import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({});

function bucketName(): string {
  const value = process.env.UPLOADS_BUCKET_NAME;
  if (!value) throw new Error("UPLOADS_BUCKET_NAME is not set");
  return value;
}

export async function uploadDocument(key: string, body: Buffer, contentType: string): Promise<void> {
  await client.send(
    new PutObjectCommand({ Bucket: bucketName(), Key: key, Body: body, ContentType: contentType })
  );
}

export async function downloadDocument(key: string): Promise<Buffer> {
  const result = await client.send(new GetObjectCommand({ Bucket: bucketName(), Key: key }));
  const bytes = await result.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Empty object body for ${key}`);
  return Buffer.from(bytes);
}
