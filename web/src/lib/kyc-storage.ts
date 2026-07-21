import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Storage for KYC identity documents.
 *
 * These are the most sensitive objects in the system, so the rules here are deliberate:
 *  - The bucket is PRIVATE. Nothing is ever served from a public URL.
 *  - Uploads go through the server using the service-role key, which never reaches the browser.
 *  - Admins read documents through short-lived signed URLs (minutes), so a leaked link expires.
 *  - Object paths are namespaced per user and prefixed with a random id, so paths aren't guessable.
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and a private bucket named `kyc-documents`.
 * Until those are set the feature reports itself unconfigured rather than silently failing.
 */
export const KYC_BUCKET = "kyc-documents";

/** Max accepted document size. Keep in sync with next.config's serverActions.bodySizeLimit. */
export const MAX_DOC_BYTES = 6 * 1024 * 1024; // 6MB
export const ACCEPTED_DOC_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

let client: SupabaseClient | null | undefined;

function storage(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    client = null;
    return null;
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export function kycStorageConfigured(): boolean {
  return storage() !== null;
}

/** Uploads one document and returns its object path (not a URL). */
export async function uploadKycDocument(
  userId: string,
  kind: "front" | "back" | "selfie",
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const sb = storage();
  if (!sb) return { ok: false, error: "Document storage isn't configured yet." };

  if (!ACCEPTED_DOC_TYPES.includes(file.type)) {
    return { ok: false, error: "Upload a JPG, PNG, WEBP or PDF." };
  }
  if (file.size > MAX_DOC_BYTES) {
    return { ok: false, error: "Each file must be under 6MB." };
  }

  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
  // Random segment keeps paths unguessable even if a user id leaks.
  const path = `${userId}/${kind}-${crypto.randomUUID()}.${ext}`;

  const { error } = await sb.storage
    .from(KYC_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[kyc] upload failed", error.message);
    // TEMPORARY DIAGNOSTIC — surfaces the storage provider's reason (bucket missing, bad key, RLS)
    // because Netlify function logs aren't readily greppable. Revert to the generic message once
    // the bucket is confirmed working; users should never see provider internals.
    return { ok: false, error: `Storage rejected the upload: ${error.message}` };
  }
  return { ok: true, path };
}

/** Short-lived signed URL so a compliance reviewer can view a document. */
export async function signedDocumentUrl(path: string, expiresInSeconds = 300): Promise<string | null> {
  const sb = storage();
  if (!sb) return null;
  const { data, error } = await sb.storage.from(KYC_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error("[kyc] signed url failed", error.message);
    return null;
  }
  return data.signedUrl;
}
