import { ChatSessionsTable, InboxesTable, ContactsTable, InboxMessagesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/connection";

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  const db = getDb();
  const chatSession = await db
    .select({
      id: ChatSessionsTable.id,
      createdAt: ChatSessionsTable.createdAt,
      inboxName: InboxesTable.name,
      contactEmail: ContactsTable.email,
      contactName: ContactsTable.fullName,
      inboxId: InboxesTable.id,
    })
    .from(ChatSessionsTable)
    .innerJoin(InboxesTable, eq(ChatSessionsTable.inboxId, InboxesTable.id))
    .innerJoin(ContactsTable, eq(ChatSessionsTable.contactId, ContactsTable.id))
    .where(eq(ChatSessionsTable.id, id))
    .limit(1);

  if (!chatSession.length) {
    notFound();
  }

  const session = chatSession[0];

  const messages = await db
    .select({
      id: InboxMessagesTable.id,
      body: InboxMessagesTable.body,
      source: InboxMessagesTable.source,
      createdAt: InboxMessagesTable.createdAt,
    })
    .from(InboxMessagesTable)
    .where(eq(InboxMessagesTable.inboxId, session.inboxId))
    .orderBy(InboxMessagesTable.createdAt);

  return (
    <div className="flex flex-col p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Chat Session</h1>
      <div className="bg-gray-800 shadow rounded-lg p-6 text-white">
        <div className="mb-4">
          <div className="text-sm text-gray-300">Session ID</div>
          <div className="text-lg">{session.id}</div>
        </div>
        <div className="mb-4">
          <div className="text-sm text-gray-300">Created At</div>
          <div className="text-lg">{session.createdAt.toLocaleString()}</div>
        </div>
        <div className="mb-4">
          <div className="text-sm text-gray-300">Contact</div>
          <div className="text-lg">{session.contactName || session.contactEmail}</div>
        </div>
        
        <div className="mt-6">
          <div className="text-sm text-gray-300 mb-3">Messages</div>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {messages.map((message) => (
              <div key={message.id} className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-blue-300">{message.source}</span>
                  <span className="text-xs text-gray-400">
                    {message.createdAt.toLocaleString()}
                  </span>
                </div>
                <div className="text-gray-100 whitespace-pre-wrap">{message.body}</div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-4 bg-gray-700 rounded-lg">
            <div className="text-gray-300 text-center">
              Chat functionality will be implemented here.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
