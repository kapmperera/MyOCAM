import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const markEntries = await prisma.markEntry.findMany({
      include: { student: true, module: true }
    });

    const ocamResults = await prisma.oCAMResult.findMany({
      include: { student: true, module: true }
    });

    const wb = XLSX.utils.book_new();

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
