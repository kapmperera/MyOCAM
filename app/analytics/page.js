import { prisma } from "@/lib/prisma";
import styles from "../page.module.css";
import DashboardCharts from "@/components/DashboardCharts";

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const allResults = await prisma.oCAMResult.findMany();
  
  // Compute Performance Bands
  const bands = { Distinction: 0, Merit: 0, Credit: 0, Pass: 0, Fail: 0, Absent: 0 };
  allResults.forEach(r => {
    if (r.grade && bands[r.grade] !== undefined) {
      bands[r.grade]++;
    }
  });
  const performanceBands = Object.keys(bands).map(key => ({ name: key, count: bands[key] }));

  // Compute Mark Ranges for CAT1 and CAT2
  const allMarks = await prisma.markEntry.findMany();
  const ranges = [
    { name: '0-20', CAT1: 0, CAT2: 0, min: 0, max: 20 },
    { name: '21-40', CAT1: 0, CAT2: 0, min: 21, max: 40 },
    { name: '41-60', CAT1: 0, CAT2: 0, min: 41, max: 60 },
    { name: '61-80', CAT1: 0, CAT2: 0, min: 61, max: 80 },
    { name: '81-100', CAT1: 0, CAT2: 0, min: 81, max: 100 }
  ];

  allMarks.forEach(m => {
    const cat1 = Math.max(m.cat1Entry1 || 0, m.cat1Entry2 || 0);
    const cat2 = Math.max(m.cat2Entry1 || 0, m.cat2Entry2 || 0);

    ranges.forEach(range => {
      if (cat1 >= range.min && cat1 <= range.max) range.CAT1++;
      if (cat2 >= range.min && cat2 <= range.max) range.CAT2++;
    });
  });

  const chartData = {
    performanceBands,
    markRanges: ranges.map(r => ({ name: r.name, CAT1: r.CAT1, CAT2: r.CAT2 }))
  };

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Detailed Analytics</h1>
          <p className={styles.subtitle}>Deep dive into student performance metrics.</p>
        </div>
        <div className={styles.actions}>
          <a href="/api/export/excel" className="btn-primary">Export Report</a>
        </div>
      </header>

      <section className={styles.chartsSection}>
        <DashboardCharts chartData={chartData} />
      </section>
    </div>
  );
}
