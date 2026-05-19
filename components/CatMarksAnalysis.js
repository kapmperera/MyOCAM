"use client";

import styles from "./DashboardCards.module.css";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function CatMarksAnalysis({ analysisData }) {
  if (!analysisData) return null;

  const rows = [
    { metric: "Average", cat1: analysisData.cat1Avg, cat2: analysisData.cat2Avg },
    { metric: "Maximum", cat1: analysisData.cat1Max, cat2: analysisData.cat2Max },
    { metric: "Minimum", cat1: analysisData.cat1Min, cat2: analysisData.cat2Min },
    { metric: "≥ Pass (35+)", cat1: analysisData.cat1Pass, cat2: analysisData.cat2Pass },
    { metric: "< Pass (< 35)", cat1: analysisData.cat1Fail, cat2: analysisData.cat2Fail },
  ];

  return (
    <div className={`glass-panel ${styles.card}`} style={{ gridColumn: "1 / -1", padding: "0" }}>
      <div className={styles.cardHeader} style={{ padding: "20px" }}>
        <h3 className={styles.title} style={{ color: "var(--accent-primary)", fontSize: "1.2rem", fontWeight: "600", textTransform: "uppercase" }}>
          CAT MARKS ANALYSIS
        </h3>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.95rem" }}>
          <thead>
            <tr style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <th style={{ padding: "12px 20px", color: "var(--text-primary)" }}>Metric</th>
              <th style={{ padding: "12px 20px", color: "var(--accent-primary)" }}>CAT 1</th>
              <th style={{ padding: "12px 20px", color: "var(--accent-secondary)" }}>CAT 2</th>
              <th style={{ padding: "12px 20px", color: "var(--text-primary)" }}>Difference</th>
              <th style={{ padding: "12px 20px", color: "var(--text-primary)" }}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const diff = (row.cat2 - row.cat1).toFixed(1);
              const numDiff = parseFloat(diff);
              let trendText = "= Equal";
              let TrendIcon = Minus;
              let trendColor = "var(--text-muted)";

              if (numDiff > 0) {
                trendText = "↑ CAT2 Higher";
                TrendIcon = TrendingUp;
                trendColor = "var(--accent-success)";
              } else if (numDiff < 0) {
                trendText = "↓ CAT1 Higher";
                TrendIcon = TrendingDown;
                trendColor = "var(--accent-danger)";
              }

              return (
                <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "12px 20px", fontWeight: "500", color: "var(--text-secondary)" }}>{row.metric}</td>
                  <td style={{ padding: "12px 20px", fontWeight: "600", color: "var(--accent-primary)" }}>{row.cat1.toFixed(1)}</td>
                  <td style={{ padding: "12px 20px", fontWeight: "600", color: "var(--accent-secondary)" }}>{row.cat2.toFixed(1)}</td>
                  <td style={{ padding: "12px 20px", color: "var(--text-primary)" }}>{Math.abs(numDiff).toFixed(1)}</td>
                  <td style={{ padding: "12px 20px", color: trendColor, display: "flex", alignItems: "center", gap: "6px" }}>
                    {trendText}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
