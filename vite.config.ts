import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

const isDev = process.env["NODE_ENV"] === "development";

// Security headers on every production response (build spec §3.5). Skipped in
// dev so Vite's inline HMR preamble and websockets aren't blocked by the CSP.
// script-src stays strict ('self'); TanStack Start emits module scripts and
// streams dehydration data via custom elements, not inline scripts.
const securityRouteRules = isDev
  ? {}
  : {
      "/**": {
        headers: {
          "content-security-policy": [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' data: https://fonts.gstatic.com",
            "img-src 'self' data: blob: https:",
            "connect-src 'self' https: data: blob:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
          ].join("; "),
          "x-frame-options": "DENY",
          "x-content-type-options": "nosniff",
          "referrer-policy": "strict-origin-when-cross-origin",
        },
      },
    };

export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart(),
    nitro({
      // Official Nitro Vercel preset (Build Output API). Vercel's TanStack
      // Start support deploys this with zero configuration.
      preset: "vercel",
      routeRules: securityRouteRules,
    }),
    viteReact(),
  ],
});
