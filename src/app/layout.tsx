import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import SessionWarningToast from "@/components/SessionWarning/SessionWarning";
import ContentProtection from "@/components/ContentProtection/ContentProtection";

import MobileBottomNavWrapper from "@/components/Navbar/MobileBottomNavWrapper";

const outfit = Outfit({ subsets: ["latin"], display: 'swap', adjustFontFallback: false });

export const viewport: Viewport = {
    themeColor: "#ffffff",
    minimumScale: 1,
    initialScale: 1,
    width: "device-width",
    viewportFit: "cover",
};

export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://creativebydrshakil.com'),
    title: {
        default: "Creative By Dr. Shakil | Medical Education Simplified",
        template: "%s | Creative By Dr. Shakil"
    },
    description: "Creative By Dr. Shakil (creativebydrshakil.com) — a premium learning platform for doctors.",
    icons: {
        icon: "/favicon.ico",
        apple: `${process.env.NEXT_PUBLIC_FILE_URL}/icons/apple-touch-icon.png`,
    },
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "/",
        siteName: "Creative By Dr. Shakil",
        images: [{ url: `${process.env.NEXT_PUBLIC_FILE_URL}/og-image.webp`, width: 1200, height: 630 }],
    },
    twitter: {
        card: "summary_large_image",
    }
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <script src="/polyfills.js" />
                <link rel="preconnect" href="https://www.youtube-nocookie.com" />
                <link rel="preconnect" href="https://www.youtube.com" />
                <link rel="preconnect" href="https://i.ytimg.com" />
                <link rel="preconnect" href="https://s.ytimg.com" />
                <link rel="preconnect" href="https://googlevideo.com" />
                <link rel="preconnect" href="https://googleads.g.doubleclick.net" />
                <link rel="preconnect" href="https://static.doubleclick.net" />
                <link rel="dns-prefetch" href="https://www.youtube-nocookie.com" />
                <link rel="dns-prefetch" href="https://www.youtube.com" />
                <link rel="dns-prefetch" href="https://googlevideo.com" />
            </head>
            <body className={outfit.className} suppressHydrationWarning>
                <noscript>
                    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: '-apple-system, sans-serif' }}>
                        <h1>JavaScript Required</h1>
                        <p>Please enable JavaScript to use this application.</p>
                    </div>
                </noscript>
                <div
                    id="legacy-browser-warning"
                    style={{
                        display: 'none',
                        position: 'fixed',
                        inset: 0,
                        zIndex: 99999,
                        backgroundColor: '#0a0a0a',
                        color: '#ffffff',
                        padding: '2rem',
                        textAlign: 'center',
                        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    }}
                >
                    <div style={{ maxWidth: '400px', margin: '20vh auto 0' }}>
                        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
                            Browser Update Required
                        </h1>
                        <p style={{ color: '#aaa', lineHeight: 1.6 }}>
                            Your browser is too old to run this application.
                            Please update your iPhone/iPad to iOS 14 or later
                            in Settings → General → Software Update.
                        </p>
                    </div>
                </div>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                try {
                                    if (typeof window !== 'undefined' && typeof Node !== 'undefined') {
                                        var origRemove = Node.prototype.removeChild;
                                        Node.prototype.removeChild = function(child) {
                                            if (child && child.parentNode !== this) {
                                                if (child.parentNode) {
                                                    return child.parentNode.removeChild(child);
                                                }
                                                return child;
                                            }
                                            return origRemove.call(this, child);
                                        };
                                        var origInsert = Node.prototype.insertBefore;
                                        Node.prototype.insertBefore = function(newNode, referenceNode) {
                                            if (referenceNode && referenceNode.parentNode !== this) {
                                                if (referenceNode.parentNode) {
                                                    return referenceNode.parentNode.insertBefore(newNode, referenceNode);
                                                }
                                                return newNode;
                                            }
                                            return origInsert.call(this, newNode, referenceNode);
                                        };
                                    }
                                } catch(e) {}
                                try {
                                    if (
                                        typeof Promise.allSettled !== 'function' &&
                                        typeof Promise.withResolvers !== 'function'
                                    ) {}
                                    var test = eval('var o = {}; o?.x');
                                    eval('var x = null ?? 1');
                                } catch(e) {
                                    document.getElementById('legacy-browser-warning').style.display = 'block';
                                }
                            })();
                        `,
                    }}
                />
                <AuthProvider>
                    <ContentProtection />
                    {children}
                    <SessionWarningToast />
                    <MobileBottomNavWrapper />
                </AuthProvider>
            </body>
        </html>
    );
}
