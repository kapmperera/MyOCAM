import { prisma } from "@/lib/prisma";
import styles from "../page.module.css";
import SearchInput from "@/components/SearchInput";

export const dynamic = 'force-dynamic';

export default async function CAT2Page({ searchParams }) {
  const params = await searchParams;
  const query = params?.q || "";

  const markEntries = await prisma.markEntry.findMany({
    where: query ? { studentId: { contains: query } } : undefined,
    include: {
      student: true,
      module: true
    }
  });

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>CAT 2 Comparison</h1>
          <p className={styles.subtitle}>Detailed comparison between CAT 2 Entry 1 and Entry 2.</p>
        </div>
        <div className={styles.actions} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <SearchInput placeholder="Search Reg. No..." />
          <a href="/api/export/excel" className="btn-primary">Export Excel</a>
        </div>
      </header>

      <section className={styles.recentActivity}>
        <div className={`glass-panel ${styles.activityCard}`}>
          <div className={styles.activityHeader}>
            <h3>Comparison Table</h3>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Registration Number</th>
                <th>Module</th>
                <th>Entry 1</th>
                <th>Entry 2</th>
                <th>Difference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {markEntries.length > 0 ? markEntries.map(entry => {
                const diff = (entry.cat2Entry2 || 0) - (entry.cat2Entry1 || 0);
                const isImproved = diff > 0;
                const isReduced = diff < 0;
                
                return (
                  <tr key={entry.id}>
                    <td>{entry.studentId}</td>
                    <td>{entry.module.courseCode}</td>
                    <td>{entry.cat2Entry1 ?? '-'}</td>
                    <td>{entry.cat2Entry2 ?? '-'}</td>
                    <td style={{ color: isImproved ? 'var(--accent-success)' : isReduced ? 'var(--accent-danger)' : 'var(--text-primary)'}}>
                      {diff > 0 ? `+${diff}` : diff}
                    </td>
                    <td>
                      {isImproved && <span className={styles.statusSuccess}>Improved</span>}
                      {isReduced && <span className={styles.statusPending} style={{background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)'}}>Reduced</span>}
                      {diff === 0 && <span style={{color: 'var(--text-muted)'}}>No Change</span>}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="6" style={{textAlign: "center", color: "var(--text-muted)"}}>No CAT 2 data available. Please upload files.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
