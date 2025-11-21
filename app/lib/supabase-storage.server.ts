import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

export async function uploadToSupabaseStorage(
  input: File | Buffer,
  type: "photo" | "avatar" = "photo",
  mimeType?: string
): Promise<string> {
  try {
    // Get Supabase credentials
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables for storage upload");
    }

    // Create Supabase client with service role key for server-side operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = randomBytes(8).toString("hex");

    let buffer: Buffer;
    let ext: string;
    let contentType: string;

    if (input instanceof File) {
      buffer = Buffer.from(await input.arrayBuffer());
      ext = getFileExtension(input.name);
      contentType = input.type || mimeType || "image/jpeg";
      if (!ext && mimeType) {
        ext = getExtensionFromMimeType(mimeType);
      }
    } else {
      buffer = input;
      ext = mimeType ? getExtensionFromMimeType(mimeType) : ".jpg";
      contentType = mimeType || "image/jpeg";
    }

    const filename = `${timestamp}-${randomId}${ext}`;
    const bucketName = type === "avatar" ? "Avatars" : "Photos";
    const filePath = `${type}s/${filename}`;

    console.log(`[SUPABASE_STORAGE] Uploading ${type} to bucket "${bucketName}" at path "${filePath}"`);

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType,
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("[SUPABASE_STORAGE] Upload error:", error);
      throw new Error(`Failed to upload ${type}: ${error.message}`);
    }

    console.log(`[SUPABASE_STORAGE] ${type} uploaded successfully:`, data.path);

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    if (!publicUrlData?.publicUrl) {
      throw new Error("Failed to get public URL for uploaded file");
    }

    console.log(`[SUPABASE_STORAGE] Public URL generated:`, publicUrlData.publicUrl);
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error("[SUPABASE_STORAGE] Error uploading file:", error);
    throw error instanceof Error ? error : new Error("Failed to upload file to storage");
  }
}

export async function deleteFromSupabaseStorage(
  filePath: string,
  type: "photo" | "avatar" = "photo"
): Promise<void> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables for storage deletion");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const bucketName = type === "avatar" ? "Avatars" : "Photos";

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      console.error("[SUPABASE_STORAGE] Delete error:", error);
      throw new Error(`Failed to delete ${type}: ${error.message}`);
    }

    console.log(`[SUPABASE_STORAGE] File deleted:`, filePath);
  } catch (error) {
    console.error("[SUPABASE_STORAGE] Error deleting file:", error);
    throw error;
  }
}

function getFileExtension(filename: string): string {
  const match = filename.match(/\.[^.]+$/);
  return match ? match[0] : "";
}

function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/heic": ".jpg", // We convert HEIC to JPEG
    "image/heif": ".jpg",
  };
  return mimeToExt[mimeType] || ".jpg";
}
