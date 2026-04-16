"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import styles from "./VideoWatermark.module.css";

/**
 * VideoWatermark — Floating overlay that displays the logged-in user's
 * full name and email on top of the video player.  The text bounces
 * continuously across the container so it cannot be cropped out.
 */
export default function VideoWatermark() {
    const { user } = useAuth();
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const animRef = useRef<number>(0);

    // Position & velocity state kept in refs so the animation loop doesn't
    // trigger React re-renders.
    const pos = useRef({ x: 20, y: 20 });
    const vel = useRef({ vx: 0.6, vy: 0.4 });

    useEffect(() => {
        const container = containerRef.current;
        const text = textRef.current;
        if (!container || !text) return;

        const animate = () => {
            const cw = container.offsetWidth;
            const ch = container.offsetHeight;
            const tw = text.offsetWidth;
            const th = text.offsetHeight;

            pos.current.x += vel.current.vx;
            pos.current.y += vel.current.vy;

            // Bounce off edges
            if (pos.current.x + tw >= cw || pos.current.x <= 0) {
                vel.current.vx *= -1;
                pos.current.x = Math.max(0, Math.min(pos.current.x, cw - tw));
            }
            if (pos.current.y + th >= ch || pos.current.y <= 0) {
                vel.current.vy *= -1;
                pos.current.y = Math.max(0, Math.min(pos.current.y, ch - th));
            }

            text.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px)`;

            animRef.current = requestAnimationFrame(animate);
        };

        animRef.current = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(animRef.current);
    }, []);

    if (!user) return null;

    const fullName = user.user_metadata?.full_name || "User";
    const email = user.email || "";

    return (
        <div ref={containerRef} className={styles.watermarkContainer}>
            <div ref={textRef} className={styles.watermarkText}>
                <span className={styles.name}>{fullName}</span>
                <span className={styles.email}>{email}</span>
            </div>
        </div>
    );
}
