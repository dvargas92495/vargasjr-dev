import { ContactsTable } from "@/db/schema";
import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

const db = drizzle(sql);

export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await db
    .select()
    .from(ContactsTable)
    .where(eq(ContactsTable.id, id))
    .limit(1);

  if (!contact.length) {
    notFound();
  }

  const contactData = contact[0];

  return (
    <div className="flex flex-col p-4">
      <h1 className="text-2xl font-bold mb-4">
        {contactData.fullName || 'Contact Details'}
      </h1>
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <p className="mt-1 text-sm text-gray-900">{contactData.fullName || 'N/A'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <p className="mt-1 text-sm text-gray-900">{contactData.email || 'N/A'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone Number</label>
            <p className="mt-1 text-sm text-gray-900">{contactData.phoneNumber || 'N/A'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Created At</label>
            <p className="mt-1 text-sm text-gray-900">{contactData.createdAt.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
