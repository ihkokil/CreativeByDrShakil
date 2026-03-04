export interface Instructor {
    id: string;
    name: string;
    role: string;
    image: string;
    aliases?: string[];
}

export interface Module {
    title: string;
    lessons: { title: string; duration: string }[];
}

export interface Course {
    id: number | string;
    slug: string;
    title: string;
    category: string;
    price: string;
    originalPrice?: string;
    rating: number;
    duration: string;
    mainInstructor: Instructor;
    subInstructors?: Instructor[];
    description?: string;
    learningObjectives?: string[];
    requirements?: string[];
    curriculum?: Module[];
    enrolledCount?: number;
    level?: string;
    language?: string;
    lastUpdated?: string;
    image?: string;
    dynamicSource?: boolean;
    lessonCount?: number;
}

export const INSTRUCTORS: Record<string, Instructor> = {
    dr_shakil: {
        id: "dr_shakil",
        name: "Dr. Shakil Ahmed",
        role: "Senior Surgical Consultant",
        image: "/placeholder.svg",
        aliases: ["Dr. Nahid Akhter Shakil", "Nahid Akhter Shakil"],
    },
    dr_rahman: {
        id: "dr_rahman",
        name: "Dr. Rahman",
        role: "Internal Medicine Expert",
        image: "/placeholder.svg",
    },
    dr_fatima: {
        id: "dr_fatima",
        name: "Dr. Fatima",
        role: "Pediatrics Specialist",
        image: "/placeholder.svg",
    },
    dr_arif: {
        id: "dr_arif",
        name: "Dr. Arif Billah",
        role: "Gynae & Obs Specialist",
        image: "/placeholder.svg",
    }
};

export const COURSES: Course[] = [
    {
        id: 1,
        slug: "fcps-part-i-internal-medicine",
        title: "FCPS Part I: Internal Medicine",
        category: "FCPS",
        price: "৳5,000",
        originalPrice: "৳8,000",
        rating: 4.8,
        duration: "6 Months",
        mainInstructor: INSTRUCTORS.dr_rahman,
        enrolledCount: 1240,
        level: "Intermediate",
        language: "English / Bengali",
        lastUpdated: "October 2026",
        description: "This comprehensive FCPS Part I Internal Medicine course is designed to guide aspiring physicians through the rigorous exam preparation process. It covers all the core modules required by the BCPS, focusing on high-yield topics, clinical scenarios, and recent updates in medicine. Our structured curriculum, combined with expert-led sessions and extensive question banks, ensures that you build a solid foundation and develop the analytical skills necessary to ace the exam.",
        learningObjectives: [
            "Master the core concepts of basic medical sciences as applied to Internal Medicine.",
            "Develop critical thinking skills to solve complex clinical case scenarios.",
            "Understand the latest guidelines and protocols in disease management.",
            "Practice with thousands of high-yield MCQs and SBAs.",
            "Identify and effectively navigate common exam pitfalls."
        ],
        requirements: [
            "MBBS degree or equivalent recognized qualification.",
            "Basic understanding of clinical medicine.",
            "Commitment of at least 15-20 hours of study per week."
        ],
        curriculum: [
            {
                title: "Module 1: Basic Physiology & Anatomy",
                lessons: [
                    { title: "Cardiovascular Physiology Basics", duration: "1h 20m" },
                    { title: "Respiratory Mechanics", duration: "1h 15m" },
                    { title: "Renal Function & Electrolytes", duration: "2h 00m" }
                ]
            },
            {
                title: "Module 2: Essential Pathology",
                lessons: [
                    { title: "Cell Injury and Adaptation", duration: "1h 45m" },
                    { title: "Inflammation and Repair", duration: "1h 30m" },
                    { title: "Neoplasia Fundamentals", duration: "2h 10m" }
                ]
            },
            {
                title: "Module 3: High-Yield Medicine Scenarios",
                lessons: [
                    { title: "Approach to Chest Pain", duration: "55m" },
                    { title: "Management of Acute Kidney Injury", duration: "1h 10m" },
                    { title: "Endocrine Emergencies", duration: "1h 25m" }
                ]
            }
        ]
    },
    {
        id: 2,
        slug: "surgery-high-yield-mcqs",
        title: "Surgery High Yield MCQs",
        category: "Exams",
        price: "৳4,500",
        rating: 4.9,
        duration: "3 Months",
        mainInstructor: INSTRUCTORS.dr_shakil,
        subInstructors: [INSTRUCTORS.dr_rahman]
    },
    {
        id: 3,
        slug: "pediatrics-residency-masterclass",
        title: "Pediatrics Residency Masterclass",
        category: "Residency",
        price: "৳6,000",
        originalPrice: "৳10,000",
        rating: 4.7,
        duration: "6 Months",
        mainInstructor: INSTRUCTORS.dr_fatima,
    },
    {
        id: 4,
        slug: "gynae-obs-part-ii-theory",
        title: "Gynae & Obs Part II Theory",
        category: "Part II",
        price: "Free",
        rating: 4.9,
        duration: "4 Months",
        mainInstructor: INSTRUCTORS.dr_arif,
    },
    {
        id: 5,
        slug: "radiology-image-based-quiz",
        title: "Radiology Image-based Quiz",
        category: "Exams",
        price: "৳2,500",
        originalPrice: "৳4,000",
        rating: 5.0,
        duration: "2 Months",
        mainInstructor: INSTRUCTORS.dr_rahman,
    },
    {
        id: 6,
        slug: "foundation-series-anatomy",
        title: "Foundation Series: Anatomy",
        category: "FCPS",
        price: "Free",
        rating: 4.6,
        duration: "3 Months",
        mainInstructor: INSTRUCTORS.dr_shakil,
        subInstructors: [INSTRUCTORS.dr_fatima]
    },
    {
        id: 7,
        slug: "fcps-surgery-viva-secrets",
        title: "FCPS Surgery: Viva Secrets",
        category: "Part II",
        price: "৳3,500",
        rating: 4.9,
        duration: "2 Months",
        mainInstructor: INSTRUCTORS.dr_shakil,
    },
    {
        id: 8,
        slug: "emergency-medicine-fast-track",
        title: "Emergency Medicine Fast-track",
        category: "Residency",
        price: "৳4,000",
        rating: 4.7,
        duration: "3 Months",
        mainInstructor: INSTRUCTORS.dr_rahman,
    },
];
