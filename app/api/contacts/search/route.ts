import { getDb } from "@/db/connection";
import { ContactsTable } from "@/db/schema";
import { ilike, ne, or, and } from "drizzle-orm";
import { withApiWrapper } from "@/utils/api-wrapper";
import { z } from "zod";

const SearchContactsParamsSchema = z.object({
  q: z.string().optional().default(""),
  exclude: z.string().optional(),
});

async function searchContactsHandler(body: unknown) {
  const { q, exclude } = SearchContactsParamsSchema.parse(body);

  const db = getDb();
  let whereClause = exclude ? ne(ContactsTable.id, exclude) : undefined;

  if (q) {
    const searchClause = or(
      ilike(ContactsTable.fullName, `%${q}%`),
      ilike(ContactsTable.email, `%${q}%`)
    );
    whereClause = whereClause ? and(whereClause, searchClause) : searchClause;
  }

  const contacts = await db
    .select()
    .from(ContactsTable)
    .where(whereClause)
    .limit(20);

  return contacts;
}

export const GET = withApiWrapper(searchContactsHandler);
