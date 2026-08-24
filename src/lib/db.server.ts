import { createClient, type Client } from "@libsql/client";
import { requiredEnv } from "./env.server";

let cached: Client | null = null;

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
