"use client";
import CreateCourseStep1 from "@/components/Teacher/CreateCourseStep1";
import { useParams } from "next/navigation";

export default function EditCoursePage() {
  const params = useParams();
  const id = params?.id as string;
  return <CreateCourseStep1 courseId={id} />;
}
