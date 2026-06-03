"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, FileSpreadsheet, FileText, Printer, CheckSquare, Square, X, Download } from "lucide-react";

export default function ExportReportButton({ courseCode = "N_A" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Customizer States
  const [customName, setCustomName] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("html");
  const [sections, setSections] = useState({
    summary: true,
    cat1: true,
    cat2: true,
    ocam: true,
    stats: true,
    preview: true,
    charts: true
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const defaultReportName = `OCAM_Mark_Summary_Report_${courseCode.replace(/\s+/g, '_')}_${todayStr}`;
  const finalReportName = customName.trim() || defaultReportName;

  const sectionLabels = {
    summary: "Dashboard Summary",
    cat1: "CAT 1 Comparison Analysis",
    cat2: "CAT 2 Comparison Analysis",
    ocam: "OCAM Calculation Analysis",
    stats: "Statistical Analysis",
    preview: "Adjusted Student Marks & Status Preview",
    charts: "Charts & Visualizations"
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToggleSection = (key) => {
    setSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleExport = () => {
    setIsModalOpen(false);
    
    // Convert active sections to comma separated string
    const activeSections = Object.keys(sections).filter(k => sections[k]).join(",");
    
    if (selectedFormat === 'print') {
      window.print();
      return;
    }

    const downloadUrl = `/api/export/report?format=${selectedFormat}&name=${encodeURIComponent(finalReportName)}&sections=${activeSections}`;
    window.location.href = downloadUrl;
  };

  const selectedCount = Object.values(sections).filter(Boolean).length;

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setIsModalOpen(true)}
        className="btn-primary"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "12px 20px",
          fontSize: "14px",
          cursor: "pointer",
          border: "none",
          borderRadius: "8px"
        }}
      >
        <Download size={16} />
        <span>Generate Report</span>
      </button>

      {/* CUSTOMIZER MODAL */}
      {isModalOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(8px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 99999,
          padding: "20px"
        }}>
          <div style={{
            background: "var(--bg-secondary)",
            border: "var(--glass-border)",
            borderRadius: "16px",
            boxShadow: "var(--glass-shadow)",
            width: "100%",
            maxWidth: "600px",
            maxHeight: "90vh",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column"
          }}>
            {/* Modal Header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "20px 24px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.05)"
            }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                Customize Academic Report
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
              
              {/* Custom Name */}
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", display: "block", marginBottom: "8px" }}>
                  Custom Report Filename
                </label>
                <input 
                  type="text" 
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={defaultReportName}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    background: "rgba(255, 255, 255, 0.02)",
                    color: "var(--text-primary)",
                    fontSize: "14px"
                  }}
                />
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>
                  Leave empty to use course code and date defaults.
                </span>
              </div>

              {/* Format selection */}
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", display: "block", marginBottom: "8px" }}>
                  Download Format
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px" }}>
                  {[
                    { key: "html", label: "HTML (.html)", desc: "Default layout" },
                    { key: "xlsx", label: "Excel (.xlsx)", desc: "Spreadsheet tabs" },
                    { key: "csv", label: "CSV (.csv)", desc: "Data values" },
                    { key: "print", label: "Print View", desc: "Printer-friendly" }
                  ].map((fmt) => (
                    <div 
                      key={fmt.key}
                      onClick={() => setSelectedFormat(fmt.key)}
                      style={{
                        padding: "12px",
                        borderRadius: "8px",
                        border: selectedFormat === fmt.key ? "2px solid var(--accent-primary)" : "1px solid rgba(255,255,255,0.08)",
                        background: selectedFormat === fmt.key ? "rgba(59, 130, 246, 0.1)" : "rgba(255,255,255,0.02)",
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 0.2s"
                      }}
                    >
                      <div style={{ fontSize: "13px", fontWeight: "600", color: selectedFormat === fmt.key ? "var(--accent-primary)" : "var(--text-primary)" }}>{fmt.label}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>{fmt.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Checklist */}
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", display: "block", marginBottom: "8px" }}>
                  Report Sections to Include
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.04)" }}>
                  {Object.keys(sections).map((key) => (
                    <div 
                      key={key}
                      onClick={() => handleToggleSection(key)}
                      style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "13px", color: "var(--text-secondary)" }}
                    >
                      {sections[key] ? (
                        <CheckSquare size={18} color="var(--accent-primary)" />
                      ) : (
                        <Square size={18} />
                      )}
                      <span>{sectionLabels[key]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview Box */}
              <div style={{
                background: "rgba(59, 130, 246, 0.04)",
                border: "1px solid rgba(59, 130, 246, 0.15)",
                borderRadius: "10px",
                padding: "16px",
                fontSize: "13px"
              }}>
                <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "8px" }}>Download Preview</strong>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", color: "var(--text-secondary)" }}>
                  <div><strong>Filename:</strong> <span style={{ fontFamily: "monospace" }}>{finalReportName}.{selectedFormat === 'print' ? 'pdf' : selectedFormat}</span></div>
                  <div><strong>Selected Format:</strong> {selectedFormat.toUpperCase()}</div>
                  <div><strong>Included Sections:</strong> {selectedCount} of {Object.keys(sections).length} included</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                    ({Object.keys(sections).filter(k => sections[k]).map(k => sectionLabels[k]).join(", ") || "No sections selected"})
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              padding: "16px 24px",
              borderTop: "1px solid rgba(255, 255, 255, 0.05)"
            }}>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="btn-secondary"
                style={{ padding: "8px 16px", fontSize: "13px" }}
              >
                Cancel
              </button>
              <button 
                onClick={handleExport}
                className="btn-primary"
                disabled={selectedCount === 0 && selectedFormat !== 'print'}
                style={{ padding: "8px 20px", fontSize: "13px" }}
              >
                Download Report
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
