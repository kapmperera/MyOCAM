import { prisma } from "@/lib/prisma";
import styles from "../page.module.css";
import SearchInput from "@/components/SearchInput";
import ExportFilteredData from "@/components/ExportFilteredData";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export default async function CAT2Page({ searchParams }) {
  const params = await searchParams;
  const query = params?.q || "";
  const sortBy = params?.sort || "default";
  
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

  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'registered_center_enabled' }
  });
  const isCenterEnabled = setting?.value === 'true';

  let centerMap = new Map();
  if (isCenterEnabled) {
    const mappings = await prisma.centerMapping.findMany();
    mappings.forEach(m => {
      centerMap.set(m.registrationNumber, m.centerName);
    });
  }

  let markEntries = await prisma.markEntry.findMany({
    where: {
      ...(query ? { studentId: { contains: query } } : {}),
      ...(selectedModuleId ? { moduleId: selectedModuleId } : {})
    },
    include: {
      student: true,
      module: true
    }
  });

  // Filter to only include records that have at least one CAT 2 entry mark
  markEntries = markEntries.filter(entry => entry.cat2Entry1 !== null || entry.cat2Entry2 !== null);

  const mismatchesCount = markEntries.filter(entry => 
    entry.cat2Entry1 !== null && entry.cat2Entry2 !== null && entry.cat2Entry1 !== entry.cat2Entry2
  ).length;

  const regMismatchesCount = markEntries.filter(entry => 
    (entry.cat2Entry1 !== null && entry.cat2Entry2 === null) || (entry.cat2Entry1 === null && entry.cat2Entry2 !== null)
  ).length;

  const crossRegMismatchesCount = markEntries.filter(entry => 
    entry.cat1Entry1 === null && entry.cat1Entry2 === null
  ).length;

  let tableData = markEntries.map(entry => {
    const diff = (entry.cat2Entry2 || 0) - (entry.cat2Entry1 || 0);
    const hasMismatch = entry.cat2Entry1 !== null && entry.cat2Entry2 !== null && entry.cat2Entry1 !== entry.cat2Entry2;
    const hasRegMismatch = (entry.cat2Entry1 !== null && entry.cat2Entry2 === null) || (entry.cat2Entry1 === null && entry.cat2Entry2 !== null);
    const hasCrossRegMismatch = entry.cat1Entry1 === null && entry.cat1Entry2 === null;
    return {
      id: entry.id,
      studentId: entry.studentId,
      courseCode: entry.module.courseCode,
      cat2Entry1: entry.cat2Entry1,
      cat2Entry2: entry.cat2Entry2,
      diff,
      hasMismatch,
      hasRegMismatch,
      hasCrossRegMismatch,
      center: isCenterEnabled ? (centerMap.get(entry.studentId) || 'Unmapped') : null
    };
  });

  // Sort mismatches first if requested
  if (sortBy === "mismatch") {
    tableData.sort((a, b) => {
      const aHas = a.hasMismatch || a.hasRegMismatch || a.hasCrossRegMismatch;
      const bHas = b.hasMismatch || b.hasRegMismatch || b.hasCrossRegMismatch;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return 0;
    });
  }

  const exportData = tableData.map(entry => ({
    'Registration Number': entry.studentId,
    'Module': entry.courseCode,
    ...(isCenterEnabled ? { 'Registered Center': entry.center } : {}),
    'Entry 1': entry.cat2Entry1 ?? '-',
    'Entry 2': entry.cat2Entry2 ?? '-',
    'Difference': entry.diff,
    'Status': entry.hasMismatch ? 'Mismatch' : entry.hasRegMismatch ? 'Unmatched Registration' : entry.hasCrossRegMismatch ? 'Missing in CAT 1' : 'No Change'
  }));

  const getSortUrl = (type) => {
    const newParams = new URLSearchParams(params);
    newParams.set("sort", type);
    return `?${newParams.toString()}`;
  };

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>CAT 2 Comparison</h1>
          <p className={styles.subtitle}>Detailed comparison between CAT 2 Entry 1 and Entry 2.</p>
        </div>
        <div className={styles.actions} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <SearchInput placeholder="Search Reg. No..." />
          <ExportFilteredData data={exportData} filename="CAT 2 Comparison Report" />
        </div>
      </header>

      {(mismatchesCount > 0 || regMismatchesCount > 0 || crossRegMismatchesCount > 0) && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          color: '#f87171',
          lineHeight: '1.5'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <strong>CAT 2 Verification Alert:</strong> We detected
              {mismatchesCount > 0 && <span> <strong>{mismatchesCount}</strong> mark discrepancies</span>}
              {(mismatchesCount > 0 && (regMismatchesCount > 0 || crossRegMismatchesCount > 0)) && <span>,</span>}
              {regMismatchesCount > 0 && <span> <strong>{regMismatchesCount}</strong> unmatched registration numbers</span>}
              {(regMismatchesCount > 0 && crossRegMismatchesCount > 0) && <span> and</span>}
              {crossRegMismatchesCount > 0 && <span> <strong>{crossRegMismatchesCount}</strong> registration numbers missing in CAT 1 dataset</span>}
              . Affected rows have been highlighted in red below for correction.
              
              {(regMismatchesCount > 0 || crossRegMismatchesCount > 0) && (
                <div style={{ marginTop: '8px', fontSize: '13px', background: 'rgba(0, 0, 0, 0.2)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {regMismatchesCount > 0 && (
                    <div>
                      <strong style={{ color: '#f59e0b' }}>Unmatched Registration Numbers:</strong>{' '}
                      <span style={{ color: '#fff', fontFamily: 'monospace' }}>
                        {tableData.filter(row => row.hasRegMismatch).map(row => row.studentId).join(', ')}
                      </span>
                    </div>
                  )}
                  {crossRegMismatchesCount > 0 && (
                    <div>
                      <strong style={{ color: '#ef4444' }}>Registration Numbers Missing in CAT 1 Dataset:</strong>{' '}
                      <span style={{ color: '#fff', fontFamily: 'monospace' }}>
                        {tableData.filter(row => row.hasCrossRegMismatch).map(row => row.studentId).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            {sortBy === "mismatch" ? (
              <a href={getSortUrl("default")} className="btn-secondary" style={{ whiteSpace: 'nowrap', textDecoration: 'none', background: 'rgba(255,255,255,0.1)' }}>
                🔄 Restore Default Order
              </a>
            ) : (
              <a href={getSortUrl("mismatch")} className="btn-primary" style={{ whiteSpace: 'nowrap', textDecoration: 'none' }}>
                ⚠️ Sort Mismatches First
              </a>
            )}
          </div>
        </div>
      )}

      <section className={styles.recentActivity}>
        <div className={`glass-panel ${styles.activityCard}`}>
          <div className={styles.activityHeader}>
            <h3>Comparison Table</h3>
          </div>
          <div className="table-wrapper">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Registration Number</th>
                  <th>Module</th>
                  {isCenterEnabled && <th>Registered Center</th>}
                  <th>Entry 1</th>
                  <th>Entry 2</th>
                  <th>Difference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tableData.length > 0 ? tableData.map(entry => {
                  return (
                    <tr 
                      key={entry.id}
                      style={entry.hasMismatch || entry.hasRegMismatch || entry.hasCrossRegMismatch ? { background: 'rgba(239, 68, 68, 0.05)', borderLeft: '3px solid #ef4444' } : {}}
                    >
                      <td style={entry.hasRegMismatch || entry.hasCrossRegMismatch ? { color: '#ef4444', fontWeight: 'bold' } : {}}>
                        {entry.studentId}
                        {entry.hasRegMismatch && (
                          <span style={{
                            fontSize: '10px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginLeft: '8px',
                            border: '1px solid rgba(239, 68, 68, 0.2)'
                          }}>Unmatched Reg</span>
                        )}
                        {entry.hasCrossRegMismatch && (
                          <span style={{
                            fontSize: '10px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#fca5a5',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginLeft: '8px',
                            border: '1px solid rgba(239, 68, 68, 0.3)'
                          }}>Missing in CAT 1</span>
                        )}
                      </td>
                      <td>{entry.courseCode}</td>
                      {isCenterEnabled && (
                        <td style={{ color: entry.center === 'Unmapped' ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: entry.center === 'Unmapped' ? 'normal' : '500' }}>
                          {entry.center}
                        </td>
                      )}
                      <td>{entry.cat2Entry1 ?? '-'}</td>
                      <td>{entry.cat2Entry2 ?? '-'}</td>
                      <td style={{ color: entry.hasMismatch ? 'var(--accent-danger)' : 'var(--text-primary)'}}>
                        {entry.diff > 0 ? `+${entry.diff}` : entry.diff}
                      </td>
                      <td>
                        {entry.hasMismatch ? (
                          <span className={styles.statusPending} style={{background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)'}}>Mismatch</span>
                        ) : entry.hasRegMismatch ? (
                          <span className={styles.statusPending} style={{background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)'}}>Unmatched Reg</span>
                        ) : entry.hasCrossRegMismatch ? (
                          <span className={styles.statusPending} style={{background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)'}}>Missing in CAT 1</span>
                        ) : (
                          <span style={{color: 'var(--text-muted)'}}>No Change</span>
                        )}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={isCenterEnabled ? "7" : "6"} style={{textAlign: "center", color: "var(--text-muted)"}}>No CAT 2 data available. Please upload files.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
