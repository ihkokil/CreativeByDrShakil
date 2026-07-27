import Navbar from "@/components/Navbar/Navbar";
import Hero from "@/components/Hero/Hero";
import Courses from "@/components/Courses/Courses";
import FAQ from "@/components/FAQ/FAQ";
import Footer from "@/components/Footer/Footer";
import styles from "./page.module.css";
import { fetchPublishedDynamicCourses } from "@/lib/dynamic-course-client";

export default async function Home() {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://creativebydrshakil.com';
    let initialCourses = [];
    let initialTeachers = [];

    try {
        const [coursesRes, teachersRes] = await Promise.all([
            fetch(`${baseUrl}/api/courses/dynamic`, { next: { revalidate: 3600 } }),
            fetch(`${baseUrl}/api/teachers`, { next: { revalidate: 3600 } })
        ]);

        if (coursesRes.ok) {
            const data = await coursesRes.json();
            if (Array.isArray(data.courses)) {
                // The dynamic-course-client mapping usually happens in the fetchPublishedDynamicCourses helper,
                // but since we are fetching from the API directly, we need to map it or just pass it to the component.
                // Wait, dynamic-course-client's fetchPublishedDynamicCourses uses relative URL '/api/courses/dynamic',
                // so we can't use it directly in Server Components without base URL. Let's just fetch and map manually.
                const { mapDynamicCourseToCourse } = await import('@/lib/dynamic-course-client');
                initialCourses = data.courses.map(mapDynamicCourseToCourse);
            }
        }

        if (teachersRes.ok) {
            const data = await teachersRes.json();
            if (Array.isArray(data.teachers)) {
                initialTeachers = data.teachers;
            }
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
