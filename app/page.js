import styles from "./page.module.css";
import DashboardCards from "@/components/DashboardCards";
import DashboardCharts from "@/components/DashboardCharts";
import CatMarksAnalysis from "@/components/CatMarksAnalysis";
import RecentModulesTable from "@/components/RecentModulesTable";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export default async function Home() {
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

  const totalStudents = selectedModuleId 
    ? allResults.length 
    : await prisma.student.count({ where: { marks: { some: {} } } });
  const totalModules = selectedModuleId ? 1 : await prisma.module.count();
  
  const eligibleStudents = allResults.filter(r => r.passFail === "Yes");
  const notEligibleCount = allResults.filter(r => r.passFail === "No").length;
  const absentCount = allResults.filter(r => r.passFail === "AB").length;

  const totalEligibleMarks = eligibleStudents.reduce((acc, curr) => acc + (curr.finalOCAM || 0), 0);
  const avgOCAM = eligibleStudents.length > 0 ? (totalEligibleMarks / eligibleStudents.length).toFixed(1) : 0;
  
  const passRate = allResults.length > 0 ? Math.round((eligibleStudents.length / allResults.length) * 100) : 0;


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

  let cat1AbsentCount = 0;
  let cat2AbsentCount = 0;

  allMarks.forEach(m => {
    const cat1 = Math.max(m.cat1Entry1 || 0, m.cat1Entry2 || 0);
    const cat2 = Math.max(m.cat2Entry1 || 0, m.cat2Entry2 || 0);

    if (cat1 === 0) cat1AbsentCount++;
    if (cat2 === 0) cat2AbsentCount++;

    ranges.forEach(range => {
      if (cat1 >= range.min && cat1 <= range.max) range.CAT1++;
      if (cat2 >= range.min && cat2 <= range.max) range.CAT2++;
    });
  });

  const chartData = {
    performanceBands,
    markRanges: ranges.map(r => ({ name: r.name, CAT1: r.CAT1, CAT2: r.CAT2 }))
  };

  // Compute CAT Marks Analysis Table Data
  let cat1Sum = 0, cat2Sum = 0;
  let cat1Max = -1, cat2Max = -1;
  let cat1Min = 101, cat2Min = 101;
  let cat1Pass = 0, cat2Pass = 0;
  let cat1Fail = 0, cat2Fail = 0;
  let totalValidCAT1 = 0, totalValidCAT2 = 0;

  allMarks.forEach(m => {
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

  const analysisData = {
    cat1Avg: totalValidCAT1 > 0 ? cat1Sum / totalValidCAT1 : 0,
    cat2Avg: totalValidCAT2 > 0 ? cat2Sum / totalValidCAT2 : 0,
    cat1Max: cat1Max === -1 ? 0 : cat1Max,
    cat2Max: cat2Max === -1 ? 0 : cat2Max,
    cat1Min: cat1Min === 101 ? 0 : cat1Min,
    cat2Min: cat2Min === 101 ? 0 : cat2Min,
    cat1Pass,
    cat2Pass,
    cat1Fail,
    cat2Fail
  };

  const stats = {
    totalStudents,
    totalModules,
    avgMark: avgOCAM,
    passRate,
    absentCount,
    notEligibleCount,
    cat1AbsentCount,
    cat2AbsentCount
  };

  const recentModules = await prisma.module.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      _count: {
        select: { ocam: true }
      }
    }
  });

  let currentModule = null;
  if (selectedModuleId) {
    currentModule = await prisma.module.findUnique({ where: { id: selectedModuleId } });
  }

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            Academic Dashboard
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
          <p className={styles.subtitle}>Welcome back, Admin. Here is the latest overview.</p>
        </div>
        <div className={styles.actions}>
          <a href="/api/export/excel" className="btn-primary">Generate Report</a>
        </div>
      </header>

      <section className={styles.statsSection}>
        <DashboardCards initialStats={stats} />
      </section>
      
      <section className={styles.statsSection} style={{ marginTop: "24px" }}>
        <CatMarksAnalysis analysisData={analysisData} />
      </section>

      <section className={styles.chartsSection}>
        <DashboardCharts chartData={chartData} />
      </section>
      
      <section className={styles.recentActivity}>
        <RecentModulesTable recentModules={recentModules} selectedModuleId={selectedModuleId} />
      </section>
    </div>
  );
}
