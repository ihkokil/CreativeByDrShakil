import { CurriculumNode } from "@/components/Course/CourseCurriculum";

export const mockBasicMedicineData: CurriculumNode[] = [
    {
        id: "basic-medicine",
        title: "Basic Medicine",
        type: "folder",
        children: [
            {
                id: "anatomy",
                title: "Anatomy",
                type: "folder",
                children: [
                    {
                        id: "embryology",
                        title: "Embryology",
                        type: "folder",
                        children: [
                            { id: "emb-1", title: "General Embryology", type: "youtubeUrl", duration: "45:00", url: "https://youtube.com/watch?v=mock1" } as any,
                            { id: "emb-2", title: "First, Second, Third Week of Development", type: "youtube", duration: "1:20:00" },
                            { id: "emb-3", title: "Placenta", type: "youtube", duration: "35:00" },
                            { id: "emb-4", title: "General Embryology Questions & Discussions", type: "youtube", duration: "55:00" },
                            { id: "emb-5", title: "Systemic Embryology", type: "youtube", duration: "1:05:00" },
                        ]
                    },
                    {
                        id: "abdomen",
                        title: "Abdomen",
                        type: "folder",
                        children: [
                            { id: "abd-1", title: "Abdomen Class 1", type: "self-hosted", duration: "40:00" },
                            { id: "abd-2", title: "Abdomen Class 2", type: "self-hosted", duration: "42:00" },
                            { id: "abd-3", title: "Abdomen Class 3", type: "self-hosted", duration: "38:00" },
                            { id: "abd-4", title: "Abdomen Class 4", type: "self-hosted", duration: "45:00" },
                            { id: "abd-5", title: "Abdomen Class 5 – Pelvic Anatomy", type: "self-hosted", duration: "50:00" },
                        ]
                    },
                    { id: "abd-q", title: "Abdomen Questions & Discussions", type: "youtube", duration: "1:15:00" }
                ]
            },
            {
                id: "thorax",
                title: "Thorax",
                type: "folder",
                children: [
                    { id: "thr-1", title: "Thorax Class 1", type: "youtube", duration: "45:00" },
                    { id: "thr-2", title: "Thorax Class 2", type: "youtube", duration: "48:00" }
                ]
            },
            { id: "sup-ext", title: "Superior Extremity Questions & Discussions", type: "youtube", duration: "55:00" },
            {
                id: "inf-ext",
                title: "Inferior Extremity",
                type: "folder",
                children: [
                    { id: "inf-1", title: "Inferior Extremity Class 1", type: "youtube", duration: "40:00" },
                    { id: "inf-2", title: "Inferior Extremity Class 2", type: "youtube", duration: "42:00" }
                ]
            },
            {
                id: "histology",
                title: "Histology",
                type: "folder",
                children: [
                    { id: "his-1", title: "Histology Class 1", type: "youtube", duration: "35:00" },
                    { id: "his-2", title: "Histology Class 2", type: "youtube", duration: "38:00" }
                ]
            }
        ]
    }
];
