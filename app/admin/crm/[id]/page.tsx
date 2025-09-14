import {
  ContactsTable,
  InboxMessagesTable,
  InboxMessageOperationsTable,
  InboxesTable,
} from "@/db/schema";
import { eq, or, desc, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import Stripe from "stripe";
import { getDb } from "@/db/connection";
import DeleteContactButton from "@/components/delete-contact-button";
import { ArrowLeftIcon, PencilIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import MessageCard from "@/components/message-card";

dayjs.extend(relativeTime);

export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const recentMessages = await db
    .selectDistinctOn([InboxMessagesTable.id], {
      id: InboxMessagesTable.id,
      source: InboxMessagesTable.source,
      displayName: ContactsTable.slackDisplayName,
      fullName: ContactsTable.fullName,
      createdAt: InboxMessagesTable.createdAt,
      body: InboxMessagesTable.body,
      inboxId: InboxMessagesTable.inboxId,
      inboxName: InboxesTable.displayLabel,
    })
    .from(InboxMessagesTable)
    .leftJoin(
      ContactsTable,
      or(
        eq(InboxMessagesTable.source, ContactsTable.slackId),
        eq(InboxMessagesTable.source, ContactsTable.email)
      )
    )
    .leftJoin(InboxesTable, eq(InboxMessagesTable.inboxId, InboxesTable.id))
    .where(
      or(
        ...(contactData.email
          ? [eq(InboxMessagesTable.source, contactData.email)]
          : []),
        ...(contactData.slackId
          ? [eq(InboxMessagesTable.source, contactData.slackId)]
          : [])
      )
    )
    .orderBy(desc(InboxMessagesTable.createdAt))
    .limit(10);

  const messageOperations = await db
    .select()
    .from(InboxMessageOperationsTable)
    .where(
      inArray(
        InboxMessageOperationsTable.inboxMessageId,
        recentMessages.map((message) => message.id)
      )
    );

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
              Created At
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {contactData.createdAt.toLocaleString()}
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
                {clientSince?.toLocaleDateString()} ({clientDurationText})
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Recent Messages</h2>
        {recentMessages.length > 0 ? (
          <div className="space-y-3">
            {recentMessages.map((message) => (
              <MessageCard
                key={message.id}
                message={{
                  ...message,
                  source:
                    message.displayName || message.fullName || message.source,
                }}
                status={messageStatuses[message.id] || "Unread"}
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
