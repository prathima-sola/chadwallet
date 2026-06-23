"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAvatar } from "@/lib/avatar-context";

export default function ProfilePage() {
  const { user, ready, authenticated } = usePrivy();
  const { avatarUrl, setAvatarUrl } = useAvatar();
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const userId = user?.id;
  const email = user?.google?.email ?? user?.email?.address ?? null;
  const displayName = user?.google?.name ?? email?.split("@")[0] ?? "Anonymous";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setUploading(true);
    setError(null);
    setSaved(false);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("userId", userId);

      const res = await fetch("/api/avatar/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("profiles") as any).upsert(
        { user_id: userId, avatar_url: data.url, display_name: displayName },
        { onConflict: "user_id" }
      );

      // Update globally — navbar + profile both refresh
      setAvatarUrl(data.url);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  if (!ready) return null;

  if (!authenticated) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--cw-muted)" }}>
        Connect your wallet to view your profile.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "48px auto", padding: "0 20px" }}>

      {/* Lightbox */}
      {preview && avatarUrl && (
        <div
          onClick={() => setPreview(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            backgroundColor: "rgba(0,0,0,0.9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          <img
            src={avatarUrl}
            alt="Profile photo"
            style={{ maxWidth: "80vw", maxHeight: "80vh", borderRadius: 12, objectFit: "contain" }}
          />
        </div>
      )}

      <h1 style={{ fontSize: 18, fontWeight: 500, color: "#fff", marginBottom: 32 }}>
        Profile
      </h1>

      {/* Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
        <div
          onClick={() => { if (avatarUrl) setPreview(true); }}
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            overflow: "hidden",
            backgroundColor: "rgba(0,217,126,0.1)",
            border: "2px solid var(--cw-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            cursor: avatarUrl ? "zoom-in" : "default",
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 28, color: "var(--cw-accent)" }}>
              {displayName?.[0]?.toUpperCase() ?? "?"}
            </span>
          )}
        </div>

        <div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              fontSize: 13,
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--cw-border)",
              backgroundColor: "rgba(255,255,255,0.04)",
              color: uploading ? "var(--cw-dim)" : "#fff",
              cursor: uploading ? "wait" : "pointer",
              display: "block",
              marginBottom: 6,
            }}
          >
            {uploading ? "Uploading..." : "Change photo"}
          </button>
          <span style={{ fontSize: 11, color: "var(--cw-dim)" }}>JPG, PNG, GIF · max 2MB</span>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>

      {/* Info */}
      <div
        style={{
          backgroundColor: "rgba(255,255,255,0.02)",
          border: "1px solid var(--cw-border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {[
          { label: "Display name", value: displayName },
          { label: "Email", value: email ?? "—" },
          { label: "User ID", value: userId ? `${userId.slice(0, 16)}...` : "—" },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 16px",
              borderBottom: "1px solid var(--cw-border)",
            }}
          >
            <span style={{ fontSize: 13, color: "var(--cw-dim)" }}>{label}</span>
            <span style={{ fontSize: 13, color: "#fff", fontFamily: label === "User ID" ? "var(--font-mono)" : "inherit" }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {saved && (
        <div style={{ marginTop: 16, fontSize: 13, color: "var(--cw-green)" }}>
          Avatar updated successfully.
        </div>
      )}
      {error && (
        <div style={{ marginTop: 16, fontSize: 13, color: "var(--cw-red)" }}>
          {error}
        </div>
      )}
    </div>
  );
}
