import { LambdaClient, UpdateFunctionConfigurationCommand, InvokeCommand } from "@aws-sdk/client-lambda";

interface TestLambdaOptions {
  previewBranchUrl: string;
  testMode?: boolean;
}

export class LambdaEmailTester {
  private lambdaClient: LambdaClient;
  private functionName = "vargas-jr-email-processor";

  constructor() {
    this.lambdaClient = new LambdaClient({ region: "us-east-1" });
  }

  async configureForTesting(options: TestLambdaOptions): Promise<void> {
    const { previewBranchUrl, testMode = true } = options;
    
    console.log(`Configuring Lambda for testing with URL: ${previewBranchUrl}`);
    
    const updateCommand = new UpdateFunctionConfigurationCommand({
      FunctionName: this.functionName,
      Environment: {
        Variables: {
          WEBHOOK_URL: process.env.WEBHOOK_URL || '',
          SES_WEBHOOK_SECRET: process.env.SES_WEBHOOK_SECRET || '',
          LAMBDA_TEST_MODE: testMode.toString(),
          TEST_WEBHOOK_URL: previewBranchUrl
        }
      }
    });

    await this.lambdaClient.send(updateCommand);
    console.log("Lambda configuration updated for testing");
  }

  async resetToProduction(): Promise<void> {
    console.log("Resetting Lambda to production configuration");
    
    const updateCommand = new UpdateFunctionConfigurationCommand({
      FunctionName: this.functionName,
      Environment: {
        Variables: {
          WEBHOOK_URL: process.env.WEBHOOK_URL || '',
          SES_WEBHOOK_SECRET: process.env.SES_WEBHOOK_SECRET || '',
          LAMBDA_TEST_MODE: 'false',
          TEST_WEBHOOK_URL: ''
        }
      }
    });

    await this.lambdaClient.send(updateCommand);
    console.log("Lambda reset to production configuration");
  }

  async testWithSampleEmail(messageId: string = "test-message-123"): Promise<void> {
    const testEvent = {
      Records: [{
        ses: {
          mail: {
            messageId,
            commonHeaders: {
              from: ["test@example.com"],
              subject: "Test Email for Preview Branch",
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
      FunctionName: this.functionName,
      Payload: JSON.stringify(testEvent)
    });

    const response = await this.lambdaClient.send(invokeCommand);
    console.log("Lambda invocation response:", response);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const previewUrl = args[1];

  const tester = new LambdaEmailTester();

  switch (command) {
    case 'configure':
      if (!previewUrl) {
        console.error("Usage: npm run test-lambda-email configure <preview-branch-url>");
        process.exit(1);
      }
      tester.configureForTesting({ previewBranchUrl: previewUrl });
      break;
    case 'reset':
      tester.resetToProduction();
      break;
    case 'test':
      tester.testWithSampleEmail();
      break;
    default:
      console.log("Usage: npm run test-lambda-email <configure|reset|test> [preview-url]");
  }
}
