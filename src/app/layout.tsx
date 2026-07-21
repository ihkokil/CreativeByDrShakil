import type { Metadata, Viewport } from "next";
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
            <body className={outfit.className} suppressHydrationWarning>
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
