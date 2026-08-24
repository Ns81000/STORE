import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { randomBytes } from "node:crypto";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error instanceof Error && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// TanStack Start emits inline bootstrap scripts dynamically during streaming
// SSR ($tsr-stream-barrier plus per-boundary completion scripts), so their
// bytes cannot be predicted and hashed. The supported pattern is a per-request
// nonce: the middleware stamps the CSP header, passes the nonce through the
// request context, and the router forwards it via ssr.nonce so every script
// and style the framework renders carries the matching attribute.
function cspFor(nonce: string): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic' is intentionally omitted: all build chunks are
    // same-origin, so 'self' keeps covering them while the nonce gates the
    // framework's inline scripts.
    `script-src 'self' 'nonce-${nonce}'`,
    // Fonts are self-hosted (public/fonts, @font-face in styles.css); the
    // inline allowance covers Tailwind's runtime style injections only.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' data: blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

const isDev = process.env["NODE_ENV"] === "development";

const cspMiddleware = createMiddleware().server(async ({ next }) => {
  if (isDev) return next(); // Vite's HMR preamble needs inline scripts.
  const nonce = randomBytes(16).toString("base64");
  const result = await next({ context: { nonce } });
  // Headers are finalized before the response body flushes, so mutating them
  // here applies to the streamed document as well.
  result.response.headers.set("content-security-policy", cspFor(nonce));
  // GET server functions must never be satisfied from the browser cache.
  result.response.headers.set("cache-control", "no-store");
  return result;
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests. Mutating requests only: same-origin GETs may
// legitimately omit the Origin header, and every GET server function here is
// read-only.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn" && ctx.request.method !== "GET",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, cspMiddleware, csrfMiddleware],
}));
