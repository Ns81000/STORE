import dns from "node:dns/promises";
import { isIP } from "node:net";

const PRIVATE_HOST = /^(localhost|0\.0\.0\.0|\[?::1\]?|.*\.local|.*\.internal)$/i;
const PRIVATE_IPV4 =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

/**
 * True when the address is not globally routable: loopback, RFC1918, link
 * local (incl. cloud metadata endpoints), CGNAT, or the IPv6 equivalents.
 */
export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a = -1, b = -1] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (family === 6) {
    const lower = address.toLowerCase();
    // Leading "::" covers unspecified, loopback, and the IPv4-mapped/compatible
    // forms (which the URL parser canonicalizes to hex, e.g. ::ffff:7f00:1);
    // no globally routable address starts with a zero first group.
    if (lower.startsWith("::")) return true;
    if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    return false;
  }
  // Not an IP literal — callers only pass resolved addresses here.
  return true;
}

/** Cheap hostname-string screen; resolveSafeUrl is the real gate before fetching. */
export function isSafePublicUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname;
  if (PRIVATE_HOST.test(host)) return false;
  if (PRIVATE_IPV4.test(host)) return false;
  if (host.startsWith("[fd") || host.startsWith("[fe80")) return false;
  return true;
}

/**
 * Parses and resolves a URL, rejecting it unless every resolved address is a
 * public IP. Covers DNS rebinding (public name → private IP) and the
 * non-canonical IP literals (0x7f000001, 2130706433, 0177.0.0.1) that
 * getaddrinfo happily resolves to loopback or RFC1918 space.
 */
export async function resolveSafeUrl(raw: string): Promise<URL | null> {
  if (!isSafePublicUrl(raw)) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  const host = parsed.hostname;
  const lookupHost = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  if (isIP(lookupHost) !== 0 && isPrivateAddress(lookupHost)) return null;
  try {
    const addresses = await dns.lookup(lookupHost, { all: true });
    if (addresses.length === 0) return null;
    if (addresses.some(({ address }) => isPrivateAddress(address))) return null;
  } catch {
    return null;
  }
  return parsed;
}
