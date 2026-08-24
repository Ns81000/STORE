import bcrypt from "bcryptjs";
import { getRequestHeader } from "@tanstack/react-start/server";
import { closeSession, currentSession, openSession, sessionExpiryFrom } from "./session.server";
import {
  clearAttempts,
  globalLockoutRemainingMs,
  lockoutRemainingMs,
  recordFailedAttempt,
  recordGlobalFailedAttempt,
} from "./store.server";

export type UnlockResult = { ok: boolean; lockedForMs: number };
export type SessionState = { unlocked: boolean; expiresAt: number | null };

// Vercel sets x-real-ip and Cloudflare sets cf-connecting-ip; both strip
// client-supplied values. x-forwarded-for is only trusted when the deployment
// declares how many appending proxies sit in front of the app (TRUSTED_PROXIES);
// the documented deploy target (Vercel) needs none.
const TRUSTED_PROXIES = Number.parseInt(process.env["TRUSTED_PROXIES"] ?? "0", 10) || 0;

function requesterIp(): string {
  const platform = getRequestHeader("x-real-ip") ?? getRequestHeader("cf-connecting-ip");
  if (platform) return platform;
  if (TRUSTED_PROXIES > 0) {
    const forwarded = getRequestHeader("x-forwarded-for")
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (forwarded?.length)
      return forwarded[Math.max(0, forwarded.length - TRUSTED_PROXIES)] ?? "unknown";
  }
  return "unknown";
}

export async function attemptUnlock(password: string): Promise<UnlockResult> {
  const ip = requesterIp();

  const lockedForMs = await lockoutRemainingMs(ip);
  if (lockedForMs > 0) return { ok: false, lockedForMs };

  // IP-agnostic budget: rotating source IPs must not buy unlimited guesses
  // against the single shared password.
  const globalLockedForMs = await globalLockoutRemainingMs();
  if (globalLockedForMs > 0) return { ok: false, lockedForMs: globalLockedForMs };

  const expectedHash = process.env["AUTH_PASSWORD_HASH"];
  if (!expectedHash) {
    console.error(
      "AUTH_PASSWORD_HASH is not set — unlocking is disabled. Generate one with `pnpm hash-password`.",
    );
    return { ok: false, lockedForMs: 0 };
  }

  // bcrypt.compare is constant-time over the hash; no plaintext is ever stored.
  if (!(await bcrypt.compare(password, expectedHash))) {
    await Promise.all([recordFailedAttempt(ip), recordGlobalFailedAttempt()]);
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
