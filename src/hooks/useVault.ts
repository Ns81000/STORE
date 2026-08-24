import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listVault } from "@/lib/vault.functions";
import type { Vault } from "@/lib/store.types";

export const VAULT_KEY = ["vault"] as const;

const EMPTY_VAULT: Vault = { sections: [], svgs: [] };

/** The server throws SessionExpiredError (HTTP 401) once the signed cookie lapses. */
export function isSessionExpired(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return /\b401\b|session expired|SessionExpiredError|Unauthorized/i.test(message);
}

export function useVault() {
  const fetchVault = useServerFn(listVault);
  const navigate = useNavigate();
  const query = useQuery<Vault>({
    queryKey: VAULT_KEY,
    queryFn: () => fetchVault(),
    // The vault is only mutated from this same tab, and every mutation
    // invalidates immediately; a short staleness window keeps mounts from
    // refetching while focus still picks up external changes promptly.
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: (count, error) => !isSessionExpired(error) && count < 2,
  });

  useEffect(() => {
    if (isSessionExpired(query.error)) void navigate({ to: "/" });
  }, [query.error, navigate]);

  return { ...query, vault: query.data ?? EMPTY_VAULT };
}

export function useVaultMutation<TInput, TResult>(run: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: run,
    onError: (error) => {
      if (isSessionExpired(error)) void navigate({ to: "/" });
    },
    // Awaiting the invalidation keeps `isPending` true until the refetched
    // vault has landed, so panels close on committed data.
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: VAULT_KEY, refetchType: "all" });
    },
  });
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/** Ephemeral status line used for copy / save confirmations. */
export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1900);
    return () => window.clearTimeout(timer);
  }, [toast]);
  return { toast, setToast };
}

// localStorage throws SecurityError in locked-down privacy modes/webviews;
// preferences silently fall back to memory there.
function readStoredValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredValue(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore — persistence is unavailable.
  }
}

/** Small localStorage-backed preference, read after hydration. */
export function useStoredChoice<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    const saved = readStoredValue(key);
    if (saved && allowed.some((option) => option === saved)) setValue(saved as T);
    // `allowed` is a module-level constant at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const choose = (next: T) => {
    setValue(next);
    writeStoredValue(key, next);
  };

  return [value, choose] as const;
}
