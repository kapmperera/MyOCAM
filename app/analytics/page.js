import { prisma } from "@/lib/prisma";
import styles from "../page.module.css";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
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

  const allResults = await prisma.oCAMResult.findMany({ where: moduleFilter });
  
  // Compute Performance Bands
  const bands = { Distinction: 0, Merit: 0, Credit: 0, Pass: 0, Fail: 0, Absent: 0 };
  allResults.forEach(r => {
    if (r.grade && bands[r.grade] !== undefined) {
      bands[r.grade]++;
    }
  });
  const performanceBands = Object.keys(bands).map(key => ({ name: key, count: bands[key] }));

  // Compute Mark Ranges for CAT1 and CAT2
  const allMarks = await prisma.markEntry.findMany({ where: moduleFilter });
  const ranges = [
    { name: '0-20', CAT1: 0, CAT2: 0, min: 0, max: 20 },
    { name: '21-40', CAT1: 0, CAT2: 0, min: 21, max: 40 },
    { name: '41-60', CAT1: 0, CAT2: 0, min: 41, max: 60 },
    { name: '61-80', CAT1: 0, CAT2: 0, min: 61, max: 80 },
    { name: '81-100', CAT1: 0, CAT2: 0, min: 81, max: 100 }
  ];

  // Compute Absenteeism Data
  let cat1Only = 0, cat2Only = 0, bothAbsent = 0, neverAbsent = 0;
  
  allMarks.forEach(m => {
    const cat1 = Math.max(m.cat1Entry1 || 0, m.cat1Entry2 || 0);
    const cat2 = Math.max(m.cat2Entry1 || 0, m.cat2Entry2 || 0);

    if (cat1 === 0 && cat2 === 0) bothAbsent++;
    else if (cat1 === 0) cat1Only++;
    else if (cat2 === 0) cat2Only++;
    else neverAbsent++;

    ranges.forEach(range => {
      if (cat1 >= range.min && cat1 <= range.max) range.CAT1++;
      if (cat2 >= range.min && cat2 <= range.max) range.CAT2++;
    });
  });

  const absenteeismData = [
    { name: 'Never Absent', value: neverAbsent, color: '#10B981' },
    { name: 'CAT 1 Only', value: cat1Only, color: '#F59E0B' },
    { name: 'CAT 2 Only', value: cat2Only, color: '#3B82F6' },
    { name: 'Both Absent', value: bothAbsent, color: '#EF4444' }
  ];

  // Compute Eligibility Funnel
  const totalRegistered = allResults.length;
  const satForExams = totalRegistered - bothAbsent;
  const eligibleStudents = allResults.filter(r => r.passFail === "Yes").length;

  const funnelData = [
    { name: 'Total Students', count: totalRegistered, color: '#3B82F6' },
    { name: 'Sat for Exams', count: satForExams, color: '#8B5CF6' },
    { name: 'Eligible (Pass)', count: eligibleStudents, color: '#10B981' }
  ];

  // Compute Final Outcome Ratio
  const passed = eligibleStudents;
  const failed = allResults.filter(r => r.passFail === "No").length;
  const absent = allResults.filter(r => r.passFail === "AB").length;

  const outcomeData = [
    { name: 'Passed', value: passed },
    { name: 'Failed', value: failed },
    { name: 'Absent', value: absent }
  ];

  const chartData = {
    performanceBands,
    markRanges: ranges.map(r => ({ name: r.name, CAT1: r.CAT1, CAT2: r.CAT2 })),
    absenteeismData,
    funnelData,
    outcomeData
  };

  let currentModule = null;
  if (selectedModuleId) {
    currentModule = await prisma.module.findUnique({ where: { id: selectedModuleId } });
  }

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            Detailed Analytics
            {currentModule && (
              <span style={{
                fontSize: "16px", 
                fontWeight: "normal", 
                marginLeft: "12px", 
                padding: "4px 10px", 
                background: "rgba(59, 130, 246, 0.1)", 
                border: "1px solid var(--accent-primary)", 
                borderRadius: "20px", 
                color: "var(--accent-primary)"
              }}>
                Viewing: {currentModule.courseCode} - {currentModule.name}
              </span>
            )}
          </h1>
          <p className={styles.subtitle}>Deep dive into student performance metrics.</p>
        </div>
        <div className={styles.actions}>
          <a href="/api/export/excel" className="btn-primary">Export Report</a>
        </div>
      </header>

      <section className={styles.chartsSection}>
        <AnalyticsCharts chartData={chartData} />
      </section>
    </div>
  );
}
