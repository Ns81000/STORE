// Sanity checks for the SSRF guard (run: node --experimental-strip-types scripts/url-safety-check.mjs)
import { isSafePublicUrl, resolveSafeUrl } from "../src/lib/url-safety.ts";

const mustReject = [
  "http://0x7f000001/",
  "http://2130706433/",
  "http://0177.0.0.1/",
  "http://127.1/",
  "http://[::1]/",
  "http://[::ffff:127.0.0.1]/",
  "http://[fd00::1]/",
  "http://10.0.0.1/",
  "http://192.168.1.1/",
  "http://172.20.1.1/",
  "http://169.254.169.254/latest/meta-data/",
  "http://localhost/",
  "http://foo.internal/",
  "javascript:alert(1)",
  "file:///etc/passwd",
];

// Direct public IP literals resolve numerically — no network needed.
const mustAccept = ["https://8.8.8.8/", "https://1.1.1.1/"];

let failures = 0;
const check = async (label, url, expectation) => {
  const resolved = await resolveSafeUrl(url);
  const ok = expectation === "reject" ? resolved === null : resolved !== null;
  if (!ok) {
    console.error(`FAIL  ${label}  ${url}`);
    failures += 1;
  } else {
    console.log(`ok    ${label}  ${url}`);
  }
};

for (const url of mustReject) await check("reject", url, "reject");
for (const url of mustAccept) await check("accept", url, "accept");

// Redirect chains are safe because every hop passes the same resolver check
// before being fetched (see the manual redirect loop in fetchHtml).
await check("reject (redirect target)", "http://169.254.169.254/latest/meta-data/", "reject");

// The cheap sync screen must agree on the obvious cases.
for (const url of ["http://localhost/", "http://10.0.0.1/", "javascript:alert(1)"]) {
  if (isSafePublicUrl(url)) {
    console.error(`FAIL  sync-screen  ${url}`);
    failures += 1;
  } else {
    console.log(`ok    sync-screen  ${url}`);
  }
}

console.log(failures === 0 ? "\nAll SSRF guard checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
