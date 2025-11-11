import {
  ContactsTable,
  InboxMessagesTable,
  InboxMessageOperationsTable,
  InboxesTable,
  OutboxMessagesTable,
  OutboxMessageRecipientsTable,
} from "@/db/schema";
import { eq, desc, inArray, sql, and, isNull, ne, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import Stripe from "stripe";
import { getDb } from "@/db/connection";
import DeleteContactButton from "@/components/delete-contact-button";
import MergeContactButton from "@/components/merge-contact-button";
import PaginationControls from "@/components/pagination-controls";
import { ArrowLeftIcon, PencilIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import MessageCard from "@/components/message-card";
import LocalTime from "@/components/local-time";
import { getContactSummaryFromS3 } from "@/app/lib/s3-client";

dayjs.extend(relativeTime);

export const dynamic = "force-dynamic";

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const searchParamsData = await searchParams;
  const db = getDb();
  const contact = await db
    .select()
    .from(ContactsTable)
    .where(eq(ContactsTable.id, id))
    .limit(1);

  if (!contact.length) {
    notFound();
  }

  const contactData = contact[0];

  const currentPage = parseInt((searchParamsData.page as string) || "1", 10);
  const pageSize = 10;
  const offset = (currentPage - 1) * pageSize;

  const latestOperations = db
    .selectDistinctOn([InboxMessageOperationsTable.inboxMessageId], {
      inboxMessageId: InboxMessageOperationsTable.inboxMessageId,
      operation: InboxMessageOperationsTable.operation,
      createdAt: InboxMessageOperationsTable.createdAt,
    })
    .from(InboxMessageOperationsTable)
    .orderBy(
      InboxMessageOperationsTable.inboxMessageId,
      desc(InboxMessageOperationsTable.createdAt)
    )
    .as("latestOperations");

  const incomingMessagesCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(InboxMessagesTable)
    .leftJoin(
      latestOperations,
      eq(InboxMessagesTable.id, latestOperations.inboxMessageId)
    )
    .where(
      and(
        eq(InboxMessagesTable.contactId, contactData.id),
        or(
          isNull(latestOperations.operation),
          ne(latestOperations.operation, "ARCHIVED")
        )
      )
    );

  const outgoingMessagesCountResult = await db
    .select({ count: sql<number>`count(distinct ${OutboxMessagesTable.id})` })
    .from(OutboxMessagesTable)
    .innerJoin(
      OutboxMessageRecipientsTable,
      eq(OutboxMessagesTable.id, OutboxMessageRecipientsTable.messageId)
    )
    .innerJoin(
      InboxMessagesTable,
      eq(OutboxMessagesTable.parentInboxMessageId, InboxMessagesTable.id)
    )
    .leftJoin(
      latestOperations,
      eq(InboxMessagesTable.id, latestOperations.inboxMessageId)
    )
    .where(
      and(
        eq(OutboxMessageRecipientsTable.contactId, contactData.id),
        or(
          isNull(latestOperations.operation),
          ne(latestOperations.operation, "ARCHIVED")
        )
      )
    );

  const totalMessages =
    (incomingMessagesCountResult[0]?.count || 0) +
    (outgoingMessagesCountResult[0]?.count || 0);
  const totalPages = Math.ceil(totalMessages / pageSize);

  const incomingMessages = await db
    .selectDistinctOn([InboxMessagesTable.id, InboxMessagesTable.createdAt], {
      id: InboxMessagesTable.id,
      displayName: ContactsTable.slackDisplayName,
      fullName: ContactsTable.fullName,
      email: ContactsTable.email,
      createdAt: InboxMessagesTable.createdAt,
      body: InboxMessagesTable.body,
      inboxId: InboxMessagesTable.inboxId,
      inboxName: InboxesTable.displayLabel,
      isOutgoing: sql<boolean>`false`,
    })
    .from(InboxMessagesTable)
    .leftJoin(ContactsTable, eq(InboxMessagesTable.contactId, ContactsTable.id))
    .leftJoin(InboxesTable, eq(InboxMessagesTable.inboxId, InboxesTable.id))
    .leftJoin(
      latestOperations,
      eq(InboxMessagesTable.id, latestOperations.inboxMessageId)
    )
    .where(
      and(
        eq(InboxMessagesTable.contactId, contactData.id),
        or(
          isNull(latestOperations.operation),
          ne(latestOperations.operation, "ARCHIVED")
        )
      )
    )
    .orderBy(desc(InboxMessagesTable.createdAt), InboxMessagesTable.id);

  const outgoingMessages = await db
    .select({
      id: OutboxMessagesTable.parentInboxMessageId,
      outboxId: OutboxMessagesTable.id,
      displayName: sql<string | null>`null`,
      fullName: sql<string | null>`null`,
      email: sql<string | null>`null`,
      createdAt: OutboxMessagesTable.createdAt,
      body: OutboxMessagesTable.body,
      inboxId: InboxMessagesTable.inboxId,
      inboxName: sql<string | null>`'Outgoing'`,
      isOutgoing: sql<boolean>`true`,
    })
    .from(OutboxMessagesTable)
    .innerJoin(
      OutboxMessageRecipientsTable,
      eq(OutboxMessagesTable.id, OutboxMessageRecipientsTable.messageId)
    )
    .innerJoin(
      InboxMessagesTable,
      eq(OutboxMessagesTable.parentInboxMessageId, InboxMessagesTable.id)
    )
    .leftJoin(
      latestOperations,
      eq(InboxMessagesTable.id, latestOperations.inboxMessageId)
    )
    .where(
      and(
        eq(OutboxMessageRecipientsTable.contactId, contactData.id),
        or(
          isNull(latestOperations.operation),
          ne(latestOperations.operation, "ARCHIVED")
        )
      )
    )
    .orderBy(desc(OutboxMessagesTable.createdAt));

  const allRecentMessages = [...incomingMessages, ...outgoingMessages]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(offset, offset + pageSize * 2);

  const messageOperations = await db
    .select()
    .from(InboxMessageOperationsTable)
    .where(
      inArray(
        InboxMessageOperationsTable.inboxMessageId,
        allRecentMessages.map((message) => message.id)
      )
    );

  const recentMessages = allRecentMessages.slice(0, pageSize);

  const messageStatuses = Object.fromEntries(
    messageOperations.map(({ inboxMessageId, operation }) => [
      inboxMessageId,
      operation,
    ])
  );

  let isClient = false;
  let clientSince: Date | null = null;
  let clientDurationText: string | null = null;

  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (stripeSecretKey && contactData.email) {
      const stripe = new Stripe(stripeSecretKey);

      const customers = await stripe.customers.list({
        email: contactData.email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        const customer = customers.data[0];

        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          status: "active",
          limit: 10,
        });

        for (const subscription of subscriptions.data) {
          for (const item of subscription.items.data) {
            const price = await stripe.prices.retrieve(item.price.id, {
              expand: ["product"],
            });

            if (
              price.product &&
              typeof price.product === "object" &&
              "name" in price.product &&
              price.product.name === "Vargas JR Salary"
            ) {
              isClient = true;
              clientSince = new Date(subscription.created * 1000);
              clientDurationText = dayjs(clientSince).fromNow();
              break;
            }
          }
          if (isClient) break;
        }
      }
    }
  } catch (error) {
    console.error("Error checking Stripe client status:", error);
  }

  const contactSummary = await getContactSummaryFromS3(id);

  return (
    <div className="flex flex-col p-4">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/admin/crm">
          <button className="flex items-center gap-2 text-gray-300 hover:text-white">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-2xl font-bold flex-1">
          {contactData.fullName || "Contact Details"}
        </h1>
        <div className="flex gap-2">
          <Link
            href={`/admin/crm/${id}/edit`}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <PencilIcon className="w-4 h-4 inline mr-2" />
            Edit
          </Link>
          <MergeContactButton
            currentContactId={id}
            currentContactName={contactData.fullName || "Contact"}
          />
          <DeleteContactButton
            id={id}
            contactName={contactData.fullName || "Contact"}
          />
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {contactData.fullName || "N/A"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {contactData.email || "N/A"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {contactData.phoneNumber || "N/A"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Slack ID
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {contactData.slackId || "N/A"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Slack Display Name
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {contactData.slackDisplayName || "N/A"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Created At
            </label>
            <p className="mt-1 text-sm text-gray-900">
              <LocalTime value={contactData.createdAt} />
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Client Status
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {isClient ? (
                <span className="text-green-600 font-semibold">
                  ✓ Active Client
                </span>
              ) : (
                <span className="text-gray-700">Not a Client</span>
              )}
            </p>
          </div>
          {isClient && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Client Since
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {clientSince && (
                  <LocalTime
                    value={clientSince}
                    options={{ dateStyle: "medium" }}
                  />
                )}{" "}
                ({clientDurationText})
              </p>
            </div>
          )}
        </div>
      </div>

      {contactSummary && (
        <div className="mt-6 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Contact Summary</h2>
          <div className="text-sm text-gray-900 whitespace-pre-wrap">
            {contactSummary}
          </div>
        </div>
      )}

      <div className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Recent Messages</h2>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            baseUrl={`/admin/crm/${id}`}
          />
        </div>
        {recentMessages.length > 0 ? (
          <div className="space-y-3">
            {recentMessages.map((message) => (
              <MessageCard
                key={
                  message.isOutgoing
                    ? `out-${message.outboxId}`
                    : `in-${message.id}`
                }
                message={{
                  ...message,
                  source: message.isOutgoing
                    ? "Vargas JR"
                    : message.displayName ||
                      message.fullName ||
                      message.email ||
                      "Unknown",
                }}
                status={messageStatuses[message.id] || "UNREAD"}
                inboxId={message.inboxId}
                inboxName={message.inboxName}
              />
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-center py-8 bg-white rounded-lg shadow">
            No recent messages found for this contact.
          </div>
        )}
      </div>
    </div>
  );
}
