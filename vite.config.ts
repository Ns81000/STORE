import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

const isDev = process.env["NODE_ENV"] === "development";

// Security headers on every production response (build spec §3.5). Skipped in
// dev so Vite's inline HMR preamble and websockets aren't blocked by the CSP.
// The CSP itself is computed per response in src/start.ts — it carries hashes
// of the framework's inline dehydration script, which varies per render.
const securityRouteRules = isDev
  ? {}
  : {
      "/**": {
        headers: {
          "x-frame-options": "DENY",
          "x-content-type-options": "nosniff",
          "referrer-policy": "strict-origin-when-cross-origin",
          "strict-transport-security": "max-age=31536000; includeSubDomains",
          "permissions-policy": "camera=(), microphone=(), geolocation=()",
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
