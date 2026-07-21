"use client";
import CreateCourseStep4 from "@/components/Teacher/CreateCourseStep4";
import { useParams } from "next/navigation";

export default function ReviewCoursePage() {
  const params = useParams();
  const id = params?.id as string;
  return <CreateCourseStep4 courseId={id} />;
}
