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
    language?: string;
    lastUpdated?: string;
    image?: string;
    dynamicSource?: boolean;
    lessonCount?: number;
}


