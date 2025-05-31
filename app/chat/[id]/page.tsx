import { ChatSessionsTable, InboxesTable } from "@/db/schema";
import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

const db = drizzle(sql);

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  const chatSession = await db
    .select({
      id: ChatSessionsTable.id,
      createdAt: ChatSessionsTable.createdAt,
      inboxName: InboxesTable.name,
    })
    .from(ChatSessionsTable)
    .innerJoin(InboxesTable, eq(ChatSessionsTable.inboxId, InboxesTable.id))
    .where(eq(ChatSessionsTable.id, id))
    .limit(1);

  if (!chatSession.length) {
    notFound();
  }

  const session = chatSession[0];

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
        <div className="text-center text-gray-300">
          Chat functionality will be implemented here.
        </div>
      </div>
    </div>
  );
}
