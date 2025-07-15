import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminLayoutClient from "./AdminLayoutClient";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin-token")?.value;

  if (token !== process.env.ADMIN_TOKEN) {
    redirect("/login?error=Unauthorized");
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
