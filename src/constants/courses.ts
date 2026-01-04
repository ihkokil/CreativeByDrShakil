export interface Instructor {
    id: string;
    name: string;
    role: string;
    image: string;
}

export interface Course {
    id: number;
    title: string;
    category: string;
    price: string;
    rating: number;
    duration: string;
    mainInstructor: Instructor;
    subInstructors?: Instructor[];
}

export const INSTRUCTORS: Record<string, Instructor> = {
    dr_shakil: {
        id: "dr_shakil",
        name: "Dr. Shakil Ahmed",
        role: "Senior Surgical Consultant",
        image: "/placeholder.svg",
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
        title: "FCPS Part I: Internal Medicine",
        category: "FCPS",
        price: "৳5,000",
        rating: 4.8,
        duration: "6 Months",
        mainInstructor: INSTRUCTORS.dr_rahman,
    },
    {
        id: 2,
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
        title: "Pediatrics Residency Masterclass",
        category: "Residency",
        price: "৳6,000",
        rating: 4.7,
        duration: "6 Months",
        mainInstructor: INSTRUCTORS.dr_fatima,
    },
    {
        id: 4,
        title: "Gynae & Obs Part II Theory",
        category: "Part II",
        price: "Free",
        rating: 4.9,
        duration: "4 Months",
        mainInstructor: INSTRUCTORS.dr_arif,
    },
    {
        id: 5,
        title: "Radiology Image-based Quiz",
        category: "Exams",
        price: "৳2,500",
        rating: 5.0,
        duration: "2 Months",
        mainInstructor: INSTRUCTORS.dr_rahman,
    },
    {
        id: 6,
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
        title: "FCPS Surgery: Viva Secrets",
        category: "Part II",
        price: "৳3,500",
        rating: 4.9,
        duration: "2 Months",
        mainInstructor: INSTRUCTORS.dr_shakil,
    },
    {
        id: 8,
        title: "Emergency Medicine Fast-track",
        category: "Residency",
        price: "৳4,000",
        rating: 4.7,
        duration: "3 Months",
        mainInstructor: INSTRUCTORS.dr_rahman,
    },
];
