import Navbar from "@/components/Navbar/Navbar";
import Hero from "@/components/Hero/Hero";
import Upcoming from "@/components/Upcoming/Upcoming";
import Courses from "@/components/Courses/Courses";
import FAQ from "@/components/FAQ/FAQ";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";

export default function Home() {
    return (
        <main className={styles.main}>
            <Navbar />
            <section className={`${styles.sectionShell} ${styles.heroShell}`}>
                <Hero />
            </section>
            <section className={`${styles.sectionShell} ${styles.upcomingShell}`}>
                <Upcoming />
            </section>
            <section className={`${styles.sectionShell} ${styles.coursesShell}`}>
                <Courses />
            </section>
            <section className={`${styles.sectionShell} ${styles.faqShell}`}>
                <FAQ />
            </section>
            <Footer />
        </main>
    );
}
