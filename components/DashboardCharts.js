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
  LineChart,
  Line,
  Legend,
} from "recharts";
import styles from "./DashboardCharts.module.css";



export default function DashboardCharts({ chartData }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !chartData) {
    return <div className={styles.loading}>Loading charts...</div>;
  }

  const { performanceBands, markRanges } = chartData;

  return (
    <div className={styles.chartsGrid}>
      <div className={`glass-panel ${styles.chartCard}`}>
        <div className={styles.chartHeader}>
          <h3>Mark Range Distribution: CAT 1 vs CAT 2</h3>
        </div>
        <div className={styles.chartContainer}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={markRanges}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
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
          <h3>Performance Bands (Overall)</h3>
        </div>
        <div className={styles.chartContainer}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={performanceBands}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
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
  );
}
