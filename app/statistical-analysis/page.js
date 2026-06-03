import { prisma } from "@/lib/prisma";
import styles from "../page.module.css";
import CurveSimulator from "@/components/CurveSimulator";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export default async function StatisticalAnalysisPage() {
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

  const allResults = await prisma.oCAMResult.findMany({ 
    where: moduleFilter,
    include: {
      student: true
    }
  });

  const markEntries = await prisma.markEntry.findMany({
    where: moduleFilter
  });
  
  // Map complete student details for simulation and individual offsets
  const studentsData = allResults.map(r => {
    const marks = markEntries.find(m => m.studentId === r.studentId);
    const cat1 = Math.max(marks?.cat1Entry1 || 0, marks?.cat1Entry2 || 0);
    const cat2 = Math.max(marks?.cat2Entry1 || 0, marks?.cat2Entry2 || 0);
    const cat1Weight = cat1 >= cat2 ? cat1 * 0.60 : cat1 * 0.40;
    const cat2Weight = cat1 >= cat2 ? cat2 * 0.40 : cat2 * 0.60;
    const ocamFinal = cat1Weight + cat2Weight;
    const ocamRounded = Math.round(ocamFinal);

    return {
      id: r.studentId,
      name: r.student.name,
      mark: ocamRounded,
      cat1Entry1: marks?.cat1Entry1 || 0,
      cat1Entry2: marks?.cat1Entry2 || 0,
      cat2Entry1: marks?.cat2Entry1 || 0,
      cat2Entry2: marks?.cat2Entry2 || 0
    };
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
            Statistical Analysis & Curve Adjustment
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
          <p className={styles.subtitle}>Dynamically analyze and adjust marks to fit a Gaussian (Normal) Distribution.</p>
        </div>
      </header>

      <section className={styles.recentActivity}>
        <CurveSimulator studentsData={studentsData} currentModule={currentModule} />
      </section>
    </div>
  );
}
