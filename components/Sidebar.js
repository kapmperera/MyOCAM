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
  GraduationCap,
  History
} from "lucide-react";
import styles from "./Sidebar.module.css";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Upload Data", href: "/upload", icon: UploadCloud },
  { name: "Module History", href: "/modules", icon: History },
  { name: "CAT 1 Comparison", href: "/cat1", icon: FileSpreadsheet },
  { name: "CAT 2 Comparison", href: "/cat2", icon: FileSpreadsheet },
  { name: "OCAM Calculations", href: "/ocam", icon: GraduationCap },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Statistical Analysis", href: "/statistical-analysis", icon: BarChart3 },
];

export default function Sidebar({ onClose }) {
  const pathname = usePathname();

  if (pathname === '/login') {
    return null;
  }

  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
  };

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
              onClick={handleLinkClick}
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <Link 
          href="/settings" 
          className={`${styles.navItem} ${pathname === "/settings" ? styles.active : ""}`}
          onClick={handleLinkClick}
        >
          <Settings size={20} />
          <span>Settings</span>
        </Link>
        <button className={`${styles.navItem} ${styles.logout}`} onClick={handleLinkClick}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
