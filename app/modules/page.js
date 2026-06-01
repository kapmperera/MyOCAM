import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import styles from "../page.module.css";
import RecentModulesTable from "@/components/RecentModulesTable";

export const dynamic = 'force-dynamic';

export default async function ModulesPage() {
  const cookieStore = await cookies();
  const selectedModuleId = cookieStore.get('selectedModuleId')?.value;

  // Fetch ALL modules without a limit
  const allModules = await prisma.module.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Module History</h1>
          <p className={styles.subtitle}>View and manage all previously processed OCAM modules.</p>
        </div>
      </header>

      <section className={styles.recentActivity}>
        <RecentModulesTable 
          recentModules={allModules} 
          selectedModuleId={selectedModuleId} 
        />
      </section>
    </div>
  );
}
