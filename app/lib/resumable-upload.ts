"use client";
// Large-file uploads to Supabase Storage with real progress, using its resumable
// (TUS) endpoint in 6MB chunks, the chunk size Supabase requires. Plain
// storage.upload() sends one request and reports no progress, which doesn't
// suit files of hundreds of MB.
import { supabase } from "./supabase";

const CHUNK = 6 * 1024 * 1024;
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

/** Uploads `file` to `bucket/path` and returns its public URL. `onProgress` gets 0..1. */
export async function resumableUpload(
  file: Blob, bucket: string, path: string, onProgress?: (fraction: number) => void, signal?: AbortSignal,
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in again.");
  const endpoint = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`;
  const base = {
    Authorization: `Bearer ${session.access_token}`,
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    "Tus-Resumable": "1.0.0",
  };

  const create = await fetch(endpoint, {
    method: "POST",
    signal,
    headers: {
      ...base,
      "Upload-Length": String(file.size),
      "x-upsert": "true",
      "Upload-Metadata": [
        `bucketName ${b64(bucket)}`,
        `objectName ${b64(path)}`,
        `contentType ${b64(file.type || "application/octet-stream")}`,
        `cacheControl ${b64("3600")}`,
      ].join(","),
    },
  });
  const location = create.headers.get("Location");
  if (!create.ok || !location) {
    const text = await create.text().catch(() => "");
    throw new Error(/maximum|too large|exceeded/i.test(text)
      ? "This file is larger than the storage upload limit (raise it in Supabase → Storage settings)."
      : `Upload couldn't start (${create.status}).`);
  }

  let offset = 0;
  onProgress?.(0);
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK);
    let attempt = 0;
    while (true) {
      try {
        const res = await fetch(location, {
          method: "PATCH",
          signal,
          headers: { ...base, "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" },
          body: chunk,
        });
        if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
        offset = Number(res.headers.get("Upload-Offset") ?? offset + chunk.size);
        break;
      } catch (e) {
        // Retry a chunk a few times on flaky connections; give up on abort
        if (signal?.aborted || ++attempt >= 3) throw e;
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    onProgress?.(Math.min(1, offset / file.size));
  }
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
