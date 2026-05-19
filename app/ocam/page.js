import { prisma } from "@/lib/prisma";
import styles from "../page.module.css";
import SearchInput from "@/components/SearchInput";
import FilterDropdown from "@/components/FilterDropdown";

export const dynamic = 'force-dynamic';

export default async function OCAMPage({ searchParams }) {
  const params = await searchParams;
  const query = params?.q || "";
  const eligibilityFilter = params?.filter || "All";

  const students = await prisma.student.findMany({
    where: query ? { id: { contains: query } } : undefined,
    include: {
      marks: { include: { module: true } },
      ocam: true
    }
  });

  // Flatten the data for display
  let tableData = [];
  students.forEach(student => {
    student.marks.forEach(markEntry => {
      const ocamResult = student.ocam.find(o => o.moduleId === markEntry.moduleId);
      
      const cat1 = Math.max(markEntry.cat1Entry1 || 0, markEntry.cat1Entry2 || 0);
      const cat2 = Math.max(markEntry.cat2Entry1 || 0, markEntry.cat2Entry2 || 0);
      
      const cat1Weight = cat1 * 0.40;
      const cat2Weight = cat2 * 0.60;
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
        cat1Weight: cat1Weight.toFixed(1),
        cat2Weight: cat2Weight.toFixed(1),
        ocamFinal: ocamFinal.toFixed(1),
        ocamRounded,
        eligibility
      });
    });
  });

  // Apply Eligibility Filter
  if (eligibilityFilter !== "All") {
    tableData = tableData.filter(row => row.eligibility === eligibilityFilter);
  }

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Final OCAM Calculations</h1>
          <p className={styles.subtitle}>Detailed breakdown of final calculated marks and eligibility.</p>
        </div>
        <div className={styles.actions} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <SearchInput placeholder="Search Reg. No..." />
          <FilterDropdown 
            options={[
              { label: 'Eligible (Yes)', value: 'Yes' },
              { label: 'Not Eligible (No)', value: 'No' },
              { label: 'Absent (AB)', value: 'AB' }
            ]} 
          />
          <a href="/api/export/excel" className="btn-primary">Export OCAM Sheet</a>
        </div>
      </header>

      <section className={styles.recentActivity}>
        <div className={`glass-panel ${styles.activityCard}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Registration No.</th>
                <th>CAT 1 Mark (Verified)</th>
                <th>CAT 2 Mark (Verified)</th>
                <th>CAT1 Weight (×0.40)</th>
                <th>CAT2 Weight (×0.60)</th>
                <th>OCAM Final</th>
                <th>OCAM Rounded</th>
                <th>Eligibility</th>
              </tr>
            </thead>
            <tbody>
              {tableData.length > 0 ? tableData.map((row, idx) => {
                return (
                  <tr key={`${row.id}-${row.moduleId}-${idx}`}>
                    <td>{row.id}</td>
                    <td>{row.cat1}</td>
                    <td>{row.cat2}</td>
                    <td>{row.cat1Weight}</td>
                    <td>{row.cat2Weight}</td>
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
      </section>
    </div>
  );
}
