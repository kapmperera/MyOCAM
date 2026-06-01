"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/page.module.css";
import { Trash2, Eye } from "lucide-react";

export default function RecentModulesTable({ recentModules, selectedModuleId }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSelect = async (moduleId) => {
    try {
      await fetch('/api/modules/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId })
      });
      router.refresh();
    } catch (error) {
      console.error("Failed to select module", error);
    }
  };

  const handleDelete = async (moduleId) => {
    if (!confirm("Are you sure you want to delete this module and all its associated marks? This cannot be undone.")) return;
    
    try {
      const res = await fetch(`/api/modules/${moduleId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert("Failed to delete module.");
      }
    } catch (error) {
      console.error("Failed to delete module", error);
    }
  };

  return (
    <div className={`glass-panel ${styles.activityCard}`}>
      <div className={styles.activityHeader}>
        <h3>
          {selectedModuleId ? "Currently Viewing Selected Module" : "Recent Modules Processed"}
        </h3>
        {selectedModuleId && (
          <button 
            className="btn-primary" 
            onClick={() => handleSelect(null)}
            style={{ padding: "6px 12px", fontSize: "14px" }}
          >
            View All Modules
          </button>
        )}
      </div>
      <div className="table-wrapper">
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Module Name</th>
              <th>Course Code</th>
              <th>Academic Year</th>
              <th>Processed Date</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recentModules.length > 0 ? recentModules.map(m => {
              const isSelected = m.id === selectedModuleId;
              return (
                <tr key={m.id} style={isSelected ? { backgroundColor: "rgba(59, 130, 246, 0.1)" } : {}}>
                  <td>
                    {m.name} {isSelected && <span style={{fontSize: "12px", marginLeft: "8px", color: "var(--accent-primary)"}}>(Selected)</span>}
                  </td>
                  <td>{m.courseCode}</td>
                  <td>{m.academicYear}</td>
                  <td style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                    {mounted ? new Date(m.createdAt).toLocaleString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : "Loading..."}
                  </td>
                  <td style={{ textAlign: "right", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    {!isSelected ? (
                      <button 
                        onClick={() => handleSelect(m.id)}
                        style={{ background: "transparent", border: "1px solid var(--accent-primary)", color: "var(--accent-primary)", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        <Eye size={14} /> View
                      </button>
                    ) : (
                      <span style={{ color: "var(--accent-success)", padding: "4px 8px", display: "flex", alignItems: "center", gap: "4px" }}>
                        Viewing
                      </span>
                    )}
                    
                    <button 
                      onClick={() => handleDelete(m.id)}
                      style={{ background: "transparent", border: "1px solid var(--accent-danger)", color: "var(--accent-danger)", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="5" style={{textAlign: "center", color: "var(--text-muted)"}}>No modules processed yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
