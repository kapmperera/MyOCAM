"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  UploadCloud, 
  FileSpreadsheet, 
  BarChart3, 
  Settings,
  LogOut,
  GraduationCap
} from "lucide-react";
import styles from "./Sidebar.module.css";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Upload Data", href: "/upload", icon: UploadCloud },
  { name: "CAT 1 Comparison", href: "/cat1", icon: FileSpreadsheet },
  { name: "CAT 2 Comparison", href: "/cat2", icon: FileSpreadsheet },
  { name: "OCAM Calculations", href: "/ocam", icon: GraduationCap },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Statistical Analysis", href: "/statistical-analysis", icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();

  if (pathname === '/login') {
    return null;
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoContainer}>
        <div className={styles.logoIcon}>
          <GraduationCap size={32} />
        </div>
        <h1 className={styles.logoText}>MyOCAM</h1>
      </div>

      <nav className={styles.nav}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ""}`}
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <button className={styles.navItem}>
          <Settings size={20} />
          <span>Settings</span>
        </button>
        <button className={`${styles.navItem} ${styles.logout}`}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
