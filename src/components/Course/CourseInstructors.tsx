"use client";

import Image from "next/image";
import styles from "./CourseInstructors.module.css";
import { Course } from "@/constants/courses";

interface Props {
  course: Course;
  instructorList: any[];
}

export default function CourseInstructors({ instructorList }: Props) {
  if (instructorList.length === 0) return null;

  return (
    <div className={styles.instructorsGrid}>
      {instructorList.map((instructor, idx) => (
        <div key={idx} className={styles.instructorCard}>
          <Image 
            src={instructor.image || "/placeholder-square.svg"} 
            alt={instructor.name}
            width={80}
            height={80}
            className={styles.image}
            unoptimized
          />
          <div className={styles.info}>
            <h3 className={styles.name}>{instructor.name}</h3>
            <p className={styles.role}>{instructor.role}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
