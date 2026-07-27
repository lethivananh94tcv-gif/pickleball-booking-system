"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAuth, getUser } from "@/utils/authStorage";
import type { AuthUser } from "@/types/auth";
import {
  DashboardIcon, CourtIcon, CalendarIcon, OperationsIcon, ComboIcon,
  PlayerIcon, CoachIcon, StaffIcon, RevenueIcon, BarChartIcon,
  PromotionIcon, CheckShieldIcon, SettingsIcon
} from "./AdminIcons";

import styles from "./AdminLayout.module.css";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    setUser(getUser());
    const stored = localStorage.getItem("admin-sidebar-collapsed");
    if (stored === "true") {
      setIsCollapsed(true);
    }
  }, []);

  const role = String(user?.RoleName || user?.role || user?.roles?.[0] || "").toLowerCase();
  const isStaff = role.includes("staff");

  function handleLogout() {
    clearAuth();
    window.dispatchEvent(new Event("auth-change"));
    router.push("/");
    router.refresh();
  }

  const getInitials = (name: string) => {
    if (!name) return "A";
    return name.charAt(0).toUpperCase();
  };
  type NavItem = {
    href: string;
    label: string;
    icon: React.ReactNode;
    hideForStaff?: boolean;
    staffOnly?: boolean;
  };

  type NavSection = {
    title: string;
    items: NavItem[];
  };

  const userName = user?.FullName || user?.fullName || "Admin";
  const userEmail = user?.Email || user?.email || "admin@pickleclub.vn";

  const navSections: NavSection[] = [
    {
      title: "OVERVIEW",
      items: [
        { href: "/admin", label: "Dashboard", icon: <DashboardIcon />, hideForStaff: true },
        { href: "/admin/reports", label: "Reports", icon: <BarChartIcon />, hideForStaff: true },
        { href: "/admin/ai", label: "AI Occupancy", icon: <BarChartIcon />, hideForStaff: true },
      ]
    },
    {
      title: "COURTS",
      items: [
        { href: "/admin/courts", label: "Courts", icon: <CourtIcon />, hideForStaff: true },
        { href: "/staff/operations", label: "Court Schedule", icon: <OperationsIcon /> },
      ]
    },
    {
      title: "BOOKINGS",
      items: [
        { href: "/admin/bookings", label: "Bookings", icon: <CalendarIcon /> },
        { href: "/admin/refunds", label: "Refunds", icon: <RevenueIcon />, hideForStaff: true },
      ]
    },
    {
      title: "PEOPLE",
      items: [
        { href: "/admin/players", label: "Players", icon: <PlayerIcon />, hideForStaff: true },
        { href: "/admin/coaches", label: "Coaches", icon: <CoachIcon />, hideForStaff: true },
        { href: "/admin/staff", label: "Staff", icon: <StaffIcon />, hideForStaff: true },
      ]
    },
    {
      title: "EVENTS",
      items: [
        { href: "/admin/tournaments", label: "Tournaments", icon: <CalendarIcon /> },
        { href: "/admin/promotions", label: "Promotions", icon: <PromotionIcon />, hideForStaff: true },
        { href: "/admin/settings", label: "Settings", icon: <SettingsIcon />, hideForStaff: true },
      ]
    }
  ];

  const staffNavSections: NavSection[] = [
    {
      title: "TỔNG QUAN",
      items: [
        { href: "/staff/operations?view=dashboard", label: "Tổng quan ca", icon: <DashboardIcon /> },
      ]
    },
    {
      title: "VẬN HÀNH SÂN",
      items: [
        { href: "/staff/operations?view=detail", label: "Chi tiết ca trực", icon: <OperationsIcon /> },
        { href: "/staff/operations/walk-in-booking", label: "Đặt sân tại quầy", icon: <CourtIcon /> },
      ]
    },
    {
      title: "QUẢN LÝ",
      items: [
        { href: "/admin/bookings", label: "Danh sách booking", icon: <CalendarIcon /> },
        { href: "/admin/refunds", label: "Yêu cầu hoàn tiền", icon: <RevenueIcon /> },
        { href: "/admin/tournaments", label: "Giải đấu", icon: <CalendarIcon /> },
      ]
    }
  ];

  const activeSections = isStaff ? staffNavSections : navSections;

  const isItemActive = (itemHref: string) => {
    const [itemPath, itemQuery] = itemHref.split("?");
    if (pathname !== itemPath) return false;
    
    if (itemQuery) {
      const params = new URLSearchParams(itemQuery);
      let match = true;
      params.forEach((value, key) => {
        if (searchParams?.get(key) !== value) {
          match = false;
        }
      });
      return match;
    } else {
      return !searchParams?.get("view");
    }
  };

  return (
    <div className={`${styles.admin} ${isCollapsed ? styles.adminCollapsed : ""}`}>
      <aside className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : ""}`}>
        <div className={styles.logo}>
          <div className={styles.logoMain}>
            <div className={styles.logoIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 9a5 5 0 0 1 5-5h0a5 5 0 0 1 5 5v3a5 5 0 0 1-5 5h0a5 5 0 0 1-5-5V9z" fill="currentColor" opacity="0.2" />
                <path d="M7 9a5 5 0 0 1 5-5h0a5 5 0 0 1 5 5v3a5 5 0 0 1-5 5h0a5 5 0 0 1-5-5V9z" />
                <path d="M12 17v5" strokeWidth="3.5" />
                <path d="M10 22h4" />
                <circle cx="18" cy="6" r="2.5" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div className={styles.logoTextWrapper}>
              <Link href="/" className={styles.logoTitle}>
                PickleClub
              </Link>
              <span className={styles.logoSubtitle}>
                {isStaff ? "STAFF PORTAL" : role.includes("manager") ? "MANAGER PORTAL" : "ENTERPRISE ADMIN"}
              </span>
            </div>
          </div>
          <button
            type="button"
            className={styles.toggleBtn}
            onClick={() => {
              setIsCollapsed((prev) => {
                const next = !prev;
                localStorage.setItem("admin-sidebar-collapsed", String(next));
                return next;
              });
            }}
            title={isCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          >
            {isCollapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="13 17 18 12 13 7"></polyline>
                <polyline points="6 17 11 12 6 7"></polyline>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="11 17 6 12 11 7"></polyline>
                <polyline points="18 17 13 12 18 7"></polyline>
              </svg>
            )}
          </button>
        </div>

        <nav className={styles.nav}>
          {activeSections.map((section) => {
            // Filter items based on user role
            const visibleItems = section.items.filter((item) => {
              if (item.hideForStaff && isStaff) return false;
              if (item.staffOnly && !isStaff) return false;
              return true;
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title} className={styles.navSection}>
                <h3 className={styles.sectionHeader}>{section.title}</h3>
                <div className={styles.sectionList}>
                  {visibleItems.map((item) => {
                    const isActive = isItemActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={isActive ? styles.active : ""}
                        title={isCollapsed ? item.label : ""}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className={styles.userProfileBottom}>
          <div className={styles.avatar}>
            {getInitials(userName)}
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName} title={userName}>{userName}</span>
            <span className={styles.userEmail} title={userEmail}>{userEmail}</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className={styles.logoutBtn}
            title="Đăng xuất"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}