import { redirect } from "next/navigation";

export default function StudentOrdersRedirectPage() {
  redirect("/dashboard/purchases");
}
