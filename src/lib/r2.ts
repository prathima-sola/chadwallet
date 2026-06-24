import { S3Client } from "@aws-sdk/client-s3";

export const R2_BUCKET = "chadwallet-avatars";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function createR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: requiredEnv("CLOUDFLARE_R2_ENDPOINT"),
    credentials: {
      accessKeyId: requiredEnv("CLOUDFLARE_R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    },
  });
}

export function r2PublicUrl() {
  return requiredEnv("CLOUDFLARE_R2_PUBLIC_URL").replace(/\/$/, "");
}
