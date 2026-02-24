import styles from "./page.module.css";
import ThemeToggle from "@/components/ThemeToggle/ThemeToggle";

export default function Home() {
    return (
        <main className={styles.main}>
            <nav className={`${styles.nav} glass`}>
                <div className={styles.container}>
                    <div className={styles.logo}>
                        <span className="gradient-text">Dr. Shakil's</span> Academy
                    </div>
                    <div className={styles.links}>
                        <a href="#">Exams</a>
                        <a href="#">MCQ Bank</a>
                        <ThemeToggle />
                        <button className={styles.loginBtn}>Student Login</button>
                    </div>
                </div>
            </nav>

            <section className={styles.hero}>
                <div className={styles.heroContent}>
                    <h1 className={styles.title}>
                        Crack your <br />
                        <span className="gradient-text">FCPS Exams</span>
                    </h1>
                    <p className={styles.subtitle}>
                        The ultimate preparation platform for professional medical exams. Comprehensive MCQ banks and mock tests designed for success.
                    </p>
                    <div className={styles.cta}>
                        <button className={styles.primaryBtn}>Enroll Now</button>
                        <button className={styles.secondaryBtn}>Sample MCQs</button>
                    </div>
                </div>

                <div className={styles.heroGlow}></div>
            </section>

            <section className={styles.features}>
                <div className={`${styles.card} glass`}>
                    <h3>FCPS Focused</h3>
                    <p>Curated question banks specifically for Part I and Part II exams.</p>
                </div>
                <div className={`${styles.card} glass`}>
                    <h3>Mock Exams</h3>
                    <p>Simulate real exam conditions with timed practice sessions.</p>
                </div>
                <div className={`${styles.card} glass`}>
                    <h3>Performance Analytics</h3>
                    <p>Track your strengths and identify high-yield areas for improvement.</p>
                </div>
            </section>
        </main>
    );
}
