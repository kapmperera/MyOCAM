"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, GraduationCap } from "lucide-react";
import Sidebar from "./Sidebar";
import styles from "./Sidebar.module.css"; // We'll add some styles here or in a separate CSS module.

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  if (pathname === "/login") {
    return <div className="app-container">{children}</div>;
  }

  return (
    <div className="app-container">
      {/* Mobile Header */}
      <header className="mobile-header">
        <button className="hamburger-btn" onClick={toggleSidebar} aria-label="Toggle Navigation">
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div className="mobile-logo">
          <GraduationCap size={28} className="logo-icon-mobile" />
          <span className="logo-text-mobile">MyOCAM</span>
        </div>
        <div style={{ width: 24 }}></div> {/* Balance the header spacing */}
      </header>

      {/* Sidebar Drawer Backdrop (Mobile only) */}
      {isSidebarOpen && (
        <div className="sidebar-backdrop" onClick={closeSidebar} />
      )}

      {/* Sidebar Pass state down or apply class */}
      <div className={`sidebar-wrapper ${isSidebarOpen ? "sidebar-open" : ""}`}>
        <Sidebar onClose={closeSidebar} />
      </div>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
