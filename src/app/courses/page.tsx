"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";
import CourseCard from "@/components/Courses/CourseCard";
import styles from "./CoursesPage.module.css";
import { Course } from "@/constants/courses";
import { LayoutGrid, List, Search, X } from "lucide-react";

import CourseCardSkeleton from "@/components/Courses/CourseCardSkeleton";
import { fetchPublishedDynamicCourses } from "@/lib/dynamic-course-client";
import { PublicTeacher, enrichCoursesWithTeachers } from "@/lib/teacher-directory";

function AllCoursesContent() {
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("All");
    const [teachers, setTeachers] = useState<PublicTeacher[]>([]);
    const [dynamicCourses, setDynamicCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const loadDynamicCourses = async () => {
            setLoading(true);
            try {
                const courses = await fetchPublishedDynamicCourses();
                if (!cancelled) {
                    setDynamicCourses(courses);
                }
            } catch {
                // Keep the static catalog if dynamic fetch fails.
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadDynamicCourses();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadTeachers = async () => {
            try {
                const response = await fetch("/api/teachers", { cache: "no-store" });
                const data = await response.json();
                if (!cancelled && response.ok && Array.isArray(data.teachers)) {
                    setTeachers(data.teachers);
                }
            } catch {
                // Keep static fallback data if teacher directory fetch fails.
            }
        };

        loadTeachers();

        return () => {
            cancelled = true;
        };
    }, []);

    const allCourses = useMemo(() => enrichCoursesWithTeachers(dynamicCourses, teachers), [dynamicCourses, teachers]);

    const categories = useMemo(() => {
        const set = new Set<string>();
        allCourses.forEach((c: any) => {
            if (c.category && String(c.category).trim()) {
                set.add(String(c.category).trim());
            }
        });
        return ["All", ...Array.from(set)];
    }, [allCourses]);

    const filteredCourses = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return allCourses.filter((c: any) => {
            if (selectedCategory !== "All" && String(c.category || "").trim() !== selectedCategory) {
                return false;
            }
            if (!q) return true;
            const titleMatch = (c.title || "").toLowerCase().includes(q);
            const descMatch = (c.description || "").toLowerCase().includes(q);
            const catMatch = (c.category || "").toLowerCase().includes(q);
            return titleMatch || descMatch || catMatch;
        });
    }, [allCourses, searchQuery, selectedCategory]);

    return (
        <main className={styles.main}>
            <Suspense fallback={null}>
                <Navbar />
            </Suspense>

            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <h1 className={styles.title}>All <span className="gradient-text">Courses</span></h1>
                    <p className={styles.subtitle}>Explore our professional medical curriculum designed for your success.</p>
                </div>
            </header>

            <section className={styles.container}>
                {/* Content Area */}
                <div className={styles.content}>
                    <div className={styles.catalogToolbar}>
                        <div className={styles.searchBox}>
                            <Search size={18} className={styles.searchIcon} />
                            <input
                                type="text"
                                placeholder="Search courses by title, specialty, or subject..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                aria-label="Search courses"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    className={styles.searchClearBtn}
                                    onClick={() => setSearchQuery("")}
                                    aria-label="Clear search"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {categories.length > 1 && (
                            <div className={styles.filterOptions}>
                                {categories.map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        className={`${styles.filterBtn} ${selectedCategory === cat ? styles.active : ""}`}
                                        onClick={() => setSelectedCategory(cat)}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className={styles.contentHeader}>
                        <div className={styles.resultsCount}>
                            Showing <strong>{filteredCourses.length}</strong> of <strong>{allCourses.length}</strong> courses
                        </div>
                        <div className={styles.viewToggle}>
                            <button
                                className={`${styles.toggleBtn} ${viewMode === 'grid' ? styles.activeToggle : ''}`}
                                onClick={() => setViewMode('grid')}
                                title="Grid View"
                                aria-label="Grid View"
                            >
                                <LayoutGrid size={20} />
                            </button>
                            <button
                                className={`${styles.toggleBtn} ${viewMode === 'list' ? styles.activeToggle : ''}`}
                                onClick={() => setViewMode('list')}
                                title="List View"
                                aria-label="List View"
                            >
                                <List size={20} />
                            </button>
                        </div>
                    </div>

                    <div className={`${styles.grid} ${viewMode === 'list' ? styles.listView : styles.gridView}`}>
                        {loading ? (
                            [...Array(6)].map((_, i) => (
                                <div key={`skeleton-${i}`} className={styles.cardWrapper}>
                                    <CourseCardSkeleton viewMode={viewMode} />
                                </div>
                            ))
                        ) : (
                            filteredCourses.map(course => (
                                <div key={course.id} className={styles.cardWrapper}>
                                    <CourseCard course={course} viewMode={viewMode} />
                                </div>
                            ))
                        )}
                    </div>

                    {!loading && filteredCourses.length === 0 && (
                        <div className={styles.noResults}>
                            <h3>No courses found</h3>
                            <p>{searchQuery || selectedCategory !== "All" ? "No courses matched your current search or filter." : "Check back soon for new content."}</p>
                            {(searchQuery || selectedCategory !== "All") && (
                                <button
                                    type="button"
                                    className={styles.resetCatalogBtn}
                                    onClick={() => {
                                        setSearchQuery("");
                                        setSelectedCategory("All");
                                    }}
                                >
                                    Reset Search & Filters
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </section>

            <Footer />
        </main>
    );
}

export default function AllCoursesPage() {
    return (
        <Suspense fallback={null}>
            <AllCoursesContent />
        </Suspense>
    );
}
