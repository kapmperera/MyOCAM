import { prisma } from "@/lib/prisma";
import styles from "../page.module.css";
import SearchInput from "@/components/SearchInput";
import FilterDropdown from "@/components/FilterDropdown";
import CustomRangeFilter from "@/components/CustomRangeFilter";
import ExportFilteredData from "@/components/ExportFilteredData";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export default async function OCAMPage({ searchParams }) {
  const params = await searchParams;
  const query = params?.q || "";
  const eligibilityFilter = params?.filter || "All";
  const rangeFilter = params?.range || "All";
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

  const students = await prisma.student.findMany({
    where: {
      ...(query ? { id: { contains: query } } : {}),
      ...(selectedModuleId ? { marks: { some: { moduleId: selectedModuleId } } } : {})
    },
    include: {
      marks: { 
        where: selectedModuleId ? { moduleId: selectedModuleId } : undefined,
        include: { module: true } 
      },
      ocam: {
        where: selectedModuleId ? { moduleId: selectedModuleId } : undefined
      }
    }
  });

  // Flatten the data for display
  let tableData = [];
  students.forEach(student => {
    student.marks.forEach(markEntry => {
      const ocamResult = student.ocam.find(o => o.moduleId === markEntry.moduleId);
      
      const cat1 = Math.max(markEntry.cat1Entry1 || 0, markEntry.cat1Entry2 || 0);
      const cat2 = Math.max(markEntry.cat2Entry1 || 0, markEntry.cat2Entry2 || 0);
      
      const cat1Entry1 = markEntry.cat1Entry1;
      const cat1Entry2 = markEntry.cat1Entry2;
      const cat2Entry1 = markEntry.cat2Entry1;
      const cat2Entry2 = markEntry.cat2Entry2;

      const cat1Mismatch = cat1Entry1 !== null && cat1Entry2 !== null && cat1Entry1 !== cat1Entry2;
      const cat2Mismatch = cat2Entry1 !== null && cat2Entry2 !== null && cat2Entry1 !== cat2Entry2;
      const cat1RegMismatch = (cat1Entry1 !== null && cat1Entry2 === null) || (cat1Entry1 === null && cat1Entry2 !== null);
      const cat2RegMismatch = (cat2Entry1 !== null && cat2Entry2 === null) || (cat2Entry1 === null && cat2Entry2 !== null);
      const missingInCat2 = (cat1Entry1 !== null || cat1Entry2 !== null) && (cat2Entry1 === null && cat2Entry2 === null);
      const missingInCat1 = (cat2Entry1 !== null || cat2Entry2 !== null) && (cat1Entry1 === null && cat1Entry2 === null);

      const cat1Weight = cat1 >= cat2 ? cat1 * 0.60 : cat1 * 0.40;
      const cat2Weight = cat1 >= cat2 ? cat2 * 0.40 : cat2 * 0.60;
      const ocamFinal = cat1Weight + cat2Weight;
      const ocamRounded = Math.round(ocamFinal);
      
      let eligibility = "No";
      if (cat1 === 0 && cat2 === 0) eligibility = "AB";
      else if (ocamRounded >= 35) eligibility = "Yes";

      tableData.push({
        id: student.id,
        moduleId: markEntry.moduleId,
        courseCode: markEntry.module.courseCode,
        cat1,
        cat2,
        cat1Entry1,
        cat1Entry2,
        cat2Entry1,
        cat2Entry2,
        cat1Mismatch,
        cat2Mismatch,
        cat1RegMismatch,
        cat2RegMismatch,
        missingInCat1,
        missingInCat2,
        cat1Weight: cat1Weight.toFixed(1),
        cat2Weight: cat2Weight.toFixed(1),
        ocamFinal: ocamFinal.toFixed(1),
        ocamRounded,
        eligibility
      });
    });
  });

  // Calculate total mismatches for the module before filtering
  const totalCat1Mismatches = tableData.filter(row => row.cat1Mismatch).length;
  const totalCat2Mismatches = tableData.filter(row => row.cat2Mismatch).length;
  const totalCat1RegMismatches = tableData.filter(row => row.cat1RegMismatch).length;
  const totalCat2RegMismatches = tableData.filter(row => row.cat2RegMismatch).length;
  const totalMissingInCat1 = tableData.filter(row => row.missingInCat1).length;
  const totalMissingInCat2 = tableData.filter(row => row.missingInCat2).length;
  const totalMismatches = totalCat1Mismatches + totalCat2Mismatches;
  const totalRegMismatches = totalCat1RegMismatches + totalCat2RegMismatches + totalMissingInCat1 + totalMissingInCat2;

  // Apply Eligibility Filter
  if (eligibilityFilter !== "All") {
    tableData = tableData.filter(row => row.eligibility === eligibilityFilter);
  }

  // Apply Range Filter
  if (rangeFilter !== "All") {
    const [min, max] = rangeFilter.split('-').map(Number);
    tableData = tableData.filter(row => row.ocamRounded >= min && row.ocamRounded <= max);
  }

  // Sort mismatches first if requested
  if (sortBy === "mismatch") {
    tableData.sort((a, b) => {
      const aHas = a.cat1Mismatch || a.cat2Mismatch || a.cat1RegMismatch || a.cat2RegMismatch || a.missingInCat1 || a.missingInCat2;
      const bHas = b.cat1Mismatch || b.cat2Mismatch || b.cat1RegMismatch || b.cat2RegMismatch || b.missingInCat1 || b.missingInCat2;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return 0;
    });
  }

  const getSortUrl = (type) => {
    const newParams = new URLSearchParams(params);
    newParams.set("sort", type);
    return `?${newParams.toString()}`;
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
            Final OCAM Calculations
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
          <p className={styles.subtitle}>Detailed breakdown of final calculated marks and eligibility.</p>
        </div>
        <div className={`${styles.actions} ${styles.ocamActions}`}>
          <SearchInput placeholder="Search Reg. No..." />
          <FilterDropdown 
            paramName="filter"
            defaultLabel="All Students"
            options={[
              { label: 'Eligible (Yes)', value: 'Yes' },
              { label: 'Not Eligible (No)', value: 'No' },
              { label: 'Absent (AB)', value: 'AB' }
            ]} 
          />
          <CustomRangeFilter paramName="range" />
          <ExportFilteredData data={tableData} />
        </div>
      </header>

      {(totalMismatches > 0 || totalRegMismatches > 0) && (
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
              <strong>Mark Verification Alert:</strong> We detected
              {totalMismatches > 0 && <span> <strong>{totalMismatches}</strong> mark discrepancies ({totalCat1Mismatches} in CAT 1, {totalCat2Mismatches} in CAT 2)</span>}
              {totalMismatches > 0 && totalRegMismatches > 0 && <span> and</span>}
              {totalRegMismatches > 0 && <span> <strong>{totalRegMismatches}</strong> unmatched or missing registration numbers</span>}
              for this module. Affected rows have been highlighted in red below for your review.
              
              {totalRegMismatches > 0 && (
                <div style={{ marginTop: '8px', fontSize: '13px', background: 'rgba(0, 0, 0, 0.2)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {totalCat1RegMismatches > 0 && (
                    <div>
                      <strong style={{ color: '#f59e0b' }}>CAT 1 Unmatched Registration Numbers:</strong>{' '}
                      <span style={{ color: '#fff', fontFamily: 'monospace' }}>
                        {tableData.filter(row => row.cat1RegMismatch).map(row => row.id).join(', ')}
                      </span>
                    </div>
                  )}
                  {totalCat2RegMismatches > 0 && (
                    <div>
                      <strong style={{ color: '#f59e0b' }}>CAT 2 Unmatched Registration Numbers:</strong>{' '}
                      <span style={{ color: '#fff', fontFamily: 'monospace' }}>
                        {tableData.filter(row => row.cat2RegMismatch).map(row => row.id).join(', ')}
                      </span>
                    </div>
                  )}
                  {totalMissingInCat1 > 0 && (
                    <div>
                      <strong style={{ color: '#ef4444' }}>Registration Numbers Missing in CAT 1 Dataset:</strong>{' '}
                      <span style={{ color: '#fff', fontFamily: 'monospace' }}>
                        {tableData.filter(row => row.missingInCat1).map(row => row.id).join(', ')}
                      </span>
                    </div>
                  )}
                  {totalMissingInCat2 > 0 && (
                    <div>
                      <strong style={{ color: '#ef4444' }}>Registration Numbers Missing in CAT 2 Dataset:</strong>{' '}
                      <span style={{ color: '#fff', fontFamily: 'monospace' }}>
                        {tableData.filter(row => row.missingInCat2).map(row => row.id).join(', ')}
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

      <div style={{ marginBottom: "16px", color: "var(--text-secondary)", fontWeight: "500" }}>
        Showing {tableData.length} {tableData.length === 1 ? "record" : "records"}
      </div>

      <section className={styles.recentActivity}>
        <div className={`glass-panel ${styles.activityCard}`}>
          <div className="table-wrapper">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Registration No.</th>
                  <th>CAT 1 Mark (Verified)</th>
                  <th>CAT 2 Mark (Verified)</th>
                  <th>CAT 1 Weight</th>
                  <th>CAT 2 Weight</th>
                  <th>OCAM Final</th>
                  <th>OCAM Rounded</th>
                  <th>Eligibility</th>
                </tr>
              </thead>
              <tbody>
                {tableData.length > 0 ? tableData.map((row, idx) => {
                  const hasMismatch = row.cat1Mismatch || row.cat2Mismatch;
                  const hasRegMismatch = row.cat1RegMismatch || row.cat2RegMismatch;
                  const hasCrossRegMismatch = row.missingInCat1 || row.missingInCat2;
                  return (
                    <tr 
                      key={`${row.id}-${row.moduleId}-${idx}`}
                      style={hasMismatch || hasRegMismatch || hasCrossRegMismatch ? { background: 'rgba(239, 68, 68, 0.05)', borderLeft: '3px solid #ef4444' } : {}}
                    >
                      <td style={hasRegMismatch || hasCrossRegMismatch ? { color: '#ef4444', fontWeight: 'bold' } : {}}>
                        {row.id}
                        {hasRegMismatch && (
                          <div style={{
                            fontSize: '10px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginTop: '4px',
                            display: 'inline-block',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            fontWeight: 'bold'
                          }}>
                            Unmatched Reg ({row.cat1RegMismatch ? 'CAT 1' : ''}{row.cat1RegMismatch && row.cat2RegMismatch ? ' & ' : ''}{row.cat2RegMismatch ? 'CAT 2' : ''})
                          </div>
                        )}
                        {row.missingInCat1 && (
                          <div style={{
                            fontSize: '10px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#fca5a5',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginTop: '4px',
                            display: 'inline-block',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            fontWeight: 'bold'
                          }}>
                            Missing in CAT 1
                          </div>
                        )}
                        {row.missingInCat2 && (
                          <div style={{
                            fontSize: '10px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#fca5a5',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginTop: '4px',
                            display: 'inline-block',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            fontWeight: 'bold'
                          }}>
                            Missing in CAT 2
                          </div>
                        )}
                      </td>
                      <td>
                        {row.cat1}
                        {row.cat1Mismatch && (
                          <div style={{ color: '#f87171', fontSize: '11px', marginTop: '4px', fontWeight: 'bold' }}>
                            Mismatch! (E1: {row.cat1Entry1} vs E2: {row.cat1Entry2})
                          </div>
                        )}
                        {row.cat1RegMismatch && (
                          <div style={{ color: '#f59e0b', fontSize: '11px', marginTop: '4px', fontWeight: 'bold' }}>
                            Unmatched Registration!
                          </div>
                        )}
                        {row.missingInCat1 && (
                          <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', fontWeight: 'bold' }}>
                            Missing in CAT 1 Dataset!
                          </div>
                        )}
                      </td>
                      <td>
                        {row.cat2}
                        {row.cat2Mismatch && (
                          <div style={{ color: '#f87171', fontSize: '11px', marginTop: '4px', fontWeight: 'bold' }}>
                            Mismatch! (E1: {row.cat2Entry1} vs E2: {row.cat2Entry2})
                          </div>
                        )}
                        {row.cat2RegMismatch && (
                          <div style={{ color: '#f59e0b', fontSize: '11px', marginTop: '4px', fontWeight: 'bold' }}>
                            Unmatched Registration!
                          </div>
                        )}
                        {row.missingInCat2 && (
                          <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', fontWeight: 'bold' }}>
                            Missing in CAT 2 Dataset!
                          </div>
                        )}
                      </td>
                      <td>
                        {row.cat1Weight}{' '}
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 4px', borderRadius: '4px' }}>
                          {row.cat1 >= row.cat2 ? '60%' : '40%'}
                        </span>
                      </td>
                      <td>
                        {row.cat2Weight}{' '}
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 4px', borderRadius: '4px' }}>
                          {row.cat1 >= row.cat2 ? '40%' : '60%'}
                        </span>
                      </td>
                      <td>{row.ocamFinal}</td>
                      <td><strong>{row.ocamRounded}</strong></td>
                      <td>
                        <span className={row.eligibility === 'Yes' ? styles.statusSuccess : styles.statusPending} 
                              style={row.eligibility === 'No' ? {background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)'} : row.eligibility === 'AB' ? {background: 'rgba(100, 100, 100, 0.2)', color: 'var(--text-muted)'} : {}}>
                          {row.eligibility}
                        </span>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="8" style={{textAlign: "center", color: "var(--text-muted)"}}>No OCAM results available.</td>
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
