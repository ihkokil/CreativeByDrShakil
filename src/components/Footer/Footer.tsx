import Link from "next/link";
import styles from "./Footer.module.css";
import { Facebook, Twitter, Github, Mail } from "lucide-react";

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={styles.container}>
                <div className={styles.brandSide}>
                    <div className={styles.logo}>
                        <span className="gradient-text">Dr. Shakil's</span> Academy
                    </div>
                    <p className={styles.tagline}>
                        Excellence in medical post-graduate training and exam preparation.
                        Join thousands of successful candidates.
                    </p>
                    <div className={styles.social}>
                        <a href="#"><Facebook size={20} /></a>
                        <a href="#"><Twitter size={20} /></a>
                        <a href="#"><Github size={20} /></a>
                        <a href="#"><Mail size={20} /></a>
                    </div>
                </div>

                <div className={styles.linksGrid}>
                    <div>
                        <h4>Resources</h4>
                        <ul>
                            <li><Link href="#">MCQ Bank</Link></li>
                            <li><Link href="#">Mock Tests</Link></li>
                            <li><Link href="#">CME Credits</Link></li>
                            <li><Link href="#">Lecture Notes</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h4>Company</h4>
                        <ul>
                            <li><Link href="#">About Us</Link></li>
                            <li><Link href="#">Our Tutors</Link></li>
                            <li><Link href="#">Careers</Link></li>
                            <li><Link href="#">Contact</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h4>Legal</h4>
                        <ul>
                            <li><Link href="#">Privacy Policy</Link></li>
                            <li><Link href="#">Terms of Use</Link></li>
                            <li><Link href="#">Refund Policy</Link></li>
                        </ul>
                    </div>
                </div>
            </div>
            <div className={styles.bottomBar}>
                <p>&copy; {new Date().getFullYear()} CreativeByDrShakil. All rights reserved.</p>
            </div>
        </footer>
    );
}
