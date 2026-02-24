"use client";

import { useState } from "react";
import styles from "./FAQ.module.css";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";

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
        <section className="section-padding">
            <div className={styles.container}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Frequently Asked Questions</h2>
                    <p className={styles.subtitle}>Everything you need to know about the platform and preparation.</p>
                </div>

                <div className={styles.list}>
                    {faqs.map((faq, index) => (
                        <div key={index} className={`${styles.item} glass`}>
                            <button
                                className={styles.question}
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                            >
                                <span>{faq.question}</span>
                                {openIndex === index ? <Minus size={20} /> : <Plus size={20} />}
                            </button>
                            <AnimatePresence>
                                {openIndex === index && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className={styles.answer}
                                    >
                                        <p>{faq.answer}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
