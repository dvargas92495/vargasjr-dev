import { ContactsTable, ChatSessionsTable } from "@/db/schema";
import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

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

  const chatSessions = await db
    .select({
      id: ChatSessionsTable.id,
      createdAt: ChatSessionsTable.createdAt,
    })
    .from(ChatSessionsTable)
    .where(eq(ChatSessionsTable.contactId, id))
    .orderBy(ChatSessionsTable.createdAt);

  const isClient = chatSessions.length > 0;
  const clientSince = isClient ? chatSessions[0].createdAt : null;
  const clientDurationText = clientSince 
    ? dayjs(clientSince).fromNow()
    : null;

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
          <div>
            <label className="block text-sm font-medium text-gray-700">Client Status</label>
            <p className="mt-1 text-sm text-gray-900">
              {isClient ? (
                <span className="text-green-600 font-semibold">✓ Active Client</span>
              ) : (
                <span className="text-gray-500">Not a Client</span>
              )}
            </p>
          </div>
          {isClient && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Client Since</label>
              <p className="mt-1 text-sm text-gray-900">
                {clientSince?.toLocaleDateString()} ({clientDurationText})
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
