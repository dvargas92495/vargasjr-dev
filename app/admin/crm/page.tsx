import { ContactsTable } from "@/db/schema";
import { desc } from "drizzle-orm";
import ContactRow from "@/components/contact-row";
import { getDb } from "@/db/connection";

const db = getDb();

export default async function CRMPage() {
  const allContacts = await db
    .select()
    .from(ContactsTable)
    .orderBy(desc(ContactsTable.createdAt));

  return (
    <>
      <div className="flex-1">
        <table className="min-w-full border border-gray-300">
          <thead>
            <tr className="bg-gray-500">
              <th className="px-6 py-3 border-b text-left">Name</th>
              <th className="px-6 py-3 border-b text-left">Email</th>
              <th className="px-6 py-3 border-b text-left">Phone</th>
              <th className="px-6 py-3 border-b text-left">Created At</th>
            </tr>
          </thead>
          <tbody>
            {allContacts.map((contact) => (
              <ContactRow key={contact.id} contact={contact} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
