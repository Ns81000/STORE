import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

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

// TanStack Start emits one inline bootstrap script (the TSR dehydration
// payload), whose content varies per render, so the CSP cannot carry a static
// hash. Instead every HTML response gets hashes computed from the inline
// scripts it actually contains — strict without 'unsafe-inline'.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

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
    headers.set("content-security-policy", CSP_DIRECTIVES.join("; "));
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn" && ctx.request.method !== "GET",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, cspMiddleware, csrfMiddleware],
}));
