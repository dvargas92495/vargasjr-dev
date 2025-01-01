import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin-token")?.value;

  if (token !== process.env.ADMIN_TOKEN) {
    redirect("/login?error=Unauthorized");
  }

  return (
    <div>
      <h1>Admin Dashboard</h1>
    </div>
  );
}
