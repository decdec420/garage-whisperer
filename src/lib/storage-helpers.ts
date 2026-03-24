import { supabase } from '@/integrations/supabase/client';

/**
 * Extract the storage path from a full public URL or return the path as-is.
 */
function extractPath(bucket: string, urlOrPath: string): string {
  // If it's a full URL, extract the path after the bucket name
  const marker = `/${bucket}/`;
  const idx = urlOrPath.indexOf(marker);
  if (idx !== -1) return urlOrPath.slice(idx + marker.length);
  return urlOrPath;
}

/**
 * Get a signed URL for a file in a private storage bucket.
 * Returns null if signing fails.
 */
export async function getSignedUrl(
  bucket: string,
  urlOrPath: string,
  expiresIn = 3600
): Promise<string | null> {
  const path = extractPath(bucket, urlOrPath);
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error) {
    console.error(`Failed to sign URL for ${bucket}/${path}:`, error.message);
    return null;
  }
  return data.signedUrl;
}

/**
 * Upload a file and return the storage path (NOT a public URL).
 * Path format: {userId}/{context}/{timestamp}-{random}.{ext}
 */
export async function uploadFile(
  bucket: string,
  file: File,
  userId: string,
  context: string
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${context}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}
