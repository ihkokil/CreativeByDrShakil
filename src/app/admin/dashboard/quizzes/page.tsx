"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Loader from "@/components/UI/Loader";

export default function AdminQuizzesRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.push("/teacher/dashboard/quizzes");
    }, [router]);

    return <Loader text="Redirecting to Quiz Management..." />;
}
