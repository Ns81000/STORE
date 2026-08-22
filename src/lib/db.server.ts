import { createClient, type Client } from "@libsql/client";

let cached: Client | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Set it in .env for local dev or in the Vercel project settings.`,
    );
  }
  return value;
}

/**
 * Remote Turso connections are HTTP-based, so a single client instance serves
 * every request in a serverless invocation; no pooling is needed.
 */
export function db(): Client {
  cached ??= createClient({
    url: requiredEnv("TURSO_DATABASE_URL"),
    authToken: requiredEnv("TURSO_AUTH_TOKEN"),
  });
  return cached;
}
