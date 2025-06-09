import { ContactsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import Stripe from "stripe";
import { db } from "@/db/connection";

export const dynamic = 'force-dynamic';

dayjs.extend(relativeTime);

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
          status: 'active',
          limit: 10,
        });

        for (const subscription of subscriptions.data) {
          for (const item of subscription.items.data) {
            const price = await stripe.prices.retrieve(item.price.id, {
              expand: ['product'],
            });
            
            if (price.product && typeof price.product === 'object' && 'name' in price.product && price.product.name === 'Vargas JR Salary') {
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
    console.error('Error checking Stripe client status:', error);
  }

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
