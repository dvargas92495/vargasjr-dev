import { NextResponse } from "next/server";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { z } from "zod";
import { execSync } from "child_process";
import { LAMBDA_FUNCTION_NAMES } from "../../lib/constants";

const testRequestSchema = z.object({
  testSubject: z.string().min(1),
  testSender: z.string().email().min(1)
});

function getCurrentBranch(): string {
  try {
    const branchName = execSync('git branch --show-current', {
      encoding: 'utf8'
    }).trim();
    
    if (!branchName) {
      throw new Error('Could not determine current branch name');
    }
    
    return branchName;
  } catch (error) {
    throw new Error(`Failed to get current branch: ${error}`);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { testSubject, testSender } = testRequestSchema.parse(body);

    const currentBranch = getCurrentBranch();
    const lambdaClient = new LambdaClient({ region: "us-east-1" });
    
    const testEvent = {
      Records: [{
        ses: {
          mail: {
            messageId: `test-${Date.now()}`,
            commonHeaders: {
              from: [testSender],
              subject: testSubject,
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
      currentBranch,
      lambdaResponse: response
    });
  } catch (error) {
    console.error("Error testing email processing:", error);
    return NextResponse.json(
      { error: "Failed to test email processing" },
      { status: 500 }
    );
  }
}
