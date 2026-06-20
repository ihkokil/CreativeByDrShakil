import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'auto',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

export async function uploadFileToStorage(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  folderPath: string
): Promise<string> {
  const bucketName = process.env.S3_BUCKET || 'images';
  const cleanFolder = folderPath.replace(/^\/+|\/+$/g, '');
  const key = `${cleanFolder}/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // Return the public URL to access the uploaded file
  const publicPrefix = process.env.NEXT_PUBLIC_S3_URL_PREFIX;
  if (!publicPrefix) {
    throw new Error('NEXT_PUBLIC_S3_URL_PREFIX must be configured in environment variables');
  }
  
  // Format typically: https://your-bucket-domain.com/key or https://cdn.com/bucket/key
  return `${publicPrefix.replace(/\/$/, '')}/${key}`;
}
