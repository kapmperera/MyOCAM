"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/page.module.css";
import { Trash2, Eye } from "lucide-react";

export default function RecentModulesTable({ recentModules, selectedModuleId }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const [editingModuleId, setEditingModuleId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCourseCode, setEditCourseCode] = useState("");
  const [editAcademicYear, setEditAcademicYear] = useState("");

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

  const startEdit = (module) => {
    setEditingModuleId(module.id);
    setEditName(module.name);
    setEditCourseCode(module.courseCode);
    setEditAcademicYear(module.academicYear);
  };

  const cancelEdit = () => {
    setEditingModuleId(null);
  };

  const handleSave = async (moduleId) => {
    if (!editName || !editCourseCode || !editAcademicYear) {
      alert("All fields are required.");
      return;
    }

    try {
      const res = await fetch(`/api/modules/${moduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          courseCode: editCourseCode,
          academicYear: editAcademicYear
        })
      });
      if (res.ok) {
        setEditingModuleId(null);
        router.refresh();
      } else {
        alert("Failed to save changes.");
      }
    } catch (error) {
      console.error("Failed to save module details", error);
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
              <th>Total Students</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recentModules.length > 0 ? recentModules.map(m => {
              const isSelected = m.id === selectedModuleId;
              const isEditingThisRow = editingModuleId === m.id;
              
              return (
                <tr key={m.id} style={isSelected ? { backgroundColor: "rgba(59, 130, 246, 0.1)" } : {}}>
                  <td>
                    {isEditingThisRow ? (
                      <input 
                        type="text" 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)} 
                        style={{
                          background: "rgba(0,0,0,0.3)",
                          border: "var(--glass-border)",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          color: "var(--text-primary)",
                          width: "90%",
                          fontSize: "14px",
                          outline: "none"
                        }}
                      />
                    ) : (
                      <>
                        {m.name} {isSelected && <span style={{fontSize: "12px", marginLeft: "8px", color: "var(--accent-primary)"}}>(Selected)</span>}
                      </>
                    )}
                  </td>
                  <td>
                    {isEditingThisRow ? (
                      <input 
                        type="text" 
                        value={editCourseCode} 
                        onChange={e => setEditCourseCode(e.target.value)} 
                        style={{
                          background: "rgba(0,0,0,0.3)",
                          border: "var(--glass-border)",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          color: "var(--text-primary)",
                          width: "90%",
                          fontSize: "14px",
                          outline: "none"
                        }}
                      />
                    ) : (
                      m.courseCode
                    )}
                  </td>
                  <td>
                    {isEditingThisRow ? (
                      <input 
                        type="text" 
                        value={editAcademicYear} 
                        onChange={e => setEditAcademicYear(e.target.value)} 
                        style={{
                          background: "rgba(0,0,0,0.3)",
                          border: "var(--glass-border)",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          color: "var(--text-primary)",
                          width: "90%",
                          fontSize: "14px",
                          outline: "none"
                        }}
                      />
                    ) : (
                      m.academicYear
                    )}
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                    {mounted ? new Date(m.createdAt).toLocaleString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : "Loading..."}
                  </td>
                  <td>
                    <span style={{ 
                      background: "rgba(59, 130, 246, 0.1)", 
                      color: "var(--accent-primary)", 
                      padding: "4px 10px", 
                      borderRadius: "12px", 
                      fontSize: "13px", 
                      fontWeight: "600" 
                    }}>
                      {m._count?.ocam || 0} Students
                    </span>
                  </td>
                  <td style={{ textAlign: "right", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    {isEditingThisRow ? (
                      <>
                        <button 
                          onClick={() => handleSave(m.id)}
                          style={{ background: "var(--accent-success)", border: "none", color: "#ffffff", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontWeight: "600" }}
                        >
                          Save
                        </button>
                        <button 
                          onClick={cancelEdit}
                          style={{ background: "transparent", border: "1px solid var(--text-muted)", color: "var(--text-muted)", padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        {!isSelected ? (
                          <button 
                            onClick={() => handleSelect(m.id)}
                            style={{ background: "transparent", border: "1px solid var(--accent-primary)", color: "var(--accent-primary)", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                          >
                            <Eye size={14} /> View
                          </button>
                        ) : (
                          <>
                            <button 
                              onClick={() => startEdit(m)}
                              style={{ background: "transparent", border: "1px solid var(--accent-primary)", color: "var(--accent-primary)", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                            >
                              Edit
                            </button>
                            <span style={{ color: "var(--accent-success)", padding: "4px 8px", display: "flex", alignItems: "center", gap: "4px" }}>
                              Viewing
                            </span>
                          </>
                        )}
                        
                        <button 
                          onClick={() => handleDelete(m.id)}
                          style={{ background: "transparent", border: "1px solid var(--accent-danger)", color: "var(--accent-danger)", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="6" style={{textAlign: "center", color: "var(--text-muted)"}}>No modules processed yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
