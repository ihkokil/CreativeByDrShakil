"use client";
import CreateCourseStep2 from "@/components/Teacher/CreateCourseStep2";
import { useParams } from "next/navigation";

export default function ContentCoursePage() {
  const params = useParams();
  const id = params?.id as string;
  return <CreateCourseStep2 courseId={id} />;
}
