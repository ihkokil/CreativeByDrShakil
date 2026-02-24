import styles from "./page.module.css";

export default function Home() {
    return (
        <main className={styles.main}>
            <nav className={`${styles.nav} glass`}>
                <div className={styles.container}>
                    <div className={styles.logo}>
                        <span className="gradient-text">Creative</span>ByDrShakil
                    </div>
                    <div className={styles.links}>
                        <a href="#">Courses</a>
                        <a href="#">Pricing</a>
                        <button className={styles.loginBtn}>Login</button>
                    </div>
                </div>
            </nav>

            <section className={styles.hero}>
                <div className={styles.heroContent}>
                    <h1 className={styles.title}>
                        The Future of <br />
                        <span className="gradient-text">Personalized Learning</span>
                    </h1>
                    <p className={styles.subtitle}>
                        Master any skill with our industry-leading platform. Designed for the modern learner, available on every device.
                    </p>
                    <div className={styles.cta}>
                        <button className={styles.primaryBtn}>Get Started</button>
                        <button className={styles.secondaryBtn}>View Demo</button>
                    </div>
                </div>

                <div className={styles.heroGlow}></div>
            </section>

            <section className={styles.features}>
                <div className={`${styles.card} glass`}>
                    <h3>Interactive Web</h3>
                    <p>Optimized for deep study sessions on your desktop.</p>
                </div>
                <div className={`${styles.card} glass`}>
                    <h3>Mobile First</h3>
                    <p>Coming soon to iOS and Android for learning on the go.</p>
                </div>
                <div className={`${styles.card} glass`}>
                    <h3>Expert Paths</h3>
                    <p>Curated content from industry leaders worldwide.</p>
                </div>
            </section>
        </main>
    );
}
