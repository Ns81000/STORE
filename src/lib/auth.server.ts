import bcrypt from "bcryptjs";
import { getRequestHeader } from "@tanstack/react-start/server";
import { closeSession, currentSession, openSession, sessionExpiryFrom } from "./session.server";
import { clearAttempts, lockoutRemainingMs, recordFailedAttempt } from "./store.server";

export type UnlockResult = { ok: boolean; lockedForMs: number };
export type SessionState = { unlocked: boolean; expiresAt: number | null };

// Vercel sets x-real-ip; Cloudflare sets cf-connecting-ip; both strip
// client-supplied values, unlike a bare x-forwarded-for behind plain proxies.
function requesterIp(): string {
  return (
    getRequestHeader("x-real-ip") ??
    getRequestHeader("cf-connecting-ip") ??
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function attemptUnlock(password: string): Promise<UnlockResult> {
  const ip = requesterIp();

  const lockedForMs = await lockoutRemainingMs(ip);
  if (lockedForMs > 0) return { ok: false, lockedForMs };

  const expectedHash = process.env["AUTH_PASSWORD_HASH"];
  // bcrypt.compare is constant-time over the hash; no plaintext is ever stored.
  if (!expectedHash || !(await bcrypt.compare(password, expectedHash))) {
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
