import { useSession } from "@tanstack/react-start/server";
import { createHash } from "node:crypto";
import { requiredEnv } from "./env.server";

export type StoreSession = { unlockedAt?: number };

const NINETY_DAYS_SECONDS = 60 * 60 * 24 * 90;
const RESEAL_INTERVAL_MS = 60 * 60 * 1000;

function sessionSecret(): string {
  return requiredEnv("SESSION_SECRET");
}

function sessionConfig() {
  return {
    password: sessionSecret(),
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
  // h3's useSession is a server request utility, not a React hook.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSession<StoreSession>(sessionConfig());
}

/** Sliding 90-day window: verified visits extend the session. */
export async function currentSession(): Promise<StoreSession | null> {
  const session = await readSession();
  const unlockedAt = session.data.unlockedAt;
  if (!unlockedAt) return null;
  if (Date.now() - unlockedAt > NINETY_DAYS_SECONDS * 1000) {
    await session.clear();
    return null;
  }
  // The cookie's maxAge already enforces the browser-side window; re-sealing
  // runs a PBKDF2 derivation, so only refresh the timestamp hourly.
  if (Date.now() - unlockedAt > RESEAL_INTERVAL_MS) {
    await session.update({ unlockedAt: Date.now() });
  }
  return { unlockedAt };
}

export class SessionExpiredError extends Error {
  statusCode = 401;
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

export function hashIp(ip: string): string {
  return createHash("sha256").update(`${sessionSecret()}:${ip}`, "utf8").digest("hex");
}
