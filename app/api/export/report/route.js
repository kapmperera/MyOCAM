import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'xlsx';

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
    let courseCode = "N/A";
    let academicYear = "N/A";
    
    if (selectedModuleId) {
      const mod = await prisma.module.findUnique({ where: { id: selectedModuleId } });
      if (mod) {
        moduleName = mod.name;
        courseCode = mod.courseCode;
        academicYear = mod.academicYear;
      }
    }

    // Compute stats
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

    const dateStr = new Date().toLocaleString();

    if (format === 'csv') {
      const csvData = [
        ["Report Property", "Value"],
        ["Report Title", "Academic Dashboard General Executive Report"],
        ["Generation Date & Time", dateStr],
        ["Course Code", courseCode],
        ["Module Name", moduleName],
        ["Academic Year", academicYear],
        [],
        ["Cohort Statistics", ""],
        ["Total Students", totalStudents],
        ["Eligible Students", eligibleCount],
        ["Eligibility Percentage", eligiblePercentage],
        ["Average OCAM (Eligible)", Number(avgOCAM)],
        ["Not Eligible Students", notEligibleCount],
        ["Absent Students", absentCount],
        [],
        ["CAT 1 Performance Marks", ""],
        ["CAT 1 Average", Number(cat1Avg)],
        ["CAT 1 Maximum", finalCat1Max],
        ["CAT 1 Minimum", finalCat1Min],
        ["CAT 1 Pass Count (>=35)", cat1Pass],
        ["CAT 1 Fail Count (<35)", cat1Fail],
        [],
        ["CAT 2 Performance Marks", ""],
        ["CAT 2 Average", Number(cat2Avg)],
        ["CAT 2 Maximum", finalCat2Max],
        ["CAT 2 Minimum", finalCat2Min],
        ["CAT 2 Pass Count (>=35)", cat2Pass],
        ["CAT 2 Fail Count (<35)", cat2Fail]
      ];

      const csvContent = csvData.map(row => row.map(val => `"${val}"`).join(",")).join("\n");

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv;charset=utf-8;',
          'Content-Disposition': `attachment; filename="Academic_Management_Report_${courseCode.replace(/\s+/g, '_')}.csv"`
        }
      });
    }

    // Default: XLSX
    const xlsxData = [
      ["ACADEMIC PERFORMANCE SUMMARY EXECUTIVE REPORT", ""],
      ["Report Generation Date/Time:", dateStr],
      [],
      ["MODULE SUMMARY INFORMATION", ""],
      ["Course Code", courseCode],
      ["Module Name", moduleName],
      ["Academic Year", academicYear],
      [],
      ["ENHANCED COHORT STATISTICS", ""],
      ["Total Students", totalStudents],
      ["Eligible Students", eligibleCount],
      ["Eligibility Percentage", eligiblePercentage],
      ["Average OCAM (Eligible)", Number(avgOCAM)],
      ["Not Eligible Students", notEligibleCount],
      ["Absent Students", absentCount],
      [],
      ["CAT PERFORMANCE COMPARATIVE ANALYSIS", ""],
      ["Metric", "CAT 1 (Verified)", "CAT 2 (Verified)"],
      ["Average Mark", Number(cat1Avg), Number(cat2Avg)],
      ["Maximum Mark", finalCat1Max, finalCat2Max],
      ["Minimum Mark", finalCat1Min, finalCat2Min],
      ["Pass Count (>=35)", cat1Pass, cat2Pass],
      ["Fail Count (<35)", cat1Fail, cat2Fail]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(xlsxData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 35 },
      { wch: 25 },
      { wch: 25 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Executive Dashboard Summary");

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Academic_Management_Report_${courseCode.replace(/\s+/g, '_')}.xlsx"`
      }
    });
  } catch (error) {
    console.error("Export Error:", error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
