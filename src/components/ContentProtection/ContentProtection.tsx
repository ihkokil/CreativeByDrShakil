"use client";

import { useEffect } from "react";

/**
 * ContentProtection — Defensive component to prevent content theft.
 * Features:
 * 1. Disables Right-Click context menu.
 * 2. Blocks common DevTools shortcuts (F12, Ctrl+Shift+I, etc.).
 * 3. Monitors for DevTools opening and can blank the page or log the attempt.
 */
export default function ContentProtection() {
    useEffect(() => {
        // Bypass content protection in development mode so developers can debug
        if (
            process.env.NODE_ENV === "development" || 
            (typeof window !== "undefined" && 
                (window.location.hostname === "localhost" || 
                 window.location.hostname.endsWith("creativebydrshakil.ihkokil.workers.dev")))
        ) {
            return;
        }

        // 1. Disable Right-Click
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
        };

        // 2. Block Keyboard Shortcuts for DevTools
        const handleKeyDown = (e: KeyboardEvent) => {
            // F12
            if (e.key === "F12") {
                e.preventDefault();
                return;
            }

            // Ctrl + Shift + I (Inspect)
            // Ctrl + Shift + J (Console)
            // Ctrl + Shift + C (Element selector)
            // Ctrl + U (View Source)
            if (
                (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
                (e.ctrlKey && e.key === "u")
            ) {
                e.preventDefault();
                return;
            }
        };

        // 3. DevTools Detection (Simple version)
        // Checks if the window width/height ratio changes drastically or via console size
        let devToolsOpen = false;
        const threshold = 160;

        const checkDevTools = () => {
            const widthDiff = window.outerWidth - window.innerWidth > threshold;
            const heightDiff = window.outerHeight - window.innerHeight > threshold;

            if (widthDiff || heightDiff) {
                if (!devToolsOpen) {
                    devToolsOpen = true;
                }
            } else {
                devToolsOpen = false;
            }
        };

        window.addEventListener("contextmenu", handleContextMenu);
        window.addEventListener("keydown", handleKeyDown);
        const interval = setInterval(checkDevTools, 1000);

        return () => {
            window.removeEventListener("contextmenu", handleContextMenu);
            window.removeEventListener("keydown", handleKeyDown);
            clearInterval(interval);
        };
    }, []);

    return null; // This component has no UI
}
