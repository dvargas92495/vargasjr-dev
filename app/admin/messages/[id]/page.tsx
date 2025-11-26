import {
  OutboxMessagesTable,
  OutboxMessageRecipientsTable,
  InboxMessagesTable,
  InboxMessageOperationsTable,
  ContactsTable,
  InboxesTable,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { getDb } from "@/db/connection";
import LocalTime from "@/components/local-time";
import DeleteMessageButton from "@/components/delete-message-button";
import MarkAsUnreadButton from "@/components/mark-as-unread-button";
import MarkAsArchivedButton from "@/components/mark-as-archived-button";

interface EmailMetadata {
  subject?: string;
  messageId?: string;
}

function formatChannelType(type: string): string {
  const typeMap: Record<string, string> = {
    EMAIL: "Email",
    SMS: "SMS",
    SLACK: "Slack",
    CHAT_SESSION: "Chat",
    FORM: "Form",
    NONE: "None",
  };
  return typeMap[type] || type;
}

export default async function MessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const db = getDb();

  const outboxMessages = await db
    .select({
      id: OutboxMessagesTable.id,
      body: OutboxMessagesTable.body,
      createdAt: OutboxMessagesTable.createdAt,
      type: OutboxMessagesTable.type,
      threadId: OutboxMessagesTable.threadId,
      parentInboxMessageId: OutboxMessagesTable.parentInboxMessageId,
    })
    .from(OutboxMessagesTable)
    .where(eq(OutboxMessagesTable.id, id))
    .limit(1);

  const outboxMessage = outboxMessages[0];

  if (outboxMessage) {
    const parentMessages = await db
      .select({
        id: InboxMessagesTable.id,
        inboxId: InboxMessagesTable.inboxId,
        body: InboxMessagesTable.body,
        createdAt: InboxMessagesTable.createdAt,
        contactId: InboxMessagesTable.contactId,
        displayName: ContactsTable.slackDisplayName,
        fullName: ContactsTable.fullName,
        email: ContactsTable.email,
      })
      .from(InboxMessagesTable)
      .leftJoin(
        ContactsTable,
        eq(InboxMessagesTable.contactId, ContactsTable.id)
      )
      .where(eq(InboxMessagesTable.id, outboxMessage.parentInboxMessageId))
      .limit(1);

    const parentMessage = parentMessages[0];

    const recipients = await db
      .select({
        id: ContactsTable.id,
        displayName: ContactsTable.slackDisplayName,
        fullName: ContactsTable.fullName,
        email: ContactsTable.email,
        phoneNumber: ContactsTable.phoneNumber,
        type: OutboxMessageRecipientsTable.type,
      })
      .from(OutboxMessageRecipientsTable)
      .innerJoin(
        ContactsTable,
        eq(OutboxMessageRecipientsTable.contactId, ContactsTable.id)
      )
      .where(eq(OutboxMessageRecipientsTable.messageId, id));

    const toContacts = recipients.filter((r) => r.type === "TO");
    const bccContacts = recipients.filter((r) => r.type === "BCC");

    return (
      <div className="flex flex-col p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            {parentMessage && (
              <Link href={`/admin/messages/${parentMessage.id}`}>
                <button className="flex items-center gap-2 text-gray-300 hover:text-white">
                  <ArrowLeftIcon className="w-5 h-5" />
                </button>
              </Link>
            )}
            <div className="flex items-center gap-3">
              <PaperAirplaneIcon className="w-6 h-6 text-blue-400" />
              <h1 className="text-2xl font-bold">Outgoing Message</h1>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 shadow rounded-lg p-6 text-white">
          <div className="mb-4">
            <div className="text-sm text-gray-300">Channel</div>
            <div className="mt-1">
              <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-blue-600 text-white">
                {formatChannelType(outboxMessage.type)}
              </span>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-sm text-gray-300">Sent At</div>
            <div className="text-lg">
              <LocalTime value={outboxMessage.createdAt} />
            </div>
          </div>

          {toContacts.length > 0 && (
            <div className="mb-4">
              <div className="text-sm text-gray-300">Sent To</div>
              <div className="text-lg">
                {toContacts.map((contact, index) => (
                  <span key={contact.id}>
                    {index > 0 && ", "}
                    <Link
                      href={`/admin/crm/${contact.id}`}
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      {contact.displayName ||
                        contact.fullName ||
                        contact.email ||
                        contact.phoneNumber ||
                        "Unknown"}
                    </Link>
                  </span>
                ))}
              </div>
            </div>
          )}

          {bccContacts.length > 0 && (
            <div className="mb-4">
              <div className="text-sm text-gray-300">BCC</div>
              <div className="text-lg">
                {bccContacts.map((contact, index) => (
                  <span key={contact.id}>
                    {index > 0 && ", "}
                    <Link
                      href={`/admin/crm/${contact.id}`}
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      {contact.displayName ||
                        contact.fullName ||
                        contact.email ||
                        contact.phoneNumber ||
                        "Unknown"}
                    </Link>
                  </span>
                ))}
              </div>
            </div>
          )}

          {outboxMessage.threadId && (
            <div className="mb-4">
              <div className="text-sm text-gray-300">Thread ID</div>
              <div className="text-lg font-mono text-gray-400">
                {outboxMessage.threadId}
              </div>
            </div>
          )}

          {parentMessage && (
            <div className="mb-4">
              <div className="text-sm text-gray-300">In Response To</div>
              <div className="text-lg">
                <Link
                  href={`/admin/messages/${parentMessage.id}`}
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Message from{" "}
                  {parentMessage.displayName ||
                    parentMessage.fullName ||
                    parentMessage.email ||
                    "Unknown"}
                </Link>
              </div>
            </div>
          )}

          <div>
            <div className="text-sm text-gray-300 mb-2">Message Body</div>
            <div className="p-4 bg-gray-700 rounded whitespace-pre-wrap overflow-x-auto w-full">
              {outboxMessage.body}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const inboxMessages = await db
    .selectDistinctOn([InboxMessagesTable.id, InboxMessagesTable.createdAt], {
      id: InboxMessagesTable.id,
      inboxId: InboxMessagesTable.inboxId,
      displayName: ContactsTable.slackDisplayName,
      fullName: ContactsTable.fullName,
      email: ContactsTable.email,
      contactId: ContactsTable.id,
      createdAt: InboxMessagesTable.createdAt,
      body: InboxMessagesTable.body,
      externalId: InboxMessagesTable.externalId,
      metadata: InboxMessagesTable.metadata,
      inboxName: InboxesTable.name,
      inboxDisplayLabel: InboxesTable.displayLabel,
    })
    .from(InboxMessagesTable)
    .leftJoin(ContactsTable, eq(InboxMessagesTable.contactId, ContactsTable.id))
    .leftJoin(InboxesTable, eq(InboxMessagesTable.inboxId, InboxesTable.id))
    .where(eq(InboxMessagesTable.id, id))
    .limit(1);

  const inboxMessage = inboxMessages[0] as (typeof inboxMessages)[0] & {
    metadata: EmailMetadata | null;
  };

  if (!inboxMessage) {
    notFound();
  }

  const messageOperations = await db
    .select()
    .from(InboxMessageOperationsTable)
    .where(eq(InboxMessageOperationsTable.inboxMessageId, inboxMessage.id))
    .orderBy(desc(InboxMessageOperationsTable.createdAt));

  const statuses = Object.fromEntries(
    messageOperations.length > 0
      ? [[messageOperations[0].inboxMessageId, messageOperations[0].operation]]
      : []
  );

  const messageResponses = await db
    .select({
      id: OutboxMessagesTable.id,
      body: OutboxMessagesTable.body,
      createdAt: OutboxMessagesTable.createdAt,
      type: OutboxMessagesTable.type,
      threadId: OutboxMessagesTable.threadId,
      parentInboxMessageId: OutboxMessagesTable.parentInboxMessageId,
    })
    .from(OutboxMessagesTable)
    .where(eq(OutboxMessagesTable.parentInboxMessageId, inboxMessage.id));

  return (
    <div className="flex flex-col p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Message</h1>
        </div>
        <div className="flex items-center gap-2">
          {statuses[inboxMessage.id] === "READ" && (
            <MarkAsUnreadButton
              messageId={inboxMessage.id}
              inboxId={inboxMessage.inboxId}
            />
          )}
          {statuses[inboxMessage.id] !== "ARCHIVED" && (
            <MarkAsArchivedButton
              messageId={inboxMessage.id}
              inboxId={inboxMessage.inboxId}
            />
          )}
          <DeleteMessageButton
            messageId={inboxMessage.id}
            inboxId={inboxMessage.inboxId}
          />
        </div>
      </div>

      <div className="bg-gray-800 shadow rounded-lg p-6 text-white">
        <div className="mb-4">
          <div className="text-sm text-gray-300">Inbox</div>
          <div className="text-lg">
            <Link
              href={`/admin/inboxes/${inboxMessage.inboxId}`}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {inboxMessage.inboxDisplayLabel ||
                inboxMessage.inboxName ||
                "Unknown Inbox"}
            </Link>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm text-gray-300">Source</div>
          <div className="text-lg">
            {inboxMessage.contactId ? (
              <Link
                href={`/admin/crm/${inboxMessage.contactId}`}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                {inboxMessage.displayName ||
                  inboxMessage.fullName ||
                  inboxMessage.email ||
                  "Unknown"}
              </Link>
            ) : (
              inboxMessage.displayName ||
              inboxMessage.fullName ||
              inboxMessage.email ||
              "Unknown"
            )}
          </div>
        </div>

        {inboxMessage.metadata?.subject && (
          <div className="mb-4">
            <div className="text-sm text-gray-300">Subject</div>
            <div className="text-lg">{inboxMessage.metadata.subject}</div>
          </div>
        )}

        <div className="mb-4">
          <div className="text-sm text-gray-300">Created At</div>
          <div className="text-lg">
            <LocalTime value={inboxMessage.createdAt} />
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm text-gray-300">Status</div>
          <div className="text-lg">{statuses[inboxMessage.id] || "UNREAD"}</div>
        </div>

        {inboxMessage.externalId && (
          <div className="mb-4">
            <div className="text-sm text-gray-300">External ID</div>
            <div className="text-lg">{inboxMessage.externalId}</div>
          </div>
        )}

        <div>
          <div className="text-sm text-gray-300">Message Body</div>
          <div className="mt-2 p-4 bg-gray-700 rounded whitespace-pre-wrap overflow-x-auto w-full">
            {inboxMessage.body}
          </div>
        </div>
      </div>
      {messageResponses.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Responses</h2>

          <div className="space-y-4">
            {messageResponses.map((response) => (
              <Link
                key={response.id}
                href={`/admin/messages/${response.id}`}
                className="block hover:opacity-90 transition-opacity"
              >
                <div className="bg-gray-800 rounded-lg shadow cursor-pointer hover:bg-gray-750 transition-colors">
                  <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center gap-2">
                        <PaperAirplaneIcon className="w-5 h-5 text-blue-400" />
                        <span className="text-xs font-semibold text-blue-400 uppercase">
                          Outgoing
                        </span>
                      </div>
                      <span className="text-gray-300 text-sm">
                        <LocalTime value={response.createdAt} />
                      </span>
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-700 text-gray-200">
                        {formatChannelType(response.type)}
                      </span>
                    </div>
                  </div>
                  <div className="px-6 py-4 border-t border-gray-700">
                    <div className="text-sm text-gray-300 mb-2">
                      Response Preview
                    </div>
                    <div className="p-4 bg-gray-700 rounded whitespace-pre-wrap text-white overflow-hidden text-ellipsis">
                      {response.body.length > 200
                        ? `${response.body.substring(0, 200)}...`
                        : response.body}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
      {messageOperations.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4 text-white">
            Recent Operations
          </h2>

          <div className="bg-gray-800 shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Created Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Workflow Execution
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {messageOperations.map((operation) => (
                    <tr key={operation.id} className="hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-600 text-gray-200">
                          {operation.operation}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <LocalTime value={operation.createdAt} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {operation.executionId ? (
                          <a
                            href={`https://app.vellum.ai/workflows/executions/${operation.executionId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline"
                          >
                            {operation.executionId}
                          </a>
                        ) : (
                          <span className="text-gray-500">No execution</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
