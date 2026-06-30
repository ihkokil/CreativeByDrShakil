"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Download, Share, PlusSquare, MoreVertical } from "lucide-react";

export function PWAInstallPrompt() {
    const [isMobile, setIsMobile] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isAndroid, setIsAndroid] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        // Check if app is already installed
        const isStandaloneCheck = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
        setIsStandalone(isStandaloneCheck);

        if (isStandaloneCheck) {
            return;
        }

        // Detect OS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
        const isAndroidDevice = /android/.test(userAgent);
        
        setIsIOS(isIOSDevice);
        setIsAndroid(isAndroidDevice);
        setIsMobile(isIOSDevice || isAndroidDevice);

        const dismissed = localStorage.getItem("pwa-prompt-dismissed");
        
        if (dismissed) {
            return;
        }

        // Helper to handle the prompt event
        const handlePromptEvent = (e: any) => {
            setInstallPromptEvent(e);
            setShowPrompt(true);
        };

        // If the event fired before this component mounted (captured in layout.tsx)
        if ((window as any).deferredPWAEvent) {
            handlePromptEvent((window as any).deferredPWAEvent);
        }

        // Listen for standard install prompt (Chrome/Edge/Android) if it fires later
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            handlePromptEvent(e);
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

        // If it's a mobile device (iOS or Android), we show the prompt regardless after a delay.
        // If we captured the event above, they'll see the "Install" button. 
        // If not, they'll see manual instructions.
        let timer: NodeJS.Timeout;
        if (isIOSDevice || isAndroidDevice) {
            timer = setTimeout(() => {
                setShowPrompt(true);
            }, 2500);
        }

        return () => {
            if (timer) clearTimeout(timer);
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        };
    }, []);

    const handleDismiss = () => {
        setShowPrompt(false);
        // Set a timestamp for when they dismissed it
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
                    style={{
                        position: 'fixed',
                        bottom: '24px',
                        left: '16px',
                        right: '16px',
                        zIndex: 99999,
                        maxWidth: '400px',
                        margin: '0 auto',
                    }}
                >
                    <div className="glass" style={{
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        boxShadow: 'var(--shadow-premium)',
                        background: 'var(--card-bg)'
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '4px',
                            background: 'linear-gradient(90deg, var(--primary), var(--info))'
                        }} />
                        
                        <button 
                            onClick={handleDismiss}
                            aria-label="Close"
                            style={{
                                position: 'absolute',
                                top: '12px',
                                right: '12px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%',
                                transition: 'background 0.2s, color 0.2s'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = 'var(--surface-soft)';
                                e.currentTarget.style.color = 'var(--foreground)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-muted)';
                            }}
                        >
                            <X size={20} />
                        </button>

                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                flexShrink: 0,
                                background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)'
                            }}>
                                <img 
                                    src="/icons/android-chrome-192x192.png" 
                                    alt="App Icon" 
                                    style={{ width: '40px', height: '40px', borderRadius: '10px' }} 
                                />
                            </div>
                            
                            <div style={{ flex: 1 }}>
                                <h3 style={{ 
                                    margin: '0 0 4px 0', 
                                    fontSize: '1.1rem', 
                                    fontWeight: 'var(--weight-bold)',
                                    color: 'var(--foreground)' 
                                }}>
                                    Install App
                                </h3>
                                <p style={{ 
                                    margin: 0, 
                                    fontSize: '0.9rem', 
                                    color: 'var(--text-muted)',
                                    lineHeight: '1.4'
                                }}>
                                    Install Creative By Dr. Shakil for a faster, better experience.
                                </p>
                                
                                {installPromptEvent ? (
                                    <div style={{ marginTop: '16px' }}>
                                        <button 
                                            onClick={handleInstall}
                                            style={{
                                                width: '100%',
                                                padding: '12px 24px',
                                                background: 'var(--foreground)',
                                                color: 'var(--background)',
                                                border: 'none',
                                                borderRadius: 'var(--radius-md)',
                                                fontWeight: 'var(--weight-bold)',
                                                fontSize: '0.95rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                transition: 'transform 0.2s, box-shadow 0.2s',
                                                boxShadow: 'var(--shadow-medium)'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        >
                                            <Download size={18} />
                                            Install Now
                                        </button>
                                    </div>
                                ) : isIOS ? (
                                    <div style={{ 
                                        marginTop: '16px',
                                        background: 'var(--surface-soft)',
                                        padding: '12px',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: '0.85rem',
                                        color: 'var(--foreground)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <span>1. Tap</span>
                                            <Share size={16} color="var(--info)" />
                                            <span>in the toolbar</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>2. Select</span>
                                            <PlusSquare size={16} />
                                            <span>Add to Home Screen</span>
                                        </div>
                                    </div>
                                ) : isAndroid ? (
                                    <div style={{ 
                                        marginTop: '16px',
                                        background: 'var(--surface-soft)',
                                        padding: '12px',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: '0.85rem',
                                        color: 'var(--foreground)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <span>1. Tap</span>
                                            <MoreVertical size={16} />
                                            <span>in browser menu</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>2. Select</span>
                                            <PlusSquare size={16} />
                                            <span>Add to Home screen</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Install from your browser menu.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
