import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseXMLData, calculateOCAM } from '@/lib/data-processor';

export async function POST(request) {
  try {
    const formData = await request.formData();
    
    // Form fields
    const courseCode = formData.get('courseCode');
    const moduleName = formData.get('moduleName');
    const academicYear = formData.get('academicYear');
    const semester = formData.get('semester');
    
    // Files
    const cat1Entry1File = formData.get('cat1Entry1');
    const cat1Entry2File = formData.get('cat1Entry2');
    const cat2Entry1File = formData.get('cat2Entry1');
    const cat2Entry2File = formData.get('cat2Entry2');

    if (!cat1Entry1File || !cat1Entry2File || !cat2Entry1File || !cat2Entry2File) {
      return NextResponse.json({ error: 'All 4 XML files are required.' }, { status: 400 });
    }

    // Read file contents
    const xmlTexts = await Promise.all([
      cat1Entry1File.text(),
      cat1Entry2File.text(),
      cat2Entry1File.text(),
      cat2Entry2File.text(),
    ]);

    // Parse XML
    const c1e1 = parseXMLData(xmlTexts[0]);
    const c1e2 = parseXMLData(xmlTexts[1]);
    const c2e1 = parseXMLData(xmlTexts[2]);
    const c2e2 = parseXMLData(xmlTexts[3]);

    // Create or find Module
    let dbModule = await prisma.module.findFirst({
      where: { courseCode, academicYear, semester }
    });

    if (!dbModule) {
      dbModule = await prisma.module.create({
        data: { courseCode, name: moduleName, academicYear, semester }
      });
    }

    // Map all unique student IDs across all files
    const allStudentsMap = new Map();
    
    const addToMap = (dataArray, entryKey) => {
      dataArray.forEach(s => {
        if (!allStudentsMap.has(s.id)) {
          allStudentsMap.set(s.id, { id: s.id, name: s.name, marks: {} });
        }
        allStudentsMap.get(s.id).marks[entryKey] = s.mark;
        // Keep the best name
        if (s.name && s.name !== "Unknown") allStudentsMap.get(s.id).name = s.name;
      });
    };

    addToMap(c1e1, 'cat1_1');
    addToMap(c1e2, 'cat1_2');
    addToMap(c2e1, 'cat2_1');
    addToMap(c2e2, 'cat2_2');

    // Process each student and insert to DB
    const results = [];
    
    for (const [id, sData] of allStudentsMap.entries()) {
      // Upsert Student
      const student = await prisma.student.upsert({
        where: { id: sData.id },
        update: { name: sData.name },
        create: { id: sData.id, name: sData.name, intake: academicYear }
      });

      // Upsert MarkEntry
      const markEntry = await prisma.markEntry.upsert({
        where: { studentId_moduleId: { studentId: student.id, moduleId: dbModule.id } },
        update: {
          cat1Entry1: sData.marks.cat1_1 ?? null,
          cat1Entry2: sData.marks.cat1_2 ?? null,
          cat2Entry1: sData.marks.cat2_1 ?? null,
          cat2Entry2: sData.marks.cat2_2 ?? null,
        },
        create: {
          studentId: student.id,
          moduleId: dbModule.id,
          cat1Entry1: sData.marks.cat1_1 ?? null,
          cat1Entry2: sData.marks.cat1_2 ?? null,
          cat2Entry1: sData.marks.cat2_1 ?? null,
          cat2Entry2: sData.marks.cat2_2 ?? null,
        }
      });

      // Calculate OCAM
      const ocamData = calculateOCAM(
        markEntry.cat1Entry1, markEntry.cat1Entry2,
        markEntry.cat2Entry1, markEntry.cat2Entry2
      );

      // Upsert OCAMResult
      await prisma.oCAMResult.upsert({
        where: { studentId_moduleId: { studentId: student.id, moduleId: dbModule.id } },
        update: {
          finalOCAM: ocamData.finalOCAM,
          grade: ocamData.grade,
          passFail: ocamData.passFail
        },
        create: {
          studentId: student.id,
          moduleId: dbModule.id,
          finalOCAM: ocamData.finalOCAM,
          grade: ocamData.grade,
          passFail: ocamData.passFail
        }
      });
      
      results.push(student.id);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully processed ${results.length} student records.`,
      moduleId: dbModule.id
    });

  } catch (error) {
    console.error("Upload API Error:", error);
    return NextResponse.json({ error: error.message || 'Internal server error during upload.' }, { status: 500 });
  }
}
