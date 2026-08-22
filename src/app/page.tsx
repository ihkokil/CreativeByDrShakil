import Navbar from "@/components/Navbar/Navbar";
import Hero from "@/components/Hero/Hero";
import Courses from "@/components/Courses/Courses";
import FAQ from "@/components/FAQ/FAQ";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";
import { fetchPublishedCoursesServer, fetchPublishedTeachersServer } from "@/lib/server-courses";
import { mapDynamicCourseToCourse } from "@/lib/dynamic-course-client";
import { Course } from "@/constants/courses";
import { PublicTeacher } from "@/lib/teacher-directory";

export default async function Home() {
    let initialCourses: Course[] = [];
    let initialTeachers: PublicTeacher[] = [];

    try {
        const [coursesData, teachersData] = await Promise.all([
            fetchPublishedCoursesServer(),
            fetchPublishedTeachersServer()
        ]);

        if (Array.isArray(coursesData)) {
            initialCourses = coursesData.map(mapDynamicCourseToCourse);
        }
        if (Array.isArray(teachersData)) {
            initialTeachers = teachersData;
        }
    } catch (error) {
        console.error("Failed to load initial data for home page", error);
    }

    return (
        <main className={styles.main}>
            <Navbar />
            <section className={`${styles.sectionShell} ${styles.heroShell}`}>
                <Hero courseCount={initialCourses.length} />
            </section>
            <section className={`${styles.sectionShell} ${styles.coursesShell}`}>
                <Courses initialCourses={initialCourses} initialTeachers={initialTeachers} />
            </section>
            <section className={`${styles.sectionShell} ${styles.faqShell}`}>
                <FAQ />
            </section>
            <Footer />
        </main>
    );
}
