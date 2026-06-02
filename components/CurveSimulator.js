"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  AreaChart,
  Area,
  LineChart
} from "recharts";
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
  calculateDistributionFitScore,
  calculateOptimalUniformCohortAdjustment,
  calculateStudentLevelAdjustmentOffsets,
  normalCdf,
  calculateTargetPassFailAdjustment
} from "@/lib/statistics";
import { Search, FileText, CheckCircle2, AlertTriangle, TrendingUp, BarChart2, Settings2, Users, Percent, Download, Award, ShieldAlert, Sparkles } from "lucide-react";

export default function CurveSimulator({ studentsData = [] }) {
  // Mode selection: "gaussian" | "passfail"
  const [activeMode, setActiveMode] = useState("gaussian");

  // Extract raw marks from students list
  const rawMarks = useMemo(() => studentsData.map(s => s.mark), [studentsData]);
  const N = rawMarks.length;

  // -- Gaussian Solver States --
  const [constantAdd, setConstantAdd] = useState(0);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [activeTab, setActiveTab] = useState("histogram"); // histogram | deviation | cdf | frequency
  const [searchQuery, setSearchQuery] = useState("");
  const [studentPage, setStudentPage] = useState(0);
  const itemsPerPage = 8;

  // -- Pass/Fail Target Solver States --
  const currentPasses = useMemo(() => rawMarks.filter(m => m >= 35).length, [rawMarks]);
  const initialPassRate = useMemo(() => N > 0 ? Number(((currentPasses / N) * 100).toFixed(1)) : 0, [currentPasses, N]);
  const [targetPassRate, setTargetPassRate] = useState(initialPassRate);
  const [passFailSearchQuery, setPassFailSearchQuery] = useState("");
  const [passFailPage, setPassFailPage] = useState(0);
  const [sortPassFailByShift, setSortPassFailByShift] = useState(false);
  const [passFailItemsPerPage, setPassFailItemsPerPage] = useState(10);

  // Sync sliders
  const handlePassRateChange = (val) => {
    setTargetPassRate(val);
    setPassFailPage(0);
  };

  // Base Bins Definition
  const bins = useMemo(() => [
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
  ], []);

  // Compute Adjusted Marks (Gaussian)
  const adjustedMarks = useMemo(() => {
    return rawMarks.map(m => {
      let adj = (m * scaleFactor) + constantAdd;
      return Math.min(100, Math.max(0, Number(adj.toFixed(1))));
    });
  }, [rawMarks, constantAdd, scaleFactor]);

  // Pass/Fail calculations
  const passFailSolverResult = useMemo(() => {
    return calculateTargetPassFailAdjustment(rawMarks, targetPassRate, 35);
  }, [rawMarks, targetPassRate]);

  // Projected marks based on Pass/Fail Target Solver
  const passFailProjectedMarks = useMemo(() => {
    return rawMarks.map(m => {
      return Math.min(100, Math.max(0, Number((m + passFailSolverResult.adjustment).toFixed(1))));
    });
  }, [rawMarks, passFailSolverResult]);

  const projectedPasses = useMemo(() => {
    return passFailProjectedMarks.filter(m => m >= 35).length;
  }, [passFailProjectedMarks]);

  const diffStudentsCount = useMemo(() => {
    return projectedPasses - currentPasses;
  }, [projectedPasses, currentPasses]);

  // Expected vs actual calculations (Gaussian)
  const actualBinsData = useMemo(() => {
    const origCounts = bins.map(() => 0);
    const adjCounts = bins.map(() => 0);
    
    rawMarks.forEach(m => {
      const idx = bins.findIndex(b => m >= b.min && m <= b.max);
      if (idx !== -1) origCounts[idx]++;
    });

    adjustedMarks.forEach(m => {
      const idx = bins.findIndex(b => m >= b.min && m <= b.max);
      if (idx !== -1) adjCounts[idx]++;
    });

    return { origCounts, adjCounts };
  }, [rawMarks, adjustedMarks, bins]);

  // Original Stats
  const origStats = useMemo(() => {
    const mean = calculateMean(rawMarks);
    const variance = calculateVariance(rawMarks, mean);
    const stdDev = calculateStdDev(variance);
    return {
      mean,
      median: calculateMedian(rawMarks),
      mode: calculateMode(rawMarks),
      stdDev,
      skewness: calculateSkewness(rawMarks, mean, stdDev),
      kurtosis: calculateKurtosis(rawMarks, mean, stdDev)
    };
  }, [rawMarks]);

  // Adjusted Stats (Gaussian)
  const adjStats = useMemo(() => {
    const mean = calculateMean(adjustedMarks);
    const variance = calculateVariance(adjustedMarks, mean);
    const stdDev = calculateStdDev(variance);
    return {
      mean,
      median: calculateMedian(adjustedMarks),
      mode: calculateMode(adjustedMarks),
      stdDev,
      skewness: calculateSkewness(adjustedMarks, mean, stdDev),
      kurtosis: calculateKurtosis(adjustedMarks, mean, stdDev)
    };
  }, [adjustedMarks]);

  const originalExpectedCounts = useMemo(() => {
    return getExpectedNormalCounts(origStats.mean, origStats.stdDev, N, bins);
  }, [origStats, N, bins]);

  const adjustedExpectedCounts = useMemo(() => {
    return getExpectedNormalCounts(adjStats.mean, adjStats.stdDev, N, bins);
  }, [adjStats, N, bins]);

  const originalFitScore = useMemo(() => {
    return calculateDistributionFitScore(actualBinsData.origCounts, originalExpectedCounts);
  }, [actualBinsData, originalExpectedCounts]);

  const adjustedFitScore = useMemo(() => {
    return calculateDistributionFitScore(actualBinsData.adjCounts, adjustedExpectedCounts);
  }, [actualBinsData, adjustedExpectedCounts]);

  // Multi-chart datasets (Gaussian)
  const chartsDataset = useMemo(() => {
    let cumulativeActual = 0;
    let cumulativeExpected = 0;
    
    return bins.map((b, idx) => {
      const actualCount = actualBinsData.adjCounts[idx];
      const expectedCount = adjustedExpectedCounts[idx];
      const diff = Number((actualCount - expectedCount).toFixed(2));
      
      cumulativeActual += actualCount;
      cumulativeExpected += expectedCount;

      const actPct = Number(((cumulativeActual / N) * 100).toFixed(1));
      const expPct = Number(((cumulativeExpected / N) * 100).toFixed(1));

      return {
        name: b.name,
        ActualCount: actualCount,
        IdealCurve: expectedCount,
        Deviation: diff,
        ActualCDF: actPct,
        IdealCDF: expPct,
        ActualDensity: Number((actualCount / N).toFixed(3)),
        IdealDensity: Number((expectedCount / N).toFixed(3))
      };
    });
  }, [bins, actualBinsData, adjustedExpectedCounts, N]);

  // Side-by-side deviation table (Gaussian)
  const deviationRows = useMemo(() => {
    return bins.map((b, idx) => {
      const expected = adjustedExpectedCounts[idx];
      const actual = actualBinsData.adjCounts[idx];
      const diff = Number((actual - expected).toFixed(2));
      
      let status = "Aligned";
      let statusClass = "trendNeutral";
      if (diff > 1.5) {
        status = "Overrepresented";
        statusClass = "trendNegative";
      } else if (diff < -1.5) {
        status = "Underrepresented";
        statusClass = "trendPositive";
      }

      return {
        range: b.name,
        expected,
        actual,
        diff,
        status,
        statusClass
      };
    });
  }, [bins, adjustedExpectedCounts, actualBinsData]);

  // Solve Student-level OCAM optimal target adjustments (Gaussian)
  const studentLevelAdjustments = useMemo(() => {
    const formattedStudents = studentsData.map(s => ({
      id: s.id,
      name: s.name,
      mark: s.mark
    }));
    return calculateStudentLevelAdjustmentOffsets(formattedStudents, 60, 15);
  }, [studentsData]);

  // Student list mapped for Pass/Fail target preview
  const passFailStudentsPreview = useMemo(() => {
    return studentsData.map(s => {
      const adjMark = Math.min(100, Math.max(0, Number((s.mark + passFailSolverResult.adjustment).toFixed(1))));
      return {
        id: s.id,
        name: s.name,
        originalMark: s.mark,
        adjustedMark: adjMark,
        originalStatus: s.mark >= 35 ? "Pass" : "Fail",
        adjustedStatus: adjMark >= 35 ? "Pass" : "Fail",
        offset: passFailSolverResult.adjustment
      };
    });
  }, [studentsData, passFailSolverResult]);

  // Filtered/paginated Gaussian lists
  const filteredStudents = useMemo(() => {
    return studentLevelAdjustments.filter(s =>
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [studentLevelAdjustments, searchQuery]);

  const paginatedStudents = useMemo(() => {
    const start = studentPage * itemsPerPage;
    return filteredStudents.slice(start, start + itemsPerPage);
  }, [filteredStudents, studentPage]);

  // Filtered/paginated Pass/Fail lists
  const filteredPassFailStudents = useMemo(() => {
    let result = passFailStudentsPreview.filter(s =>
      s.id.toLowerCase().includes(passFailSearchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(passFailSearchQuery.toLowerCase())
    );
    
    if (sortPassFailByShift) {
      result = [...result].sort((a, b) => {
        const aHasShift = a.originalStatus !== a.adjustedStatus;
        const bHasShift = b.originalStatus !== b.adjustedStatus;
        if (aHasShift && !bHasShift) return -1;
        if (!aHasShift && bHasShift) return 1;
        return 0;
      });
    }
    
    return result;
  }, [passFailStudentsPreview, passFailSearchQuery, sortPassFailByShift]);

  const paginatedPassFailStudents = useMemo(() => {
    const limit = passFailItemsPerPage === -1 ? filteredPassFailStudents.length : passFailItemsPerPage;
    const start = passFailPage * limit;
    return filteredPassFailStudents.slice(start, start + limit);
  }, [filteredPassFailStudents, passFailPage, passFailItemsPerPage]);

  // Solve optimal uniform cohort recommendation (Gaussian)
  const uniformRecommendation = useMemo(() => {
    return calculateOptimalUniformCohortAdjustment(rawMarks, bins);
  }, [rawMarks, bins]);

  const applyUniformRecommendation = () => {
    setConstantAdd(uniformRecommendation.constant);
    setScaleFactor(uniformRecommendation.scale);
  };

  const resetAdjustments = () => {
    setConstantAdd(0);
    setScaleFactor(1);
  };

  const handleApplyAdjustment = () => {
    const total = passFailStudentsPreview.length;
    if (total === 0) return;

    const originalPasses = passFailStudentsPreview.filter(s => s.originalStatus === "Pass").length;
    const originalFails = total - originalPasses;
    const projectedPasses = passFailStudentsPreview.filter(s => s.adjustedStatus === "Pass").length;
    const projectedFails = total - projectedPasses;
    
    const promoted = passFailStudentsPreview.filter(s => s.originalStatus === "Fail" && s.adjustedStatus === "Pass").length;
    const demoted = passFailStudentsPreview.filter(s => s.originalStatus === "Pass" && s.adjustedStatus === "Fail").length;
    const totalAffected = promoted + demoted;

    const originalPassRate = ((originalPasses / total) * 100).toFixed(1);
    const originalFailRate = (100 - parseFloat(originalPassRate)).toFixed(1);
    const projectedPassRate = ((projectedPasses / total) * 100).toFixed(1);
    const projectedFailRate = (100 - parseFloat(projectedPassRate)).toFixed(1);
    const adjustment = passFailSolverResult.adjustment;
    const offsetStr = adjustment >= 0 ? `+${adjustment.toFixed(1)}` : `${adjustment.toFixed(1)}`;

    const dateStr = new Date().toLocaleString();

    const studentRowsHtml = passFailStudentsPreview.map(s => {
      const isPromoted = s.originalStatus === "Fail" && s.adjustedStatus === "Pass";
      const isDemoted = s.originalStatus === "Pass" && s.adjustedStatus === "Fail";

      let rowBg = "#ffffff";
      let rowColor = "#333333";
      let statusChangeText = "No Change";
      let statusChangeBadgeBg = "#f3f4f6";
      let statusChangeBadgeColor = "#4b5563";

      if (isPromoted) {
        rowBg = "#ecfdf5";
        rowColor = "#065f46";
        statusChangeText = "Fail ➔ Pass (Promoted)";
        statusChangeBadgeBg = "#d1fae5";
        statusChangeBadgeColor = "#065f46";
      } else if (isDemoted) {
        rowBg = "#fef2f2";
        rowColor = "#991b1b";
        statusChangeText = "Pass ➔ Fail (Demoted)";
        statusChangeBadgeBg = "#fee2e2";
        statusChangeBadgeColor = "#991b1b";
      }

      return `
        <tr style="background-color: ${rowBg}; color: ${rowColor}; border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 12px; font-family: monospace; font-weight: bold;">${s.id}</td>
          <td style="padding: 10px 12px; text-align: center;">${s.originalMark.toFixed(1)}</td>
          <td style="padding: 10px 12px; text-align: center; font-weight: bold; color: ${adjustment > 0 ? '#10b981' : adjustment < 0 ? '#ef4444' : '#6b7280'}">${offsetStr}</td>
          <td style="padding: 10px 12px; text-align: center; font-weight: bold;">${s.adjustedMark.toFixed(1)}</td>
          <td style="padding: 10px 12px; text-align: center;">
            <span style="padding: 2px 8px; border-radius: 12px; font-size: 11px; background-color: ${s.originalStatus === 'Pass' ? '#d1fae5' : '#fee2e2'}; color: ${s.originalStatus === 'Pass' ? '#065f46' : '#991b1b'}">
              ${s.originalStatus}
            </span>
          </td>
          <td style="padding: 10px 12px; text-align: center;">
            <span style="padding: 2px 8px; border-radius: 12px; font-size: 11px; background-color: ${s.adjustedStatus === 'Pass' ? '#d1fae5' : '#fee2e2'}; color: ${s.adjustedStatus === 'Pass' ? '#065f46' : '#991b1b'}">
              ${s.adjustedStatus}
            </span>
          </td>
          <td style="padding: 10px 12px; text-align: center;">
            <span style="padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; background-color: ${statusChangeBadgeBg}; color: ${statusChangeBadgeColor}">
              ${statusChangeText}
            </span>
          </td>
        </tr>
      `;
    }).join("");

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OCAM Common Mark Adjustment & Status Shift Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      color: #1f2937;
      background-color: #f9fafb;
      margin: 0;
      padding: 40px 20px;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: #ffffff;
      padding: 32px;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .header {
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .header-title {
      font-size: 24px;
      font-weight: 800;
      color: #111827;
      margin: 0;
    }
    .header-meta {
      font-size: 13px;
      color: #6b7280;
      margin-top: 4px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .card {
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      background-color: #fcfcfd;
    }
    .card-title {
      font-size: 12px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }
    .card-value {
      font-size: 24px;
      font-weight: 800;
      color: #111827;
    }
    .card-accent-green {
      border-left: 4px solid #10b981;
      background-color: #f0fdf4;
    }
    .card-accent-red {
      border-left: 4px solid #ef4444;
      background-color: #fef2f2;
    }
    .card-accent-blue {
      border-left: 4px solid #3b82f6;
      background-color: #eff6ff;
    }
    .table-title {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-bottom: 24px;
    }
    th {
      background-color: #f3f4f6;
      color: #374151;
      font-weight: 700;
      text-align: left;
      padding: 12px;
      border-bottom: 2px solid #e5e7eb;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    .btn-print {
      display: inline-flex;
      align-items: center;
      background-color: #111827;
      color: #ffffff;
      padding: 10px 18px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      text-decoration: none;
      margin-bottom: 20px;
    }
    .btn-print:hover {
      background-color: #1f2937;
    }
    @media print {
      body {
        background-color: #ffffff;
        padding: 0;
      }
      .container {
        box-shadow: none;
        padding: 0;
      }
      .btn-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap;">
      <div class="header">
        <h1 class="header-title">OCAM Mark Adjustment & Status Shift Report</h1>
        <div class="header-meta">Generated: ${dateStr} | Mode: Pass/Fail Target Solver</div>
      </div>
      <button class="btn-print" onclick="window.print()">Print / Save PDF</button>
    </div>

    <div class="grid">
      <div class="card card-accent-blue">
        <div class="card-title">Applied Adjustment</div>
        <div class="card-value" style="color: ${adjustment > 0 ? '#10b981' : adjustment < 0 ? '#ef4444' : '#111827'}">${offsetStr} Marks</div>
      </div>
      <div class="card card-accent-green">
        <div class="card-title">Promoted (Fail ➔ Pass)</div>
        <div class="card-value">${promoted} Students</div>
      </div>
      <div class="card card-accent-red">
        <div class="card-title">Demoted (Pass ➔ Fail)</div>
        <div class="card-value">${demoted} Students</div>
      </div>
      <div class="card">
        <div class="card-title">Total Affected</div>
        <div class="card-value">${totalAffected} / ${total}</div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));">
      <div class="card">
        <div class="card-title">Original Performance Metrics</div>
        <div style="display: flex; justify-content: space-between; margin-top: 10px;">
          <span>Pass Rate: <strong>${originalPassRate}%</strong> (${originalPasses} Students)</span>
          <span>Fail Rate: <strong>${originalFailRate}%</strong> (${originalFails} Students)</span>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Projected Performance Metrics</div>
        <div style="display: flex; justify-content: space-between; margin-top: 10px;">
          <span>Pass Rate: <strong>${projectedPassRate}%</strong> (${projectedPasses} Students)</span>
          <span>Fail Rate: <strong>${projectedFailRate}%</strong> (${projectedFails} Students)</span>
        </div>
      </div>
    </div>

    <h2 class="table-title">Student Adjustment & Status Shift Log</h2>
    <table>
      <thead>
        <tr>
          <th>Reg No.</th>
          <th style="text-align: center;">Original Mark</th>
          <th style="text-align: center;">Adjustment Offset</th>
          <th style="text-align: center;">Adjusted Mark</th>
          <th style="text-align: center;">Original Status</th>
          <th style="text-align: center;">New Status</th>
          <th style="text-align: center;">Status Shift</th>
        </tr>
      </thead>
      <tbody>
        ${studentRowsHtml}
      </tbody>
    </table>
  </div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `OCAM_Mark_Adjustment_Report_${new Date().toISOString().slice(0,10)}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFitGrade = (score) => {
    if (score >= 85) return { text: "Excellent Normal Alignment", color: "var(--accent-success)" };
    if (score >= 70) return { text: "Good Normal Fit", color: "var(--accent-primary)" };
    if (score >= 50) return { text: "Moderate Deviation", color: "var(--accent-warning)" };
    return { text: "High Statistical Skew", color: "var(--accent-danger)" };
  };

  // Pass/Fail chart comparison dataset
  const passFailChartData = useMemo(() => {
    const currentFails = N - currentPasses;
    const projectedFails = N - projectedPasses;
    return [
      { name: "Passed Students", Current: currentPasses, Projected: projectedPasses },
      { name: "Failed Students", Current: currentFails, Projected: projectedFails }
    ];
  }, [N, currentPasses, projectedPasses]);

  if (studentsData.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
        No cohort OCAM results found. Upload student marks first to evaluate statistical alignment.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      
      {/* Top Level Sub-Section Mode Selector */}
      <div style={{ display: "flex", gap: "8px", background: "rgba(0,0,0,0.3)", padding: "6px", borderRadius: "12px", border: "var(--glass-border)", alignSelf: "flex-start" }}>
        <button
          onClick={() => setActiveMode("gaussian")}
          style={{
            background: activeMode === "gaussian" ? "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))" : "transparent",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s"
          }}
        >
          <Sparkles size={16} />
          Gaussian Bell Fit Solver
        </button>
        <button
          onClick={() => setActiveMode("passfail")}
          style={{
            background: activeMode === "passfail" ? "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))" : "transparent",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s"
          }}
        >
          <Award size={16} />
          Pass/Fail Rate Target Solver
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* MODE 1: GAUSSIAN BELL FIT SOLVER                     */}
      {/* ---------------------------------------------------- */}
      {activeMode === "gaussian" && (
        <>
          {/* Visual Indicator Metrics Row */}
          <div className="stats-row-sim" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
            
            {/* Distribution Fit Score Card */}
            <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px", border: "1px solid var(--accent-primary)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: "500" }}>Gaussian Fit Score</span>
                <Percent size={18} color="var(--accent-primary)" />
              </div>
              <div style={{ fontSize: "36px", fontWeight: "700", color: "var(--text-primary)" }}>
                {adjustedFitScore}%
              </div>
              <div style={{ fontSize: "13px", fontWeight: "600", color: getFitGrade(adjustedFitScore).color }}>
                {getFitGrade(adjustedFitScore).text}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Originally: {originalFitScore}%
              </div>
            </div>

            {/* Mean & Median */}
            <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: "500" }}>Cohort Mean</span>
                <Users size={18} color="var(--accent-secondary)" />
              </div>
              <div style={{ fontSize: "36px", fontWeight: "700", color: "var(--text-primary)" }}>
                {adjStats.mean.toFixed(1)}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Median: {adjStats.median} | Mode: {adjStats.mode}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Original Mean: {origStats.mean.toFixed(1)}
              </div>
            </div>

            {/* Standard Deviation */}
            <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: "500" }}>Standard Deviation</span>
                <TrendingUp size={18} color="var(--accent-success)" />
              </div>
              <div style={{ fontSize: "36px", fontWeight: "700", color: "var(--text-primary)" }}>
                {adjStats.stdDev.toFixed(2)}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Standard Spread (Spread of grades)
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Original Std Dev: {origStats.stdDev.toFixed(2)}
              </div>
            </div>

            {/* Skewness & Kurtosis */}
            <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: "500" }}>Skewness & Kurtosis</span>
                <BarChart2 size={18} color="var(--accent-warning)" />
              </div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--text-primary)", marginTop: "4px" }}>
                {adjStats.skewness.toFixed(2)} / {adjStats.kurtosis.toFixed(2)}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {analyzeDistribution(adjStats.skewness, adjStats.kurtosis).shape}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Original: {origStats.skewness.toFixed(2)} / {origStats.kurtosis.toFixed(2)}
              </div>
            </div>

          </div>

          {/* Adjustments Controls & Uniform Cohort Shifts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", width: "100%" }} className="stats-row-sim">
            
            {/* Real-time Adjusters */}
            <div className="glass-panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)", fontSize: "18px" }}>
                <Settings2 size={20} color="var(--accent-primary)" />
                Real-time Adjustment Solvers
              </h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Slider 1 */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Constant Addition</span>
                    <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--accent-primary)" }}>+{constantAdd} Marks</span>
                  </div>
                  <input 
                    type="range" 
                    min="-15" max="30" step="1" 
                    value={constantAdd} 
                    onChange={(e) => setConstantAdd(Number(e.target.value))}
                    style={{ width: "100%", cursor: "pointer" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                    <span>-15</span>
                    <span>0 (No shift)</span>
                    <span>+30</span>
                  </div>
                </div>

                {/* Slider 2 */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Linear Scaling Factor</span>
                    <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--accent-secondary)" }}>x{scaleFactor.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.7" max="1.5" step="0.05" 
                    value={scaleFactor} 
                    onChange={(e) => setScaleFactor(Number(e.target.value))}
                    style={{ width: "100%", cursor: "pointer" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                    <span>0.7x (Flatten)</span>
                    <span>1.0x (Original)</span>
                    <span>1.5x (Spread)</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button className="btn-primary" style={{ flex: 1, backgroundColor: "var(--accent-secondary)" }} onClick={resetAdjustments}>
                  Reset Adjustments
                </button>
              </div>
            </div>

            {/* Solver Uniform Optimization Card */}
            <div className="glass-panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px", background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.15)" }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)", fontSize: "18px" }}>
                <CheckCircle2 size={20} color="var(--accent-success)" />
                Optimal Cohort Recommendation
              </h3>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                Our mathematical solver analyzed the entire cohort mark dataset and resolved the optimal uniform shift that maximizes the overall Distribution Fit Score:
              </p>

              <div className="glass-panel" style={{ padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "rgba(0,0,0,0.2)" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase" }}>Optimal Shift</div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", marginTop: "4px" }}>
                    +{uniformRecommendation.constant} Marks
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase" }}>Optimal Scaling</div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", marginTop: "4px" }}>
                    x{uniformRecommendation.scale.toFixed(2)}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                <span style={{ color: "var(--text-muted)" }}>Expected Normal Fit:</span>
                <strong style={{ color: "var(--accent-success)", fontSize: "15px" }}>{uniformRecommendation.bestScore}% Match</strong>
              </div>

              <button className="btn-primary" onClick={applyUniformRecommendation} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                Apply Recommended Uniform Shift
              </button>
            </div>

          </div>

          {/* Visual Analytics Dashboard Charts Section */}
          <div className="glass-panel" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ fontSize: "18px", color: "var(--text-primary)", fontWeight: "600" }}>Gaussian Curve Visual Dashboard</h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Real-time overlay comparison models</p>
              </div>

              {/* Tab buttons */}
              <div style={{ display: "flex", gap: "4px", background: "rgba(0,0,0,0.3)", padding: "4px", borderRadius: "8px", border: "var(--glass-border)" }}>
                {[
                  { id: "histogram", label: "Histogram Overlay" },
                  { id: "deviation", label: "Deviation Gap" },
                  { id: "cdf", label: "Cumulative CDF" },
                  { id: "frequency", label: "Frequency Spline" }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      background: activeTab === tab.id ? "var(--bg-secondary)" : "transparent",
                      border: "none",
                      color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-secondary)",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: "500",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ width: "100%", height: "400px" }}>
              <ResponsiveContainer width="100%" height="100%">
                
                {activeTab === "histogram" && (
                  <ComposedChart data={chartsDataset} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" label={{ value: 'Student Count', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)' } }} />
                    <Tooltip contentStyle={{ backgroundColor: "#131722", borderColor: "rgba(255,255,255,0.1)" }} />
                    <Legend />
                    <Bar dataKey="ActualCount" name="Actual Students" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} />
                    <Line type="monotone" dataKey="IdealCurve" name="Expected Gaussian Bell" stroke="#10B981" strokeWidth={3} dot={false} />
                  </ComposedChart>
                )}

                {activeTab === "deviation" && (
                  <BarChart data={chartsDataset} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" label={{ value: 'Discrepancy (Students)', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)' } }} />
                    <Tooltip contentStyle={{ backgroundColor: "#131722", borderColor: "rgba(255,255,255,0.1)" }} />
                    <Legend />
                    <Bar 
                      dataKey="Deviation" 
                      name="Difference (Actual - Ideal)" 
                      fill="#F59E0B"
                      radius={[4, 4, 0, 0]}
                      barSize={30}
                    />
                  </BarChart>
                )}

                {activeTab === "cdf" && (
                  <LineChart data={chartsDataset} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" unit="%" label={{ value: 'Cumulative Percent', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)' } }} />
                    <Tooltip contentStyle={{ backgroundColor: "#131722", borderColor: "rgba(255,255,255,0.1)" }} />
                    <Legend />
                    <Line type="monotone" dataKey="ActualCDF" name="Actual Cumulative (CDF)" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="IdealCDF" name="Gaussian Cumulative (CDF)" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                )}

                {activeTab === "frequency" && (
                  <AreaChart data={chartsDataset} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" label={{ value: 'Density Fraction', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)' } }} />
                    <Tooltip contentStyle={{ backgroundColor: "#131722", borderColor: "rgba(255,255,255,0.1)" }} />
                    <Legend />
                    <Area type="monotone" dataKey="ActualDensity" name="Actual Density Spline" stroke="#3B82F6" fill="rgba(59, 130, 246, 0.1)" strokeWidth={2} />
                    <Area type="monotone" dataKey="IdealDensity" name="Expected Normal Spline" stroke="#10B981" fill="rgba(16, 185, 129, 0.05)" strokeWidth={2} strokeDasharray="3 3" />
                  </AreaChart>
                )}

              </ResponsiveContainer>
            </div>
          </div>

          {/* Side-by-side Expected vs Actual Deviation Table */}
          <div className="glass-panel" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "18px", color: "var(--text-primary)", fontWeight: "600", marginBottom: "16px" }}>
              Mark Range Distribution & Deviation Matrix
            </h3>
            <div className="table-wrapper">
              <table className="table" style={{ fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                    <th>Mark Range</th>
                    <th>Expected Students (Gaussian)</th>
                    <th>Actual Students</th>
                    <th>Difference (Actual - Expected)</th>
                    <th>Cohort Alignment Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deviationRows.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: "500", color: "var(--text-secondary)" }}>{row.range} Marks</td>
                      <td>{row.expected.toFixed(1)}</td>
                      <td style={{ fontWeight: "600" }}>{row.actual}</td>
                      <td style={{ 
                        fontWeight: "600",
                        color: row.diff > 0 ? "var(--accent-warning)" : row.diff < 0 ? "var(--accent-danger)" : "var(--text-primary)"
                      }}>
                        {row.diff > 0 ? `+${row.diff}` : row.diff}
                      </td>
                      <td>
                        <span className={row.statusClass} style={{
                          padding: "4px 10px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: "600",
                          background: row.status === "Overrepresented" ? "rgba(245, 158, 11, 0.1)" : row.status === "Underrepresented" ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                          color: row.status === "Overrepresented" ? "var(--accent-warning)" : row.status === "Underrepresented" ? "var(--accent-danger)" : "var(--accent-success)"
                        }}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Student-Level OCAM Adjustment Table */}
          <div className="glass-panel" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ fontSize: "18px", color: "var(--text-primary)", fontWeight: "600" }}>
                  Student-Level OCAM Curve Alignment Matrix
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Exact adjustments required per student to align cohort with ideal normal curve (centered at Mean: 60, StdDev: 15)
                </p>
              </div>
              
              <div style={{ position: "relative", minWidth: "250px" }}>
                <Search style={{ position: "absolute", left: "12px", top: "12px", color: "var(--text-muted)" }} size={16} />
                <input 
                  type="text" 
                  placeholder="Search Reg. No or Name..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setStudentPage(0); }}
                  style={{
                    width: "100%",
                    background: "rgba(0,0,0,0.3)",
                    border: "var(--glass-border)",
                    padding: "10px 16px 10px 36px",
                    borderRadius: "8px",
                    color: "var(--text-primary)",
                    fontSize: "14px",
                    outline: "none"
                  }}
                />
              </div>
            </div>

            <div className="table-wrapper">
              <table className="table" style={{ fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                    <th>Reg No.</th>
                    <th>Student Name</th>
                    <th>Current OCAM</th>
                    <th>Target OCAM (Ideal Normal)</th>
                    <th>Offset Required</th>
                    <th>Ideal Adjusted OCAM</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length > 0 ? paginatedStudents.map((s, idx) => (
                    <tr key={`${s.id}-${idx}`}>
                      <td style={{ fontFamily: "monospace", fontWeight: "600" }}>{s.id}</td>
                      <td>{s.name}</td>
                      <td>{s.originalMark.toFixed(1)}</td>
                      <td>{s.targetMark.toFixed(1)}</td>
                      <td style={{ 
                        fontWeight: "600",
                        color: s.offset > 0 ? "var(--accent-success)" : s.offset < 0 ? "var(--accent-danger)" : "var(--text-primary)"
                      }}>
                        {s.offset > 0 ? `+${s.offset}` : s.offset}
                      </td>
                      <td style={{ fontWeight: "700" }}>{s.targetMark.toFixed(1)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                        No students matched the query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {filteredStudents.length > itemsPerPage && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Showing {studentPage * itemsPerPage + 1} - {Math.min((studentPage + 1) * itemsPerPage, filteredStudents.length)} of {filteredStudents.length} Students
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button 
                    className="btn-secondary"
                    disabled={studentPage === 0}
                    onClick={() => setStudentPage(p => p - 1)}
                    style={{ padding: "6px 12px", fontSize: "13px" }}
                  >
                    Previous
                  </button>
                  <button 
                    className="btn-secondary"
                    disabled={(studentPage + 1) * itemsPerPage >= filteredStudents.length}
                    onClick={() => setStudentPage(p => p + 1)}
                    style={{ padding: "6px 12px", fontSize: "13px" }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Cohort Executive Report Portal */}
          <div className="glass-panel" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "12px" }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)", fontSize: "18px" }}>
                <FileText size={20} color="var(--accent-primary)" />
                Executive Cohort Alignment Report
              </h3>
              <button 
                className="btn-primary" 
                onClick={() => window.print()}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", fontSize: "13px" }}
              >
                <Download size={16} />
                Export Executive Report
              </button>
            </div>

            <div id="executive-report" style={{ color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "16px", fontSize: "14px", lineHeight: "1.6" }}>
              
              <div>
                <h4 style={{ color: "var(--text-primary)", fontSize: "15px", fontWeight: "600", marginBottom: "4px" }}>
                  1. Distribution Alignment Summary
                </h4>
                <p>
                  The original OCAM distribution holds a Gaussian Normal Fit score of <strong>{originalFitScore}%</strong>. Following the real-time simulation model (Constant Shift: {constantAdd > 0 ? `+${constantAdd}` : constantAdd} Marks, Scaling: x{scaleFactor.toFixed(2)}), the distribution fit has been optimised to <strong>{adjustedFitScore}%</strong>.
                </p>
              </div>

              <div>
                <h4 style={{ color: "var(--text-primary)", fontSize: "15px", fontWeight: "600", marginBottom: "4px" }}>
                  2. Distribution Discrepancy & Skew Analysis
                </h4>
                <p>
                  The adjusted distribution is classified as <strong>{analyzeDistribution(adjStats.skewness, adjStats.kurtosis).shape}</strong>. 
                  {Math.abs(adjStats.skewness) > 0.5 ? 
                    ` The skewness is currently ${adjStats.skewness.toFixed(2)}, suggesting that grades still lean slightly. Additional linear scaling is recommended.` : 
                    " The skewness is near ideal, demonstrating excellent normal bell curve symmetry."
                  }
                </p>
              </div>

              <div>
                <h4 style={{ color: "var(--text-primary)", fontSize: "15px", fontWeight: "600", marginBottom: "4px" }}>
                  3. Cohort Alignment Effectiveness Report
                </h4>
                <p>
                  Based on the deviation indicators, the <strong>{deviationRows.filter(r => r.status === "Aligned").length} mark ranges</strong> are in perfect alignment. However, there are overrepresented brackets in the 
                  {" "}{deviationRows.filter(r => r.status === "Overrepresented").map(r => `${r.range} marks`).join(", ") || "none"} intervals, and underrepresented brackets in the
                  {" "}{deviationRows.filter(r => r.status === "Underrepresented").map(r => `${r.range} marks`).join(", ") || "none"} intervals.
                </p>
              </div>

              <div style={{ padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.04)", fontSize: "13px" }}>
                <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "4px" }}>
                  Executive Recommendation Note:
                </strong>
                To reach absolute normal bell curve alignment across this cohort, it is advised to apply either the **Uniform shift** (applying constant +{uniformRecommendation.constant} marks & x{uniformRecommendation.scale.toFixed(2)} scale) or compile individual student mark offsets resolved in the OCAM Curve Alignment matrix.
              </div>

            </div>
          </div>
        </>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODE 2: PASS/FAIL RATE TARGET SOLVER                 */}
      {/* ---------------------------------------------------- */}
      {activeMode === "passfail" && (
        <>
          {/* Performance Summary Stats Grid */}
          <div className="stats-row-sim" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
            
            {/* Total Students */}
            <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: "500" }}>Total Students</span>
                <Users size={18} color="var(--accent-primary)" />
              </div>
              <div style={{ fontSize: "36px", fontWeight: "700", color: "var(--text-primary)" }}>
                {N}
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                Active cohort module sizes
              </div>
            </div>

            {/* Current Pass Rate */}
            <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px", borderLeft: "4px solid var(--accent-success)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: "500" }}>Current Pass Rate</span>
                <Award size={18} color="var(--accent-success)" />
              </div>
              <div style={{ fontSize: "36px", fontWeight: "700", color: "var(--text-primary)" }}>
                {initialPassRate}%
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                {currentPasses} out of {N} Students passed (Threshold: 35)
              </div>
            </div>

            {/* Current Fail Rate */}
            <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px", borderLeft: "4px solid var(--accent-danger)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: "500" }}>Current Fail Rate</span>
                <ShieldAlert size={18} color="var(--accent-danger)" />
              </div>
              <div style={{ fontSize: "36px", fontWeight: "700", color: "var(--text-primary)" }}>
                {(100 - initialPassRate).toFixed(1)}%
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                {N - currentPasses} out of {N} Students failed
              </div>
            </div>

          </div>

          {/* Interactive Target Solver Matrix Card */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", width: "100%" }} className="stats-row-sim">
            
            {/* Input Slider Card */}
            <div className="glass-panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)", fontSize: "18px" }}>
                <Settings2 size={20} color="var(--accent-primary)" />
                Target Percentage Solvers
              </h3>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Desired Pass Percentage</span>
                  <span style={{ fontSize: "16px", fontWeight: "700", color: "var(--accent-success)" }}>{targetPassRate.toFixed(1)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" step="0.5" 
                  value={targetPassRate} 
                  onChange={(e) => handlePassRateChange(Number(e.target.value))}
                  style={{ width: "100%", cursor: "pointer" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                  <span>0% Pass</span>
                  <span>Current ({initialPassRate}%)</span>
                  <span>100% Pass</span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", fontSize: "13px" }}>
                <span style={{ color: "var(--text-secondary)" }}>Desired Fail Percentage (Locked)</span>
                <span style={{ fontWeight: "700", color: "var(--accent-danger)" }}>{(100 - targetPassRate).toFixed(1)}%</span>
              </div>

              <button 
                className="btn-primary" 
                onClick={() => handlePassRateChange(initialPassRate)}
                style={{ padding: "10px 16px", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", backgroundColor: "var(--accent-secondary)", border: "none" }}
              >
                Reset to Current Rate ({initialPassRate}%)
              </button>
            </div>

            {/* Resolved Adjustment & Shift Recommendation */}
            <div className="glass-panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px", background: "rgba(16, 185, 129, 0.04)", border: "1px solid rgba(16, 185, 129, 0.15)" }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)", fontSize: "18px" }}>
                <CheckCircle2 size={20} color="var(--accent-success)" />
                Recommended Uniform Adjustment Offset
              </h3>
              
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                To achieve your target pass rate of <strong>{targetPassRate.toFixed(1)}%</strong> as closely as possible, apply the following uniform mark shift:
              </p>

              <div className="glass-panel" style={{ padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "rgba(0,0,0,0.2)", alignPoints: "center" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase" }}>Common Mark Offset</div>
                  <div style={{ 
                    fontSize: "24px", 
                    fontWeight: "700", 
                    color: passFailSolverResult.adjustment >= 0 ? "var(--accent-success)" : "var(--accent-danger)",
                    marginTop: "4px" 
                  }}>
                    {passFailSolverResult.adjustment >= 0 ? `+${passFailSolverResult.adjustment}` : passFailSolverResult.adjustment} Marks
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase" }}>Projected Pass Rate</div>
                  <div style={{ fontSize: "24px", fontWeight: "700", color: "var(--text-primary)", marginTop: "4px" }}>
                    {passFailSolverResult.resultingPassRate}%
                  </div>
                </div>
              </div>

              <div style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Achieved Rate Delta:</span>
                <span style={{ color: "var(--text-primary)", fontWeight: "600" }}>
                  {Math.abs(passFailSolverResult.resultingPassRate - targetPassRate).toFixed(1)}% discrepancy
                </span>
              </div>
            </div>

          </div>

          {/* Impact Analysis & Before-and-after Comparison Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "24px" }} className="stats-row-sim">
            
            {/* Impact Chart */}
            <div className="glass-panel" style={{ padding: "24px" }}>
              <h3 style={{ fontSize: "16px", color: "var(--text-primary)", fontWeight: "600", marginBottom: "16px" }}>
                Pass/Fail Distribution Impact Chart
              </h3>
              <div style={{ width: "100%", height: "260px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={passFailChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" />
                    <Tooltip contentStyle={{ backgroundColor: "#131722", borderColor: "rgba(255,255,255,0.1)" }} />
                    <Legend />
                    <Bar dataKey="Current" fill="#64748B" radius={[4, 4, 0, 0]} name="Current Cohort" barSize={35} />
                    <Bar dataKey="Projected" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Projected Cohort" barSize={35} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Impact stats card */}
            <div className="glass-panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px", justifyContent: "center" }}>
              <h3 style={{ fontSize: "16px", color: "var(--text-primary)", fontWeight: "600" }}>
                Projected Shift Impact
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Original Passes:</span>
                  <span style={{ fontWeight: "700" }}>{currentPasses} Students</span>
                </div>
                <div style={{ padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Projected Passes:</span>
                  <span style={{ fontWeight: "700", color: "var(--accent-success)" }}>{projectedPasses} Students</span>
                </div>
              </div>

              {diffStudentsCount !== 0 ? (
                <div style={{ 
                  padding: "16px", 
                  borderRadius: "8px", 
                  background: diffStudentsCount > 0 ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                  border: diffStudentsCount > 0 ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(239, 68, 68, 0.2)",
                  textAlign: "center"
                }}>
                  <strong style={{ fontSize: "15px", color: diffStudentsCount > 0 ? "var(--accent-success)" : "var(--accent-danger)", display: "block", marginBottom: "4px" }}>
                    {diffStudentsCount > 0 ? "Pass Increase Impact" : "Pass Decrease Impact"}
                  </strong>
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                    {diffStudentsCount > 0 ? 
                      `Applying this shift will successfully PASS an additional ${diffStudentsCount} students.` : 
                      `Applying this shift will FAIL an additional ${Math.abs(diffStudentsCount)} students.`
                    }
                  </span>
                </div>
              ) : (
                <div style={{ padding: "16px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                  This minor offset does not change individual pass/fail statuses for any student.
                </div>
              )}
            </div>

          </div>

          {/* Live Preview matrix of all students */}
          <div className="glass-panel" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ fontSize: "18px", color: "var(--text-primary)", fontWeight: "600" }}>
                  Adjusted Student Marks & Status Preview
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Real-time preview of student marks and status shifts before saving (passing threshold: 35)
                </p>
              </div>

              <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <button 
                  className="btn-primary" 
                  onClick={handleApplyAdjustment}
                  style={{ padding: "10px 16px", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px", border: "none", backgroundColor: "var(--accent-success)", borderRadius: "8px", cursor: "pointer", color: "#ffffff", fontWeight: "600" }}
                >
                  📥 Apply Adjustment
                </button>

                {sortPassFailByShift ? (
                  <button 
                    className="btn-primary" 
                    onClick={() => { setSortPassFailByShift(false); setPassFailPage(0); }}
                    style={{ padding: "10px 16px", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px", border: "none", backgroundColor: "var(--accent-secondary)", borderRadius: "8px", cursor: "pointer" }}
                  >
                    🔄 Restore Default Order
                  </button>
                ) : (
                  <button 
                    className="btn-primary" 
                    onClick={() => { setSortPassFailByShift(true); setPassFailPage(0); }}
                    style={{ padding: "10px 16px", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px", border: "none", backgroundColor: "var(--accent-primary)", borderRadius: "8px", cursor: "pointer" }}
                  >
                    ⚠️ Sort Status Shifts First
                  </button>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Show:</span>
                  <select 
                    value={passFailItemsPerPage}
                    onChange={e => {
                      setPassFailItemsPerPage(Number(e.target.value));
                      setPassFailPage(0);
                    }}
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      border: "var(--glass-border)",
                      padding: "10px 16px",
                      borderRadius: "8px",
                      color: "var(--text-primary)",
                      fontSize: "14px",
                      outline: "none",
                      cursor: "pointer",
                      fontFamily: "inherit"
                    }}
                  >
                    <option value={10} style={{ background: "#181825", color: "#cdd6f4" }}>10 rows</option>
                    <option value={25} style={{ background: "#181825", color: "#cdd6f4" }}>25 rows</option>
                    <option value={50} style={{ background: "#181825", color: "#cdd6f4" }}>50 rows</option>
                    <option value={100} style={{ background: "#181825", color: "#cdd6f4" }}>100 rows</option>
                    <option value={-1} style={{ background: "#181825", color: "#cdd6f4" }}>All records</option>
                  </select>
                </div>

                <div style={{ position: "relative", minWidth: "250px" }}>
                  <Search style={{ position: "absolute", left: "12px", top: "12px", color: "var(--text-muted)" }} size={16} />
                  <input 
                    type="text" 
                    placeholder="Search Reg No. or Name..."
                    value={passFailSearchQuery}
                    onChange={e => { setPassFailSearchQuery(e.target.value); setPassFailPage(0); }}
                    style={{
                      width: "100%",
                      background: "rgba(0,0,0,0.3)",
                      border: "var(--glass-border)",
                      padding: "10px 16px 10px 36px",
                      borderRadius: "8px",
                      color: "var(--text-primary)",
                      fontSize: "14px",
                      outline: "none"
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="table" style={{ fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                    <th>Reg No.</th>
                    <th>Common Mark Offset</th>
                    <th>Original OCAM Mark</th>
                    <th>Adjusted OCAM Mark</th>
                    <th>Original Status</th>
                    <th>Projected Status</th>
                    <th>Status Shift</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPassFailStudents.length > 0 ? paginatedPassFailStudents.map((s, idx) => {
                    const hasStatusShift = s.originalStatus !== s.adjustedStatus;
                    const offsetVal = s.offset || 0;
                    return (
                      <tr 
                        key={`${s.id}-pf-${idx}`}
                        style={hasStatusShift ? { background: "rgba(16, 185, 129, 0.05)", borderLeft: "3px solid var(--accent-success)" } : {}}
                      >
                        <td style={{ fontFamily: "monospace", fontWeight: "600" }}>{s.id}</td>
                        <td style={{ 
                          fontFamily: "monospace", 
                          fontWeight: "700", 
                          color: offsetVal > 0 ? "var(--accent-success)" : offsetVal < 0 ? "var(--accent-danger)" : "var(--text-muted)" 
                        }}>
                          {offsetVal >= 0 ? `+${offsetVal.toFixed(1)}` : offsetVal.toFixed(1)}
                        </td>
                        <td>{s.originalMark.toFixed(1)}</td>
                        <td style={{ fontWeight: "700" }}>{s.adjustedMark.toFixed(1)}</td>
                        <td>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            background: s.originalStatus === "Pass" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                            color: s.originalStatus === "Pass" ? "var(--accent-success)" : "var(--accent-danger)"
                          }}>
                            {s.originalStatus}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            background: s.adjustedStatus === "Pass" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                            color: s.adjustedStatus === "Pass" ? "var(--accent-success)" : "var(--accent-danger)"
                          }}>
                            {s.adjustedStatus}
                          </span>
                        </td>
                        <td>
                          {hasStatusShift ? (
                            <strong style={{ color: "var(--accent-success)", fontSize: "13px" }}>
                              {s.originalStatus === "Fail" ? "Promoted to Pass" : "Shifted to Fail"}
                            </strong>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>No Change</span>
                          )}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan="7" style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                        No students matched the query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {(() => {
              const passFailLimit = passFailItemsPerPage === -1 ? filteredPassFailStudents.length : passFailItemsPerPage;
              return filteredPassFailStudents.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", flexWrap: "wrap", gap: "12px" }}>
                  <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                    Showing {filteredPassFailStudents.length > 0 ? (passFailPage * passFailLimit + 1) : 0} - {Math.min((passFailPage + 1) * passFailLimit, filteredPassFailStudents.length)} of {filteredPassFailStudents.length} Students
                  </span>
                  
                  {passFailItemsPerPage !== -1 && filteredPassFailStudents.length > passFailLimit && (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button 
                        className="btn-secondary"
                        disabled={passFailPage === 0}
                        onClick={() => setPassFailPage(p => p - 1)}
                        style={{ padding: "6px 12px", fontSize: "13px" }}
                      >
                        Previous
                      </button>
                      <button 
                        className="btn-secondary"
                        disabled={(passFailPage + 1) * passFailLimit >= filteredPassFailStudents.length}
                        onClick={() => setPassFailPage(p => p + 1)}
                        style={{ padding: "6px 12px", fontSize: "13px" }}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </>
      )}

    </div>
  );
}
