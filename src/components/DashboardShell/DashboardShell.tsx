"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./DashboardShell.module.css";
import { LogOut, Menu, X, MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle/ThemeToggle";

type DashboardNavItem = {
    key: string;
    label: string;
    icon: LucideIcon;
    mobilePrimary?: boolean;
    badge?: string;
};

interface DashboardShellProps {
    title: string;
    subtitle?: string;
    roleLabel: string;
    userName: string;
    userEmail?: string;
    userAvatarUrl?: string | null;
    items: DashboardNavItem[];
    activeKey: string;
    onSelect: (key: string) => void;
    onLogout: () => void | Promise<void>;
    children: React.ReactNode;
}

export default function DashboardShell({
    title,
    subtitle,
    roleLabel,
    userName,
    userEmail,
    userAvatarUrl,
    items,
    activeKey,
    onSelect,
    onLogout,
    children,
}: DashboardShellProps) {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const primaryMobileItems = useMemo(() => {
        const explicit = items.filter((item) => item.mobilePrimary);
        if (explicit.length > 0) {
            return explicit.slice(0, 3);
        }
        return items.slice(0, 3);
    }, [items]);

    const secondaryMobileItems = useMemo(() => {
        const primaryKeys = new Set(primaryMobileItems.map((item) => item.key));
        return items.filter((item) => !primaryKeys.has(item.key));
    }, [items, primaryMobileItems]);

    const initials = userName
        .split(" ")
        .map((segment) => segment[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    const handleSelect = (key: string) => {
        onSelect(key);
        setIsDrawerOpen(false);
    };

    return (
        <div className={styles.shell}>
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <Link href="/" className={styles.brandLink} aria-label="Go to homepage">
                        <Image src="/logo.png" alt="Creative Learning" width={152} height={40} priority />
                    </Link>
                </div>

                <div className={styles.profileCard}>
                    <div className={styles.avatar}>
                        {userAvatarUrl ? (
                            <Image
                                src={userAvatarUrl}
                                alt={`${userName} profile`}
                                fill
                                unoptimized
                                className={styles.avatarImage}
                                sizes="38px"
                            />
                        ) : (
                            initials
                        )}
                    </div>
                    <div className={styles.profileInfo}>
                        <strong>{userName}</strong>
                        <span>{userEmail || "Logged in"}</span>
                    </div>
                </div>

                <nav className={styles.navList}>
                    {items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeKey === item.key;
                        return (
                            <button
                                key={item.key}
                                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                                onClick={() => handleSelect(item.key)}
                            >
                                <span className={styles.navItemLeft}>
                                    <Icon size={18} />
                                    <span>{item.label}</span>
                                </span>
                                {item.badge && <span className={styles.badge}>{item.badge}</span>}
                            </button>
                        );
                    })}
                </nav>

                <button className={styles.logoutBtnDesktop} onClick={onLogout}>
                    <LogOut size={18} />
                    <span>Logout</span>
                </button>
            </aside>

            <div className={styles.mainArea}>
                <header className={styles.topbar}>
                    <div className={styles.topbarInner}>
                        <div>
                            <h1>{title}</h1>
                            {subtitle ? <p>{subtitle}</p> : null}
                        </div>
                        <div className={styles.topbarRight}>
                            <span className={styles.rolePill}>{roleLabel}</span>
                            <ThemeToggle />
                            <button
                                className={styles.mobileMoreBtn}
                                onClick={() => setIsDrawerOpen(true)}
                                aria-label="Open dashboard menu"
                            >
                                <Menu size={22} />
                            </button>
                        </div>
                    </div>
                </header>

                <div className={styles.content}>
                    <div className={styles.contentInner}>{children}</div>
                </div>
            </div>

            <nav className={styles.mobileBottomNav}>
                {primaryMobileItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeKey === item.key;
                    return (
                        <button
                            key={item.key}
                            className={`${styles.mobileTab} ${isActive ? styles.mobileTabActive : ""}`}
                            onClick={() => handleSelect(item.key)}
                        >
                            <Icon size={18} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}

                <button className={styles.mobileTab} onClick={() => setIsDrawerOpen(true)}>
                    <MoreHorizontal size={18} />
                    <span>More</span>
                </button>
            </nav>

            {isDrawerOpen && <div className={styles.drawerBackdrop} onClick={() => setIsDrawerOpen(false)} />}

            <aside className={`${styles.mobileDrawer} ${isDrawerOpen ? styles.mobileDrawerOpen : ""}`}>
                <div className={styles.drawerHeader}>
                    <h2>More Options</h2>
                    <button className={styles.drawerCloseBtn} onClick={() => setIsDrawerOpen(false)}>
                        <X size={18} />
                    </button>
                </div>

                <div className={styles.drawerItems}>
                    {secondaryMobileItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeKey === item.key;
                        return (
                            <button
                                key={item.key}
                                className={`${styles.drawerItem} ${isActive ? styles.drawerItemActive : ""}`}
                                onClick={() => handleSelect(item.key)}
                            >
                                <span className={styles.navItemLeft}>
                                    <Icon size={18} />
                                    <span>{item.label}</span>
                                </span>
                                {item.badge && <span className={styles.badge}>{item.badge}</span>}
                            </button>
                        );
                    })}

                    <button className={styles.logoutBtnMobile} onClick={onLogout}>
                        <LogOut size={18} />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
        </div>
    );
}
