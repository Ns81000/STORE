import { getRequestHeader } from "@tanstack/react-start/server";
import {
  closeSession,
  currentSession,
  openSession,
  passwordMatches,
  sessionExpiryFrom,
} from "./session.server";
import { clearAttempts, lockoutRemainingMs, recordFailedAttempt } from "./store.server";

export type UnlockResult = { ok: boolean; lockedForMs: number };
export type SessionState = { unlocked: boolean; expiresAt: number | null };

function requesterIp(): string {
  return (
    getRequestHeader("cf-connecting-ip") ??
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function attemptUnlock(password: string): Promise<UnlockResult> {
  const ip = requesterIp();

  const lockedForMs = await lockoutRemainingMs(ip);
  if (lockedForMs > 0) return { ok: false, lockedForMs };

  const expected = process.env["STORE_PASSWORD"];
  if (!expected || !passwordMatches(password, expected)) {
    await recordFailedAttempt(ip);
    return { ok: false, lockedForMs: 0 };
  }

  await clearAttempts(ip);
  await openSession();
  return { ok: true, lockedForMs: 0 };
}

export async function readSessionState(): Promise<SessionState> {
  const session = await currentSession();
  if (!session?.unlockedAt) return { unlocked: false, expiresAt: null };
  return { unlocked: true, expiresAt: sessionExpiryFrom(session.unlockedAt) };
}

export async function endSession(): Promise<{ ok: true }> {
  await closeSession();
  return { ok: true };
}
