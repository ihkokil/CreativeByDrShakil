import { redirect } from "next/navigation";

export default function StudentUserRedirectPage() {
    redirect("/dashboard/profile");
}
