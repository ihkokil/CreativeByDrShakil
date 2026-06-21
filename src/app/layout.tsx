import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import SessionWarningToast from "@/components/SessionWarning/SessionWarning";
import ContentProtection from "@/components/ContentProtection/ContentProtection";

import MobileBottomNavWrapper from "@/components/Navbar/MobileBottomNavWrapper";

const outfit = Outfit({ subsets: ["latin"], display: 'swap', adjustFontFallback: false });

export const metadata: Metadata = {
    title: "Creative By Dr. Shakil | Medical Education Simplified",
    description: "Creative By Dr. Shakil (creativebydrshakil.com) — a premium learning platform for doctors.",
    icons: {
        icon: "/favicon.ico",
    },
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
