import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import * as XLSX from 'xlsx';
import {
  calculateMean,
  calculateVariance,
  calculateStdDev,
  calculateMedian,
  calculateMode,
  calculateSkewness,
  calculateKurtosis,
  analyzeDistribution,
  getExpectedNormalCounts,
  calculateDistributionFitScore
} from '@/lib/statistics';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'html';
    const nameParam = searchParams.get('name');
    const sectionsParam = searchParams.get('sections');

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

    const totalStudents = ocamResults.length;
    if (totalStudents === 0) {
      return NextResponse.json({ error: 'No student data found for this module.' }, { status: 400 });
    }

    const dateFileStr = new Date().toISOString().slice(0, 10);
    const finalReportName = nameParam ? nameParam.replace(/\s+/g, '_') : `OCAM_Mark_Summary_Report_${courseCode}_${dateFileStr}`;

    const includedSections = sectionsParam ? sectionsParam.split(',') : ['summary', 'cat1', 'cat2', 'ocam', 'stats', 'preview', 'charts'];
    const showSummary = includedSections.includes('summary');
    const showCat1 = includedSections.includes('cat1');
    const showCat2 = includedSections.includes('cat2');
    const showOcam = includedSections.includes('ocam');
    const showStats = includedSections.includes('stats');
    const showPreview = includedSections.includes('preview');
    const showCharts = includedSections.includes('charts');

    // Map students data
    const studentsData = ocamResults.map(r => {
      const marks = markEntries.find(m => m.studentId === r.studentId);
      return {
        id: r.studentId,
        name: r.student.name,
        mark: r.finalOCAM || 0,
        cat1Entry1: marks?.cat1Entry1 || 0,
        cat1Entry2: marks?.cat1Entry2 || 0,
        cat2Entry1: marks?.cat2Entry1 || 0,
        cat2Entry2: marks?.cat2Entry2 || 0
      };
    });

    const eligibleCount = studentsData.filter(s => s.mark >= 35).length;
    const eligibilityPercentage = totalStudents > 0 ? Math.round((eligibleCount / totalStudents) * 100) + "%" : "0%";
    const avgOCAM = eligibleCount > 0 ? (studentsData.filter(s => s.mark >= 35).reduce((acc, curr) => acc + curr.mark, 0) / eligibleCount).toFixed(1) : "0.0";
    const notEligibleCount = studentsData.filter(s => s.mark > 0 && s.mark < 35).length;
    const absentCount = studentsData.filter(s => s.mark === 0).length;

    // CAT stats
    let cat1Sum = 0, cat2Sum = 0;
    let cat1Max = -1, cat2Max = -1;
    let cat1Min = 101, cat2Min = 101;
    let cat1Pass = 0, cat2Pass = 0;
    let cat1Fail = 0, cat2Fail = 0;

    studentsData.forEach(s => {
      const cat1 = Math.max(s.cat1Entry1 || 0, s.cat1Entry2 || 0);
      const cat2 = Math.max(s.cat2Entry1 || 0, s.cat2Entry2 || 0);

      cat1Sum += cat1;
      cat2Sum += cat2;

      if (cat1 > cat1Max) cat1Max = cat1;
      if (cat2 > cat2Max) cat2Max = cat2;

      if (cat1 < cat1Min) cat1Min = cat1;
      if (cat2 < cat2Min) cat2Min = cat2;

      if (cat1 >= 35) cat1Pass++;
      else cat1Fail++;

      if (cat2 >= 35) cat2Pass++;
      else cat2Fail++;
    });

    const cat1Avg = totalStudents > 0 ? (cat1Sum / totalStudents).toFixed(1) : "0.0";
    const cat2Avg = totalStudents > 0 ? (cat2Sum / totalStudents).toFixed(1) : "0.0";
    const finalCat1Min = cat1Min === 101 ? 0 : cat1Min;
    const finalCat2Min = cat2Min === 101 ? 0 : cat2Min;
    const finalCat1Max = cat1Max === -1 ? 0 : cat1Max;
    const finalCat2Max = cat2Max === -1 ? 0 : cat2Max;

    const filteredPassFailStudents = studentsData.map(s => ({
      id: s.id,
      name: s.name,
      originalMark: s.mark,
      adjustedMark: s.mark,
      originalStatus: s.mark >= 35 ? "Pass" : "Fail",
      adjustedStatus: s.mark >= 35 ? "Pass" : "Fail",
      offset: 0
    }));

    const totalAffected = 0;
    const promotedCount = 0;
    const demotedCount = 0;

    const origPasses = eligibleCount;
    const origPassPct = eligibilityPercentage;
    const origFailPct = totalStudents > 0 ? (100 - Math.round((eligibleCount / totalStudents) * 100)) + "%" : "0%";
    const adjPassPct = origPassPct;
    const adjFailPct = origFailPct;

    const dateStr = new Date().toLocaleString();
    const modelStr = "Default Module OCAM Calculations";

    // Gaussian Setup
    const bins = [
      { name: '0-10', min: 0, max: 10, center: 5 },
      { name: '11-20', min: 11, max: 20, center: 15 },
      { name: '21-30', min: 21, max: 30, center: 25 },
      { name: '31-40', min: 31, max: 40, center: 35 },
      { name: '41-50', min: 41, max: 50, center: 45 },
      { name: '51-60', min: 51, max: 60, center: 55 },
      { name: '61-70', min: 61, max: 70, center: 65 },
      { name: '71-80', min: 71, max: 75, center: 75 },
      { name: '81-90', min: 81, max: 90, center: 85 },
      { name: '91-100', min: 91, max: 100, center: 95 }
    ];

    const rawMarks = studentsData.map(s => s.mark);
    const mean = calculateMean(rawMarks);
    const variance = calculateVariance(rawMarks, mean);
    const stdDev = calculateStdDev(variance);
    const median = calculateMedian(rawMarks);
    const mode = calculateMode(rawMarks);
    const skewness = calculateSkewness(rawMarks, mean, stdDev);
    const kurtosis = calculateKurtosis(rawMarks, mean, stdDev);

    const origStats = { mean, stdDev, median, mode, skewness, kurtosis };
    const adjStats = { ...origStats };

    const actualCounts = bins.map(() => 0);
    rawMarks.forEach(mark => {
      const idx = bins.findIndex(b => mark >= b.min && mark <= b.max);
      if (idx !== -1) actualCounts[idx]++;
    });

    const expectedCounts = getExpectedNormalCounts(mean, stdDev, totalStudents, bins);
    const fitScore = calculateDistributionFitScore(actualCounts, expectedCounts);
    const originalFitScore = fitScore;
    const adjustedFitScore = fitScore;

    const deviationRows = bins.map((b, idx) => {
      const expected = expectedCounts[idx];
      const actual = actualCounts[idx];
      const diff = Number((actual - expected).toFixed(2));
      let status = "Aligned";
      if (diff > 1.5) status = "Overrepresented";
      else if (diff < -1.5) status = "Underrepresented";

      return {
        range: b.name,
        expected,
        actual,
        diff,
        status
      };
    });

    const chartsDataset = bins.map((b, idx) => {
      const actualCount = actualCounts[idx];
      const expectedCount = expectedCounts[idx];
      const diff = Number((actualCount - expectedCount).toFixed(2));
      return {
        name: b.name,
        ActualCount: actualCount,
        IdealCurve: expectedCount,
        Deviation: diff
      };
    });

    if (format === 'csv') {
      const csvRows = [
        ["REPORT HEADER INFORMATION"],
        ["Course Code", courseCode],
        ["Module Name", moduleName],
        ["Academic Year", academicYear],
        ["Report Generation Date & Time", dateStr],
        ["Selected OCAM Model", modelStr],
        []
      ];

      if (showSummary) {
        csvRows.push(
          ["SECTION 1: DASHBOARD SUMMARY"],
          ["Total Students", totalStudents],
          ["Eligible Students", eligibleCount],
          ["Eligibility Percentage", eligibilityPercentage],
          ["Average OCAM (Eligible)", Number(avgOCAM)],
          ["Not Eligible Students", notEligibleCount],
          ["Absent Students", absentCount],
          ["CAT 1 Average", Number(cat1Avg)],
          ["CAT 2 Average", Number(cat2Avg)],
          ["CAT 1 Maximum", finalCat1Max],
          ["CAT 1 Minimum", finalCat1Min],
          ["CAT 2 Maximum", finalCat2Max],
          ["CAT 2 Minimum", finalCat2Min],
          ["CAT 1 Pass Count (>=35)", cat1Pass],
          ["CAT 1 Fail Count (<35)", cat1Fail],
          ["CAT 2 Pass Count (>=35)", cat2Pass],
          ["CAT 2 Fail Count (<35)", cat2Fail],
          ["Total Students Affected by Adjustments", totalAffected],
          ["Fail to Pass Promoted Count", promotedCount],
          ["Pass to Fail Demoted Count", demotedCount],
          ["Original Pass Percentage", origPassPct],
          ["Original Fail Percentage", origFailPct],
          ["Updated Pass Percentage", adjPassPct],
          ["Updated Fail Percentage", adjFailPct],
          []
        );
      }

      if (showCat1) {
        csvRows.push(
          ["SECTION 2: CAT 1 COMPARISON ANALYSIS"],
          ["Student ID", "Entry 1", "Entry 2", "Difference", "Status"],
          ...studentsData.map(s => {
            const diff = (s.cat1Entry2 || 0) - (s.cat1Entry1 || 0);
            return [s.id, s.cat1Entry1, s.cat1Entry2, diff, diff > 0 ? "Improved" : diff < 0 ? "Reduced" : "No Change"];
          }),
          []
        );
      }

      if (showCat2) {
        csvRows.push(
          ["SECTION 3: CAT 2 COMPARISON ANALYSIS"],
          ["Student ID", "Entry 1", "Entry 2", "Difference", "Status"],
          ...studentsData.map(s => {
            const diff = (s.cat2Entry2 || 0) - (s.cat2Entry1 || 0);
            return [s.id, s.cat2Entry1, s.cat2Entry2, diff, diff > 0 ? "Improved" : diff < 0 ? "Reduced" : "No Change"];
          }),
          []
        );
      }

      if (showOcam) {
        csvRows.push(
          ["SECTION 4: OCAM CALCULATION ANALYSIS"],
          ["Student ID", "CAT 1 (Verified)", "CAT 2 (Verified)", "CAT 1 Weight (0.4)", "CAT 2 Weight (0.6)", "OCAM Final", "OCAM Rounded", "Eligibility"],
          ...studentsData.map(s => {
            const cat1 = Math.max(s.cat1Entry1 || 0, s.cat1Entry2 || 0);
            const cat2 = Math.max(s.cat2Entry1 || 0, s.cat2Entry2 || 0);
            const c1w = cat1 * 0.40;
            const c2w = cat2 * 0.60;
            const finalVal = c1w + c2w;
            const rounded = Math.round(finalVal);
            let elig = "No";
            if (cat1 === 0 && cat2 === 0) elig = "AB";
            else if (rounded >= 35) elig = "Yes";
            return [s.id, cat1, cat2, Number(c1w.toFixed(2)), Number(c2w.toFixed(2)), Number(finalVal.toFixed(2)), rounded, elig];
          }),
          []
        );
      }

      if (showStats) {
        csvRows.push(
          ["SECTION 5: STATISTICAL ANALYSIS (GAUSSIAN SHIFT)"],
          ["Mean (Original)", Number(origStats.mean.toFixed(2))],
          ["Mean (Adjusted)", Number(adjStats.mean.toFixed(2))],
          ["Std Deviation (Original)", Number(origStats.stdDev.toFixed(2))],
          ["Std Deviation (Adjusted)", Number(adjStats.stdDev.toFixed(2))],
          ["Original Fit Score", originalFitScore + "%"],
          ["Adjusted Fit Score", adjustedFitScore + "%"],
          ["Range", "Expected Ideal Curve", "Actual Counts", "Deviation", "Status"],
          ...deviationRows.map(r => [r.range, r.expected, r.actual, r.diff, r.status]),
          []
        );
      }

      if (showPreview) {
        csvRows.push(
          ["SECTION 6: ADJUSTED STUDENT MARKS & STATUS PREVIEW"],
          ["Student ID", "Original OCAM Mark", "Adjustment Offset", "Adjusted OCAM Mark", "Original Status", "New Status", "Status Shift"],
          ...filteredPassFailStudents.map(s => {
            const shift = s.originalStatus !== s.adjustedStatus ? (s.originalStatus === "Fail" ? "Promoted to Pass" : "Shifted to Fail") : "No Change";
            const offsetLabel = s.offset >= 0 ? "+" + s.offset.toFixed(1) : s.offset.toFixed(1);
            return [s.id, s.originalMark.toFixed(1), offsetLabel, s.adjustedMark.toFixed(1), s.originalStatus, s.adjustedStatus, shift];
          })
        );
      }

      const csvContent = csvRows.map(row => row.map(val => '"' + val + '"').join(",")).join("\n");
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv;charset=utf-8;',
          'Content-Disposition': `attachment; filename="${finalReportName}.csv"`
        }
      });
    }

    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();

      // Tab 1: Dashboard Summary
      if (showSummary) {
        const summaryData = [
          ["ACADEMIC PERFORMANCE SUMMARY EXECUTIVE REPORT", ""],
          ["Report Generation Date/Time:", dateStr],
          [],
          ["MODULE SUMMARY INFORMATION", ""],
          ["Course Code", courseCode],
          ["Module Name", moduleName],
          ["Academic Year", academicYear],
          ["Selected OCAM Model", modelStr],
          [],
          ["ENHANCED COHORT STATISTICS", ""],
          ["Total Students", totalStudents],
          ["Eligible Students", eligibleCount],
          ["Eligibility Percentage", eligibilityPercentage],
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
          ["Fail Count (<35)", cat1Fail, cat2Fail],
          [],
          ["STATUS CHANGE PREVIEW STATISTICS", ""],
          ["Total Students Affected", totalAffected],
          ["Promoted (Fail to Pass)", promotedCount],
          ["Demoted (Pass to Fail)", demotedCount],
          ["Original Pass Rate", origPassPct],
          ["Updated Pass Rate", adjPassPct]
        ];
        const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
        summaryWs['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 25 }];
        XLSX.utils.book_append_sheet(wb, summaryWs, "Dashboard Summary");
      }

      // Tab 2: CAT 1 Comparison
      if (showCat1) {
        const cat1Data = [
          ["CAT 1 ENTRY 1 VS ENTRY 2 COMPARISON LOG"],
          ["Report Generation Date/Time:", dateStr],
          [],
          ["Student ID", "Entry 1", "Entry 2", "Difference", "Status"]
        ];
        studentsData.forEach(s => {
          const diff = (s.cat1Entry2 || 0) - (s.cat1Entry1 || 0);
          cat1Data.push([s.id, s.cat1Entry1, s.cat1Entry2, diff, diff > 0 ? "Improved" : diff < 0 ? "Reduced" : "No Change"]);
        });
        const cat1Ws = XLSX.utils.aoa_to_sheet(cat1Data);
        cat1Ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, cat1Ws, "CAT 1 Comparison");
      }

      // Tab 3: CAT 2 Comparison
      if (showCat2) {
        const cat2Data = [
          ["CAT 2 ENTRY 1 VS ENTRY 2 COMPARISON LOG"],
          ["Report Generation Date/Time:", dateStr],
          [],
          ["Student ID", "Entry 1", "Entry 2", "Difference", "Status"]
        ];
        studentsData.forEach(s => {
          const diff = (s.cat2Entry2 || 0) - (s.cat2Entry1 || 0);
          cat2Data.push([s.id, s.cat2Entry1, s.cat2Entry2, diff, diff > 0 ? "Improved" : diff < 0 ? "Reduced" : "No Change"]);
        });
        const cat2Ws = XLSX.utils.aoa_to_sheet(cat2Data);
        cat2Ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, cat2Ws, "CAT 2 Comparison");
      }

      // Tab 4: OCAM Calculations
      if (showOcam) {
        const ocamData = [
          ["OCAM VERIFIED WEIGHTED SUM LOG"],
          ["Report Generation Date/Time:", dateStr],
          [],
          ["Student ID", "CAT 1 (Verified)", "CAT 2 (Verified)", "CAT 1 Weight (0.4)", "CAT 2 Weight (0.6)", "OCAM Final", "OCAM Rounded", "Eligibility"]
        ];
        studentsData.forEach(s => {
          const cat1 = Math.max(s.cat1Entry1 || 0, s.cat1Entry2 || 0);
          const cat2 = Math.max(s.cat2Entry1 || 0, s.cat2Entry2 || 0);
          const c1w = cat1 * 0.40;
          const c2w = cat2 * 0.60;
          const finalVal = c1w + c2w;
          const rounded = Math.round(finalVal);
          let elig = "No";
          if (cat1 === 0 && cat2 === 0) elig = "AB";
          else if (rounded >= 35) elig = "Yes";
          ocamData.push([s.id, cat1, cat2, Number(c1w.toFixed(2)), Number(c2w.toFixed(2)), Number(finalVal.toFixed(2)), rounded, elig]);
        });
        const ocamWs = XLSX.utils.aoa_to_sheet(ocamData);
        ocamWs['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ocamWs, "OCAM Calculation");
      }

      // Tab 5: Statistical & Adjusted Preview
      if (showStats || showPreview) {
        const statsData = [
          ["STATISTICAL CURVE ALIGNMENT & ADJUSTED MARKS PREVIEW"],
          ["Report Generation Date/Time:", dateStr],
          ["Sorting Method:", "Default Order"],
          []
        ];

        if (showStats) {
          statsData.push(
            ["GAUSSIAN DISTRIBUTION METRICS"],
            ["Metric", "Original Value", "Adjusted Value"],
            ["Mean", Number(origStats.mean.toFixed(2)), Number(adjStats.mean.toFixed(2))],
            ["Median", Number(origStats.median.toFixed(2)), Number(adjStats.median.toFixed(2))],
            ["Mode", Number(origStats.mode.toFixed(2)), Number(adjStats.mode.toFixed(2))],
            ["Standard Deviation", Number(origStats.stdDev.toFixed(2)), Number(adjStats.stdDev.toFixed(2))],
            ["Skewness", Number(origStats.skewness.toFixed(2)), Number(adjStats.skewness.toFixed(2))],
            ["Kurtosis", Number(origStats.kurtosis.toFixed(2)), Number(adjStats.kurtosis.toFixed(2))],
            ["Gaussian Fit Alignment Score", originalFitScore + "%", adjustedFitScore + "%"],
            []
          );
        }

        if (showPreview) {
          statsData.push(
            ["ADJUSTED STUDENT MARKS PREVIEW LOG"],
            ["Student ID", "Original OCAM Mark", "Adjustment Offset", "Adjusted OCAM Mark", "Original Status", "New Status", "Status Shift"]
          );
          filteredPassFailStudents.forEach(s => {
            const shift = s.originalStatus !== s.adjustedStatus ? (s.originalStatus === "Fail" ? "Promoted to Pass" : "Shifted to Fail") : "No Change";
            const offsetLabel = s.offset >= 0 ? "+" + s.offset.toFixed(1) : s.offset.toFixed(1);
            statsData.push([s.id, s.originalMark.toFixed(1), offsetLabel, s.adjustedMark.toFixed(1), s.originalStatus, s.adjustedStatus, shift]);
          });
        }

        const statsWs = XLSX.utils.aoa_to_sheet(statsData);
        statsWs['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, statsWs, "Statistical & Adjusted Marks");
      }

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${finalReportName}.xlsx"`
        }
      });
    }

    // Default: html consolidated report
    const cat1Rows = studentsData.map(s => {
      const diff = (s.cat1Entry2 || 0) - (s.cat1Entry1 || 0);
      const isImp = diff > 0;
      const isRed = diff < 0;
      return `
        <tr>
          <td>${s.id}</td>
          <td>${s.cat1Entry1.toFixed(1)}</td>
          <td>${s.cat1Entry2.toFixed(1)}</td>
          <td style="font-weight: bold; color: ${isImp ? '#10b981' : isRed ? '#ef4444' : '#6b7280'}">${diff >= 0 ? '+' : ''}${diff.toFixed(1)}</td>
          <td>
            <span class="badge ${isImp ? 'badge-pass' : isRed ? 'badge-fail' : 'badge-neutral'}">
              ${isImp ? 'Improved' : isRed ? 'Reduced' : 'No Change'}
            </span>
          </td>
        </tr>
      `;
    }).join("");

    const cat2Rows = studentsData.map(s => {
      const diff = (s.cat2Entry2 || 0) - (s.cat2Entry1 || 0);
      const isImp = diff > 0;
      const isRed = diff < 0;
      return `
        <tr>
          <td>${s.id}</td>
          <td>${s.cat2Entry1.toFixed(1)}</td>
          <td>${s.cat2Entry2.toFixed(1)}</td>
          <td style="font-weight: bold; color: ${isImp ? '#10b981' : isRed ? '#ef4444' : '#6b7280'}">${diff >= 0 ? '+' : ''}${diff.toFixed(1)}</td>
          <td>
            <span class="badge ${isImp ? 'badge-pass' : isRed ? 'badge-fail' : 'badge-neutral'}">
              ${isImp ? 'Improved' : isRed ? 'Reduced' : 'No Change'}
            </span>
          </td>
        </tr>
      `;
    }).join("");

    const ocamRows = studentsData.map(s => {
      const cat1 = Math.max(s.cat1Entry1 || 0, s.cat1Entry2 || 0);
      const cat2 = Math.max(s.cat2Entry1 || 0, s.cat2Entry2 || 0);
      const c1w = cat1 * 0.40;
      const c2w = cat2 * 0.60;
      const finalVal = c1w + c2w;
      const rounded = Math.round(finalVal);
      let elig = "No";
      if (cat1 === 0 && cat2 === 0) elig = "AB";
      else if (rounded >= 35) elig = "Yes";
      return `
        <tr>
          <td>${s.id}</td>
          <td>${cat1.toFixed(1)}</td>
          <td>${cat2.toFixed(1)}</td>
          <td>${c1w.toFixed(1)}</td>
          <td>${c2w.toFixed(1)}</td>
          <td style="font-weight: bold;">${finalVal.toFixed(1)}</td>
          <td style="font-weight: bold;">${rounded}</td>
          <td>
            <span class="badge ${elig === 'Yes' ? 'badge-pass' : elig === 'No' ? 'badge-fail' : 'badge-neutral'}">
              ${elig}
            </span>
          </td>
        </tr>
      `;
    }).join("");

    const statsRows = deviationRows.map(r => `
      <tr>
        <td>${r.range}</td>
        <td>${r.expected.toFixed(1)}</td>
        <td>${r.actual}</td>
        <td style="font-weight: bold; color: ${r.diff > 0 ? '#10b981' : r.diff < 0 ? '#ef4444' : '#6b7280'}">${r.diff >= 0 ? '+' : ''}${r.diff}</td>
        <td>
          <span class="badge ${r.status === 'Aligned' ? 'badge-neutral' : r.status === 'Overrepresented' ? 'badge-fail' : 'badge-pass'}">
            ${r.status}
          </span>
        </td>
      </tr>
    `).join("");

    const previewRows = filteredPassFailStudents.map(s => {
      const offsetLabel = s.offset >= 0 ? "+" + s.offset.toFixed(1) : s.offset.toFixed(1);
      return `
        <tr>
          <td style="font-family: monospace; font-weight: bold;">${s.id}</td>
          <td>${s.originalMark.toFixed(1)}</td>
          <td style="font-weight: bold;">${offsetLabel}</td>
          <td style="font-weight: bold;">${s.adjustedMark.toFixed(1)}</td>
          <td><span class="badge ${s.originalStatus === 'Pass' ? 'badge-pass' : 'badge-fail'}">${s.originalStatus}</span></td>
          <td><span class="badge ${s.adjustedStatus === 'Pass' ? 'badge-pass' : 'badge-fail'}">${s.adjustedStatus}</span></td>
          <td><span class="badge badge-neutral">No Change</span></td>
        </tr>
      `;
    }).join("");

    // Build navigation tabs HTML based on included sections
    let tabsHtml = "";
    if (showSummary) tabsHtml += `<button class="tab-btn active" onclick="showTab('summary')">Dashboard Summary</button>`;
    if (showCat1) tabsHtml += `<button class="tab-btn" onclick="showTab('cat1')">CAT 1 Analysis</button>`;
    if (showCat2) tabsHtml += `<button class="tab-btn" onclick="showTab('cat2')">CAT 2 Analysis</button>`;
    if (showOcam) tabsHtml += `<button class="tab-btn" onclick="showTab('ocam')">OCAM Calculation</button>`;
    if (showStats) tabsHtml += `<button class="tab-btn" onclick="showTab('statistical')">Statistical Analysis</button>`;
    if (showPreview) tabsHtml += `<button class="tab-btn" onclick="showTab('preview')">Adjusted Preview</button>`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OCAM Mark Summary Report - ${courseCode}</title>
  <style>
    :root {
      --primary: #1e3a8a;
      --primary-light: #3b82f6;
      --secondary: #0f172a;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      --bg: #f8fafc;
      --card: #ffffff;
      --border: #e2e8f0;
      --text: #1e293b;
      --text-muted: #64748b;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .header {
      background: linear-gradient(135deg, var(--secondary) 0%, #1e293b 100%);
      color: #ffffff;
      padding: 40px 24px;
      position: relative;
      border-bottom: 4px solid var(--primary-light);
    }
    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .header-title h1 {
      margin: 0 0 12px 0;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.025em;
    }
    .header-meta {
      font-size: 14px;
      color: #94a3b8;
      line-height: 1.6;
    }
    .nav-tabs {
      background: #ffffff;
      border-bottom: 1px solid var(--border);
      padding: 0 24px;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    .nav-container {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      gap: 8px;
      overflow-x: auto;
    }
    .tab-btn {
      background: none;
      border: none;
      padding: 18px 24px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      border-bottom: 3px solid transparent;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .tab-btn:hover {
      color: var(--primary);
    }
    .tab-btn.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }
    .container {
      max-width: 1200px;
      margin: 32px auto;
      padding: 0 24px;
    }
    .report-section {
      display: none;
      animation: fadeIn 0.3s ease-out;
    }
    .report-section.active {
      display: block;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.02), 0 4px 6px -2px rgba(0,0,0,0.02);
      transition: transform 0.2s;
    }
    .card:hover {
      transform: translateY(-2px);
    }
    .card-title {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--text-muted);
      margin-bottom: 8px;
      letter-spacing: 0.05em;
    }
    .card-value {
      font-size: 28px;
      font-weight: 800;
      color: var(--secondary);
    }
    .card-accent-success { border-left: 4px solid var(--success); }
    .card-accent-danger { border-left: 4px solid var(--danger); }
    .card-accent-primary { border-left: 4px solid var(--primary-light); }
    .card-accent-warning { border-left: 4px solid var(--warning); }
    
    .chart-container {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 32px;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.02);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      font-size: 13.5px;
      margin-bottom: 32px;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.02);
    }
    th {
      background: #f8fafc;
      color: var(--secondary);
      font-weight: 700;
      padding: 14px 20px;
      text-align: left;
      border-bottom: 2px solid var(--border);
    }
    td {
      padding: 14px 20px;
      border-bottom: 1px solid var(--border);
      color: var(--text);
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-pass { background: #d1fae5; color: #065f46; }
    .badge-fail { background: #fee2e2; color: #991b1b; }
    .badge-neutral { background: #f1f5f9; color: #475569; }
    
    .btn-print {
      background: var(--primary-light);
      color: #ffffff;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2);
      transition: all 0.2s;
    }
    .btn-print:hover {
      background: #2563eb;
      transform: translateY(-1px);
    }
    .section-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 20px;
      color: var(--secondary);
      border-bottom: 2px solid var(--border);
      padding-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    @media print {
      * {
        animation: none !important;
        transition: none !important;
        box-shadow: none !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        background: #ffffff !important;
        color: #000000 !important;
      }
      .nav-tabs, .btn-print, button {
        display: none !important;
      }
      .header {
        background: #f8fafc !important;
        color: #000000 !important;
        border-bottom: 3px solid #cbd5e1 !important;
        padding: 24px !important;
      }
      .header-meta {
        color: #475569 !important;
      }
      .container {
        max-width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        display: block !important;
      }
      .report-section {
        display: block !important;
        opacity: 1 !important;
        visibility: visible !important;
        page-break-before: always !important;
        break-before: page !important;
        margin-bottom: 40px !important;
      }
      .report-section:first-of-type {
        page-break-before: avoid !important;
        break-before: avoid !important;
      }
      .grid {
        display: block !important;
      }
      .card {
        display: inline-block !important;
        width: 30% !important;
        margin: 1% !important;
        vertical-align: top !important;
        border: 1px solid #cbd5e1 !important;
        background: #ffffff !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .chart-container {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      canvas {
        max-height: 250px !important;
      }
      table {
        width: 100% !important;
        border: 1px solid #cbd5e1 !important;
        border-collapse: collapse !important;
        page-break-inside: auto !important;
        overflow: visible !important;
      }
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      th, td {
        border: 1px solid #cbd5e1 !important;
        padding: 8px 12px !important;
      }
      .badge {
        border: 1px solid #cbd5e1 !important;
      }
      .badge-pass { background-color: #d1fae5 !important; color: #065f46 !important; }
      .badge-fail { background-color: #fee2e2 !important; color: #991b1b !important; }
      .badge-neutral { background-color: #f1f5f9 !important; color: #475569 !important; }
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    function showTab(tabId) {
      document.querySelectorAll('.report-section').forEach(sec => sec.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      event.target.classList.add('active');
    }
  </script>
</head>
<body>
  <div class="header">
    <div class="header-content">
      <div class="header-title">
        <h1>Academic Dashboard General Executive Report</h1>
        <div class="header-meta">
          <strong>Institution:</strong> MyOCAM Academy &nbsp;|&nbsp;
          <strong>Course Code:</strong> ${courseCode} &nbsp;|&nbsp;
          <strong>Module Name:</strong> ${moduleName} &nbsp;|&nbsp;
          <strong>Academic Year:</strong> ${academicYear} <br />
          <strong>Selected OCAM Model:</strong> ${modelStr} &nbsp;|&nbsp;
          <strong>Generated:</strong> ${dateStr}
        </div>
      </div>
      <button class="btn-print" onclick="window.print()">Print Report / Save PDF</button>
    </div>
  </div>

  <div class="nav-tabs">
    <div class="nav-container">
      ${tabsHtml}
    </div>
  </div>

  <div class="container">
    <!-- SECTION 1: Dashboard Summary -->
    ${showSummary ? `
    <div id="summary" class="report-section active">
      <h2 class="section-title">Cohort Executive Summary</h2>
      <div class="grid">
        <div class="card card-accent-primary">
          <div class="card-title">Total Students</div>
          <div class="card-value">${totalStudents}</div>
        </div>
        <div class="card card-accent-success">
          <div class="card-title">Eligible Students</div>
          <div class="card-value">${eligibleCount}</div>
        </div>
        <div class="card card-accent-success">
          <div class="card-title">Eligibility Rate</div>
          <div class="card-value">${eligibilityPercentage}</div>
        </div>
        <div class="card card-accent-warning">
          <div class="card-title">Average OCAM (Eligible)</div>
          <div class="card-value">${Number(avgOCAM).toFixed(1)}</div>
        </div>
        <div class="card card-accent-danger">
          <div class="card-title">Not Eligible</div>
          <div class="card-value">${notEligibleCount}</div>
        </div>
        <div class="card card-accent-warning">
          <div class="card-title">Absent Students</div>
          <div class="card-value">${absentCount}</div>
        </div>
        <div class="card card-accent-primary">
          <div class="card-title">CAT 1 Average</div>
          <div class="card-value">${cat1Avg}</div>
        </div>
        <div class="card card-accent-primary">
          <div class="card-title">CAT 2 Average</div>
          <div class="card-value">${cat2Avg}</div>
        </div>
        <div class="card card-accent-warning">
          <div class="card-title">Pass Changes (Promoted)</div>
          <div class="card-value" style="color: var(--success);">${promotedCount}</div>
        </div>
      </div>

      ${showCharts ? `
      <div class="chart-container">
        <canvas id="catChart" style="max-height: 380px; width: 100%;"></canvas>
      </div>
      ` : ''}

      <h2 class="section-title">CAT Performance Overview</h2>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>CAT 1 (Verified)</th>
            <th>CAT 2 (Verified)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Average Mark</td>
            <td style="font-weight: bold; color: var(--primary);">${Number(cat1Avg).toFixed(1)}</td>
            <td style="font-weight: bold; color: #8b5cf6;">${Number(cat2Avg).toFixed(1)}</td>
          </tr>
          <tr>
            <td>Maximum Mark</td>
            <td>${finalCat1Max}</td>
            <td>${finalCat2Max}</td>
          </tr>
          <tr>
            <td>Minimum Mark</td>
            <td>${finalCat1Min}</td>
            <td>${finalCat2Min}</td>
          </tr>
          <tr>
            <td>Pass Count (>=35)</td>
            <td style="color: var(--success); font-weight: 600;">${cat1Pass}</td>
            <td style="color: var(--success); font-weight: 600;">${cat2Pass}</td>
          </tr>
          <tr>
            <td>Fail Count (<35)</td>
            <td style="color: var(--danger); font-weight: 600;">${cat1Fail}</td>
            <td style="color: var(--danger); font-weight: 600;">${cat2Fail}</td>
          </tr>
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- SECTION 2: CAT 1 Analysis -->
    ${showCat1 ? `
    <div id="cat1" class="report-section ${!showSummary ? 'active' : ''}">
      <h2 class="section-title">CAT 1 Entry 1 vs Entry 2 Performance Analysis</h2>
      <table>
        <thead>
          <tr>
            <th>Student Registration Number</th>
            <th>CAT 1 Entry 1</th>
            <th>CAT 1 Entry 2</th>
            <th>Difference</th>
            <th>Status Trend</th>
          </tr>
        </thead>
        <tbody>
          ${cat1Rows}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- SECTION 3: CAT 2 Analysis -->
    ${showCat2 ? `
    <div id="cat2" class="report-section ${!showSummary && !showCat1 ? 'active' : ''}">
      <h2 class="section-title">CAT 2 Entry 1 vs Entry 2 Performance Analysis</h2>
      <table>
        <thead>
          <tr>
            <th>Student Registration Number</th>
            <th>CAT 2 Entry 1</th>
            <th>CAT 2 Entry 2</th>
            <th>Difference</th>
            <th>Status Trend</th>
          </tr>
        </thead>
        <tbody>
          ${cat2Rows}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- SECTION 4: OCAM Calculation -->
    ${showOcam ? `
    <div id="ocam" class="report-section ${!showSummary && !showCat1 && !showCat2 ? 'active' : ''}">
      <h2 class="section-title">OCAM Weighted Calculation Log</h2>
      <table>
        <thead>
          <tr>
            <th>Student Registration Number</th>
            <th>CAT 1 Mark (Verified)</th>
            <th>CAT 2 Mark (Verified)</th>
            <th>CAT 1 Weight (x0.4)</th>
            <th>CAT 2 Weight (x0.6)</th>
            <th>OCAM Final</th>
            <th>OCAM Rounded</th>
            <th>Eligibility</th>
          </tr>
        </thead>
        <tbody>
          ${ocamRows}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- SECTION 5: Statistical Analysis -->
    ${showStats ? `
    <div id="statistical" class="report-section ${!showSummary && !showCat1 && !showCat2 && !showOcam ? 'active' : ''}">
      <h2 class="section-title">Gaussian Curve Fit & Skewness Analysis</h2>
      <div class="grid">
        <div class="card card-accent-primary">
          <div class="card-title">Original Fit Score</div>
          <div class="card-value">${originalFitScore}%</div>
        </div>
        <div class="card card-accent-success">
          <div class="card-title">Adjusted Fit Score</div>
          <div class="card-value">${adjustedFitScore}%</div>
        </div>
        <div class="card">
          <div class="card-title">Original Mean</div>
          <div class="card-value">${origStats.mean.toFixed(2)}</div>
        </div>
        <div class="card text-accent-success">
          <div class="card-title">Adjusted Mean</div>
          <div class="card-value">${adjStats.mean.toFixed(2)}</div>
        </div>
      </div>

      ${showCharts ? `
      <div class="chart-container">
        <canvas id="gaussianChart" style="max-height: 380px; width: 100%;"></canvas>
      </div>
      ` : ''}

      <h2 class="section-title">Mark Range Expected Normal Distribution</h2>
      <table>
        <thead>
          <tr>
            <th>Mark Range</th>
            <th>Expected Ideal Curve Count</th>
            <th>Actual Cohort Counts</th>
            <th>Deviation Offset</th>
            <th>Distribution Status</th>
          </tr>
        </thead>
        <tbody>
          ${statsRows}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- SECTION 6: Adjusted Preview -->
    ${showPreview ? `
    <div id="preview" class="report-section ${!showSummary && !showCat1 && !showCat2 && !showOcam && !showStats ? 'active' : ''}">
      <h2 class="section-title">Adjusted Student Marks & Status Shift Logs</h2>
      
      <div class="grid" style="margin-bottom: 24px;">
        <div class="card">
          <div class="card-title">Total Records Impacted</div>
          <div class="card-value">${totalAffected}</div>
        </div>
        <div class="card card-accent-success">
          <div class="card-title">Promoted (Fail ➔ Pass)</div>
          <div class="card-value">${promotedCount}</div>
        </div>
        <div class="card card-accent-danger">
          <div class="card-title">Demoted (Pass ➔ Fail)</div>
          <div class="card-value">${demotedCount}</div>
        </div>
      </div>

      <div style="background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); display: flex; flex-wrap: wrap; gap: 24px;">
        <div>
          <span style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: var(--text-muted); display: block;">Original Pass/Fail Rate</span>
          <span style="font-size: 16px; font-weight: 700; color: var(--secondary);">Pass: ${origPassPct} | Fail: ${origFailPct}</span>
        </div>
        <div style="border-left: 2px solid var(--border); padding-left: 24px;">
          <span style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: var(--text-muted); display: block;">Adjusted Pass/Fail Rate</span>
          <span style="font-size: 16px; font-weight: 700; color: var(--success);">Pass: ${adjPassPct} | Fail: ${adjFailPct}</span>
        </div>
        <div style="border-left: 2px solid var(--border); padding-left: 24px;">
          <span style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: var(--text-muted); display: block;">Active sorting order</span>
          <span style="font-size: 16px; font-weight: 700; color: var(--primary-light);">Default Order</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Student Registration Number</th>
            <th>Original OCAM Mark</th>
            <th>Applied Adjustment Offset</th>
            <th>Adjusted OCAM Mark</th>
            <th>Original Status</th>
            <th>Projected Status</th>
            <th>Status Shift Details</th>
          </tr>
        </thead>
        <tbody>
          ${previewRows}
        </tbody>
      </table>
    </div>
    ` : ''}
  </div>

  <script>
    const chartData = ${JSON.stringify(chartsDataset)};
    
    window.onload = function() {
      if (typeof Chart !== 'undefined') {
        // CAT performance comparison
        ${showSummary && showCharts ? `
        const catCtx = document.getElementById('catChart').getContext('2d');
        new Chart(catCtx, {
          type: 'bar',
          data: {
            labels: ['Average Mark', 'Maximum Mark', 'Minimum Mark', 'Pass Count', 'Fail Count'],
            datasets: [
              {
                label: 'CAT 1',
                data: [${cat1Avg}, ${finalCat1Max}, ${finalCat1Min}, ${cat1Pass}, ${cat1Fail}],
                backgroundColor: 'rgba(30, 58, 138, 0.75)',
                borderColor: '#1e3a8a',
                borderWidth: 1.5,
                borderRadius: 6
              },
              {
                label: 'CAT 2',
                data: [${cat2Avg}, ${finalCat2Max}, ${finalCat2Min}, ${cat2Pass}, ${cat2Fail}],
                backgroundColor: 'rgba(139, 92, 246, 0.75)',
                borderColor: '#8b5cf6',
                borderWidth: 1.5,
                borderRadius: 6
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'top', labels: { font: { weight: 'bold' } } },
              title: { display: true, text: 'CAT 1 vs CAT 2 Key Performance Profile', font: { size: 16, weight: 'bold' } }
            },
            scales: {
              y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
              x: { grid: { display: false } }
            }
          }
        });
        ` : ''}

        // Gaussian Bell curve
        ${showStats && showCharts ? `
        const gaussCtx = document.getElementById('gaussianChart').getContext('2d');
        new Chart(gaussCtx, {
          type: 'bar',
          data: {
            labels: chartData.map(d => d.name),
            datasets: [
              {
                label: 'Actual Cohort Count',
                data: chartData.map(d => d.ActualCount),
                backgroundColor: 'rgba(59, 130, 246, 0.65)',
                borderColor: '#3b82f6',
                borderWidth: 1.5,
                borderRadius: 4,
                order: 2
              },
              {
                label: 'Ideal Normal Curve',
                data: chartData.map(d => d.IdealCurve),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.05)',
                type: 'line',
                fill: true,
                tension: 0.35,
                borderWidth: 3,
                order: 1
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'top', labels: { font: { weight: 'bold' } } },
              title: { display: true, text: 'Gaussian Curve Alignment (Actual vs Expected)', font: { size: 16, weight: 'bold' } }
            },
            scales: {
              y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
              x: { grid: { display: false } }
            }
          }
        });
        ` : ''}
      }
    };
  </script>
</body>
</html>
    `;

    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html;charset=utf-8;',
        'Content-Disposition': `attachment; filename="${finalReportName}.html"`
      }
    });

  } catch (error) {
    console.error("Export Error:", error);
    return NextResponse.json({ error: 'Failed to generate report: ' + error.message }, { status: 500 });
  }
}
