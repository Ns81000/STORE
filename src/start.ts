import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { createHash } from "node:crypto";

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

// TanStack Start emits inline bootstrap scripts (the TSR dehydration payload)
// whose content varies per render, so a static hash cannot work. Instead every
// HTML response carries hashes computed from the inline scripts it actually
// contains -- strict, without 'unsafe-inline'. Cached pages stay consistent
// because the service worker stores header and body as one unit and never
// pre-caches dynamic routes (see public/sw.js).
const CSP_DIRECTIVES = [
  "default-src 'self'",
  // Fonts are self-hosted (public/fonts, @font-face in styles.css); the inline
  // allowance covers Tailwind's runtime style injections only.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

function scriptHashes(html: string): string[] {
  const hashes = new Set<string>();
  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    const code = match[1];
    if (code && code.trim().length > 0) {
      hashes.add(`'sha256-${createHash("sha256").update(code, "utf8").digest("base64")}'`);
    }
  }
  return [...hashes];
}

const isDev = process.env["NODE_ENV"] === "development";

const cspMiddleware = createMiddleware().server(async ({ next }) => {
  if (isDev) return next(); // Vite's HMR preamble needs inline scripts.
  const result = await next();
  const response = result.response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/json")) {
    return result;
  }
  const headers = new Headers(response.headers);
  // GET server functions must never be satisfied from the browser cache.
  headers.set("cache-control", "no-store");
  if (contentType.includes("text/html")) {
    const html = await response.text();
    const hashes = scriptHashes(html);
    headers.set(
      "content-security-policy",
      [
        "default-src 'self'",
        `script-src 'self'${hashes.length > 0 ? ` ${hashes.join(" ")}` : ""}`,
        ...CSP_DIRECTIVES.slice(1),
      ].join("; "),
    );
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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
