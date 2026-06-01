"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import styles from "./DashboardCharts.module.css";

export default function AnalyticsCharts({ chartData }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !chartData) {
    return <div className={styles.loading}>Loading charts...</div>;
  }

  const { 
    performanceBands, 
    markRanges, 
    absenteeismData, 
    funnelData, 
    outcomeData 
  } = chartData;

  const OUTCOME_COLORS = {
    'Passed': '#10B981', // Green
    'Failed': '#EF4444', // Red
    'Absent': '#94A3B8'  // Gray
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
  
    if (percent === 0) return null;

    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* Existing Detailed Charts */}
      <div className={styles.chartsGrid}>
        <div className={`glass-panel ${styles.chartCard}`}>
          <div className={styles.chartHeader}>
            <h3>Mark Range Distribution: CAT 1 vs CAT 2</h3>
          </div>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={markRanges} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" stroke="#94A3B8" />
                <YAxis stroke="#94A3B8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#131722', borderColor: 'rgba(255,255,255,0.1)' }}
                  itemStyle={{ color: '#F0F4F8' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Legend />
                <Bar dataKey="CAT1" fill="#3B82F6" radius={[4, 4, 0, 0]} name="CAT 1 Students" />
                <Bar dataKey="CAT2" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="CAT 2 Students" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`glass-panel ${styles.chartCard}`}>
          <div className={styles.chartHeader}>
            <h3>Performance Bands</h3>
          </div>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceBands} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" stroke="#94A3B8" />
                <YAxis stroke="#94A3B8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#131722', borderColor: 'rgba(255,255,255,0.1)' }}
                  itemStyle={{ color: '#F0F4F8' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} name="Students" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* New Absenteeism & Drop-off Insights */}
      <h2 style={{ marginTop: "16px", color: "var(--text-primary)" }}>Absenteeism & Drop-off Insights</h2>
      <div className={styles.chartsGrid}>
        
        {/* Absenteeism Breakdown Donut Chart */}
        <div className={`glass-panel ${styles.chartCard}`}>
          <div className={styles.chartHeader}>
            <h3>Absenteeism Breakdown</h3>
          </div>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={absenteeismData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={renderCustomizedLabel}
                  labelLine={false}
                >
                  {absenteeismData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#131722', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }} 
                  itemStyle={{ color: 'white' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Eligibility Funnel */}
        <div className={`glass-panel ${styles.chartCard}`}>
          <div className={styles.chartHeader}>
            <h3>Eligibility Funnel</h3>
          </div>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
                <XAxis type="number" stroke="#94A3B8" />
                <YAxis dataKey="name" type="category" stroke="#94A3B8" width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#131722', borderColor: 'rgba(255,255,255,0.1)' }}
                  itemStyle={{ color: '#F0F4F8' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Students">
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Final Outcome Ratio */}
        <div className={`glass-panel ${styles.chartCard}`}>
          <div className={styles.chartHeader}>
            <h3>Final Outcome Ratio</h3>
          </div>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={outcomeData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={renderCustomizedLabel}
                  labelLine={false}
                >
                  {outcomeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={OUTCOME_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#131722', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }} 
                  itemStyle={{ color: 'white' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
