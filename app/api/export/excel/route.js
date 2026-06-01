import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    let selectedModuleId = cookieStore.get('selectedModuleId')?.value;

    if (!selectedModuleId) {
      const latestModule = await prisma.module.findFirst({ orderBy: { createdAt: 'desc' } });
      if (latestModule) {
        selectedModuleId = latestModule.id;
      }
    } else if (selectedModuleId === 'all') {
      selectedModuleId = undefined;
    }
    const moduleFilter = selectedModuleId ? { moduleId: selectedModuleId } : {};

    const markEntries = await prisma.markEntry.findMany({
      where: moduleFilter,
      include: { student: true, module: true }
    });

    const ocamResults = await prisma.oCAMResult.findMany({
      where: moduleFilter,
      include: { student: true, module: true }
    });

    let moduleName = "All Modules";
    if (selectedModuleId) {
      const mod = await prisma.module.findUnique({ where: { id: selectedModuleId } });
      if (mod) {
        moduleName = `${mod.courseCode} - ${mod.name}`;
      }
    }

    // Compute Summary Stats
    const totalStudents = ocamResults.length;
    const eligible = ocamResults.filter(r => r.passFail === "Yes");
    const eligibleCount = eligible.length;
    const avgOCAM = eligibleCount > 0 ? (eligible.reduce((acc, curr) => acc + (curr.finalOCAM || 0), 0) / eligibleCount).toFixed(1) : "0.0";
    const eligiblePercentage = totalStudents > 0 ? `${Math.round((eligibleCount / totalStudents) * 100)}%` : "0%";
    const notEligibleCount = ocamResults.filter(r => r.passFail === "No").length;
    const absentCount = ocamResults.filter(r => r.passFail === "AB").length;

    // CAT marks analysis
    let cat1Sum = 0, cat2Sum = 0;
    let cat1Max = -1, cat2Max = -1;
    let cat1Min = 101, cat2Min = 101;
    let cat1Pass = 0, cat2Pass = 0;
    let cat1Fail = 0, cat2Fail = 0;
    let totalValidCAT1 = 0, totalValidCAT2 = 0;

    markEntries.forEach(m => {
      const cat1 = Math.max(m.cat1Entry1 || 0, m.cat1Entry2 || 0);
      const cat2 = Math.max(m.cat2Entry1 || 0, m.cat2Entry2 || 0);

      cat1Sum += cat1;
      cat2Sum += cat2;
      totalValidCAT1++;
      totalValidCAT2++;

      if (cat1 > cat1Max) cat1Max = cat1;
      if (cat2 > cat2Max) cat2Max = cat2;

      if (cat1 < cat1Min) cat1Min = cat1;
      if (cat2 < cat2Min) cat2Min = cat2;

      if (cat1 >= 35) cat1Pass++;
      else cat1Fail++;

      if (cat2 >= 35) cat2Pass++;
      else cat2Fail++;
    });

    const cat1Avg = totalValidCAT1 > 0 ? (cat1Sum / totalValidCAT1).toFixed(1) : "0.0";
    const cat2Avg = totalValidCAT2 > 0 ? (cat2Sum / totalValidCAT2).toFixed(1) : "0.0";
    const finalCat1Min = cat1Min === 101 ? 0 : cat1Min;
    const finalCat2Min = cat2Min === 101 ? 0 : cat2Min;
    const finalCat1Max = cat1Max === -1 ? 0 : cat1Max;
    const finalCat2Max = cat2Max === -1 ? 0 : cat2Max;

    const summaryData = [
      { "Metric": "Module Name", "Value": moduleName },
      { "Metric": "Total Students", "Value": totalStudents },
      { "Metric": "Eligible Students", "Value": eligibleCount },
      { "Metric": "Avg OCAM (Eligible)", "Value": Number(avgOCAM) },
      { "Metric": "Eligible Percentage", "Value": eligiblePercentage },
      { "Metric": "Not Eligible Students", "Value": notEligibleCount },
      { "Metric": "Absent Students", "Value": absentCount },
      { "Metric": "", "Value": "" },
      { "Metric": "CAT MARKS ANALYSIS", "Value": "" },
      { "Metric": "CAT 1 Average", "Value": Number(cat1Avg) },
      { "Metric": "CAT 2 Average", "Value": Number(cat2Avg) },
      { "Metric": "CAT 1 Maximum", "Value": finalCat1Max },
      { "Metric": "CAT 2 Maximum", "Value": finalCat2Max },
      { "Metric": "CAT 1 Minimum", "Value": finalCat1Min },
      { "Metric": "CAT 2 Minimum", "Value": finalCat2Min },
      { "Metric": "CAT 1 Pass Count (>=35)", "Value": cat1Pass },
      { "Metric": "CAT 2 Pass Count (>=35)", "Value": cat2Pass },
      { "Metric": "CAT 1 Fail Count (<35)", "Value": cat1Fail },
      { "Metric": "CAT 2 Fail Count (<35)", "Value": cat2Fail }
    ];

    const wb = XLSX.utils.book_new();

    // 0. Summary Sheet
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Dashboard Summary");

    // 1. Raw Data Entry Sheet
    const rawData = markEntries.map(e => ({
      'Registration Number': e.studentId,
      'Module': e.module.courseCode,
      'CAT1 Entry 1': e.cat1Entry1,
      'CAT1 Entry 2': e.cat1Entry2,
      'CAT2 Entry 1': e.cat2Entry1,
      'CAT2 Entry 2': e.cat2Entry2,
    }));
    const rawSheet = XLSX.utils.json_to_sheet(rawData);
    XLSX.utils.book_append_sheet(wb, rawSheet, "Raw Data Entry");

    // 2. CAT 1 Comparison
    const cat1Data = markEntries.map(e => {
      const diff = (e.cat1Entry2 || 0) - (e.cat1Entry1 || 0);
      return {
        'Registration Number': e.studentId,
        'Entry 1': e.cat1Entry1,
        'Entry 2': e.cat1Entry2,
        'Difference': diff,
        'Status': diff > 0 ? 'Improved' : diff < 0 ? 'Reduced' : 'No Change'
      };
    });
    const cat1Sheet = XLSX.utils.json_to_sheet(cat1Data);
    XLSX.utils.book_append_sheet(wb, cat1Sheet, "CAT 1 Comparison");

    // 3. CAT 2 Comparison
    const cat2Data = markEntries.map(e => {
      const diff = (e.cat2Entry2 || 0) - (e.cat2Entry1 || 0);
      return {
        'Registration Number': e.studentId,
        'Entry 1': e.cat2Entry1,
        'Entry 2': e.cat2Entry2,
        'Difference': diff,
        'Status': diff > 0 ? 'Improved' : diff < 0 ? 'Reduced' : 'No Change'
      };
    });
    const cat2Sheet = XLSX.utils.json_to_sheet(cat2Data);
    XLSX.utils.book_append_sheet(wb, cat2Sheet, "CAT 2 Comparison");

    // 4. OCAM Calculations
    const ocamData = markEntries.map(markEntry => {
      const ocamResult = ocamResults.find(o => o.moduleId === markEntry.moduleId && o.studentId === markEntry.studentId);
      
      const cat1 = Math.max(markEntry.cat1Entry1 || 0, markEntry.cat1Entry2 || 0);
      const cat2 = Math.max(markEntry.cat2Entry1 || 0, markEntry.cat2Entry2 || 0);
      
      const cat1Weight = cat1 * 0.40;
      const cat2Weight = cat2 * 0.60;
      const ocamFinal = cat1Weight + cat2Weight;
      const ocamRounded = Math.round(ocamFinal);
      
      let eligibility = "No";
      if (cat1 === 0 && cat2 === 0) eligibility = "AB";
      else if (ocamRounded >= 35) eligibility = "Yes";

      return {
        'Registration No.': markEntry.studentId,
        'CAT 1 Mark (Verified)': cat1,
        'CAT 2 Mark (Verified)': cat2,
        'CAT1 Weight (×0.40)': Number(cat1Weight.toFixed(1)),
        'CAT2 Weight (×0.60)': Number(cat2Weight.toFixed(1)),
        'OCAM Final': Number(ocamFinal.toFixed(1)),
        'OCAM Rounded': ocamRounded,
        'Eligibility': eligibility
      };
    });
    const ocamSheet = XLSX.utils.json_to_sheet(ocamData);
    XLSX.utils.book_append_sheet(wb, ocamSheet, "OCAM Calculation");

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Academic_Management_Report.xlsx"'
      }
    });
  } catch (error) {
    console.error("Export Error:", error);
    return NextResponse.json({ error: 'Failed to generate Excel report' }, { status: 500 });
  }
}
