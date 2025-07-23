import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import formatZodError from "@/utils/format-zod-error";
import { ChatSessionsTable, InboxesTable, ContactsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/connection";
import { createErrorResponse } from "@/utils/error-response";

export async function POST(request: Request) {
  const requestId = `chat-session-${Date.now()}`;
  console.log(`[${requestId}] Creating new chat session`);
  
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error(`[${requestId}] Failed to parse request body:`, parseError);
      return NextResponse.json(
        createErrorResponse("Invalid JSON in request body", {
          code: "INVALID_JSON",
          details: parseError instanceof Error ? parseError.message : "Request body is not valid JSON",
          requestId,
          troubleshooting: [
            "Ensure request body contains valid JSON",
            "Check Content-Type header is application/json"
          ]
        }),
        { status: 400 }
      );
    }

    let validatedData;
    try {
      validatedData = z
        .object({
          email: z.string().email(),
          message: z.string(),
        })
        .parse(body);
    } catch (validationError) {
      console.error(`[${requestId}] Request validation failed:`, validationError);
      if (validationError instanceof ZodError) {
        return NextResponse.json(
          createErrorResponse("Request validation failed", {
            code: "VALIDATION_ERROR",
            details: formatZodError(validationError),
            requestId,
            diagnostics: {
              receivedData: body,
              validationErrors: validationError.errors
            },
            troubleshooting: [
              "Ensure 'email' field contains a valid email address",
              "Ensure 'message' field is provided and not empty"
            ]
          }),
          { status: 400 }
        );
      }
      throw validationError;
    }

    const { email } = validatedData;

    try {
      const db = getDb();
      let inbox = await db
        .select({ id: InboxesTable.id })
        .from(InboxesTable)
        .where(eq(InboxesTable.type, "CHAT_SESSION"))
        .limit(1)
        .execute();

      if (!inbox.length) {
        console.log(`[${requestId}] Creating new chat session inbox`);
        const newInbox = await db
          .insert(InboxesTable)
          .values({
            name: "chat-sessions",
            type: "CHAT_SESSION",
            config: {},
          })
          .returning({ id: InboxesTable.id });
        inbox = newInbox;
      }

      let contact = await db
        .select({ id: ContactsTable.id })
        .from(ContactsTable)
        .where(eq(ContactsTable.email, email))
        .limit(1)
        .execute();

      if (!contact.length) {
        console.log(`[${requestId}] Creating new contact for email: ${email}`);
        const newContact = await db
          .insert(ContactsTable)
          .values({ email })
          .returning({ id: ContactsTable.id });
        contact = newContact;
      }

      const chatSession = await db
        .insert(ChatSessionsTable)
        .values({ 
          inboxId: inbox[0].id,
          contactId: contact[0].id
        })
        .returning({ id: ChatSessionsTable.id });

      console.log(`[${requestId}] Successfully created chat session:`, chatSession[0].id);
      return NextResponse.json({ 
        id: chatSession[0].id,
        requestId 
      });
    } catch (dbError) {
      console.error(`[${requestId}] Database error creating chat session:`, dbError);
      
      let errorResponse;
      if (dbError instanceof Error && dbError.message.includes('unique constraint')) {
        errorResponse = createErrorResponse("Duplicate chat session", {
          code: "DUPLICATE_SESSION",
          details: dbError.message,
          requestId,
          diagnostics: {
            operation: "INSERT",
            table: "chat_sessions",
            email: email
          },
          troubleshooting: [
            "Check if a chat session already exists for this contact",
            "Try refreshing the page and starting a new session"
          ]
        });
      } else {
        errorResponse = createErrorResponse("Failed to create chat session", {
          code: "DATABASE_ERROR",
          details: dbError instanceof Error ? dbError.message : String(dbError),
          requestId,
          diagnostics: {
            operation: "INSERT",
            tables: ["inboxes", "contacts", "chat_sessions"],
            errorName: dbError instanceof Error ? dbError.name : "Unknown"
          },
          troubleshooting: [
            "Check database connectivity",
            "Verify database schema is up to date",
            "Check database permissions"
          ]
        });
      }
      
      return NextResponse.json(errorResponse, { status: 500 });
    }
  } catch (error) {
    console.error(`[${requestId}] Unexpected error creating chat session:`, error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    if (errorStack) {
      console.error(`[${requestId}] Error stack:`, errorStack);
    }

    return NextResponse.json(
      createErrorResponse("Failed to create chat session", {
        code: "UNEXPECTED_ERROR",
        details: error instanceof Error ? error.message : "Unknown error occurred",
        requestId,
        diagnostics: {
          errorName: error instanceof Error ? error.name : "Unknown",
          errorStack: errorStack
        },
        troubleshooting: [
          "Check server logs for detailed error information",
          "Verify database connectivity",
          "Try creating the chat session again"
        ]
      }),
      { status: 500 }
    );
  }
}
