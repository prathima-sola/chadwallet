"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";

interface AvatarContextValue {
  avatarUrl: string | null;
  displayName: string | null;
  setAvatarUrl: (url: string) => void;
  setDisplayName: (name: string | null) => void;
}

const AvatarContext = createContext<AvatarContextValue>({
  avatarUrl: null,
  displayName: null,
  setAvatarUrl: () => {},
  setDisplayName: () => {},
});

export function AvatarProvider({ children }: { children: React.ReactNode }) {
  const { user, getAccessToken } = usePrivy();
  const [avatarUrl, setAvatarUrlState] = useState<string | null>(null);
  const [displayName, setDisplayNameState] = useState<string | null>(null);

  const userId = user?.id;

  // Load persisted avatar after Privy identifies the user.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!userId) {
        setAvatarUrlState(null);
        setDisplayNameState(null);
        return;
      }

      try {
        const token = await getAccessToken();
        const res = await fetch("/api/profile", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!cancelled) {
          setAvatarUrlState(data.profile?.avatar_url ? `${data.profile.avatar_url}?t=${Date.now()}` : null);
          setDisplayNameState(typeof data.profile?.display_name === "string" ? data.profile.display_name : null);
        }
      } catch {
        if (!cancelled) {
          setAvatarUrlState(null);
          setDisplayNameState(null);
        }
      }
    };

    const timer = setTimeout(() => void load(), 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [getAccessToken, userId]);

  const setAvatarUrl = useCallback((url: string) => {
    setAvatarUrlState(url + "?t=" + Date.now());
  }, []);

  const setDisplayName = useCallback((name: string | null) => {
    const cleaned = typeof name === "string" ? name.trim() : null;
    setDisplayNameState(cleaned || null);
  }, []);

  return (
    <AvatarContext.Provider value={{ avatarUrl, displayName, setAvatarUrl, setDisplayName }}>
      {children}
    </AvatarContext.Provider>
  );
}

export function useAvatar() {
  return useContext(AvatarContext);
}
