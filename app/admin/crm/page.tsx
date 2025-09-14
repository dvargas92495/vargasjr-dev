import { ContactsTable, InboxMessagesTable } from "@/db/schema";
import { desc, max, eq } from "drizzle-orm";
import ContactRow from "@/components/contact-row";
import { getDb } from "@/db/connection";

export default async function CRMPage() {
  const db = getDb();
  const allContacts = await db
    .select({
      id: ContactsTable.id,
      email: ContactsTable.email,
      phoneNumber: ContactsTable.phoneNumber,
      fullName: ContactsTable.fullName,
      slackId: ContactsTable.slackId,
      slackDisplayName: ContactsTable.slackDisplayName,
      createdAt: ContactsTable.createdAt,
      lastMessageAt: max(InboxMessagesTable.createdAt),
    })
    .from(ContactsTable)
    .leftJoin(
      InboxMessagesTable,
      eq(ContactsTable.id, InboxMessagesTable.contactId)
    )
    .groupBy(ContactsTable.id)
    .orderBy(desc(max(InboxMessagesTable.createdAt)));

  return (
    <>
      <div className="flex-1">
        <table className="min-w-full border border-gray-300">
          <thead>
            <tr className="bg-gray-500 text-white">
              <th className="px-6 py-3 border-b text-left">Name</th>
              <th className="px-6 py-3 border-b text-left">Email</th>
              <th className="px-6 py-3 border-b text-left">Phone</th>
              <th className="px-6 py-3 border-b text-left">Last Message&apos;d Date</th>
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
