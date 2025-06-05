import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function uploadPDFToS3(pdfBuffer: Uint8Array): Promise<string> {
  const uuid = uuidv4();
  const bucketName = process.env.S3_BUCKET_NAME || 'vargas-jr-memory';
  const key = `contracts/${uuid}.pdf`;
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
    Metadata: {
      'generated-at': new Date().toISOString(),
      'document-type': 'hiring-agreement',
    },
  });
  
  await s3Client.send(command);
  return uuid;
}
