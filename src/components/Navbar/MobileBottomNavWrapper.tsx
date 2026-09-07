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

    const cleanPath = pathname?.replace(/\/+$/, "") || "";

    // Suppress on study mode, inside quiz attempts (distraction-free), and management routes
    if (
        cleanPath.startsWith("/study") ||
        cleanPath.startsWith("/admin") ||
        cleanPath.startsWith("/teacher") ||
        cleanPath.startsWith("/dashboard/quizzes/")
    ) {
        return null;
    }

    return <MobileBottomNav />;
}
