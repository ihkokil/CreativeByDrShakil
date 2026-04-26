"use client";

import styles from "./CourseCard.module.css";
import { motion } from "framer-motion";

interface Props {
    viewMode?: "grid" | "list";
}

export default function CourseCardSkeleton({ viewMode = "grid" }: Props) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`${styles.card} ${styles.skeletonCard} ${viewMode === 'list' ? styles.listCard : ''} glass`}
        >
            <div className={`${styles.imageWrapper} ${styles.skeleton}`}>
            </div>

            <div className={styles.cardInfo}>
                <div className={styles.instructorSection}>
                    <div className={`${styles.instructorAvatar} ${styles.skeleton} ${styles.skeletonAvatar}`} />
                    <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '100px' }} />
                </div>

                <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
                <div className={`${styles.skeleton} ${styles.skeletonText}`} />
                <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '60%' }} />
            </div>

            <div className={styles.cardFooter}>
                <div className={styles.priceContainer}>
                    <div className={`${styles.skeleton} ${styles.skeletonPrice}`} />
                </div>
                <div className={`${styles.skeleton} ${styles.skeletonBtn}`} />
            </div>
        </motion.div>
    );
}
