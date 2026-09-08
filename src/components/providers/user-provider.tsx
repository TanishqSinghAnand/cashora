"use client";

import { createContext, useContext } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import type { SessionUser } from "@/types";

interface MeResponse {
  user: SessionUser | null;
  features?: { googleSheets: boolean };
}

interface UserContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  features?: { googleSheets: boolean };
  refresh: () => void;
}

const UserContext = createContext<UserContextValue>({ user: null, isLoading: true, refresh: () => {} });

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, mutate } = useSWR<MeResponse>("/api/me", fetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: true,
  });

  return (
    <UserContext.Provider value={{ user: data?.user ?? null, isLoading, features: data?.features, refresh: () => mutate() }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
