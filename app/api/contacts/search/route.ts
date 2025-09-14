import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { ContactsTable } from "@/db/schema";
import { ilike, ne, or, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const excludeId = searchParams.get("exclude");

  const db = getDb();
  let whereClause = excludeId ? ne(ContactsTable.id, excludeId) : undefined;

  if (query) {
    const searchClause = or(
      ilike(ContactsTable.fullName, `%${query}%`),
      ilike(ContactsTable.email, `%${query}%`)
    );
    whereClause = whereClause ? and(whereClause, searchClause) : searchClause;
  }

  const contacts = await db
    .select()
    .from(ContactsTable)
    .where(whereClause)
    .limit(20);

  return NextResponse.json(contacts);
}
