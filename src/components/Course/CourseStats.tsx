"use client";

import { BarChart, Clock, Award, Users } from "lucide-react";
import styles from "./CourseStats.module.css";
import { Course } from "@/constants/courses";

interface Props {
  course: Course;
}

export default function CourseStats({ course }: Props) {
  const stats = [
    {
      label: "Skill Level",
      value: course.level || "Beginner",
      icon: <BarChart size={20} />,
    },
    {
      label: "Total Duration",
      value: course.duration,
      icon: <Clock size={20} />,
    },
    {
      label: "Students",
      value: course.enrolledCount ? `${course.enrolledCount.toLocaleString()}+` : "New Course",
      icon: <Users size={20} />,
    },
    {
      label: "Last Updated",
      value: course.lastUpdated || "Recently",
      icon: <Award size={20} />,
    },
  ];

  return (
    <div className={styles.statsGrid}>
      {stats.map((stat, idx) => (
        <div key={idx} className={styles.statCard}>
          <div className={styles.iconWrapper}>{stat.icon}</div>
          <div className={styles.content}>
            <span className={styles.label}>{stat.label}</span>
            <span className={styles.value}>{stat.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
