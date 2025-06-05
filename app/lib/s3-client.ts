import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const DOCUMENT_TYPE = 'contractor-agreement';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

function generateS3Key(uuid: string): string {
  const baseKey = `contracts/${uuid}.pdf`;
  
  if (process.env.VERCEL_ENV === 'production') {
    return baseKey;
  }
  
  const previewId = process.env.VERCEL_GIT_COMMIT_SHA || 'preview';
  return `previews/${previewId}/${baseKey}`;
}

export async function uploadPDFToS3(pdfBuffer: Uint8Array): Promise<string> {
  const uuid = uuidv4();
  const bucketName = process.env.S3_BUCKET_NAME || 'vargas-jr-memory';
  const key = generateS3Key(uuid);
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
    Metadata: {
      'generated-at': new Date().toISOString(),
      'document-type': DOCUMENT_TYPE,
    },
  });
  
  await s3Client.send(command);
  return uuid;
}
