"use client";

import { useState, useMemo } from "react";
import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";
import CourseCard from "@/components/Courses/CourseCard";
import styles from "./CoursesPage.module.css";
import { COURSES, INSTRUCTORS } from "@/constants/courses";
import { Filter, Search, X, LayoutGrid, List } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function AllCoursesPage() {
    const [activeCategory, setActiveCategory] = useState("All");
    const [activeInstructor, setActiveInstructor] = useState("All");
    const [activeDuration, setActiveDuration] = useState("All");
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    const categories = ["All", "FCPS", "Exams", "Residency", "Part II"];
    const instructors = ["All", ...Object.values(INSTRUCTORS).map(i => i.name)];
    const durations = ["All", "2 Months", "3 Months", "4 Months", "6 Months"];

    const filteredCourses = useMemo(() => {
        return COURSES.filter(course => {
            const matchCategory = activeCategory === "All" || course.category === activeCategory;
            const matchInstructor = activeInstructor === "All" || course.mainInstructor.name === activeInstructor;
            const matchDuration = activeDuration === "All" || course.duration === activeDuration;
            const matchSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase());
            return matchCategory && matchInstructor && matchDuration && matchSearch;
        });
    }, [activeCategory, activeInstructor, activeDuration, searchQuery]);

    return (
        <main className={styles.main}>
            <Navbar />

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
                            <select
                                className={styles.selectControl}
                                value={activeCategory}
                                onChange={(e) => setActiveCategory(e.target.value)}
                            >
                                {categories.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.filterGroup}>
                            <h4>Instructors</h4>
                            <select
                                className={styles.selectControl}
                                value={activeInstructor}
                                onChange={(e) => setActiveInstructor(e.target.value)}
                            >
                                {instructors.map((ins) => (
                                    <option key={ins} value={ins}>{ins}</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.filterGroup}>
                            <h4>Duration</h4>
                            <select
                                className={styles.selectControl}
                                value={activeDuration}
                                onChange={(e) => setActiveDuration(e.target.value)}
                            >
                                {durations.map((dur) => (
                                    <option key={dur} value={dur}>{dur}</option>
                                ))}
                            </select>
                        </div>

                        {(activeCategory !== "All" || activeInstructor !== "All" || activeDuration !== "All" || searchQuery) && (
                            <button
                                className={styles.clearBtn}
                                onClick={() => {
                                    setActiveCategory("All");
                                    setActiveInstructor("All");
                                    setActiveDuration("All");
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
