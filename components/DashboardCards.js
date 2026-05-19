"use client";

import styles from "./DashboardCards.module.css";
import { Users, BookOpen, GraduationCap, TrendingUp, TrendingDown, Award } from "lucide-react";

export default function DashboardCards({ initialStats }) {
  const stats = [
    { title: "Total Students", value: initialStats?.totalStudents || "0", icon: Users, color: "var(--accent-primary)", trend: "" },
    { title: "Eligible Students", value: Math.round((initialStats?.passRate || 0) * (initialStats?.totalStudents || 0) / 100), icon: BookOpen, color: "var(--accent-secondary)", trend: "" },
    { title: "Avg OCAM (Eligible)", value: initialStats?.avgMark || "0", icon: Award, color: "var(--accent-success)", trend: "" },
    { title: "Eligible Percentage", value: (initialStats?.passRate || "0") + "%", icon: GraduationCap, color: "var(--accent-success)", trend: "" },
    { title: "Not Eligible Students", value: initialStats?.notEligibleCount || "0", icon: TrendingDown, color: "var(--accent-danger)", trend: "" },
    { title: "Absent Students", value: `Overall: ${initialStats?.absentCount || "0"}`, icon: TrendingDown, color: "var(--text-muted)", trend: `CAT 1: ${initialStats?.cat1AbsentCount || 0} | CAT 2: ${initialStats?.cat2AbsentCount || 0}` },
  ];

  return (
    <div className={styles.grid}>
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        const isPositive = stat.trend.startsWith("+");
        const trendClass = isPositive ? styles.trendPositive : (stat.trend === "0" ? styles.trendNeutral : styles.trendNegative);

        return (
          <div key={i} className={`glass-panel ${styles.card}`}>
            <div className={styles.cardHeader}>
              <h3 className={styles.title}>{stat.title}</h3>
              <div className={styles.iconWrapper} style={{ backgroundColor: `${stat.color}20`, color: stat.color }}>
                <Icon size={20} />
              </div>
            </div>
            <div className={styles.cardBody}>
              <p className={styles.value}>{stat.value}</p>
              {stat.trend && (
                <div className={`${styles.trend} ${trendClass}`}>
                  {stat.trend}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
