"use client";

import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
import MobileBottomNav from "./MobileBottomNav";

/**
 * Wrapper that renders MobileBottomNav only for students on public/main pages.
 * Suppressed inside /dashboard, /study, /admin, and /teacher which provide their own navigation.
 */
export default function MobileBottomNavWrapper() {
    const { user, role } = useAuth();
    const pathname = usePathname();

    // Only show for logged-in students (not admin/teacher)
    if (!user || role === "admin" || role === "teacher") return null;

    // Suppress on dashboard, study, and management routes
    if (
        pathname?.startsWith("/dashboard") ||
        pathname?.startsWith("/study") ||
        pathname?.startsWith("/admin") ||
        pathname?.startsWith("/teacher")
    ) {
        return null;
    }

    return <MobileBottomNav />;
}
