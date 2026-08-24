/** Fails fast with a descriptive error when a required env var is missing. */
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Set it in .env for local dev or in the Vercel project settings.`,
    );
  }
  return value;
}
