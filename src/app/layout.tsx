import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Creative Learning | Master Your Skills",
    description: "A premium learning platform for the web and mobile.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
