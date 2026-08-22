import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

export type StoreSession = { unlockedAt?: number };

const NINETY_DAYS_SECONDS = 60 * 60 * 24 * 90;

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "store-session",
    maxAge: NINETY_DAYS_SECONDS,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export async function readSession() {
  return useSession<StoreSession>(sessionConfig());
}

/** Sliding 90-day window: every verified visit extends the session. */
export async function currentSession(): Promise<StoreSession | null> {
  const session = await readSession();
  const unlockedAt = session.data.unlockedAt;
  if (!unlockedAt) return null;
  if (Date.now() - unlockedAt > NINETY_DAYS_SECONDS * 1000) {
    await session.clear();
    return null;
  }
  await session.update({ unlockedAt: Date.now() });
  return { unlockedAt };
}

export class SessionExpiredError extends Error {
  constructor() {
    super("session expired");
    this.name = "SessionExpiredError";
  }
}

export async function requireUnlocked(): Promise<void> {
  const session = await currentSession();
  if (!session) throw new SessionExpiredError();
}

export async function openSession(): Promise<void> {
  const session = await readSession();
  await session.update({ unlockedAt: Date.now() });
}

export async function closeSession(): Promise<void> {
  const session = await readSession();
  await session.clear();
}

export function sessionExpiryFrom(unlockedAt: number): number {
  return unlockedAt + NINETY_DAYS_SECONDS * 1000;
}

/**
 * Hash both sides to fixed-length digests before comparing: timingSafeEqual
 * throws on a length mismatch and raw length would leak through timing.
 */
export function passwordMatches(input: string, expected: string): boolean {
  const given = createHash("sha256").update(input, "utf8").digest();
  const wanted = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(given, wanted);
}

export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${process.env["SESSION_SECRET"]!}:${ip}`, "utf8")
    .digest("hex");
}
