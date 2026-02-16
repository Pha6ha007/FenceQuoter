// lib/storage.ts
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

type SupabaseClient = any;

export function logoPath(userId: string, ext: string) {
  return `${userId}/logo.${ext}`;
}

export function quotePdfPath(userId: string, quoteId: string) {
  return `${userId}/${quoteId}.pdf`;
}

export function quotePhotoPath(userId: string, quoteId: string, fileId: string, ext: string) {
  return `${userId}/${quoteId}/${fileId}.${ext}`;
}

function guessExtFromUri(uri: string) {
  const m = uri.toLowerCase().match(/\.(png|jpg|jpeg|heic|webp|pdf)(\?.*)?$/);
  if (!m) return null;
  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  return ext;
}

async function readAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  // Web: handle blob URLs and data URLs
  if (Platform.OS === "web") {
    // Blob URL (blob:http://...)
    if (uri.startsWith("blob:")) {
      const response = await fetch(uri);
      return await response.arrayBuffer();
    }
    // Data URL (data:image/png;base64,...)
    if (uri.startsWith("data:")) {
      const base64 = uri.split(",")[1];
      return decode(base64);
    }
    // Regular URL - fetch it
    const response = await fetch(uri);
    return await response.arrayBuffer();
  }

  // Native: use expo-file-system
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: "base64",
  });
  return decode(base64);
}

export async function uploadImageToBucket(params: {
  supabase: SupabaseClient;
  bucket: "logos" | "quote-photos";
  path: string;               // path inside bucket (WITHOUT bucket name)
  uri: string;                // local file uri
  contentType?: string;
  upsert?: boolean;
}) {
  const { supabase, bucket, path, uri, upsert = true } = params;

  const ext = guessExtFromUri(uri) ?? "jpg";
  const contentType =
    params.contentType ??
    (ext === "png" ? "image/png" :
     ext === "webp" ? "image/webp" :
     ext === "heic" ? "image/heic" : "image/jpeg");

  const arrayBuffer = await readAsArrayBuffer(uri);

  const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
    upsert,
    contentType,
  });

  if (error) throw error;

  return { bucket, path };
}

export async function uploadPdfToBucket(params: {
  supabase: SupabaseClient;
  bucket: "quote-pdfs";
  path: string;
  fileUri: string;            // local pdf file uri
  upsert?: boolean;
}) {
  const { supabase, bucket, path, fileUri, upsert = true } = params;

  const arrayBuffer = await readAsArrayBuffer(fileUri);

  const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
    upsert,
    contentType: "application/pdf",
  });

  if (error) throw error;

  return { bucket, path };
}

export function publicLogoUrl(supabase: SupabaseClient, path: string) {
  // logos bucket is public
  const { data } = supabase.storage.from("logos").getPublicUrl(path);
  return data.publicUrl;
}

export async function signedUrl(params: {
  supabase: SupabaseClient;
  bucket: "quote-photos" | "quote-pdfs";
  path: string;
  expiresInSeconds?: number;
}) {
  const { supabase, bucket, path } = params;
  const expiresInSeconds = Math.max(60, Math.min(params.expiresInSeconds ?? 60 * 60 * 24 * 7, 60 * 60 * 24 * 30));

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
