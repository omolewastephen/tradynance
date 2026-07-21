import "server-only";

import { v2 as cloudinary } from "cloudinary";

/**
 * Storage for KYC identity documents (Cloudinary).
 *
 * These are the most sensitive objects in the system, so the rules here are deliberate:
 *  - Assets upload as `type: "private"`. Cloudinary's DEFAULT upload type is publicly readable by
 *    anyone who has (or guesses) the URL — unacceptable for identity documents. Private assets have
 *    no public delivery URL at all; the only way to read one is a signed download URL.
 *  - Admins read through `private_download_url`, signed and expiring in minutes, so a link that
 *    gets forwarded or logged stops working.
 *  - Uploads happen server-side with the API secret, which never reaches the browser.
 *  - Object ids are namespaced per user and carry a random UUID, so they aren't guessable.
 *
 * Configure with CLOUDINARY_URL (cloudinary://<api_key>:<api_secret>@<cloud_name>) or the three
 * discrete vars. Until then the feature reports itself unconfigured rather than silently failing.
 */
export const MAX_DOC_BYTES = 6 * 1024 * 1024; // 6MB
export const ACCEPTED_DOC_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

let configured: boolean | undefined;

function configure(): boolean {
  if (configured !== undefined) return configured;

  const url = process.env.CLOUDINARY_URL;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (url) {
    // The SDK reads CLOUDINARY_URL from the environment on its own.
    cloudinary.config({ secure: true });
    configured = Boolean(cloudinary.config().api_secret);
    return configured;
  }
  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    configured = true;
    return true;
  }
  configured = false;
  return false;
}

export function kycStorageConfigured(): boolean {
  return configure();
}

/**
 * A stored document reference. Cloudinary needs resource_type + format + public_id to sign a
 * download, so all three are packed into the single string column rather than adding columns.
 */
function encodeRef(resourceType: string, format: string, publicId: string): string {
  return `${resourceType}|${format}|${publicId}`;
}

function decodeRef(ref: string): { resourceType: string; format: string; publicId: string } | null {
  const parts = ref.split("|");
  if (parts.length !== 3) return null;
  return { resourceType: parts[0], format: parts[1], publicId: parts[2] };
}

/** Uploads one document and returns its stored reference (not a URL). */
export async function uploadKycDocument(
  userId: string,
  kind: "front" | "back" | "selfie",
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (!configure()) return { ok: false, error: "Document storage isn't configured yet." };

  if (!ACCEPTED_DOC_TYPES.includes(file.type)) {
    return { ok: false, error: "Upload a JPG, PNG, WEBP or PDF." };
  }
  if (file.size > MAX_DOC_BYTES) {
    return { ok: false, error: "Each file must be under 6MB." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Random segment keeps ids unguessable even if a user id leaks.
  const publicId = `${kind}-${crypto.randomUUID()}`;

  try {
    const result = await new Promise<{ public_id: string; format?: string; resource_type: string }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `kyc/${userId}`,
            public_id: publicId,
            type: "private", // never publicly deliverable — see the note at the top of this file
            resource_type: "auto", // PDFs land as `image` in Cloudinary; `auto` picks correctly
            overwrite: false,
            invalidate: false,
          },
          (error, res) => {
            if (error || !res) reject(new Error(error?.message ?? "Upload failed"));
            else resolve(res as { public_id: string; format?: string; resource_type: string });
          },
        );
        stream.end(buffer);
      },
    );

    const format = result.format ?? (file.type === "application/pdf" ? "pdf" : file.type.split("/")[1]);
    return { ok: true, path: encodeRef(result.resource_type, format, result.public_id) };
  } catch (err) {
    console.error("[kyc] upload failed", (err as Error).message);
    return { ok: false, error: "Could not store the document. Try again." };
  }
}

/** Short-lived signed URL so a compliance reviewer can view a document. */
export async function signedDocumentUrl(
  ref: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  if (!configure()) return null;

  const decoded = decodeRef(ref);
  if (!decoded) {
    console.error("[kyc] unrecognised document reference");
    return null;
  }

  try {
    return cloudinary.utils.private_download_url(decoded.publicId, decoded.format, {
      resource_type: decoded.resourceType,
      type: "private",
      expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
    });
  } catch (err) {
    console.error("[kyc] signed url failed", (err as Error).message);
    return null;
  }
}
