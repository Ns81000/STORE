/**
 * CSP self-check: fetches a URL, recomputes sha256 of every inline script in
 * the HTML body, and verifies each hash appears in the content-security-policy
 * response header. Proves (or disproves) that a served document is internally
 * consistent.
 *
 * Usage: node scripts/dev/verify-csp.mjs [url]
 */
import { createHash } from "node:crypto";

const url = process.argv[2] ?? "http://localhost:3000/";

const res = await fetch(url, { redirect: "manual" });
const csp = res.headers.get("content-security-policy") ?? "";
const html = await res.text();

console.log(`URL: ${url}`);
console.log(`status: ${res.status}`);
if (!csp) {
  console.log("NO content-security-policy header present!");
  process.exit(1);
}
console.log(`policy: ${csp}\n`);

const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let index = 0;
let consistent = true;

while ((match = re.exec(html))) {
  const code = match[1];
  if (!code.trim()) continue;
  index += 1;
  const hash =
    "'sha256-" + createHash("sha256").update(code, "utf8").digest("base64") + "'";
  const ok = csp.includes(hash);
  consistent &&= ok;
  console.log(`inline #${index}: ${hash}`);
  console.log(`  -> ${ok ? "present in header" : "MISSING FROM HEADER"}`);
}

console.log(`\ninline scripts found: ${index}`);
console.log(
  consistent && index > 0
    ? "RESULT: CONSISTENT - header covers every inline script in this document."
    : "RESULT: MISMATCH - this document would break under its own CSP.",
);

// Browser-fidelity check: inside a classic <script>, the sequence "<!--"
// switches the HTML parser into "script data escaped" state where "</script>"
// no longer terminates the element until a "-->" appears. A naive regex misses
// this, so a payload containing "<!--" makes the browser execute a DIFFERENT
// (larger) script than the one that was hashed -> guaranteed CSP block.
console.log("\n--- browser-parser hazard scan ---");
let hazards = 0;
const rawMatches = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
console.log(`total <script tags in raw HTML: ${(html.match(/<script/gi) ?? []).length}`);
rawMatches.forEach((body, i) => {
  const opens = (body.match(/<!--/g) ?? []).length;
  const closes = (body.match(/-->/g) ?? []).length;
  if (opens > 0 || closes > 0) {
    hazards += 1;
    console.log(
      `inline #${i + 1}: contains ${opens}x "<!--" and ${closes}x "-->"` +
        " -> parser state diverges from regex-based hashing!",
    );
    const spot = body.indexOf("<!--");
    console.log(`   context: ...${body.slice(Math.max(0, spot - 60), spot + 40)}...`);
  }
});
if (hazards === 0) {
  console.log("no <!--/--> sequences inside inline scripts.");
}

// CR-normalization check: browsers normalize \r\n and bare \r to \n across the
// whole document INCLUDING script text before executing it. If a script body
// contains any \r, the browser executes different bytes than were hashed.
console.log("\n--- carriage-return scan ---");
let crFound = false;
rawMatches.forEach((body, i) => {
  const cr = (body.match(/\r/g) ?? []).length;
  console.log(`inline #${i + 1}: ${cr} CR characters`);
  if (cr > 0) crFound = true;
});
const crInHtml = (html.match(/\r/g) ?? []).length;
console.log(`CR characters in entire HTML: ${crInHtml}`);
if (crFound || crInHtml > 0) {
  console.log(
    "\nCONFIRMED: CR present - browser normalizes it away, so executed bytes" +
      " differ from hashed bytes. This explains the CSP block.",
  );
}
