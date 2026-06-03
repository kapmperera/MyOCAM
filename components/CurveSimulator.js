"use client";

import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
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
import { Search, FileText, CheckCircle2, AlertTriangle, TrendingUp, BarChart2, Settings2, Users, Percent, Download, Award, ShieldAlert, Sparkles, ChevronDown, FileSpreadsheet, Printer } from "lucide-react";

export default function CurveSimulator({ studentsData = [], currentModule = null }) {
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
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showStatusShiftDropdown, setShowStatusShiftDropdown] = useState(false);

  // -- Final Exam Predictor States & Boundaries --
  const GRADE_BOUNDARIES = useMemo(() => [
    { grade: "A+", min: 75, max: 100, color: "#10b981" },
    { grade: "A", min: 70, max: 74, color: "#059669" },
    { grade: "A-", min: 65, max: 69, color: "#34d399" },
    { grade: "B+", min: 60, max: 64, color: "#3b82f6" },
    { grade: "B", min: 55, max: 59, color: "#2563eb" },
    { grade: "B-", min: 50, max: 54, color: "#60a5fa" },
    { grade: "C+", min: 45, max: 49, color: "#f59e0b" },
    { grade: "C", min: 40, max: 44, color: "#d97706" },
    { grade: "C-", min: 35, max: 39, color: "#f87171" },
    { grade: "D+", min: 30, max: 34, color: "#ef4444" },
    { grade: "D", min: 25, max: 29, color: "#dc2626" },
    { grade: "E", min: 0, max: 24, color: "#991b1b" }
  ], []);

  const [desiredExamPassRate, setDesiredExamPassRate] = useState(75);
  const [whatIfExamAvg, setWhatIfExamAvg] = useState(60);
  const [predSearchQuery, setPredSearchQuery] = useState("");
  const [predPage, setPredPage] = useState(0);
  const [predItemsPerPage, setPredItemsPerPage] = useState(10);
  const [predRiskFilter, setPredRiskFilter] = useState("all");
  const [predSortBy, setPredSortBy] = useState("id");
  const [predSortOrder, setPredSortOrder] = useState("asc");
  const [analysisScope, setAnalysisScope] = useState("all"); // "all" | "eligible"

  const examPredictions = useMemo(() => {
    const filteredBase = analysisScope === "eligible"
      ? studentsData.filter(s => s.mark >= 35)
      : studentsData;

    return filteredBase.map(s => {
      const ocam = s.mark || 0;
      const ocamContrib = Number((ocam * 0.4).toFixed(2));
      
      const requiredMarks = {};
      GRADE_BOUNDARIES.forEach(gb => {
        const req = (gb.min - ocamContrib) / 0.6;
        requiredMarks[gb.grade] = Math.min(100, Math.max(0, Number(req.toFixed(1))));
      });

      const reqToPass = (40 - ocamContrib) / 0.6;
      let riskLevel = "Low Risk";
      if (reqToPass > 55) {
        riskLevel = "High Risk";
      } else if (reqToPass >= 35) {
        riskLevel = "Moderate Risk";
      }

      const isGuaranteed = ocamContrib >= 40;

      return {
        id: s.id,
        name: s.name,
        ocam,
        ocamContrib,
        requiredMarks,
        riskLevel,
        isGuaranteed,
        reqToPass: Math.min(100, Math.max(0, Number(reqToPass.toFixed(1))))
      };
    });
  }, [studentsData, GRADE_BOUNDARIES, analysisScope]);

  const examSolverResults = useMemo(() => {
    if (examPredictions.length === 0) return null;
    const sorted = [...examPredictions].sort((a, b) => a.reqToPass - b.reqToPass);
    const total = sorted.length;
    const targetIdx = Math.min(total - 1, Math.max(0, Math.floor((desiredExamPassRate / 100) * total)));
    const requiredExamThreshold = sorted[targetIdx]?.reqToPass || 0;

    let expectedPassCount = 0;
    let expectedFailCount = 0;
    const gradeCounts = {};
    GRADE_BOUNDARIES.forEach(gb => { gradeCounts[gb.grade] = 0; });

    examPredictions.forEach(s => {
      const overallMark = s.ocamContrib + 0.6 * requiredExamThreshold;
      const roundedMark = Math.min(100, Math.max(0, Math.round(overallMark)));
      
      let assignedGrade = "E";
      for (const gb of GRADE_BOUNDARIES) {
        if (roundedMark >= gb.min && roundedMark <= gb.max) {
          assignedGrade = gb.grade;
          break;
        }
      }
      gradeCounts[assignedGrade] = (gradeCounts[assignedGrade] || 0) + 1;
      if (roundedMark >= 40) {
        expectedPassCount++;
      } else {
        expectedFailCount++;
      }
    });

    return {
      requiredExamThreshold,
      expectedPassCount,
      expectedFailCount,
      gradeCounts
    };
  }, [examPredictions, desiredExamPassRate, GRADE_BOUNDARIES]);

  const calculateWhatIfStats = useMemo(() => {
    return (examMark) => {
      let passCount = 0;
      let failCount = 0;
      let totalMark = 0;
      const marks = [];
      const gradeCounts = {};
      GRADE_BOUNDARIES.forEach(gb => { gradeCounts[gb.grade] = 0; });

      examPredictions.forEach(s => {
        const overallMark = s.ocamContrib + 0.6 * examMark;
        const roundedMark = Math.min(100, Math.max(0, Math.round(overallMark)));
        marks.push(roundedMark);
        totalMark += roundedMark;

        let assignedGrade = "E";
        for (const gb of GRADE_BOUNDARIES) {
          if (roundedMark >= gb.min && roundedMark <= gb.max) {
            assignedGrade = gb.grade;
            break;
          }
        }
        gradeCounts[assignedGrade] = (gradeCounts[assignedGrade] || 0) + 1;
        if (roundedMark >= 40) {
          passCount++;
        } else {
          failCount++;
        }
      });

      const total = examPredictions.length;
      const mean = total > 0 ? totalMark / total : 0;
      
      const sortedMarks = [...marks].sort((a, b) => a - b);
      let median = 0;
      if (total > 0) {
        const mid = Math.floor(total / 2);
        median = total % 2 !== 0 ? sortedMarks[mid] : (sortedMarks[mid - 1] + sortedMarks[mid]) / 2;
      }

      const variance = total > 0 ? marks.reduce((sum, m) => sum + Math.pow(m - mean, 2), 0) / total : 0;
      const stdDev = Math.sqrt(variance);

      return {
        passRate: total > 0 ? (passCount / total) * 100 : 0,
        failRate: total > 0 ? (failCount / total) * 100 : 0,
        passCount,
        failCount,
        mean,
        median,
        stdDev,
        gradeCounts
      };
    };
  }, [examPredictions, GRADE_BOUNDARIES]);

  const sortedAndFilteredPredictions = useMemo(() => {
    let result = examPredictions.filter(s => {
      const matchesSearch = s.id.toLowerCase().includes(predSearchQuery.toLowerCase()) ||
                            s.name.toLowerCase().includes(predSearchQuery.toLowerCase());
      const matchesRisk = predRiskFilter === "all" || s.riskLevel.toLowerCase() === (predRiskFilter + " risk").toLowerCase();
      return matchesSearch && matchesRisk;
    });

    result.sort((a, b) => {
      let valA, valB;
      if (predSortBy === "id") {
        valA = a.id;
        valB = b.id;
      } else if (predSortBy === "ocam") {
        valA = a.ocam;
        valB = b.ocam;
      } else if (predSortBy === "requiredExam") {
        valA = a.reqToPass;
        valB = b.reqToPass;
      } else {
        valA = a.id;
        valB = b.id;
      }

      if (valA < valB) return predSortOrder === "asc" ? -1 : 1;
      if (valA > valB) return predSortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [examPredictions, predSearchQuery, predRiskFilter, predSortBy, predSortOrder]);

  const paginatedPredictions = useMemo(() => {
    const start = predPage * predItemsPerPage;
    const limit = predItemsPerPage === -1 ? sortedAndFilteredPredictions.length : predItemsPerPage;
    return sortedAndFilteredPredictions.slice(start, start + limit);
  }, [sortedAndFilteredPredictions, predPage, predItemsPerPage]);

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

    const studentRowsHtml = filteredPassFailStudents.map(s => {
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
      <div class="header" style="flex: 1; min-width: 300px; margin-right: 16px;">
        <h1 class="header-title">OCAM Mark Adjustment & Status Shift Report</h1>
        <div class="header-meta" style="margin-top: 8px; font-size: 13px; color: #4b5563; line-height: 1.6;">
          <strong>Generated:</strong> ${dateStr} &nbsp;|&nbsp; 
          <strong>Mode:</strong> Pass/Fail Target Solver <br />
          <strong>Sorting Method:</strong> ${sortPassFailByShift ? "Status Change First" : "Default Order"} &nbsp;|&nbsp; 
          <strong>Active Search Filter:</strong> ${passFailSearchQuery ? `"${passFailSearchQuery}"` : "None"} &nbsp;|&nbsp; 
          <strong>Records Displayed:</strong> ${filteredPassFailStudents.length} of ${total}
        </div>
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

  const handleDownloadStatusShiftList = (format = "html") => {
    const shiftedStudents = filteredPassFailStudents.filter(s => s.originalStatus !== s.adjustedStatus);
    const courseCode = currentModule?.courseCode || "N/A";
    const dateFileStr = new Date().toISOString().slice(0, 10);
    const reportName = "OCAM_Status_Shift_Report_" + courseCode + "_" + dateFileStr;
    const dateStr = new Date().toLocaleString();
    const modelStr = activeMode === "gaussian" ? "Gaussian (Normal Distribution)" : "Pass/Fail Target Solver";

    const totalStudents = studentsData.length;
    const totalStatusChanges = shiftedStudents.length;
    const promotedCount = shiftedStudents.filter(s => s.originalStatus === "Fail" && s.adjustedStatus === "Pass").length;
    const demotedCount = shiftedStudents.filter(s => s.originalStatus === "Pass" && s.adjustedStatus === "Fail").length;

    const offsetVal = activeMode === "gaussian" ? constantAdd : passFailSolverResult.adjustment;
    const offsetStr = offsetVal >= 0 ? "+" + offsetVal.toFixed(1) : offsetVal.toFixed(1);

    const originalPasses = studentsData.filter(s => s.mark >= 35).length;
    const originalPassPercentage = totalStudents > 0 ? ((originalPasses / totalStudents) * 100).toFixed(1) + "%" : "0%";
    
    const updatedPasses = filteredPassFailStudents.filter(s => s.adjustedStatus === "Pass").length;
    const updatedPassPercentage = totalStudents > 0 ? ((updatedPasses / totalStudents) * 100).toFixed(1) + "%" : "0%";

    if (format === "csv") {
      const csvRows = [
        ["STATUS SHIFT REPORT HEADER"],
        ["Course Code", courseCode],
        ["Module Name", currentModule?.name || "N/A"],
        ["Academic Year", currentModule?.academicYear || "N/A"],
        ["Generation Date & Time", dateStr],
        ["Model Applied", modelStr],
        [],
        ["SUMMARY STATISTICS"],
        ["Total Students Analyzed", totalStudents],
        ["Total Status Changes", totalStatusChanges],
        ["Number of Fail -> Pass Changes", promotedCount],
        ["Number of Pass -> Fail Changes", demotedCount],
        ["Common Mark Offset Applied", offsetStr],
        ["Original Pass Percentage", originalPassPercentage],
        ["Updated Pass Percentage", updatedPassPercentage],
        [],
        ["STATUS SHIFT LIST"],
        ["Registration Number", "Original OCAM Mark", "Common Mark Offset", "Adjusted OCAM Mark", "Original Status", "New Status", "Status Change Type"],
        ...shiftedStudents.map(s => {
          const typeStr = s.originalStatus + " -> " + s.adjustedStatus;
          return [s.id, s.originalMark.toFixed(1), offsetStr, s.adjustedMark.toFixed(1), s.originalStatus, s.adjustedStatus, typeStr];
        })
      ];

      const csvContent = csvRows.map(row => row.map(val => '"' + val + '"').join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", reportName + ".csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (format === "xlsx") {
      const wb = XLSX.utils.book_new();
      
      const summaryData = [
        ["ACADEMIC OCAM STATUS SHIFT EXECUTIVE SUMMARY"],
        ["Course Code", courseCode],
        ["Module Name", currentModule?.name || "N/A"],
        ["Academic Year", currentModule?.academicYear || "N/A"],
        ["Generation Date & Time", dateStr],
        [],
        ["SUMMARY METRICS"],
        ["Total Students Analyzed", totalStudents],
        ["Total Status Changes", totalStatusChanges],
        ["Number of Fail -> Pass Changes", promotedCount],
        ["Number of Pass -> Fail Changes", demotedCount],
        ["Common Mark Offset Applied", offsetStr],
        ["Original Pass Percentage", originalPassPercentage],
        ["Updated Pass Percentage", updatedPassPercentage]
      ];
      
      const listData = [
        ["Registration Number", "Original OCAM Mark", "Common Mark Offset", "Adjusted OCAM Mark", "Original Status", "New Status", "Status Change Type"]
      ];
      
      shiftedStudents.forEach(s => {
        const typeStr = s.originalStatus + " -> " + s.adjustedStatus;
        listData.push([s.id, s.originalMark, offsetVal, s.adjustedMark, s.originalStatus, s.adjustedStatus, typeStr]);
      });
      
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      const listWs = XLSX.utils.aoa_to_sheet(listData);
      
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary Statistics");
      XLSX.utils.book_append_sheet(wb, listWs, "Status Shift List");
      
      XLSX.writeFile(wb, reportName + ".xlsx");
      return;
    }

    if (format === "print") {
      const printWin = window.open("", "_blank");
      const htmlCode = generateStatusShiftHtml(true);
      printWin.document.write(htmlCode);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
      }, 500);
      return;
    }

    const htmlCode = generateStatusShiftHtml(false);
    const blob = new Blob([htmlCode], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", reportName + ".html");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    function generateStatusShiftHtml(isPrintMode = false) {
      const studentRows = shiftedStudents.map(s => {
        const isPromoted = s.originalStatus === "Fail" && s.adjustedStatus === "Pass";
        const rowBg = isPromoted ? "#ecfdf5" : "#fef2f2";
        const rowColor = isPromoted ? "#065f46" : "#991b1b";
        const badgeClass = isPromoted ? "badge-pass" : "badge-fail";
        const shiftText = s.originalStatus + " ➔ " + s.adjustedStatus;

        return `
          <tr style="background-color: ${rowBg}; color: ${rowColor};">
            <td style="font-family: monospace; font-weight: bold;">${s.id}</td>
            <td>${s.originalMark.toFixed(1)}</td>
            <td style="font-weight: bold;">${offsetStr}</td>
            <td style="font-weight: bold;">${s.adjustedMark.toFixed(1)}</td>
            <td><span class="badge ${s.originalStatus === 'Pass' ? 'badge-pass' : 'badge-fail'}">${s.originalStatus}</span></td>
            <td><span class="badge ${s.adjustedStatus === 'Pass' ? 'badge-pass' : 'badge-fail'}">${s.adjustedStatus}</span></td>
            <td><span class="badge ${badgeClass}">${shiftText}</span></td>
          </tr>
        `;
      }).join("");

      return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OCAM Status Shift Report - ${courseCode}</title>
  <style>
    :root {
      --primary: #1e3a8a;
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
      padding: 30px;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .header {
      background: linear-gradient(135deg, var(--secondary) 0%, #1e293b 100%);
      color: #ffffff;
      padding: 32px 24px;
      border-radius: 12px;
      margin-bottom: 30px;
      border-bottom: 4px solid #3b82f6;
    }
    .header-title h1 {
      margin: 0 0 12px 0;
      font-size: 26px;
      font-weight: 800;
    }
    .header-meta {
      font-size: 13.5px;
      color: #94a3b8;
      line-height: 1.6;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
    }
    .card-title {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--text-muted);
      margin-bottom: 8px;
    }
    .card-value {
      font-size: 26px;
      font-weight: 800;
      color: var(--secondary);
    }
    .card-accent-primary { border-left: 4px solid #3b82f6; }
    .card-accent-success { border-left: 4px solid var(--success); }
    .card-accent-danger { border-left: 4px solid var(--danger); }
    .card-accent-warning { border-left: 4px solid var(--warning); }
    
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      font-size: 13.5px;
    }
    th {
      background: #f8fafc;
      color: var(--secondary);
      font-weight: 700;
      padding: 12px 18px;
      text-align: left;
      border-bottom: 2px solid var(--border);
    }
    td {
      padding: 12px 18px;
      border-bottom: 1px solid var(--border);
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
      background: #3b82f6;
      color: #ffffff;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 15px;
    }
    @media print {
      * {
        animation: none !important;
        transition: none !important;
        box-shadow: none !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body { background: #ffffff; padding: 0; }
      .btn-print { display: none !important; }
      .header { background: #f8fafc !important; color: #000000 !important; border: 1px solid #cbd5e1 !important; border-bottom: 3px solid #cbd5e1 !important; }
      .header-meta { color: #475569 !important; }
      .grid { display: block !important; }
      .card { display: inline-block !important; width: 30% !important; margin: 1% !important; border: 1px solid #cbd5e1 !important; }
      table { border: 1px solid #cbd5e1 !important; }
      th, td { border: 1px solid #cbd5e1 !important; }
      .badge-pass { background-color: #d1fae5 !important; color: #065f46 !important; }
      .badge-fail { background-color: #fee2e2 !important; color: #991b1b !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0 0 10px 0;">OCAM Status Shift Report</h1>
    <div class="header-meta">
      <strong>Course Code:</strong> ${courseCode} &nbsp;|&nbsp;
      <strong>Module Name:</strong> ${currentModule?.name || "N/A"} &nbsp;|&nbsp;
      <strong>Academic Year:</strong> ${currentModule?.academicYear || "N/A"} <br />
      <strong>Model Applied:</strong> ${modelStr} &nbsp;|&nbsp;
      <strong>Generated:</strong> ${dateStr}
    </div>
    ${!isPrintMode ? `<button class="btn-print" onclick="window.print()">Print Report / Save PDF</button>` : ''}
  </div>

  <div class="grid">
    <div class="card card-accent-primary">
      <div class="card-title">Total Students Analyzed</div>
      <div class="card-value">${totalStudents}</div>
    </div>
    <div class="card card-accent-warning">
      <div class="card-title">Total Status Changes</div>
      <div class="card-value">${totalStatusChanges}</div>
    </div>
    <div class="card card-accent-success">
      <div class="card-title">Fail ➔ Pass Changes</div>
      <div class="card-value" style="color: var(--success);">${promotedCount}</div>
    </div>
    <div class="card card-accent-danger">
      <div class="card-title">Pass ➔ Fail Changes</div>
      <div class="card-value" style="color: var(--danger);">${demotedCount}</div>
    </div>
    <div class="card card-accent-primary">
      <div class="card-title">Mark Offset Applied</div>
      <div class="card-value">${offsetStr}</div>
    </div>
    <div class="card">
      <div class="card-title">Original Pass Rate</div>
      <div class="card-value">${originalPassPercentage}</div>
    </div>
    <div class="card card-accent-success">
      <div class="card-title">Updated Pass Rate</div>
      <div class="card-value">${updatedPassPercentage}</div>
    </div>
  </div>

  <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 15px;">Status Shift Records Only</h2>
  ${shiftedStudents.length === 0 ? `
    <div style="background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 30px; text-align: center; color: var(--text-muted);">
      No student status changes occurred following this mark offset adjustment.
    </div>
  ` : `
    <table>
      <thead>
        <tr>
          <th>Registration Number</th>
          <th>Original OCAM Mark</th>
          <th>Common Mark Offset</th>
          <th>Adjusted OCAM Mark</th>
          <th>Original Status</th>
          <th>New Status</th>
          <th>Status Change Type</th>
        </tr>
      </thead>
      <tbody>
        ${studentRows}
      </tbody>
    </table>
  `}

  ${isPrintMode ? `<script>window.onload = function() { window.print(); }</script>` : ''}
</body>
</html>
      `;
    }
  };

  const exportConsolidatedReport = (format = "html") => {
    const courseCode = currentModule?.courseCode || "N/A";
    const moduleName = currentModule?.name || "N/A";
    const academicYear = currentModule?.academicYear || "N/A";
    const dateStr = new Date().toLocaleString();
    const dateFileStr = new Date().toISOString().slice(0, 10);
    const modelStr = activeMode === "gaussian" ? "Gaussian (Normal Distribution)" : "Pass/Fail Target Solver";

    // 1. Compute summary stats
    const totalStudents = studentsData.length;
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

    // Pass / Fail status shift stats
    const totalAffected = filteredPassFailStudents.filter(s => s.originalStatus !== s.adjustedStatus).length;
    const promotedCount = filteredPassFailStudents.filter(s => s.originalStatus === "Fail" && s.adjustedStatus === "Pass").length;
    const demotedCount = filteredPassFailStudents.filter(s => s.originalStatus === "Pass" && s.adjustedStatus === "Fail").length;

    const origPasses = filteredPassFailStudents.filter(s => s.originalStatus === "Pass").length;
    const origPassPct = totalStudents > 0 ? ((origPasses / totalStudents) * 100).toFixed(1) + "%" : "0.0%";
    const origFailPct = totalStudents > 0 ? (((totalStudents - origPasses) / totalStudents) * 100).toFixed(1) + "%" : "0.0%";

    const adjPasses = filteredPassFailStudents.filter(s => s.adjustedStatus === "Pass").length;
    const adjPassPct = totalStudents > 0 ? ((adjPasses / totalStudents) * 100).toFixed(1) + "%" : "0.0%";
    const adjFailPct = totalStudents > 0 ? (((totalStudents - adjPasses) / totalStudents) * 100).toFixed(1) + "%" : "0.0%";

    if (format === "csv") {
      // Build a flat consolidated CSV structure
      const csvRows = [
        ["REPORT HEADER INFORMATION"],
        ["Course Code", courseCode],
        ["Module Name", moduleName],
        ["Academic Year", academicYear],
        ["Report Generation Date & Time", dateStr],
        ["Selected OCAM Model", modelStr],
        [],
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
        [],
        ["SECTION 2: CAT 1 COMPARISON ANALYSIS"],
        ["Student ID", "Entry 1", "Entry 2", "Difference", "Status"],
        ...studentsData.map(s => {
          const diff = (s.cat1Entry2 || 0) - (s.cat1Entry1 || 0);
          return [s.id, s.cat1Entry1, s.cat1Entry2, diff, diff > 0 ? "Improved" : diff < 0 ? "Reduced" : "No Change"];
        }),
        [],
        ["SECTION 3: CAT 2 COMPARISON ANALYSIS"],
        ["Student ID", "Entry 1", "Entry 2", "Difference", "Status"],
        ...studentsData.map(s => {
          const diff = (s.cat2Entry2 || 0) - (s.cat2Entry1 || 0);
          return [s.id, s.cat2Entry1, s.cat2Entry2, diff, diff > 0 ? "Improved" : diff < 0 ? "Reduced" : "No Change"];
        }),
        [],
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
        [],
        ["SECTION 5: STATISTICAL ANALYSIS (GAUSSIAN SHIFT)"],
        ["Mean (Original)", Number(origStats.mean.toFixed(2))],
        ["Mean (Adjusted)", Number(adjStats.mean.toFixed(2))],
        ["Std Deviation (Original)", Number(origStats.stdDev.toFixed(2))],
        ["Std Deviation (Adjusted)", Number(adjStats.stdDev.toFixed(2))],
        ["Original Fit Score", originalFitScore + "%"],
        ["Adjusted Fit Score", adjustedFitScore + "%"],
        ["Range", "Expected Ideal Curve", "Actual Counts", "Deviation", "Status"],
        ...deviationRows.map(r => [r.range, r.expected, r.actual, r.diff, r.status]),
        [],
        ["SECTION 6: ADJUSTED STUDENT MARKS & STATUS PREVIEW"],
        ["Student ID", "Original OCAM Mark", "Adjustment Offset", "Adjusted OCAM Mark", "Original Status", "New Status", "Status Shift"],
        ...filteredPassFailStudents.map(s => {
          const shift = s.originalStatus !== s.adjustedStatus ? (s.originalStatus === "Fail" ? "Promoted to Pass" : "Shifted to Fail") : "No Change";
          const offsetLabel = s.offset >= 0 ? "+" + s.offset.toFixed(1) : s.offset.toFixed(1);
          return [s.id, s.originalMark.toFixed(1), offsetLabel, s.adjustedMark.toFixed(1), s.originalStatus, s.adjustedStatus, shift];
        })
      ];

      const csvContent = csvRows.map(row => row.map(val => '"' + val + '"').join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "OCAM_Mark_Summary_Report_" + courseCode + "_" + dateFileStr + ".csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (format === "xlsx") {
      const wb = XLSX.utils.book_new();

      // Tab 1: Dashboard Summary
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

      // Tab 2: CAT 1 Comparison
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

      // Tab 3: CAT 2 Comparison
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

      // Tab 4: OCAM Calculations
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

      // Tab 5: Statistical & Adjusted Preview
      const statsData = [
        ["STATISTICAL CURVE ALIGNMENT & ADJUSTED MARKS PREVIEW"],
        ["Report Generation Date/Time:", dateStr],
        ["Sorting Method:", sortPassFailByShift ? "Status Change First" : "Default Order"],
        ["Search Query Filter:", passFailSearchQuery ? '"' + passFailSearchQuery + '"' : "None"],
        [],
        ["GAUSSIAN DISTRIBUTION METRICS"],
        ["Metric", "Original Value", "Adjusted Value"],
        ["Mean", Number(origStats.mean.toFixed(2)), Number(adjStats.mean.toFixed(2))],
        ["Median", Number(origStats.median.toFixed(2)), Number(adjStats.median.toFixed(2))],
        ["Mode", Number(origStats.mode.toFixed(2)), Number(adjStats.mode.toFixed(2))],
        ["Standard Deviation", Number(origStats.stdDev.toFixed(2)), Number(adjStats.stdDev.toFixed(2))],
        ["Skewness", Number(origStats.skewness.toFixed(2)), Number(adjStats.skewness.toFixed(2))],
        ["Kurtosis", Number(origStats.kurtosis.toFixed(2)), Number(adjStats.kurtosis.toFixed(2))],
        ["Gaussian Fit Alignment Score", originalFitScore + "%", adjustedFitScore + "%"],
        [],
        ["ADJUSTED STUDENT MARKS PREVIEW LOG"],
        ["Student ID", "Original OCAM Mark", "Adjustment Offset", "Adjusted OCAM Mark", "Original Status", "New Status", "Status Shift"]
      ];
      filteredPassFailStudents.forEach(s => {
        const shift = s.originalStatus !== s.adjustedStatus ? (s.originalStatus === "Fail" ? "Promoted to Pass" : "Shifted to Fail") : "No Change";
        const offsetLabel = s.offset >= 0 ? "+" + s.offset.toFixed(1) : s.offset.toFixed(1);
        statsData.push([s.id, s.originalMark.toFixed(1), offsetLabel, s.adjustedMark.toFixed(1), s.originalStatus, s.adjustedStatus, shift]);
      });
      const statsWs = XLSX.utils.aoa_to_sheet(statsData);
      statsWs['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, statsWs, "Statistical & Adjusted Marks");

      XLSX.writeFile(wb, "OCAM_Mark_Summary_Report_" + courseCode + "_" + dateFileStr + ".xlsx");
      return;
    }

    // Default: Consolidated HTML
    const isPromotedVal = s => s.originalStatus === "Fail" && s.adjustedStatus === "Pass";
    const isDemotedVal = s => s.originalStatus === "Pass" && s.adjustedStatus === "Fail";

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
      const isProm = isPromotedVal(s);
      const isDem = isDemotedVal(s);
      let rowBg = "#ffffff";
      let rowColor = "#333333";
      let shiftText = "No Change";
      let shiftBadge = "badge-neutral";
      if (isProm) {
        rowBg = "#ecfdf5";
        rowColor = "#065f46";
        shiftText = "Fail ➔ Pass (Promoted)";
        shiftBadge = "badge-pass";
      } else if (isDem) {
        rowBg = "#fef2f2";
        rowColor = "#991b1b";
        shiftText = "Pass ➔ Fail (Demoted)";
        shiftBadge = "badge-fail";
      }
      const offsetLabel = s.offset >= 0 ? "+" + s.offset.toFixed(1) : s.offset.toFixed(1);
      return `
        <tr style="background-color: ${rowBg}; color: ${rowColor};">
          <td style="font-family: monospace; font-weight: bold;">${s.id}</td>
          <td>${s.originalMark.toFixed(1)}</td>
          <td style="font-weight: bold;">${offsetLabel}</td>
          <td style="font-weight: bold;">${s.adjustedMark.toFixed(1)}</td>
          <td><span class="badge ${s.originalStatus === 'Pass' ? 'badge-pass' : 'badge-fail'}">${s.originalStatus}</span></td>
          <td><span class="badge ${s.adjustedStatus === 'Pass' ? 'badge-pass' : 'badge-fail'}">${s.adjustedStatus}</span></td>
          <td><span class="badge ${shiftBadge}">${shiftText}</span></td>
        </tr>
      `;
    }).join("");

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
      <button class="tab-btn active" onclick="showTab('summary')">Dashboard Summary</button>
      <button class="tab-btn" onclick="showTab('cat1')">CAT 1 Analysis</button>
      <button class="tab-btn" onclick="showTab('cat2')">CAT 2 Analysis</button>
      <button class="tab-btn" onclick="showTab('ocam')">OCAM Calculation</button>
      <button class="tab-btn" onclick="showTab('statistical')">Statistical Analysis</button>
      <button class="tab-btn" onclick="showTab('preview')">Adjusted Preview</button>
    </div>
  </div>

  <div class="container">
    <!-- SECTION 1: Dashboard Summary -->
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

      <div class="chart-container">
        <canvas id="catChart" style="max-height: 380px; width: 100%;"></canvas>
      </div>

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

    <!-- SECTION 2: CAT 1 Analysis -->
    <div id="cat1" class="report-section">
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

    <!-- SECTION 3: CAT 2 Analysis -->
    <div id="cat2" class="report-section">
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

    <!-- SECTION 4: OCAM Calculation -->
    <div id="ocam" class="report-section">
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

    <!-- SECTION 5: Statistical Analysis -->
    <div id="statistical" class="report-section">
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

      <div class="chart-container">
        <canvas id="gaussianChart" style="max-height: 380px; width: 100%;"></canvas>
      </div>

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

    <!-- SECTION 6: Adjusted Preview -->
    <div id="preview" class="report-section">
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
          <span style="font-size: 16px; font-weight: 700; color: var(--primary-light);">${sortPassFailByShift ? "Status Change First" : "Default Order"}</span>
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
  </div>

  <script>
    const chartData = ${JSON.stringify(chartsDataset)};
    
    window.onload = function() {
      if (typeof Chart !== 'undefined') {
        // CAT performance comparison
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

        // Gaussian Bell curve
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
      }
    };
  </script>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "OCAM_Mark_Summary_Report_" + courseCode + "_" + dateFileStr + ".html");
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
        <button
          onClick={() => setActiveMode("exam_prediction")}
          style={{
            background: activeMode === "exam_prediction" ? "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))" : "transparent",
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
          <TrendingUp size={16} />
          Final Exam Predictor & Pass Analyzer
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
              <div style={{ position: "relative", display: "inline-block" }}>
                <button 
                  className="btn-primary" 
                  onClick={() => setShowExportDropdown(!showExportDropdown)}
                  style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", fontSize: "13px" }}
                >
                  <Download size={16} />
                  <span>Export Executive Report</span>
                  <ChevronDown size={14} />
                </button>
                {showExportDropdown && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 8px)",
                      background: "var(--bg-secondary)",
                      border: "var(--glass-border)",
                      borderRadius: "8px",
                      boxShadow: "var(--glass-shadow)",
                      padding: "8px 0",
                      minWidth: "240px",
                      zIndex: 9999
                    }}
                  >
                    <div
                      onClick={() => {
                        exportConsolidatedReport("html");
                        setShowExportDropdown(false);
                      }}
                      style={{
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        cursor: "pointer",
                        fontSize: "13px",
                        color: "var(--text-primary)",
                        transition: "background 0.2s"
                      }}
                      className="dropdown-item-hover"
                    >
                      <FileText size={16} color="var(--accent-primary)" />
                      <span>HTML Report (.html) - Default</span>
                    </div>

                    <div
                      onClick={() => {
                        exportConsolidatedReport("xlsx");
                        setShowExportDropdown(false);
                      }}
                      style={{
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        cursor: "pointer",
                        fontSize: "13px",
                        color: "var(--text-primary)",
                        transition: "background 0.2s"
                      }}
                      className="dropdown-item-hover"
                    >
                      <FileSpreadsheet size={16} color="var(--accent-success)" />
                      <span>Excel Workbook (.xlsx)</span>
                    </div>

                    <div
                      onClick={() => {
                        exportConsolidatedReport("csv");
                        setShowExportDropdown(false);
                      }}
                      style={{
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        cursor: "pointer",
                        fontSize: "13px",
                        color: "var(--text-primary)",
                        transition: "background 0.2s"
                      }}
                      className="dropdown-item-hover"
                    >
                      <FileText size={16} color="var(--accent-primary)" />
                      <span>CSV Document (.csv)</span>
                    </div>

                    <div
                      onClick={() => {
                        window.print();
                        setShowExportDropdown(false);
                      }}
                      style={{
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        cursor: "pointer",
                        fontSize: "13px",
                        color: "var(--text-primary)",
                        borderTop: "1px solid rgba(255,255,255,0.05)",
                        transition: "background 0.2s"
                      }}
                      className="dropdown-item-hover"
                    >
                      <Printer size={16} color="var(--accent-secondary)" />
                      <span>Print Report / Save PDF</span>
                    </div>
                  </div>
                )}
              </div>
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
      {activeMode === "exam_prediction" && (() => {
        const whatIfStats = calculateWhatIfStats(whatIfExamAvg);
        const totalStudents = examPredictions.length;
        const lowRiskCount = examPredictions.filter(p => p.riskLevel === "Low Risk").length;
        const modRiskCount = examPredictions.filter(p => p.riskLevel === "Moderate Risk").length;
        const highRiskCount = examPredictions.filter(p => p.riskLevel === "High Risk").length;
        const guaranteedPassCount = examPredictions.filter(p => p.isGuaranteed).length;

        return (
          <>
            {/* Analysis Scope Selector Bar */}
            <div className="glass-panel" style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>Analysis Scope Selector</span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Current Mode: {analysisScope === "eligible" ? "Eligible Students Only (OCAM ≥ 35)" : "All Cohort Students"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  {(() => {
                    const eligibleCount = studentsData.filter(s => s.mark >= 35).length;
                    const totalCount = studentsData.length;
                    const pct = totalCount > 0 ? ((eligibleCount / totalCount) * 100).toFixed(1) : "0";
                    return `Cohort Statistics: ${eligibleCount} of ${totalCount} students eligible (${pct}%)`;
                  })()}
                </span>
                <select
                  value={analysisScope}
                  onChange={e => {
                    setAnalysisScope(e.target.value);
                    setPredPage(0);
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
                    fontWeight: "600"
                  }}
                >
                  <option value="all" style={{ background: "#181825" }}>All Students ({studentsData.length})</option>
                  <option value="eligible" style={{ background: "#181825" }}>Eligible Students Only (OCAM ≥ 35) ({studentsData.filter(s => s.mark >= 35).length})</option>
                </select>
              </div>
            </div>

            {/* Cohort-Level Pass Prediction & Risk Summary Cards */}
            <div className="stats-row-sim" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
              <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: "500" }}>Total Students</span>
                <strong style={{ fontSize: "28px", color: "var(--text-primary)" }}>{totalStudents}</strong>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Active Cohort Size</span>
              </div>
              <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px", borderLeft: "4px solid var(--accent-success)" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: "500" }}>Guaranteed Pass</span>
                <strong style={{ fontSize: "28px", color: "var(--accent-success)" }}>{guaranteedPassCount}</strong>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>OCAM Contribution ≥ 40</span>
              </div>
              <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px", borderLeft: "4px solid var(--accent-success)" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: "500" }}>Low Risk (Req ≤ 35)</span>
                <strong style={{ fontSize: "28px", color: "var(--accent-success)" }}>{lowRiskCount}</strong>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{totalStudents > 0 ? ((lowRiskCount / totalStudents) * 100).toFixed(1) : 0}% of cohort</span>
              </div>
              <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px", borderLeft: "4px solid var(--accent-primary)" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: "500" }}>Moderate Risk (35-55)</span>
                <strong style={{ fontSize: "28px", color: "var(--accent-primary)" }}>{modRiskCount}</strong>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{totalStudents > 0 ? ((modRiskCount / totalStudents) * 100).toFixed(1) : 0}% of cohort</span>
              </div>
              <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px", borderLeft: "4px solid var(--accent-danger)" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: "500" }}>High Risk (Req &gt; 55)</span>
                <strong style={{ fontSize: "28px", color: "var(--accent-danger)" }}>{highRiskCount}</strong>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{totalStudents > 0 ? ((highRiskCount / totalStudents) * 100).toFixed(1) : 0}% of cohort</span>
              </div>
            </div>

            {/* Solvers & Simulator Controls Panel */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", flexWrap: "wrap" }}>
              
              {/* Final Exam Pass Rate Target Solver */}
              <div className="glass-panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
                <h3 style={{ fontSize: "18px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Award size={20} color="var(--accent-primary)" />
                  Final Examination Pass Rate Target Solver
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Determine the uniform minimum Final Exam score required across the cohort to hit your targeted overall pass percentage.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Target Pass Rate:</span>
                    <strong style={{ color: "var(--accent-primary)", fontSize: "16px" }}>{desiredExamPassRate}%</strong>
                  </div>
                  <input 
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={desiredExamPassRate}
                    onChange={e => setDesiredExamPassRate(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "var(--accent-primary)", cursor: "pointer" }}
                  />
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {[70, 75, 80, 85, 90].map(pr => (
                      <button
                        key={`preset-pr-${pr}`}
                        onClick={() => setDesiredExamPassRate(pr)}
                        className="btn-secondary"
                        style={{ padding: "4px 8px", fontSize: "12px", flex: 1 }}
                      >
                        {pr}%
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ background: "rgba(0,0,0,0.2)", padding: "16px", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Required Exam Mark:</span>
                    <strong style={{ fontSize: "16px", color: "var(--accent-primary)" }}>{examSolverResults?.requiredExamThreshold.toFixed(1)}%</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Expected Pass:</span>
                    <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--accent-success)" }}>{examSolverResults?.expectedPassCount} students ({totalStudents > 0 ? ((examSolverResults.expectedPassCount / totalStudents) * 100).toFixed(1) : 0}%)</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Expected Fail:</span>
                    <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--accent-danger)" }}>{examSolverResults?.expectedFailCount} students ({totalStudents > 0 ? ((examSolverResults.expectedFailCount / totalStudents) * 100).toFixed(1) : 0}%)</span>
                  </div>
                </div>
              </div>

              {/* What-If Scenario Analysis Simulator */}
              <div className="glass-panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
                <h3 style={{ fontSize: "18px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <TrendingUp size={20} color="var(--accent-secondary)" />
                  What-If Performance Simulator
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Simulate cohort-level pass rate, grade distribution, and summary marks under different average Final Exam score assumptions.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Simulated Average Final Exam Mark:</span>
                    <strong style={{ color: "var(--accent-secondary)", fontSize: "16px" }}>{whatIfExamAvg}%</strong>
                  </div>
                  <input 
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={whatIfExamAvg}
                    onChange={e => setWhatIfExamAvg(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "var(--accent-secondary)", cursor: "pointer" }}
                  />
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {[40, 50, 60, 70, 80].map(examMark => (
                      <button
                        key={`preset-exam-${examMark}`}
                        onClick={() => setWhatIfExamAvg(examMark)}
                        className="btn-secondary"
                        style={{ padding: "4px 8px", fontSize: "12px", flex: 1 }}
                      >
                        Avg = {examMark}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ background: "rgba(0,0,0,0.2)", padding: "16px", borderRadius: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Predicted Pass Rate</span>
                    <strong style={{ fontSize: "18px", color: "var(--accent-success)" }}>{whatIfStats.passRate.toFixed(1)}%</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Predicted Fail Rate</span>
                    <strong style={{ fontSize: "18px", color: "var(--accent-danger)" }}>{whatIfStats.failRate.toFixed(1)}%</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Cohort Mean / Median</span>
                    <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>{whatIfStats.mean.toFixed(1)} / {whatIfStats.median.toFixed(1)}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Standard Deviation</span>
                    <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>{whatIfStats.stdDev.toFixed(2)}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Visual Analytics Charts Section */}
            <div className="glass-panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
              <h3 style={{ fontSize: "18px", color: "var(--text-primary)" }}>Grade Distribution Forecast & Comparison</h3>
              <div style={{ width: "100%", height: "300px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={
                    GRADE_BOUNDARIES.map(gb => ({
                      name: gb.grade,
                      "Target Solver": examSolverResults?.gradeCounts[gb.grade] || 0,
                      "What-If Simulator": whatIfStats.gradeCounts[gb.grade] || 0
                    })).reverse()
                  }>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" />
                    <Tooltip contentStyle={{ background: "var(--bg-secondary)", border: "var(--glass-border)" }} />
                    <Legend />
                    <Bar dataKey="Target Solver" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="What-If Simulator" fill="var(--accent-secondary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Student-Level Detailed Predictor Table */}
            <div className="glass-panel" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h3 style={{ fontSize: "18px", color: "var(--text-primary)", fontWeight: "600" }}>
                    Student Pass Requirement Analyzer List
                  </h3>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                    Check exact minimum Final Exam marks required per student to achieve specific grade thresholds (Pass Mark C = 40).
                  </p>
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Risk:</span>
                    <select
                      value={predRiskFilter}
                      onChange={e => { setPredRiskFilter(e.target.value); setPredPage(0); }}
                      style={{ background: "rgba(0,0,0,0.3)", border: "var(--glass-border)", padding: "8px 12px", borderRadius: "8px", color: "var(--text-primary)", fontSize: "13px", outline: "none", cursor: "pointer" }}
                    >
                      <option value="all" style={{ background: "#181825" }}>All Risk Levels</option>
                      <option value="low" style={{ background: "#181825" }}>Low Risk (Req ≤ 35)</option>
                      <option value="moderate" style={{ background: "#181825" }}>Moderate Risk (35-55)</option>
                      <option value="high" style={{ background: "#181825" }}>High Risk (Req &gt; 55)</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Sort By:</span>
                    <select
                      value={predSortBy}
                      onChange={e => setPredSortBy(e.target.value)}
                      style={{ background: "rgba(0,0,0,0.3)", border: "var(--glass-border)", padding: "8px 12px", borderRadius: "8px", color: "var(--text-primary)", fontSize: "13px", outline: "none", cursor: "pointer" }}
                    >
                      <option value="id" style={{ background: "#181825" }}>Reg Number</option>
                      <option value="ocam" style={{ background: "#181825" }}>OCAM Mark</option>
                      <option value="requiredExam" style={{ background: "#181825" }}>Required Exam to Pass</option>
                    </select>
                    <select
                      value={predSortOrder}
                      onChange={e => setPredSortOrder(e.target.value)}
                      style={{ background: "rgba(0,0,0,0.3)", border: "var(--glass-border)", padding: "8px 12px", borderRadius: "8px", color: "var(--text-primary)", fontSize: "13px", outline: "none", cursor: "pointer" }}
                    >
                      <option value="asc" style={{ background: "#181825" }}>Ascending</option>
                      <option value="desc" style={{ background: "#181825" }}>Descending</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Show:</span>
                    <select 
                      value={predItemsPerPage}
                      onChange={e => { setPredItemsPerPage(Number(e.target.value)); setPredPage(0); }}
                      style={{ background: "rgba(0,0,0,0.3)", border: "var(--glass-border)", padding: "8px 12px", borderRadius: "8px", color: "var(--text-primary)", fontSize: "13px", outline: "none", cursor: "pointer" }}
                    >
                      <option value={10} style={{ background: "#181825" }}>10 rows</option>
                      <option value={25} style={{ background: "#181825" }}>25 rows</option>
                      <option value={50} style={{ background: "#181825" }}>50 rows</option>
                      <option value={-1} style={{ background: "#181825" }}>All records</option>
                    </select>
                  </div>

                  <div style={{ position: "relative", minWidth: "220px" }}>
                    <Search style={{ position: "absolute", left: "10px", top: "10px", color: "var(--text-muted)" }} size={14} />
                    <input 
                      type="text" 
                      placeholder="Search Reg No..."
                      value={predSearchQuery}
                      onChange={e => { setPredSearchQuery(e.target.value); setPredPage(0); }}
                      style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "var(--glass-border)", padding: "8px 12px 8px 30px", borderRadius: "8px", color: "var(--text-primary)", fontSize: "13px", outline: "none" }}
                    />
                  </div>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="table" style={{ fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                      <th>Reg No.</th>
                      <th>OCAM Mark</th>
                      <th>OCAM (40%)</th>
                      <th style={{ color: "var(--accent-success)" }}>Exam to C (Pass)</th>
                      <th>Exam to C+</th>
                      <th>Exam to B-</th>
                      <th>Exam to B</th>
                      <th>Exam to B+</th>
                      <th>Exam to A-</th>
                      <th>Exam to A</th>
                      <th>Exam to A+</th>
                      <th>Risk Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPredictions.length > 0 ? paginatedPredictions.map((s, idx) => {
                      const isHighRisk = s.riskLevel === "High Risk";
                      const isLowRisk = s.riskLevel === "Low Risk";
                      return (
                        <tr key={`${s.id}-pred-${idx}`}>
                          <td style={{ fontFamily: "monospace", fontWeight: "600" }}>{s.id}</td>
                          <td>{s.ocam.toFixed(1)}</td>
                          <td>{s.ocamContrib.toFixed(1)}</td>
                          <td style={{ fontWeight: "700", color: isLowRisk ? "var(--accent-success)" : isHighRisk ? "var(--accent-danger)" : "var(--accent-primary)" }}>
                            {s.reqToPass <= 0 ? "Guaranteed" : `${s.reqToPass}%`}
                          </td>
                          <td>{s.requiredMarks["C+"] <= 0 ? "0.0%" : `${s.requiredMarks["C+"]}%`}</td>
                          <td>{s.requiredMarks["B-"] <= 0 ? "0.0%" : `${s.requiredMarks["B-"]}%`}</td>
                          <td>{s.requiredMarks["B"] <= 0 ? "0.0%" : `${s.requiredMarks["B"]}%`}</td>
                          <td>{s.requiredMarks["B+"] <= 0 ? "0.0%" : `${s.requiredMarks["B+"]}%`}</td>
                          <td>{s.requiredMarks["A-"] <= 0 ? "0.0%" : `${s.requiredMarks["A-"]}%`}</td>
                          <td>{s.requiredMarks["A"] <= 0 ? "0.0%" : `${s.requiredMarks["A"]}%`}</td>
                          <td>{s.requiredMarks["A+"] <= 0 ? "0.0%" : `${s.requiredMarks["A+"]}%`}</td>
                          <td>
                            <span style={{
                              padding: "2px 8px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: "600",
                              background: isLowRisk ? "rgba(16, 185, 129, 0.1)" : isHighRisk ? "rgba(239, 68, 68, 0.1)" : "rgba(59, 130, 246, 0.1)",
                              color: isLowRisk ? "var(--accent-success)" : isHighRisk ? "var(--accent-danger)" : "var(--accent-primary)"
                            }}>
                              {s.riskLevel}
                            </span>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="12" style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                          No students matched the query filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {(() => {
                const predLimit = predItemsPerPage === -1 ? sortedAndFilteredPredictions.length : predItemsPerPage;
                return sortedAndFilteredPredictions.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", flexWrap: "wrap", gap: "12px" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                      Showing {sortedAndFilteredPredictions.length > 0 ? (predPage * predLimit + 1) : 0} - {Math.min((predPage + 1) * predLimit, sortedAndFilteredPredictions.length)} of {sortedAndFilteredPredictions.length} Students
                    </span>
                    
                    {predItemsPerPage !== -1 && sortedAndFilteredPredictions.length > predLimit && (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button 
                          className="btn-secondary"
                          disabled={predPage === 0}
                          onClick={() => setPredPage(p => p - 1)}
                          style={{ padding: "6px 12px", fontSize: "13px" }}
                        >
                          Previous
                        </button>
                        <button 
                          className="btn-secondary"
                          disabled={(predPage + 1) * predLimit >= sortedAndFilteredPredictions.length}
                          onClick={() => setPredPage(p => p + 1)}
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
        );
      })()}

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

                <div style={{ position: "relative", display: "inline-block" }}>
                  <button 
                    className="btn-primary" 
                    onClick={() => setShowStatusShiftDropdown(!showStatusShiftDropdown)}
                    style={{ padding: "10px 16px", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px", border: "none", backgroundColor: "var(--accent-primary)", borderRadius: "8px", cursor: "pointer", color: "#ffffff", fontWeight: "600" }}
                  >
                    <Download size={16} />
                    <span>Download Status Shift List Only</span>
                    <ChevronDown size={14} />
                  </button>
                  {showStatusShiftDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "calc(100% + 8px)",
                        background: "var(--bg-secondary)",
                        border: "var(--glass-border)",
                        borderRadius: "8px",
                        boxShadow: "var(--glass-shadow)",
                        padding: "8px 0",
                        minWidth: "260px",
                        zIndex: 9999
                      }}
                    >
                      <div
                        onClick={() => {
                          handleDownloadStatusShiftList("html");
                          setShowStatusShiftDropdown(false);
                        }}
                        style={{
                          padding: "10px 16px",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          cursor: "pointer",
                          fontSize: "13px",
                          color: "var(--text-primary)",
                          transition: "background 0.2s"
                        }}
                        className="dropdown-item-hover"
                      >
                        <FileText size={16} color="var(--accent-primary)" />
                        <span>HTML Report (.html) - Default</span>
                      </div>

                      <div
                        onClick={() => {
                          handleDownloadStatusShiftList("xlsx");
                          setShowStatusShiftDropdown(false);
                        }}
                        style={{
                          padding: "10px 16px",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          cursor: "pointer",
                          fontSize: "13px",
                          color: "var(--text-primary)",
                          transition: "background 0.2s"
                        }}
                        className="dropdown-item-hover"
                      >
                        <FileSpreadsheet size={16} color="var(--accent-success)" />
                        <span>Excel Workbook (.xlsx)</span>
                      </div>

                      <div
                        onClick={() => {
                          handleDownloadStatusShiftList("csv");
                          setShowStatusShiftDropdown(false);
                        }}
                        style={{
                          padding: "10px 16px",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          cursor: "pointer",
                          fontSize: "13px",
                          color: "var(--text-primary)",
                          transition: "background 0.2s"
                        }}
                        className="dropdown-item-hover"
                      >
                        <FileText size={16} color="var(--accent-primary)" />
                        <span>CSV Document (.csv)</span>
                      </div>

                      <div
                        onClick={() => {
                          handleDownloadStatusShiftList("print");
                          setShowStatusShiftDropdown(false);
                        }}
                        style={{
                          padding: "10px 16px",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          cursor: "pointer",
                          fontSize: "13px",
                          color: "var(--text-primary)",
                          borderTop: "1px solid rgba(255,255,255,0.05)",
                          transition: "background 0.2s"
                        }}
                        className="dropdown-item-hover"
                      >
                        <Printer size={16} color="var(--accent-secondary)" />
                        <span>Print-Friendly Format</span>
                      </div>
                    </div>
                  )}
                </div>

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
                    <th>Original OCAM Mark</th>
                    <th>Common Mark Offset</th>
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
                        <td>{s.originalMark.toFixed(1)}</td>
                        <td style={{ 
                          fontFamily: "monospace", 
                          fontWeight: "700", 
                          color: offsetVal > 0 ? "var(--accent-success)" : offsetVal < 0 ? "var(--accent-danger)" : "var(--text-muted)" 
                        }}>
                          {offsetVal >= 0 ? `+${offsetVal.toFixed(1)}` : offsetVal.toFixed(1)}
                        </td>
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
