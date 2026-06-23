"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { supabase } from "@/lib/supabase";

interface AvatarContextValue {
  avatarUrl: string | null;
  setAvatarUrl: (url: string) => void;
}

const AvatarContext = createContext<AvatarContextValue>({ avatarUrl: null, setAvatarUrl: () => {} });

export function AvatarProvider({ children }: { children: React.ReactNode }) {
  const { user } = usePrivy();
  const [avatarUrl, setAvatarUrlState] = useState<string | null>(null);

  const userId = user?.id;

  // Load from Supabase when user logs in
  useEffect(() => {
    if (!userId) { setAvatarUrlState(null); return; }
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("user_id", userId)
      .single()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => {
        if (data?.avatar_url) setAvatarUrlState(data.avatar_url + "?t=" + Date.now());
      });
  }, [userId]);

  const setAvatarUrl = useCallback((url: string) => {
    setAvatarUrlState(url + "?t=" + Date.now());
  }, []);

  return (
    <AvatarContext.Provider value={{ avatarUrl, setAvatarUrl }}>
      {children}
    </AvatarContext.Provider>
  );
}

export function useAvatar() {
  return useContext(AvatarContext);
}
