"use client";

import Link from "next/link";
import Image from "next/image";
import styles from "./Footer.module.css";
import { Facebook, Twitter, Instagram, Youtube, Mail } from "lucide-react";

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={styles.mainFooter}>
                <div className={styles.brandSide}>
                    <div className={styles.logo}>
                        <Image src="/logo.png" alt="Creative By Dr. Shakil" width={180} height={50} className={styles.logoImg} />
                    </div>
                    <p className={styles.description}>
                        Empowering the next generation of medical specialists through evidence-based training and clinical excellence since 2018.
                    </p>
                    <div className={styles.contactInfo}>
                        <div className={styles.contactItem}>
                            <Mail size={18} />
                            <span>contact@drshakil.com</span>
                        </div>
                    </div>
                </div>

                <div className={styles.linksGrid}>
                    <div className={styles.linkColumn}>
                        <h4>Academy</h4>
                        <ul>
                            <li><Link href="/courses">All Courses</Link></li>
                            <li><Link href="#">Study Portal</Link></li>
                            <li><Link href="#">Mock Exams</Link></li>
                            <li><Link href="#">Success Stories</Link></li>
                        </ul>
                    </div>
                    <div className={styles.linkColumn}>
                        <h4>Support</h4>
                        <ul>
                            <li><Link href="#">Help Center</Link></li>
                            <li><Link href="#">Student FAQ</Link></li>
                            <li><Link href="/contact">Contact Us</Link></li>
                            <li><Link href="#">Terms of Service</Link></li>
                        </ul>
                    </div>
                    <div className={styles.linkColumn}>
                        <h4>Follow Us</h4>
                        <div className={styles.socialGrid}>
                            <a href="#" className={styles.socialIcon} aria-label="Facebook"><Facebook size={20} /></a>
                            <a href="#" className={styles.socialIcon} aria-label="Twitter"><Twitter size={20} /></a>
                            <a href="#" className={styles.socialIcon} aria-label="Instagram"><Instagram size={20} /></a>
                            <a href="#" className={styles.socialIcon} aria-label="Youtube"><Youtube size={20} /></a>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.bottomBar}>
                <div className={styles.bottomContent}>
                    <p>&copy; {new Date().getFullYear()} Creative By Dr. Shakil | creativebydrshakil.com. Developed for medical excellence.</p>
                    <div className={styles.legalLinks}>
                        <Link href="#">Privacy</Link>
                        <Link href="#">Cookies</Link>
                        <Link href="#">Security</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
