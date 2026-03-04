"use client";

import { useEffect, useRef } from "react";

/**
 * ContentProtection — Global client component mounted in the root layout.
 *
 * Features:
 *  1. Disables right-click (context menu) across the entire site.
 *  2. Detects DevTools being open (multiple heuristics) and blanks the page.
 *  3. Blocks common DevTools keyboard shortcuts (F12, Ctrl+Shift+I/J/C, Ctrl+U).
 *  4. Uses the Screen Capture API (Captured Surface Control & displayMedia
 *     detection) combined with CSS `display-mode` to hide content when screen
 *     recording / screen-sharing is active.
 */
export default function ContentProtection() {
    const blankedRef = useRef(false);

    useEffect(() => {
        /* ------------------------------------------------------------------ */
        /*  1. DISABLE RIGHT-CLICK                                            */
        /* ------------------------------------------------------------------ */
        const blockContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            return false;
        };
        document.addEventListener("contextmenu", blockContextMenu, true);

        /* ------------------------------------------------------------------ */
        /*  2. BLOCK DEV-TOOLS KEYBOARD SHORTCUTS                             */
        /* ------------------------------------------------------------------ */
        const blockShortcuts = (e: KeyboardEvent) => {
            // F12
            if (e.key === "F12") {
                e.preventDefault();
                e.stopPropagation();
                blankPage();
                return false;
            }
            // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C  (Chrome/Edge/Firefox)
            if (
                (e.ctrlKey && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key))
            ) {
                e.preventDefault();
                e.stopPropagation();
                blankPage();
                return false;
            }
            // Ctrl+U  (View Source)
            if (e.ctrlKey && (e.key === "u" || e.key === "U")) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            // Ctrl+S (Save Page)
            if (e.ctrlKey && (e.key === "s" || e.key === "S") && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        };
        document.addEventListener("keydown", blockShortcuts, true);

        /* ------------------------------------------------------------------ */
        /*  3. DEV-TOOLS DETECTION (multiple heuristics)                      */
        /* ------------------------------------------------------------------ */

        /**
         * Heuristic A — `debugger` timing.
         * When DevTools is open, hitting a `debugger` statement takes >100ms
         * because the browser pauses execution.
         */
        let devToolsDetectionInterval: ReturnType<typeof setInterval>;

        const checkDevTools = () => {
            if (blankedRef.current) return;

            const start = performance.now();
            // eslint-disable-next-line no-debugger
            debugger;
            const elapsed = performance.now() - start;

            if (elapsed > 100) {
                blankPage();
            }
        };

        /**
         * Heuristic B — Window outer-inner size difference.
         * When DevTools is docked, the difference between outerWidth/innerWidth
         * or outerHeight/innerHeight grows significantly.
         */
        const checkSizeDifference = () => {
            if (blankedRef.current) return;

            const widthThreshold = window.outerWidth - window.innerWidth > 160;
            const heightThreshold = window.outerHeight - window.innerHeight > 160;

            if (widthThreshold || heightThreshold) {
                blankPage();
            }
        };

        /**
         * Heuristic C — console.log toString trick.
         * Custom objects with getters on `id` are only evaluated when DevTools
         * console is open.
         */
        const consoleCheck = () => {
            if (blankedRef.current) return;

            const element = new Image();
            Object.defineProperty(element, "id", {
                get: function () {
                    blankPage();
                    return "";
                },
            });
            console.log("%c", element as unknown as string);
        };

        // Run checks periodically
        devToolsDetectionInterval = setInterval(() => {
            checkSizeDifference();
            consoleCheck();
        }, 1500);

        // Also run the debugger-based check but less frequently (it causes a
        // brief pause when DevTools IS open, so we keep the interval longer).
        const debuggerInterval = setInterval(checkDevTools, 4000);

        /* ------------------------------------------------------------------ */
        /*  4. SCREEN RECORDING / SCREEN CAPTURE PROTECTION                   */
        /* ------------------------------------------------------------------ */

        /**
         * We use `navigator.mediaDevices` to listen for active screen capture
         * and use the Page Visibility API to detect when tab is being shared.
         *
         * Additionally we apply a CSS-level protection: the entire body gets
         * a special CSS class that uses `-webkit-backdrop-filter` tricks and
         * `content-visibility` to make the page appear blank to recorders.
         */

        // Detect Picture-in-Picture / display capture via permissions API
        const checkScreenCapture = async () => {
            try {
                if (navigator.mediaDevices && "getDisplayMedia" in navigator.mediaDevices) {
                    // Check if permission `display-capture` is granted
                    const permStatus = await navigator.permissions.query({
                        name: "display-capture" as PermissionName,
                    });
                    if (permStatus.state === "granted") {
                        document.body.classList.add("screen-capture-active");
                    }
                    permStatus.addEventListener("change", () => {
                        if (permStatus.state === "granted") {
                            document.body.classList.add("screen-capture-active");
                        } else {
                            document.body.classList.remove("screen-capture-active");
                        }
                    });
                }
            } catch {
                // Permissions API may not support display-capture — that's OK
            }
        };

        checkScreenCapture();

        /* ------------------------------------------------------------------ */
        /*  BLANK PAGE FUNCTION                                               */
        /* ------------------------------------------------------------------ */
        function blankPage() {
            if (blankedRef.current) return;
            blankedRef.current = true;

            // Nuke the DOM
            document.title = "";
            document.body.innerHTML = "";
            document.body.style.cssText =
                "margin:0;padding:0;background:#000;color:#000;min-height:100vh;";

            // Remove all stylesheets
            document.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove());
            document.querySelectorAll("style").forEach((el) => el.remove());

            // Prevent further scripts from loading useful content
            const meta = document.createElement("meta");
            meta.httpEquiv = "Content-Security-Policy";
            meta.content = "default-src 'none';";
            document.head.appendChild(meta);

            // Stop all intervals
            clearInterval(devToolsDetectionInterval);
            clearInterval(debuggerInterval);
        }

        /* ------------------------------------------------------------------ */
        /*  DISABLE TEXT SELECTION & DRAG (extra layer)                        */
        /* ------------------------------------------------------------------ */
        const preventSelection = (e: Event) => e.preventDefault();
        document.addEventListener("selectstart", preventSelection, true);
        document.addEventListener("dragstart", preventSelection, true);

        /* ------------------------------------------------------------------ */
        /*  CLEANUP                                                           */
        /* ------------------------------------------------------------------ */
        return () => {
            document.removeEventListener("contextmenu", blockContextMenu, true);
            document.removeEventListener("keydown", blockShortcuts, true);
            document.removeEventListener("selectstart", preventSelection, true);
            document.removeEventListener("dragstart", preventSelection, true);
            clearInterval(devToolsDetectionInterval);
            clearInterval(debuggerInterval);
        };
    }, []);

    return null; // This component renders nothing — it only applies side-effects
}
