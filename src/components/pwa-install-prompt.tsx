"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Download, Share, PlusSquare } from "lucide-react";

export function PWAInstallPrompt() {
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        // Check if app is already installed
        const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
        setIsStandalone(isStandalone);

        if (isStandalone) {
            return;
        }

        // Detect iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIOSDevice);

        // Check if user previously dismissed
        const dismissed = localStorage.getItem("pwa-prompt-dismissed");
        
        // Listen for standard install prompt (Chrome/Edge/Android)
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setInstallPromptEvent(e);
            if (!dismissed) {
                setShowPrompt(true);
            }
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

        // If iOS and not dismissed, show the prompt (since iOS doesn't fire beforeinstallprompt)
        if (isIOSDevice && !dismissed) {
            // Small delay to ensure it doesn't pop up immediately on load
            const timer = setTimeout(() => setShowPrompt(true), 2000);
            return () => {
                clearTimeout(timer);
                window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
            };
        }

        return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    }, []);

    const handleDismiss = () => {
        setShowPrompt(false);
        // Set a timestamp for when they dismissed it so we don't bother them for a while (e.g., 7 days)
        localStorage.setItem("pwa-prompt-dismissed", Date.now().toString());
    };

    const handleInstall = async () => {
        if (!installPromptEvent) return;

        installPromptEvent.prompt();
        const { outcome } = await installPromptEvent.userChoice;
        
        if (outcome === "accepted") {
            setShowPrompt(false);
        }
        // Clear the saved prompt since it can't be used again
        setInstallPromptEvent(null);
    };

    if (isStandalone) return null;

    return (
        <AnimatePresence>
            {showPrompt && (
                <motion.div 
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-gray-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-4 z-50 overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
                    
                    <button 
                        onClick={handleDismiss}
                        className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-start gap-4 pt-2">
                        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/50 dark:to-purple-900/50 rounded-xl flex items-center justify-center">
                            <img src="/icons/icon-192x192.png" alt="App Icon" className="w-8 h-8 rounded-lg" />
                        </div>
                        
                        <div className="flex-1">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                Install App
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                                Install Creative By Dr. Shakil for a faster, better experience.
                            </p>
                            
                            {isIOS ? (
                                <div className="mt-4 bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300">
                                    <p className="flex items-center gap-2 mb-2">
                                        1. Tap <Share className="w-4 h-4 text-blue-500" /> in the toolbar
                                    </p>
                                    <p className="flex items-center gap-2">
                                        2. Select <PlusSquare className="w-4 h-4 text-gray-900 dark:text-white" /> Add to Home Screen
                                    </p>
                                </div>
                            ) : (
                                <div className="mt-4 flex gap-2">
                                    <button 
                                        onClick={handleInstall}
                                        className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium py-2 px-4 rounded-xl shadow-sm hover:bg-gray-800 dark:hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        Install Now
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
