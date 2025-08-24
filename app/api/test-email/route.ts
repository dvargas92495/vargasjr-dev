import { NextResponse } from "next/server";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { z } from "zod";
import { LAMBDA_FUNCTION_NAMES } from "../../lib/constants";
import { getBaseUrl } from "../constants";
import { AWS_DEFAULT_REGION } from "@/server/constants";

const testRequestSchema = z.object({
  testSubject: z.string().min(1),
  testSender: z.string().email().min(1),
  testBody: z.string().min(1),
});

function getCurrentBranch(): string {
  const commitRef = process.env.VERCEL_GIT_COMMIT_REF;
  if (commitRef) {
    return commitRef.replace("refs/heads/", "");
  }

  const githubHeadRef = process.env.GITHUB_HEAD_REF;
  if (githubHeadRef) {
    return githubHeadRef;
  }

  const branchName = process.env.BRANCH_NAME;
  if (branchName) {
    return branchName;
  }

  return "main";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { testSubject, testSender, testBody } = testRequestSchema.parse(body);

    const currentBranch = getCurrentBranch();
    const lambdaClient = new LambdaClient({ region: AWS_DEFAULT_REGION });

    let finalSubject = testSubject;
    if (process.env.VERCEL_ENV !== "production" && currentBranch !== "main") {
      finalSubject = `[PREVIEW: ${currentBranch}] ${testSubject}`;
    }

    const testEvent = {
      Records: [
        {
          ses: {
            mail: {
              messageId: `test-${Date.now()}`,
              commonHeaders: {
                from: [testSender],
                subject: finalSubject,
                to: ["hello@vargasjr.dev"],
              },
              content: testBody,
            },
            receipt: {
              recipients: ["hello@vargasjr.dev"],
              timestamp: new Date().toISOString(),
            },
          },
        },
      ],
    };

    const invokeCommand = new InvokeCommand({
      FunctionName: LAMBDA_FUNCTION_NAMES.EMAIL_PROCESSOR,
      Payload: JSON.stringify(testEvent),
    });

    const response = await lambdaClient.send(invokeCommand);

    let deserializedPayload;
    try {
      if (response.Payload) {
        const decoder = new TextDecoder("utf-8");
        const payloadString = decoder.decode(response.Payload);
        deserializedPayload = JSON.parse(payloadString);
      } else {
        deserializedPayload = null;
      }
    } catch (error) {
      console.error("Error deserializing Lambda payload:", error);
      deserializedPayload = { error: "Failed to deserialize payload" };
    }

    return NextResponse.json({
      success: true,
      messageId: testEvent.Records[0].ses.mail.messageId,
      currentBranch,
      finalSubject: testEvent.Records[0].ses.mail.commonHeaders.subject,
      expectedWebhookUrl: getBaseUrl() + "/api/ses/webhook",
      payload: deserializedPayload,
    });
  } catch (error) {
    console.error("Error testing email processing:", error);
    return NextResponse.json(
      {
        error: "Failed to test email processing",
        details: error instanceof Error ? error.message : String(error),
        success: false,
      },
      { status: 500 }
    );
  }
}
