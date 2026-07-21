"use client";
import CreateCourseStep3 from "@/components/Teacher/CreateCourseStep3";
import { useParams } from "next/navigation";

export default function OutlineCoursePage() {
  const params = useParams();
  const id = params?.id as string;
  return <CreateCourseStep3 courseId={id} />;
}
