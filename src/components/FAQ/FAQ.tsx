"use client";

import { useState } from "react";
import styles from "./FAQ.module.css";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";

const faqs = [
    {
        question: "When are the exams held?",
        answer: "Typically, BCPS Part I exams are held in January and July each year. Check the official BCPS website for precise deadlines."
    },
    {
        question: "Is there a free trial?",
        answer: "Yes! You can access our Foundation Series and Sample MCQ Banks for free by creating a student account."
    },
    {
        question: "Can I access the courses from my phone?",
        answer: "Absolutely. Our platform is fully responsive and we have native apps for iOS and Android in the pipeline."
    }
];

export default function FAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <section className="section-padding alt-bg">
            <div className={styles.container}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Frequently Asked <span className="gradient-text">Questions</span></h2>
                    <p className={styles.subtitle}>Common queries about our exam preparation system and platform features.</p>
                </div>

                <div className={styles.list}>
                    {faqs.map((faq, index) => {
                        const isOpen = openIndex === index;
                        return (
                            <div key={index} className={`${styles.item} ${isOpen ? styles.activeItem : ""}`}>
                                <button
                                    className={styles.question}
                                    onClick={() => setOpenIndex(isOpen ? null : index)}
                                    aria-expanded={isOpen}
                                >
                                    <span className={styles.questionText}>{faq.question}</span>
                                    <motion.div
                                        animate={{ rotate: isOpen ? 45 : 0, color: isOpen ? "var(--primary)" : "currentColor" }}
                                        transition={{ duration: 0.3, ease: "circOut" }}
                                        className={styles.iconWrapper}
                                    >
                                        <Plus size={24} />
                                    </motion.div>
                                </button>
                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div
                                            key="content"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
                                            className={styles.answerWrapper}
                                        >
                                            <div className={styles.answer}>
                                                <p>{faq.answer}</p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
