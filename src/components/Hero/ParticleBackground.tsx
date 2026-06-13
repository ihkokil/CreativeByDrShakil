"use client";

import { useEffect, useRef } from "react";
import styles from "./Hero.module.css";

export default function ParticleBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animationFrameId: number;
        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const handleResize = () => {
            if (!canvas) return;
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };

        window.addEventListener("resize", handleResize);

        // Particle class
        class Particle {
            x: number;
            y: number;
            vx: number;
            vy: number;
            radius: number;

            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.vx = (Math.random() - 0.5) * 0.4;
                this.vy = (Math.random() - 0.5) * 0.4;
                this.radius = Math.random() * 2 + 1;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                // Bounce off edges
                if (this.x < 0 || this.x > width) this.vx *= -1;
                if (this.y < 0 || this.y > height) this.vy *= -1;
            }

            draw(context: CanvasRenderingContext2D, color: string) {
                context.beginPath();
                context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                context.fillStyle = color;
                context.fill();
            }
        }

        // Initialize particles based on screen size
        const particleCount = Math.min(Math.floor((width * height) / 16000), 80);
        const particles: Particle[] = [];
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }

        // Mouse tracking
        const mouse = { x: -9999, y: -9999 };
        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        };
        const handleMouseLeave = () => {
            mouse.x = -9999;
            mouse.y = -9999;
        };

        // Track mouse on the window to capture events outside the canvas
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseleave", handleMouseLeave);

        // Theme colors
        const getParticleColor = () => {
            const isDark = document.documentElement.getAttribute("data-theme") === "dark";
            return isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(29, 78, 216, 0.1)";
        };

        const getLineColor = () => {
            const isDark = document.documentElement.getAttribute("data-theme") === "dark";
            return isDark ? "rgba(59, 130, 246, 0.08)" : "rgba(29, 78, 216, 0.04)";
        };

        let particleColor = getParticleColor();
        let lineColor = getLineColor();

        const observer = new MutationObserver(() => {
            particleColor = getParticleColor();
            lineColor = getLineColor();
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

        // Animation loop
        const loop = () => {
            ctx.clearRect(0, 0, width, height);

            particles.forEach((p) => {
                p.update();
                p.draw(ctx, particleColor);
            });

            // Draw connection lines
            for (let i = 0; i < particles.length; i++) {
                const p1 = particles[i];
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = lineColor;
                        ctx.lineWidth = (1 - dist / 120) * 0.8;
                        ctx.stroke();
                    }
                }

                // Interactive connection to mouse cursor
                if (mouse.x > 0 && mouse.y > 0) {
                    const dx = p1.x - mouse.x;
                    const dy = p1.y - mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 180) {
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(mouse.x, mouse.y);
                        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
                        ctx.strokeStyle = isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(29, 78, 216, 0.06)";
                        ctx.lineWidth = (1 - dist / 180) * 1.2;
                        ctx.stroke();
                    }
                }
            }

            animationFrameId = requestAnimationFrame(loop);
        };

        loop();

        return () => {
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseleave", handleMouseLeave);
            cancelAnimationFrame(animationFrameId);
            observer.disconnect();
        };
    }, []);

    return <canvas ref={canvasRef} className={styles.particleCanvas} />;
}
