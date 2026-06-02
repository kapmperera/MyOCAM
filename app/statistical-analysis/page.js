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
  
  // Map complete student details for simulation and individual offsets
  const studentsData = allResults.map(r => ({
    id: r.studentId,
    name: r.student.name,
    mark: r.finalOCAM || 0
  }));

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
        <CurveSimulator studentsData={studentsData} />
      </section>
    </div>
  );
}
