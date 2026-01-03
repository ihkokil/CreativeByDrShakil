"use client";

import { useState } from "react";
import styles from "./MCQ.module.css";
import { Check, X, HelpCircle, ArrowRight, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const mockQuestion = {
    id: 1,
    question: "A 45-year-old male presents with sudden onset of severe epigastric pain radiating to the back. Serum amylase is 3 times the upper limit of normal. What is the most common cause of this condition worldwide?",
    options: [
        "Alcohol consumption",
        "Gallstones",
        "Hypertriglyceridemia",
        "Trauma",
        "Drug-induced pancreatitis"
    ],
    correct: 1, // Gallstones
    explanation: "Gallstones are the most common cause of acute pancreatitis worldwide (approx 40-50%), followed by alcohol. Serum amylase > 3x normal is highly suggestive."
};

export default function MCQSection() {
    const [selected, setSelected] = useState<number | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);

    const handleSelect = (idx: number) => {
        if (selected !== null) return;
        setSelected(idx);
        setShowExplanation(true);
    };

    const reset = () => {
        setSelected(null);
        setShowExplanation(false);
    };

    return (
        <div className={styles.mcqContainer}>
            <div className={styles.qHeader}>
                <div className={styles.qBadge}><HelpCircle size={14} /> Practice Question</div>
                <div className={styles.qNumber}>Q1 / 50</div>
            </div>

            <h3 className={styles.questionText}>{mockQuestion.question}</h3>

            <div className={styles.optionsList}>
                {mockQuestion.options.map((option, idx) => {
                    const isCorrect = idx === mockQuestion.correct;
                    const isSelected = selected === idx;
                    const statusClass = selected !== null
                        ? (isCorrect ? styles.correct : isSelected ? styles.wrong : styles.disabled)
                        : "";

                    return (
                        <button
                            key={idx}
                            className={`${styles.optionBtn} ${statusClass}`}
                            onClick={() => handleSelect(idx)}
                            disabled={selected !== null}
                        >
                            <div className={styles.optionLetter}>
                                {String.fromCharCode(65 + idx)}
                            </div>
                            <div className={styles.optionContent}>{option}</div>
                            {selected !== null && isCorrect && <Check size={18} className={styles.checkIcon} />}
                            {selected !== null && isSelected && !isCorrect && <X size={18} className={styles.xIcon} />}
                        </button>
                    );
                })}
            </div>

            <AnimatePresence>
                {showExplanation && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={styles.explanationBox}
                    >
                        <div className={styles.expHeader}>
                            <span className={selected === mockQuestion.correct ? styles.correctText : styles.wrongText}>
                                {selected === mockQuestion.correct ? "Excellent! Correct Answer." : "Incorrect. Let's learn why."}
                            </span>
                        </div>
                        <p className={styles.expText}>{mockQuestion.explanation}</p>
                        <div className={styles.expActions}>
                            <button className={styles.resetBtn} onClick={reset}>
                                <RotateCcw size={16} /> Try Again
                            </button>
                            <button className={styles.nextBtn}>
                                Next Question <ArrowRight size={16} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
