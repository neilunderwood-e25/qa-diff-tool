import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Supabase Storage helper. Prisma owns the relational data; Supabase Storage
// owns the screenshot binaries. This module is the ONLY place that talks to
// Supabase directly, and it runs server-side only (it uses the service-role
// key, which must never reach the browser).

export const SCREENSHOTS_BUCKET = "qa-screenshots";

/**
 * Lazily construct a service-role Supabase client. The key is read at call
 * time (not module load) so it is never captured into a client bundle, and the
 * factory throws a clear error if the env is missing rather than failing deep
 * inside an upload.
 */
export function getStorageAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase storage is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Build the public URL for an object in the screenshots bucket without needing
 * a client instance. The bucket is public, so objects are served at a stable,
 * key-less path — safe to embed in `<img src>`.
 */
export function screenshotPublicUrl(objectPath: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${SCREENSHOTS_BUCKET}/${objectPath}`;
}

/**
 * Upload a PNG buffer to the screenshots bucket. Upserts so re-running a
 * comparison with the same runId overwrites cleanly. Returns the public URL.
 */
export async function uploadScreenshot(
  client: SupabaseClient,
  objectPath: string,
  buffer: Buffer
): Promise<string> {
  const { error } = await client.storage
    .from(SCREENSHOTS_BUCKET)
    .upload(objectPath, buffer, {
      contentType: "image/png",
      upsert: true,
    });
  if (error) throw error;
  return screenshotPublicUrl(objectPath);
}
