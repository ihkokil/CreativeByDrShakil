"use client";

import { useAuth } from "@/context/AuthContext";
import MobileBottomNav from "./MobileBottomNav";

/**
 * Wrapper that renders MobileBottomNav only for students.
 * Place in root layout so it appears on every page.
 */
export default function MobileBottomNavWrapper() {
    const { user, role } = useAuth();

    // Only show for logged-in students (not admin/teacher)
    if (!user || role === "admin" || role === "teacher") return null;

    return <MobileBottomNav />;
}
