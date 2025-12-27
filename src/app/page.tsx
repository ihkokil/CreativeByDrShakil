import styles from "./page.module.css";
import ThemeToggle from "@/components/ThemeToggle/ThemeToggle";

export default function Home() {
    return (
        <main className={styles.main}>
            <nav className={`${styles.nav} glass`}>
                <div className={styles.container}>
                    <div className={styles.logo}>
                        <span className="gradient-text">Dr. Shakil's</span> Learning
                    </div>
                    <div className={styles.links}>
                        <a href="#">Resources</a>
                        <a href="#">CME Credits</a>
                        <ThemeToggle />
                        <button className={styles.loginBtn}>Doctor Login</button>
                    </div>
                </div>
            </nav>

            <section className={styles.hero}>
                <div className={styles.heroContent}>
                    <h1 className={styles.title}>
                        Master Medicine <br />
                        <span className="gradient-text">With Clarity</span>
                    </h1>
                    <p className={styles.subtitle}>
                        Concise, case-based learning designed for the busy clinician. Updated daily with the latest global research.
                    </p>
                    <div className={styles.cta}>
                        <button className={styles.primaryBtn}>Start Learning</button>
                        <button className={styles.secondaryBtn}>Explore Courses</button>
                    </div>
                </div>

                <div className={styles.heroGlow}></div>
            </section>

            <section className={styles.features}>
                <div className={`${styles.card} glass`}>
                    <h3>Clinical Cases</h3>
                    <p>Real-world scenarios analyzed by senior consultants.</p>
                </div>
                <div className={`${styles.card} glass`}>
                    <h3>Flash Updates</h3>
                    <p>30-second summaries of new medical guidelines.</p>
                </div>
                <div className={`${styles.card} glass`}>
                    <h3>Community</h3>
                    <p>Connect with specialists from around the world.</p>
                </div>
            </section>
        </main>
    );
}
