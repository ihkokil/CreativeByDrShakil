"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";
import CourseCard from "@/components/Courses/CourseCard";
import styles from "./CoursesPage.module.css";
import { COURSES, Course } from "@/constants/courses";
import { Filter, Search, X, LayoutGrid, List } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { fetchPublishedDynamicCourses, mergeStaticAndDynamicCourses } from "@/lib/dynamic-course-client";
import { PublicTeacher, enrichCoursesWithTeachers } from "@/lib/teacher-directory";
import { CategorySummary, fetchCategories } from "@/lib/categories";

export default function AllCoursesPage() {
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedInstructors, setSelectedInstructors] = useState<string[]>([]);
    const [selectedDurations, setSelectedDurations] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [teachers, setTeachers] = useState<PublicTeacher[]>([]);
    const [dynamicCourses, setDynamicCourses] = useState<Course[]>([]);
    const [categoryList, setCategoryList] = useState<CategorySummary[]>([]);
    const searchParams = useSearchParams();

    useEffect(() => {
        let cancelled = false;

        const loadDynamicCourses = async () => {
            try {
                const courses = await fetchPublishedDynamicCourses();
                if (!cancelled) {
                    setDynamicCourses(courses);
                }
            } catch {
                // Keep the static catalog if dynamic fetch fails.
            }
        };

        loadDynamicCourses();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadCategories = async () => {
            try {
                const list = await fetchCategories();
                if (!cancelled) {
                    setCategoryList(list);
                }
            } catch {
                // Keep derived filters if category fetch fails.
            }
        };

        loadCategories();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const category = searchParams.get("category");
        if (!category) return;
        setSelectedCategories([category]);
    }, [searchParams]);

    const displayCourses = useMemo(() => enrichCoursesWithTeachers(COURSES, teachers), [teachers]);
    const allCourses = useMemo(
        () => mergeStaticAndDynamicCourses(displayCourses, dynamicCourses),
        [displayCourses, dynamicCourses]
    );

    const categoryOptions = useMemo(
        () => Array.from(new Set([
            ...categoryList.map((category) => category.displayName),
            ...allCourses.map((course) => course.category),
        ])).sort(),
        [allCourses, categoryList]
    );
    const instructors = useMemo(
        () => Array.from(new Set(allCourses.map((course) => course.mainInstructor.name))).sort(),
        [allCourses]
    );
    const durations = useMemo(
        () => Array.from(new Set(allCourses.map((course) => course.duration))).sort(),
        [allCourses]
    );

    useEffect(() => {
        let cancelled = false;

        const loadTeachers = async () => {
            try {
                const response = await fetch("/api/teachers");
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

    const toggleSelection = (value: string, setter: (updater: (prev: string[]) => string[]) => void) => {
        setter((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
    };

    const filteredCourses = useMemo(() => {
        return allCourses.filter(course => {
            const matchCategory = selectedCategories.length === 0 || selectedCategories.includes(course.category);
            const matchInstructor = selectedInstructors.length === 0 || selectedInstructors.includes(course.mainInstructor.name);
            const matchDuration = selectedDurations.length === 0 || selectedDurations.includes(course.duration);
            const matchSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase());
            return matchCategory && matchInstructor && matchDuration && matchSearch;
        });
    }, [allCourses, selectedCategories, selectedInstructors, selectedDurations, searchQuery]);

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
                {/* Sidebar Filters */}
                <aside className={styles.sidebar}>
                    <div className={styles.filterSection}>
                        <div className={styles.sidebarTitle}>
                            <Filter size={18} /> Filters
                        </div>

                        <div className={styles.searchBox}>
                            <Search size={18} className={styles.searchIcon} />
                            <input
                                type="text"
                                placeholder="Search courses..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className={styles.filterGroup}>
                            <h4>Categories</h4>
                            <div className={styles.checkboxList}>
                                {categoryOptions.map((cat) => (
                                    <label key={cat} className={styles.checkboxItem}>
                                        <input
                                            type="checkbox"
                                            checked={selectedCategories.includes(cat)}
                                            onChange={() => toggleSelection(cat, setSelectedCategories)}
                                        />
                                        <span className={styles.checkmark}></span>
                                        {cat}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className={styles.filterGroup}>
                            <h4>Instructors</h4>
                            <div className={styles.checkboxList}>
                                {instructors.map((ins) => (
                                    <label key={ins} className={styles.checkboxItem}>
                                        <input
                                            type="checkbox"
                                            checked={selectedInstructors.includes(ins)}
                                            onChange={() => toggleSelection(ins, setSelectedInstructors)}
                                        />
                                        <span className={styles.checkmark}></span>
                                        {ins}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className={styles.filterGroup}>
                            <h4>Duration</h4>
                            <div className={styles.checkboxList}>
                                {durations.map((dur) => (
                                    <label key={dur} className={styles.checkboxItem}>
                                        <input
                                            type="checkbox"
                                            checked={selectedDurations.includes(dur)}
                                            onChange={() => toggleSelection(dur, setSelectedDurations)}
                                        />
                                        <span className={styles.checkmark}></span>
                                        {dur}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {(selectedCategories.length > 0 || selectedInstructors.length > 0 || selectedDurations.length > 0 || searchQuery) && (
                            <button
                                className={styles.clearBtn}
                                onClick={() => {
                                    setSelectedCategories([]);
                                    setSelectedInstructors([]);
                                    setSelectedDurations([]);
                                    setSearchQuery("");
                                }}
                            >
                                <X size={16} /> Clear All
                            </button>
                        )}
                    </div>
                </aside>

                {/* Content Area */}
                <div className={styles.content}>
                    <div className={styles.contentHeader}>
                        <div className={styles.resultsCount}>
                            Showing <strong>{filteredCourses.length}</strong> courses
                        </div>
                        <div className={styles.viewToggle}>
                            <button
                                className={`${styles.toggleBtn} ${viewMode === 'grid' ? styles.activeToggle : ''}`}
                                onClick={() => setViewMode('grid')}
                                title="Grid View"
                            >
                                <LayoutGrid size={20} />
                            </button>
                            <button
                                className={`${styles.toggleBtn} ${viewMode === 'list' ? styles.activeToggle : ''}`}
                                onClick={() => setViewMode('list')}
                                title="List View"
                            >
                                <List size={20} />
                            </button>
                        </div>
                    </div>

                    <div className={`${styles.grid} ${viewMode === 'list' ? styles.listView : styles.gridView}`}>
                        <AnimatePresence mode="popLayout">
                            {filteredCourses.map(course => (
                                <div key={course.id} className={styles.cardWrapper}>
                                    <CourseCard course={course} viewMode={viewMode} />
                                </div>
                            ))}
                        </AnimatePresence>
                    </div>

                    {filteredCourses.length === 0 && (
                        <div className={styles.noResults}>
                            <h3>No courses found</h3>
                            <p>Try adjusting your filters or search query.</p>
                        </div>
                    )}
                </div>
            </section>

            <Footer />
        </main>
    );
}
