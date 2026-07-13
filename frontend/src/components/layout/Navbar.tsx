"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  clearAuth,
  getUser,
  getToken,
} from "@/utils/authStorage";

import type { AuthUser } from "@/types/auth";
import { getPendingInvitationCount, getUnreadGroupChatCounts } from "@/services/matchingApi";
import { getMyNotifications, getUnreadNotificationCount, markNotificationAsRead } from "@/services/notificationApi";
import type { NotificationItem } from "@/types/operationTypes";

import styles from "./Navbar.module.css";

const navItems = [
  { href: "/", label: "Trang chủ" },
  { href: "/courts", label: "Sân" },
  { href: "/coaches", label: "Coach" },
  { href: "/combo", label: "Combo" },
  { href: "/matching", label: "Tìm người chơi" },
  { href: "/bookings", label: "Lịch sử booking" },
];

export default function Navbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "profile";
  const router = useRouter();

  /**
   * user đang login
   */
  const [user, setUser] = useState<AuthUser | null>(null);
  const [totalMatchingBadge, setTotalMatchingBadge] = useState(0);

  // Notifications
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  /**
   * đọc localStorage mỗi lần đổi route và đồng bộ số thông báo
   */
  useEffect(() => {
    function syncUser() {
      setUser(getUser());
    }

    async function fetchMatchingBadgeCount() {
      const token = getToken();
      const currentUser = getUser();
      const role = String(currentUser?.RoleName || currentUser?.role || currentUser?.roles?.[0] || "").toLowerCase();
      
      // Chỉ Player mới có chức năng tìm người chơi (matching)
      if (!token || !role.includes("player")) {
        setTotalMatchingBadge(0);
        return;
      }
      try {
        const [pendingRes, unreadRes] = await Promise.all([
          getPendingInvitationCount(token).catch(() => ({ count: 0 })),
          getUnreadGroupChatCounts(token).catch(() => ({ totalUnread: 0, groups: [] }))
        ]);
        setTotalMatchingBadge((pendingRes?.count || 0) + (unreadRes?.totalUnread || 0));
      } catch (err) {
        setTotalMatchingBadge(0);
      }
    }

    async function fetchNotifs() {
      const token = getToken();
      if (!token) {
        setUnreadNotifCount(0);
        return;
      }
      try {
        const count = await getUnreadNotificationCount(token);
        setUnreadNotifCount(typeof count === 'number' ? count : 0);
      } catch (err) {
        // console.warn("Failed to fetch notif count", err);
        setUnreadNotifCount(0);
      }
    }

    syncUser();
    fetchMatchingBadgeCount();
    fetchNotifs();

    window.addEventListener("storage", syncUser);
    window.addEventListener("storage", fetchMatchingBadgeCount);
    window.addEventListener("auth-change", syncUser);
    window.addEventListener("auth-change", fetchMatchingBadgeCount);
    window.addEventListener("auth-change", fetchNotifs);
    window.addEventListener("invitation-count-change", fetchMatchingBadgeCount);

    const interval = setInterval(() => {
      fetchMatchingBadgeCount();
      fetchNotifs();
    }, 15000);

    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("storage", fetchMatchingBadgeCount);
      window.removeEventListener("auth-change", syncUser);
      window.removeEventListener("auth-change", fetchMatchingBadgeCount);
      window.removeEventListener("auth-change", fetchNotifs);
      window.removeEventListener("invitation-count-change", fetchMatchingBadgeCount);
      clearInterval(interval);
    };
  }, [pathname]);

  /**
   * logout
   */
  function handleLogout() {
    clearAuth();

    setUser(null);
    setTotalMatchingBadge(0);
    setUnreadNotifCount(0);

    window.dispatchEvent(new Event("auth-change"));

    router.push("/");
    router.refresh();
  }

  /**
   * tên hiển thị
   */
  const fullName =
    user?.FullName ||
    user?.fullName ||
    user?.Email ||
    user?.email ||
    "Tài khoản";

  /**
   * role user
   */
  const role = String(
    user?.RoleName ||
    user?.role ||
    user?.roles?.[0] ||
    ""
  ).toLowerCase();

  let profilePath = "/profile";

  if (role.includes("admin") || role.includes("manager") || role.includes("staff")) {
    profilePath = "/admin";
  } else if (role.includes("coach")) {
    profilePath = "/coach-dashboard";
  } else {
    profilePath = "/profile";
  }

  let navItems = [
    { href: "/", label: "Trang chủ" },
    { href: "/courts", label: "Sân" },
    { href: "/coaches", label: "Coach" },
    { href: "/combo", label: "Combo" },
    { href: "/tournaments", label: "Giải đấu" },
    { href: "/matching", label: "Tìm người chơi" },
    { href: "/bookings", label: "Lịch sử booking" },
  ];

  if (pathname.startsWith("/coach-dashboard")) {
    navItems = [
      { href: "/coach-dashboard?tab=profile", label: "Hồ sơ" },
      { href: "/coach-dashboard?tab=expertise", label: "Chuyên môn" },
      { href: "/coach-dashboard?tab=fee", label: "Học phí" },
      { href: "/coach-dashboard?tab=schedules", label: "Lịch dạy" },
      { href: "/coach-dashboard?tab=bookings", label: "Đơn đặt lịch" },
      { href: "/coach-dashboard?tab=income", label: "Thu nhập" },
    ];
  }


  const isAdminOrStaff = role.includes("admin") || role.includes("manager") || role.includes("staff");

  if (pathname.startsWith("/admin") || pathname.startsWith("/staff")) {
    return null;
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
      <Link href="/" className={styles.logo}>
  <Image
    src="/images/logo.png"
    alt="Pickle Club"
    width={42}
    height={42}
    className={styles.logoImage}
    priority
  />

  <span className={styles.logoText}>
    Pickle <b>Club</b>
  </span>
</Link>
        <nav className={styles.nav}>
          {navItems.map((item) => {
            let active = false;
            
            if (item.href.includes("?tab=")) {
              // Đối với coach dashboard tabs
              const urlTab = new URLSearchParams(item.href.split("?")[1]).get("tab");
              active = pathname === item.href.split("?")[0] && currentTab === urlTab;
            } else if (item.href === "/") {
              active = pathname === "/";
            } else {
              active = pathname.startsWith(item.href);
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? styles.active : ""}
              >
                {item.label}
                {item.href === "/matching" && totalMatchingBadge > 0 && (
                  <span className={styles.badge}>
                    {totalMatchingBadge > 9 ? "9+" : totalMatchingBadge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT ACTIONS */}
        <div className={styles.actions}>
          {user ? (
            <>
              {/* NOTIFICATION BELL */}
              <div className={styles.notificationWrapper}>
                <button
                  type="button"
                  className={styles.bellButton}
                  onClick={async () => {
                    const token = getToken();
                    if (token && !showNotifDropdown) {
                      const data = await getMyNotifications(token, 5);
                      setNotifs(data);
                    }
                    setShowNotifDropdown(!showNotifDropdown);
                  }}
                >
                  <svg className={styles.bellIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadNotifCount > 0 && (
                    <span className={styles.notificationBadge}>
                      {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                    </span>
                  )}
                </button>
                {showNotifDropdown && (
                  <div className={styles.dropdown}>
                    <div className={styles.dropdownHeader}>
                      <h3>Thông báo</h3>
                      <Link href="/notifications" onClick={() => setShowNotifDropdown(false)}>Xem tất cả</Link>
                    </div>
                    <div className={styles.dropdownList}>
                      {notifs.length === 0 ? (
                        <div className={styles.dropdownEmpty}>Bạn chưa có thông báo nào.</div>
                      ) : (
                        notifs.map(n => (
                          <div
                            key={n.notificationId}
                            className={`${styles.notificationItem} ${n.status === 'Unread' ? styles.unread : ''}`}
                            onClick={async () => {
                              if (n.status === 'Unread') {
                                const token = getToken();
                                if (token) await markNotificationAsRead(token, n.notificationId);
                                setUnreadNotifCount(prev => Math.max(0, prev - 1));
                                setNotifs(prev => prev.map(x => x.notificationId === n.notificationId ? { ...x, status: 'Read' } : x));
                              }
                            }}
                          >
                            <span className={styles.notifTitle}>{n.title}</span>
                            <span className={styles.notifMessage}>{n.message}</span>
                            <span className={styles.notifTime}>{new Date(n.createdAt).toLocaleString("vi-VN")}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <div className={styles.dropdownFooter}>
                      <Link href="/notifications" onClick={() => setShowNotifDropdown(false)}>
                        Mở trung tâm thông báo
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* ADMIN DASHBOARD LINK */}
              {isAdminOrStaff && (
                <Link
                  href={profilePath}
                  className={styles.adminLink}
                  title="Vào trang quản trị"
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  <span>Quản trị</span>
                </Link>
              )}

              {/* COACH DASHBOARD LINK */}
              {role.includes("coach") && (
                <Link
                  href="/coach-dashboard"
                  className={styles.adminLink}
                  title="Quản lý Coach"
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  <span>Quản lý</span>
                </Link>
              )}

              {/* USER PILL (Profile + Logout) */}
              <div className={styles.userPill}>
                <Link
                  href={profilePath}
                  className={styles.profileName}
                  title={fullName}
                >
                  {fullName}
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className={styles.logoutIcon}
                  title="Đăng xuất"
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* LOGIN */}
              <Link
                href="/login"
                className={styles.login}
              >
                Đăng nhập
              </Link>

              {/* REGISTER */}
              <Link
                href="/register"
                className={styles.register}
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}