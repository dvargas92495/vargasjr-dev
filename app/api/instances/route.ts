import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { EC2 } from "@aws-sdk/client-ec2";
import { cookies } from "next/headers";

function getEnvironmentPrefix(): string {
  if (process.env.VERCEL_ENV === 'preview') {
    return 'PREVIEW';
  }
  return '';
}

function getCurrentPRNumber(): string | null {
  return process.env.VERCEL_GIT_PULL_REQUEST_ID || null;
}

const instanceSchema = z.object({
  id: z.string(),
  operation: z.enum(["STOP", "START"]),
});

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-token");

    if (token?.value !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const environmentPrefix = getEnvironmentPrefix();
    const currentPRNumber = getCurrentPRNumber();

    try {
      const ec2 = new EC2({
        region: "us-east-1",
      });
      
      const filters = [
        { Name: "tag:Project", Values: ["VargasJR"] },
        { Name: "instance-state-name", Values: ["running", "stopped", "pending"] }
      ];
      
      if (environmentPrefix === '') {
        filters.push({ Name: "tag:Type", Values: ["main"] });
      } else if (environmentPrefix === 'PREVIEW' && currentPRNumber) {
        filters.push({ Name: "tag:PRNumber", Values: [currentPRNumber] });
      }
      
      const instancesData = await ec2
        .describeInstances({ Filters: filters })
        .then((data) => data.Reservations?.flatMap(r => r.Instances || []) || []);

      return NextResponse.json({
        instances: instancesData,
        environmentPrefix,
        currentPRNumber
      });

    } catch (awsError) {
      const errorMessage = awsError instanceof Error ? awsError.message : "AWS error";
      
      if (errorMessage.includes("Could not load credentials")) {
        console.log("AWS credentials not available - returning mock data for development");
        
        const mockInstances = [
          {
            InstanceId: "i-1234567890abcdef0",
            State: { Name: "running" },
            KeyName: "test-key",
            PublicDnsName: "ec2-test.compute-1.amazonaws.com",
            InstanceType: "t3.micro",
            ImageId: "ami-12345678",
            Tags: [
              { Key: "Name", Value: "Test Instance" },
              { Key: "Type", Value: "main" },
              { Key: "Project", Value: "VargasJR" }
            ]
          }
        ];

        return NextResponse.json({
          instances: mockInstances,
          environmentPrefix,
          currentPRNumber,
          isDevelopment: true
        });
      }

      throw awsError;
    }

  } catch (error) {
    console.error("Failed to fetch instances:", error);
    return NextResponse.json(
      { error: "Failed to fetch instances" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-token");

    if (token?.value !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, operation } = instanceSchema.parse(body);

    const ec2 = new EC2({
      region: "us-east-1",
    });

    if (operation === "STOP") {
      await ec2.stopInstances({ InstanceIds: [id] });
    } else if (operation === "START") {
      await ec2.startInstances({ InstanceIds: [id] });
    } else {
      return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create inbox" },
      { status: 500 }
    );
  }
}
