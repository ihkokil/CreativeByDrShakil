import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: process.env.SUPABASE_STORAGE_ENDPOINT,
  region: process.env.SUPABASE_STORAGE_REGION || 'ap-northeast-1',
  credentials: {
    accessKeyId: process.env.SUPABASE_STORAGE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.SUPABASE_STORAGE_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

export async function uploadFileToStorage(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  folderPath: string
): Promise<string> {
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'images';
  const cleanFolder = folderPath.replace(/^\/+|\/+$/g, '');
  const key = `${cleanFolder}/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${key}`;
}
