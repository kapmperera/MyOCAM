"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { calculateMean, calculateVariance, calculateStdDev } from "@/lib/statistics";

export default function CurveSimulator({ rawMarks = [] }) {
  const [constantAdd, setConstantAdd] = useState(0);
  const [scaleFactor, setScaleFactor] = useState(1);

  // Compute Adjusted Marks
  const adjustedMarks = useMemo(() => {
    return rawMarks.map(m => {
      let adj = (m * scaleFactor) + constantAdd;
      return Math.min(100, Math.max(0, Number(adj.toFixed(1))));
    });
  }, [rawMarks, constantAdd, scaleFactor]);

  // Compute Stats
  const mean = calculateMean(adjustedMarks);
  const stdDev = calculateStdDev(calculateVariance(adjustedMarks, mean));
  
  const origMean = calculateMean(rawMarks);
  const origStdDev = calculateStdDev(calculateVariance(rawMarks, origMean));

  // Compute Histogram Bins & Gaussian Overlay
  const chartData = useMemo(() => {
    const bins = [
      { name: '0-10', min: 0, max: 10, center: 5, count: 0 },
      { name: '11-20', min: 11, max: 20, center: 15, count: 0 },
      { name: '21-30', min: 21, max: 30, center: 25, count: 0 },
      { name: '31-40', min: 31, max: 40, center: 35, count: 0 },
      { name: '41-50', min: 41, max: 50, center: 45, count: 0 },
      { name: '51-60', min: 51, max: 60, center: 55, count: 0 },
      { name: '61-70', min: 61, max: 70, center: 65, count: 0 },
      { name: '71-80', min: 71, max: 80, center: 75, count: 0 },
      { name: '81-90', min: 81, max: 90, center: 85, count: 0 },
      { name: '91-100', min: 91, max: 100, center: 95, count: 0 },
    ];

    // Bin the marks
    adjustedMarks.forEach(mark => {
      const b = bins.find(bin => mark >= bin.min && mark <= bin.max);
      if (b) b.count++;
    });

    const N = adjustedMarks.length;
    const binWidth = 10;

    // Gaussian Probability Density Function
    const gaussianPdf = (x, m, sd) => {
      if (sd === 0) return 0;
      const exponent = Math.exp(-Math.pow(x - m, 2) / (2 * Math.pow(sd, 2)));
      return (1 / (sd * Math.sqrt(2 * Math.PI))) * exponent;
    };

    // Calculate Ideal Gaussian curve points corresponding to bins
    return bins.map(b => {
      // Scale PDF by N * binWidth to match histogram heights
      const expectedCount = N * binWidth * gaussianPdf(b.center, mean, stdDev);
      return {
        name: b.name,
        ActualCount: b.count,
        IdealCurve: Number(expectedCount.toFixed(2))
      };
    });
  }, [adjustedMarks, mean, stdDev]);

  if (rawMarks.length === 0) {
    return <div style={{ padding: "20px", color: "var(--text-muted)" }}>No data available. Upload marks first.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* Controls */}
      <div className="glass-panel" style={{ padding: "24px" }}>
        <h3 style={{ marginBottom: "16px", color: "var(--text-primary)" }}>Adjustment Controls</h3>
        <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
          
          <div style={{ flex: 1, minWidth: "250px" }}>
            <label style={{ display: "block", marginBottom: "8px", color: "var(--text-secondary)" }}>
              Constant Addition (+{constantAdd} marks)
            </label>
            <input 
              type="range" 
              min="-20" max="40" step="1" 
              value={constantAdd} 
              onChange={(e) => setConstantAdd(Number(e.target.value))}
              style={{ width: "100%", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
              <span>-20</span>
              <span>0</span>
              <span>+40</span>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: "250px" }}>
            <label style={{ display: "block", marginBottom: "8px", color: "var(--text-secondary)" }}>
              Linear Scaling (x{scaleFactor})
            </label>
            <input 
              type="range" 
              min="0.5" max="2" step="0.05" 
              value={scaleFactor} 
              onChange={(e) => setScaleFactor(Number(e.target.value))}
              style={{ width: "100%", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
              <span>0.5x</span>
              <span>1.0x</span>
              <span>2.0x</span>
            </div>
          </div>
          
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button 
              className="btn-primary" 
              onClick={() => { setConstantAdd(0); setScaleFactor(1); }}
              style={{ backgroundColor: "var(--accent-secondary)" }}
            >
              Reset to Original
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Stats */}
      <div className="stats-row-sim">
        <div className="glass-panel" style={{ flex: 1, padding: "16px", textAlign: "center" }}>
          <div style={{ color: "var(--text-muted)", fontSize: "14px", textTransform: "uppercase" }}>Original Mean</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--text-secondary)", marginTop: "8px" }}>
            {origMean.toFixed(2)}
          </div>
        </div>
        <div className="glass-panel" style={{ flex: 1, padding: "16px", textAlign: "center", border: "1px solid var(--accent-primary)" }}>
          <div style={{ color: "var(--text-muted)", fontSize: "14px", textTransform: "uppercase", color: "var(--accent-primary)" }}>Adjusted Mean</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--accent-primary)", marginTop: "8px" }}>
            {mean.toFixed(2)}
          </div>
        </div>
        <div className="glass-panel" style={{ flex: 1, padding: "16px", textAlign: "center" }}>
          <div style={{ color: "var(--text-muted)", fontSize: "14px", textTransform: "uppercase" }}>Original Std. Dev</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--text-secondary)", marginTop: "8px" }}>
            {origStdDev.toFixed(2)}
          </div>
        </div>
        <div className="glass-panel" style={{ flex: 1, padding: "16px", textAlign: "center", border: "1px solid var(--accent-secondary)" }}>
          <div style={{ color: "var(--text-muted)", fontSize: "14px", textTransform: "uppercase", color: "var(--accent-secondary)" }}>Adjusted Std. Dev</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--accent-secondary)", marginTop: "8px" }}>
            {stdDev.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="glass-panel" style={{ padding: "24px", height: "450px" }}>
        <h3 style={{ marginBottom: "20px", color: "var(--text-primary)" }}>Mark Distribution vs. Ideal Gaussian Curve</h3>
        <ResponsiveContainer width="100%" height="90%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="name" stroke="#94A3B8" />
            <YAxis stroke="#94A3B8" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#131722', borderColor: 'rgba(255,255,255,0.1)' }}
              itemStyle={{ color: '#F0F4F8' }}
            />
            <Legend />
            <Bar dataKey="ActualCount" name="Number of Students" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            <Line 
              type="monotone" 
              dataKey="IdealCurve" 
              name="Gaussian (Normal) Curve" 
              stroke="#10B981" 
              strokeWidth={3} 
              dot={false}
              activeDot={{ r: 6 }} 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
