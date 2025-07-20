import { NextResponse } from "next/server";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { z } from "zod";
import { LAMBDA_FUNCTION_NAMES } from "../../lib/constants";

const testRequestSchema = z.object({
  previewBranchName: z.string().min(1),
  testSubject: z.string().optional(),
  testSender: z.string().email().optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { previewBranchName, testSubject, testSender } = testRequestSchema.parse(body);

    const lambdaClient = new LambdaClient({ region: "us-east-1" });
    
    const testEvent = {
      Records: [{
        ses: {
          mail: {
            messageId: `test-${Date.now()}`,
            commonHeaders: {
              from: [testSender || "test@example.com"],
              subject: testSubject || `[PREVIEW: ${previewBranchName}] Test Email for Preview Branch`,
              to: ["hello@vargasjr.dev"]
            }
          },
          receipt: {
            recipients: ["hello@vargasjr.dev"],
            timestamp: new Date().toISOString()
          }
        }
      }]
    };

    const invokeCommand = new InvokeCommand({
      FunctionName: LAMBDA_FUNCTION_NAMES.EMAIL_PROCESSOR,
      Payload: JSON.stringify(testEvent)
    });

    const response = await lambdaClient.send(invokeCommand);
    
    return NextResponse.json({ 
      success: true, 
      messageId: testEvent.Records[0].ses.mail.messageId,
      previewBranchName,
      lambdaResponse: response
    });
  } catch (error) {
    console.error("Error testing Lambda:", error);
    return NextResponse.json(
      { error: "Failed to test Lambda function" },
      { status: 500 }
    );
  }
}
