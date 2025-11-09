import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { AWS_S3_BUCKETS } from "./constants";
import { AWS_DEFAULT_REGION } from "@/server/constants";

const DOCUMENT_TYPE = "contractor-agreement";

const s3Client = new S3Client({
  region: AWS_DEFAULT_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export function generateS3Key(baseKey: string): string {
  if (process.env.VERCEL_ENV === "production") {
    return baseKey;
  }

  const previewId = process.env.VERCEL_GIT_COMMIT_SHA || "preview";
  return `previews/${previewId}/${baseKey}`;
}

export async function uploadPDFToS3(pdfBuffer: Uint8Array): Promise<string> {
  const uuid = uuidv4();
  const bucketName = AWS_S3_BUCKETS.MEMORY;
  const baseKey = `contracts/${uuid}.pdf`;
  const key = generateS3Key(baseKey);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: pdfBuffer,
    ContentType: "application/pdf",
    Metadata: {
      "generated-at": new Date().toISOString(),
      "document-type": DOCUMENT_TYPE,
    },
  });

  await s3Client.send(command);
  return uuid;
}

export async function getContactSummaryFromS3(
  contactId: string
): Promise<string | null> {
  try {
    const bucketName = AWS_S3_BUCKETS.MEMORY;
    const baseKey = `contact-summaries/${contactId}.txt`;
    const key = generateS3Key(baseKey);

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await s3Client.send(command);
    if (response.Body) {
      return await response.Body.transformToString();
    }
    return null;
  } catch (error) {
    console.error(
      `Failed to retrieve contact summary for ${contactId} from S3:`,
      error
    );
    return null;
  }
}
