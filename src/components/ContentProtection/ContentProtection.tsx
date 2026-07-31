"use client";

import { useEffect, useState } from "react";

/**
 * ContentProtection — Defensive component to prevent content theft.
 * Features:
 * 1. Disables Right-Click context menu.
 * 2. Blocks common DevTools shortcuts (F12, Ctrl+Shift+I, etc.).
 * 3. Monitors for DevTools opening and blocks the page.
 * 4. Uses debugger trap to detect undocked or pre-opened DevTools.
 */
export default function ContentProtection() {
    const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);

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

            const key = e.key.toLowerCase();
            // Ctrl + Shift + I (Inspect)
            // Ctrl + Shift + J (Console)
            // Ctrl + Shift + C (Element selector)
            // Ctrl + U (View Source)
            if (
                (e.ctrlKey && e.shiftKey && (key === "i" || key === "j" || key === "c")) ||
                (e.ctrlKey && key === "u")
            ) {
                e.preventDefault();
                return;
            }
        };

        // 3. DevTools Detection
        const threshold = 160;

        const checkDevTools = () => {
            // Check for docked DevTools via window size difference
            const widthDiff = window.outerWidth - window.innerWidth > threshold;
            const heightDiff = window.outerHeight - window.innerHeight > threshold;

            if (widthDiff || heightDiff) {
                setIsDevToolsOpen(true);
            }

            // 4. Debugger Trap
            // If DevTools is open (even undocked or opened in another tab), the debugger statement
            // will pause execution. We can detect this pause by checking elapsed time.
            const start = performance.now();
            
            // The debugger statement itself. If DevTools is closed, this is skipped instantly.
            // We use an anonymous function evaluation to avoid some basic static analyzers.
            (function() { debugger; })(); 
            
            if (performance.now() - start > 100) {
                // If it took more than 100ms, the debugger paused execution.
                setIsDevToolsOpen(true);
            }
        };

        window.addEventListener("contextmenu", handleContextMenu);
        window.addEventListener("keydown", handleKeyDown);
        
        // Run the check repeatedly
        const interval = setInterval(checkDevTools, 1000);

        return () => {
            window.removeEventListener("contextmenu", handleContextMenu);
            window.removeEventListener("keydown", handleKeyDown);
            clearInterval(interval);
        };
    }, []);

    // If DevTools is detected, render a fullscreen blocking overlay
    if (isDevToolsOpen) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: '#000',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 999999,
                fontSize: '24px',
                fontFamily: 'sans-serif'
            }}>
                Development tools are not allowed on this page.
            </div>
        );
    }

    return null; // Normally has no UI
}
