"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState, useRef } from "react";
import { useAvatar } from "@/lib/avatar-context";

export default function ProfilePage() {
  const { user, ready, authenticated, getAccessToken } = usePrivy();
  const { avatarUrl, setAvatarUrl } = useAvatar();
  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const userId = user?.id;
  const email = user?.google?.email ?? user?.email?.address ?? null;
  const fallbackDisplayName = user?.google?.name ?? email?.split("@")[0] ?? "Anonymous";
  const displayName = displayNameInput.trim() || fallbackDisplayName;

  useEffect(() => {
    if (!authenticated || !userId) return;
    let cancelled = false;

    async function loadProfile() {
      try {
        const token = await getAccessToken();
        const res = await fetch("/api/profile", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        const savedName = typeof data.profile?.display_name === "string" ? data.profile.display_name : null;
        if (!cancelled) setDisplayNameInput(savedName ?? fallbackDisplayName);
      } catch {
        if (!cancelled) setDisplayNameInput(fallbackDisplayName);
      }
    }

    const timer = setTimeout(() => void loadProfile(), 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [authenticated, fallbackDisplayName, getAccessToken, userId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setUploading(true);
      setError(null);
      setSuccessMessage(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("displayName", displayName);

      const token = await getAccessToken();
      const res = await fetch("/api/avatar/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Refresh navbar and profile together.
      setAvatarUrl(data.url);
      setSuccessMessage("Profile photo updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const token = await getAccessToken();
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ display_name: displayNameInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to save profile");
      setDisplayNameInput(data.profile?.display_name ?? fallbackDisplayName);
      setSuccessMessage("Profile saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingProfile(false);
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
            // eslint-disable-next-line @next/next/no-img-element
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "120px 1fr auto",
            gap: 12,
            alignItems: "center",
            padding: "14px 16px",
            borderBottom: "1px solid var(--cw-border)",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--cw-dim)" }}>Display name</span>
          <input
            value={displayNameInput}
            onChange={(e) => {
              setDisplayNameInput(e.target.value);
              setSuccessMessage(null);
            }}
            maxLength={80}
            style={{
              minWidth: 0,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--cw-border)",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
              padding: "8px 10px",
              outline: "none",
            }}
          />
          <button
            onClick={saveProfile}
            disabled={savingProfile}
            style={{
              fontSize: 12,
              padding: "8px 12px",
              borderRadius: 8,
              border: "none",
              backgroundColor: "var(--cw-accent)",
              color: "#080404",
              cursor: savingProfile ? "wait" : "pointer",
              opacity: savingProfile ? 0.65 : 1,
            }}
          >
            {savingProfile ? "Saving..." : "Save"}
          </button>
        </div>

        {[
          { label: "Email", value: email ?? "-" },
          { label: "User ID", value: userId ? `${userId.slice(0, 16)}...` : "-" },
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

      {successMessage && (
        <div style={{ marginTop: 16, fontSize: 13, color: "var(--cw-green)" }}>
          {successMessage}
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
