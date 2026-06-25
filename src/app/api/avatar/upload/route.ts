import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createR2Client, R2_BUCKET, r2PublicUrl } from "@/lib/r2";
import { createServerSupabase } from "@/lib/supabase-server";
import { authErrorResponse, requirePrivyAuth } from "@/lib/privy-server";

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

function cleanText(value: FormDataEntryValue | null, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function safeObjectKeyUserId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePrivyAuth(req);
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const displayName = cleanText(formData.get("displayName"), 80);

    if (!file) {
      return NextResponse.json({ error: "Choose an image to upload" }, { status: 400 });
    }

    const ext = ALLOWED_IMAGE_TYPES[file.type];
    if (!ext) {
      return NextResponse.json({ error: "Use a JPG, PNG, GIF, or WebP image" }, { status: 400 });
    }

    // Max 2MB
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "File must be under 2MB" }, { status: 400 });
    }

    const key = `avatars/${safeObjectKeyUserId(auth.user_id)}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const publicBaseUrl = r2PublicUrl();

    await createR2Client().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        CacheControl: "public, max-age=31536000",
      })
    );

    const url = `${publicBaseUrl}/${key}`;
    const profileUpdate = {
      user_id: auth.user_id,
      ...(displayName ? { display_name: displayName } : {}),
      avatar_url: url,
      updated_at: new Date().toISOString(),
    };
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("profiles")
      .upsert(profileUpdate, { onConflict: "user_id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ url });
  } catch (e) {
    return authErrorResponse(e) ?? NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
