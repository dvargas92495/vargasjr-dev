import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";



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

  return (
    <div className="flex min-h-screen max-h-screen">
      {/* Side Panel */}
      <div className="w-64 bg-gray-500 p-4">
        <nav>
          <ul className="space-y-2">
            <li>
              <Link
                href="/admin"
                className="block p-2 hover:bg-gray-200 hover:text-black rounded"
              >
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/admin/inboxes"
                className="block p-2 hover:bg-gray-200 hover:text-black rounded"
              >
                Inboxes
              </Link>
            </li>
            <li>
              <Link
                href="/admin/applications"
                className="block p-2 hover:bg-gray-200 hover:text-black rounded"
              >
                Applications
              </Link>
            </li>
            <li>
              <Link
                href="/admin/crm"
                className="block p-2 hover:bg-gray-200 hover:text-black rounded"
              >
                CRM
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 flex flex-col">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
        <div className="overflow-x-auto flex flex-col flex-1">{children}</div>
      </div>
    </div>
  );
}
