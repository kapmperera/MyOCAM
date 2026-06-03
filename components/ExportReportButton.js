"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, FileSpreadsheet, FileText, Printer } from "lucide-react";

export default function ExportReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

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

  const handleExport = (format) => {
    setIsOpen(false);
    if (format === 'print') {
      window.print();
    } else {
      window.location.href = `/api/export/report?format=${format}`;
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
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
        <span>Generate Report</span>
        <ChevronDown size={16} />
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            background: "var(--bg-secondary)",
            border: "var(--glass-border)",
            borderRadius: "8px",
            boxShadow: "var(--glass-shadow)",
            padding: "8px 0",
            minWidth: "220px",
            zIndex: 9999
          }}
        >
          <div
            onClick={() => handleExport("xlsx")}
            style={{
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
              fontSize: "13px",
              color: "var(--text-primary)",
              transition: "background 0.2s"
            }}
            className="dropdown-item-hover"
          >
            <FileSpreadsheet size={16} color="var(--accent-success)" />
            <span>Excel Workbook (.xlsx)</span>
          </div>

          <div
            onClick={() => handleExport("csv")}
            style={{
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
              fontSize: "13px",
              color: "var(--text-primary)",
              transition: "background 0.2s"
            }}
            className="dropdown-item-hover"
          >
            <FileText size={16} color="var(--accent-primary)" />
            <span>CSV Document (.csv)</span>
          </div>

          <div
            onClick={() => handleExport("print")}
            style={{
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
              fontSize: "13px",
              color: "var(--text-primary)",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              transition: "background 0.2s"
            }}
            className="dropdown-item-hover"
          >
            <Printer size={16} color="var(--accent-secondary)" />
            <span>Print Executive Dashboard</span>
          </div>
        </div>
      )}
      <style jsx>{`
        .dropdown-item-hover:hover {
          background: rgba(255, 255, 255, 0.05) !important;
        }
      `}</style>
    </div>
  );
}
