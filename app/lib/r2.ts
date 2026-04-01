import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

/**
 * Cloudflare R2 Storage Utility
 *
 * Uses the S3-compatible API provided by Cloudflare R2.
 * Bucket: friend-ai
 *
 * Required environment variables:
 * - R2_ACCOUNT_ID: Cloudflare account ID
 * - R2_ACCESS_KEY_ID: R2 API token access key
 * - R2_SECRET_ACCESS_KEY: R2 API token secret key
 * - R2_PUBLIC_URL: Public URL for the R2 bucket (e.g. from custom domain or r2.dev)
 */

const R2_BUCKET = 'friend-ai';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

/**
 * Upload a file to Cloudflare R2.
 *
 * @param key - The object key (path) in the bucket, e.g. "avatars/avatar_abc123.jpg"
 * @param body - The file content as Buffer
 * @param contentType - MIME type of the file
 * @returns The public URL of the uploaded file
 */
export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  // Return the public URL
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (publicUrl) {
    return `${publicUrl}/${key}`;
  }

  // Fallback: direct R2 URL (requires public access enabled)
  return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
}

/**
 * Delete a file from Cloudflare R2.
 *
 * @param key - The object key to delete, e.g. "avatars/avatar_abc123.jpg"
 */
export async function deleteFromR2(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  );
}

/**
 * Extract the R2 object key from a full URL.
 * Handles both R2_PUBLIC_URL-based and direct R2 URLs.
 *
 * @param url - The full URL of the R2 object
 * @returns The object key, or null if it can't be extracted
 */
export function getR2KeyFromUrl(url: string): string | null {
  if (!url) return null;

  // If it's a relative /uploads/ path (old local files), return null
  if (url.startsWith('/uploads/')) return null;

  try {
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (publicUrl && url.startsWith(publicUrl)) {
      return url.slice(publicUrl.length + 1); // +1 for the "/"
    }

    // Try to extract from direct R2 URL
    const r2Pattern = /r2\.cloudflarestorage\.com\/friend-ai\/(.+)$/;
    const match = url.match(r2Pattern);
    if (match) return match[1];

    return null;
  } catch {
    return null;
  }
}
