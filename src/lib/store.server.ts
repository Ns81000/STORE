import type { InStatement, Row, Value } from "@libsql/client";
import { db } from "./db.server";
import { hashIp } from "./session.server";
import { isSafePublicUrl, resolveSafeUrl } from "./url-safety";
import {
  MAX_SECTIONS,
  SECTION_COLORS,
  coerceColor,
  domainOf,
  type ActionMode,
  type Asset,
  type AssetRow,
  type Section,
  type SectionColor,
  type SvgIcon,
  type Vault,
} from "./store.types";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function newId(): string {
  // Rejection-sample so every character is uniformly likely (256 % 36 != 0).
  let out = "";
  while (out.length < 16) {
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    for (const byte of bytes) {
      if (byte >= 252) continue;
      out += ALPHABET[byte % ALPHABET.length]!;
      if (out.length === 16) break;
    }
  }
  return out;
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length > 0 ? base : `section-${newId().slice(0, 6)}`;
}

/* ---------- row decoding ---------- */

function optionalText(value: Value | undefined): string | null {
  return value === undefined || value === null ? null : String(value);
}

function requiredText(value: Value | undefined, column: string): string {
  if (value === undefined || value === null) {
    throw new Error(`Corrupt database row: expected text in column "${column}"`);
  }
  return String(value);
}

function requiredInteger(value: Value | undefined, column: string): number {
  if (value === undefined || value === null) {
    throw new Error(`Corrupt database row: expected integer in column "${column}"`);
  }
  return Number(value);
}

type SectionRecord = {
  id: string;
  name: string;
  slug: string;
  colorToken: string;
  svgUrl: string | null;
  sortOrder: number;
};

function sectionRecord(row: Row): SectionRecord {
  return {
    id: requiredText(row["id"], "id"),
    name: requiredText(row["name"], "name"),
    slug: requiredText(row["slug"], "slug"),
    colorToken: requiredText(row["color_token"], "color_token"),
    svgUrl: optionalText(row["svg_url"]),
    sortOrder: requiredInteger(row["sort_order"], "sort_order"),
  };
}

type AssetRecord = {
  id: string;
  sectionId: string;
  url: string;
  title: string | null;
  iconSvgUrl: string | null;
  previewEnabled: boolean;
  actionMode: ActionMode;
  sortOrder: number;
};

function assetRecord(row: Row): AssetRecord {
  return {
    id: requiredText(row["id"], "id"),
    sectionId: requiredText(row["section_id"], "section_id"),
    url: requiredText(row["url"], "url"),
    title: optionalText(row["title"]),
    iconSvgUrl: optionalText(row["icon_svg_url"]),
    previewEnabled: requiredInteger(row["preview_enabled"], "preview_enabled") === 1,
    actionMode: requiredText(row["action_mode"], "action_mode") === "copy" ? "copy" : "open",
    sortOrder: requiredInteger(row["sort_order"], "sort_order"),
  };
}

type PreviewRecord = {
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  ogSiteName: string | null;
  status: string;
  fetchedAt: number;
  errorMessage: string | null;
};

function previewRecord(row: Row): PreviewRecord {
  return {
    ogTitle: optionalText(row["og_title"]),
    ogDescription: optionalText(row["og_description"]),
    ogImageUrl: optionalText(row["og_image_url"]),
    ogSiteName: optionalText(row["og_site_name"]),
    status: requiredText(row["status"], "status"),
    fetchedAt: requiredInteger(row["fetched_at"], "fetched_at"),
    errorMessage: optionalText(row["error_message"]),
  };
}

type AssetLinkRecord = {
  id: string;
  assetId: string;
  svgUrl: string | null;
  label: string | null;
  url: string;
  mode: ActionMode;
  sortOrder: number;
};

function assetLinkRecord(row: Row): AssetLinkRecord {
  return {
    id: requiredText(row["id"], "id"),
    assetId: requiredText(row["asset_id"], "asset_id"),
    svgUrl: optionalText(row["svg_url"]),
    label: optionalText(row["label"]),
    url: requiredText(row["url"], "url"),
    mode: requiredText(row["mode"], "mode") === "copy" ? "copy" : "open",
    sortOrder: requiredInteger(row["sort_order"], "sort_order"),
  };
}

type SvgRecord = { id: string; name: string; url: string; sortOrder: number };

function svgRecord(row: Row): SvgRecord {
  return {
    id: requiredText(row["id"], "id"),
    name: requiredText(row["name"], "name"),
    url: requiredText(row["url"], "url"),
    sortOrder: requiredInteger(row["sort_order"], "sort_order"),
  };
}

/* ---------- reads ---------- */

export async function uniqueSlug(name: string, ignoreId?: string): Promise<string> {
  const base = slugify(name);
  const result = await db().execute("SELECT id, slug FROM sections");
  const taken = new Set(
    result.rows
      .filter((row) => requiredText(row["id"], "id") !== ignoreId)
      .map((row) => requiredText(row["slug"], "slug")),
  );
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export async function nextSectionColor(): Promise<SectionColor> {
  const result = await db().execute("SELECT color_token FROM sections");
  const used = new Set(result.rows.map((row) => String(row["color_token"])));
  return SECTION_COLORS.find((color) => !used.has(color)) ?? SECTION_COLORS[0];
}

export async function sectionCount(): Promise<number> {
  const result = await db().execute("SELECT COUNT(*) AS count FROM sections");
  return requiredInteger(result.rows[0]?.["count"], "count");
}

export async function nextSectionOrder(): Promise<number> {
  const result = await db().execute(
    "SELECT sort_order FROM sections ORDER BY sort_order DESC LIMIT 1",
  );
  const top = result.rows[0];
  return (top ? requiredInteger(top["sort_order"], "sort_order") : -1) + 1;
}

export async function nextAssetOrder(sectionId: string): Promise<number> {
  const result = await db().execute({
    sql: "SELECT sort_order FROM assets WHERE section_id = ? ORDER BY sort_order DESC LIMIT 1",
    args: [sectionId],
  });
  const top = result.rows[0];
  return (top ? requiredInteger(top["sort_order"], "sort_order") : -1) + 1;
}

export async function loadVault(): Promise<Vault> {
  const [sectionResult, assetResult, previewResult, linkResult, svgResult] = await Promise.all([
    db().execute("SELECT * FROM sections ORDER BY sort_order"),
    db().execute("SELECT * FROM assets ORDER BY sort_order"),
    db().execute("SELECT * FROM preview_cache"),
    db().execute("SELECT * FROM asset_rows ORDER BY sort_order"),
    db().execute("SELECT * FROM svg_library ORDER BY sort_order"),
  ]);

  const previews = new Map(
    previewResult.rows.map((row) => {
      const record = previewRecord(row);
      return [requiredText(row["asset_id"], "asset_id"), record] as const;
    }),
  );

  const rowsByAsset = new Map<string, AssetRow[]>();
  for (const row of linkResult.rows) {
    const record = assetLinkRecord(row);
    const bucket = rowsByAsset.get(record.assetId) ?? [];
    bucket.push({
      id: record.id,
      svgUrl: record.svgUrl,
      label: record.label,
      url: record.url,
      mode: record.mode,
      sortOrder: record.sortOrder,
    });
    rowsByAsset.set(record.assetId, bucket);
  }

  const assetsBySection = new Map<string, Asset[]>();
  for (const row of assetResult.rows) {
    const record = assetRecord(row);
    const cached = previews.get(record.id);
    const asset: Asset = {
      id: record.id,
      sectionId: record.sectionId,
      url: record.url,
      title: record.title,
      iconSvgUrl: record.iconSvgUrl,
      previewEnabled: record.previewEnabled,
      actionMode: record.actionMode,
      sortOrder: record.sortOrder,
      rows: rowsByAsset.get(record.id) ?? [],
      preview: cached
        ? {
            ogTitle: cached.ogTitle,
            ogDescription: cached.ogDescription,
            ogImageUrl: cached.ogImageUrl,
            ogSiteName: cached.ogSiteName,
            status:
              cached.status === "ok" || cached.status === "failed" ? cached.status : "pending",
            fetchedAt: cached.fetchedAt,
            errorMessage: cached.errorMessage,
          }
        : null,
    };
    const bucket = assetsBySection.get(record.sectionId) ?? [];
    bucket.push(asset);
    assetsBySection.set(record.sectionId, bucket);
  }

  const sections: Section[] = sectionResult.rows.map((row, index) => {
    const record = sectionRecord(row);
    return {
      id: record.id,
      name: record.name,
      slug: record.slug,
      colorToken: coerceColor(record.colorToken, index),
      svgUrl: record.svgUrl,
      sortOrder: record.sortOrder,
      assets: assetsBySection.get(record.id) ?? [],
    };
  });

  const svgs: SvgIcon[] = svgResult.rows.map((row) => {
    const record = svgRecord(row);
    return { id: record.id, name: record.name, url: record.url, sortOrder: record.sortOrder };
  });

  return { sections, svgs };
}

/* ---------- assets ---------- */

export type RowInput = {
  svgUrl: string | null;
  label: string | null;
  url: string;
  mode: ActionMode;
};

export type AssetInput = {
  sectionId: string;
  url: string;
  title: string | null;
  iconSvgUrl: string | null;
  previewEnabled: boolean;
  actionMode: ActionMode;
  rows: readonly RowInput[];
  prefetchedPreview?: ScrapeResult | undefined;
};

const INSERT_ASSET_ROW =
  "INSERT INTO asset_rows (id, asset_id, svg_url, label, url, mode, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

const PREVIEW_UPSERT_SQL = `INSERT INTO preview_cache (asset_id, og_title, og_description, og_image_url, og_site_name, status, fetched_at, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(asset_id) DO UPDATE SET
        og_title = excluded.og_title,
        og_description = excluded.og_description,
        og_image_url = excluded.og_image_url,
        og_site_name = excluded.og_site_name,
        status = excluded.status,
        fetched_at = excluded.fetched_at,
        error_message = excluded.error_message`;

function mshotsUrl(url: string): string {
  return `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=960`;
}

function rowStatements(assetId: string, rows: readonly RowInput[], now: number): InStatement[] {
  return rows.map((row, index) => ({
    sql: INSERT_ASSET_ROW,
    args: [newId(), assetId, row.svgUrl, row.label, row.url, row.mode, index, now, now],
  }));
}

export async function insertAsset(input: AssetInput): Promise<string> {
  const id = newId();
  const now = Date.now();

  const screenshotUrl = isSafePublicUrl(input.url) ? mshotsUrl(input.url) : null;

  const statements: InStatement[] = [
    {
      sql: `INSERT INTO assets (id, section_id, url, title, icon_svg_url, preview_enabled, action_mode, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM assets WHERE section_id = ?), 0), ?, ?)`,
      args: [
        id,
        input.sectionId,
        input.url,
        input.title,
        input.iconSvgUrl,
        input.previewEnabled ? 1 : 0,
        input.actionMode,
        input.sectionId,
        now,
        now,
      ],
    },
    ...rowStatements(id, input.rows, now),
  ];

  if (input.previewEnabled && input.prefetchedPreview) {
    statements.push({
      sql: PREVIEW_UPSERT_SQL,
      args: [
        id,
        input.prefetchedPreview.ogTitle,
        input.prefetchedPreview.ogDescription,
        input.prefetchedPreview.ogImageUrl,
        input.prefetchedPreview.ogSiteName,
        input.prefetchedPreview.status,
        now,
        input.prefetchedPreview.errorMessage,
      ],
    });
  } else if (input.previewEnabled && screenshotUrl) {
    statements.push({
      sql: PREVIEW_UPSERT_SQL,
      args: [
        id,
        input.title || prettyDomainTitle(input.url),
        null,
        screenshotUrl,
        domainOf(input.url),
        "ok",
        now,
        null,
      ],
    });
  }

  await db().batch(statements, "write");
  return id;
}

export async function updateAsset(id: string, input: AssetInput): Promise<void> {
  const now = Date.now();
  const screenshotUrl = isSafePublicUrl(input.url) ? mshotsUrl(input.url) : null;

  const statements: InStatement[] = [
    {
      sql: "UPDATE assets SET url = ?, title = ?, icon_svg_url = ?, preview_enabled = ?, action_mode = ?, updated_at = ? WHERE id = ?",
      args: [
        input.url,
        input.title,
        input.iconSvgUrl,
        input.previewEnabled ? 1 : 0,
        input.actionMode,
        now,
        id,
      ],
    },
    { sql: "DELETE FROM asset_rows WHERE asset_id = ?", args: [id] },
    ...rowStatements(id, input.rows, now),
  ];

  if (input.previewEnabled && input.prefetchedPreview) {
    statements.push({
      sql: PREVIEW_UPSERT_SQL,
      args: [
        id,
        input.prefetchedPreview.ogTitle,
        input.prefetchedPreview.ogDescription,
        input.prefetchedPreview.ogImageUrl,
        input.prefetchedPreview.ogSiteName,
        input.prefetchedPreview.status,
        now,
        input.prefetchedPreview.errorMessage,
      ],
    });
  } else if (input.previewEnabled && screenshotUrl) {
    statements.push({
      sql: `INSERT INTO preview_cache (asset_id, og_title, og_description, og_image_url, og_site_name, status, fetched_at, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(asset_id) DO UPDATE SET
              og_title = COALESCE(preview_cache.og_title, excluded.og_title),
              og_description = NULL,
              og_image_url = CASE 
                WHEN preview_cache.og_image_url IS NULL OR preview_cache.og_image_url LIKE '%mshots%' 
                THEN excluded.og_image_url 
                ELSE preview_cache.og_image_url 
              END,
              og_site_name = COALESCE(preview_cache.og_site_name, excluded.og_site_name),
              status = excluded.status,
              fetched_at = excluded.fetched_at,
              error_message = excluded.error_message`,
      args: [
        id,
        input.title || prettyDomainTitle(input.url),
        null,
        screenshotUrl,
        domainOf(input.url),
        "ok",
        now,
        null,
      ],
    });
  } else if (!input.previewEnabled) {
    statements.push({
      sql: "DELETE FROM preview_cache WHERE asset_id = ?",
      args: [id],
    });
  }

  await db().batch(statements, "write");
}

export async function applyOrder(
  table: "sections" | "assets",
  ids: readonly string[],
): Promise<void> {
  const target = table === "sections" ? "sections" : "assets";
  const now = Date.now();
  await db().batch(
    ids.map((id, index) => ({
      sql: `UPDATE ${target} SET sort_order = ?, updated_at = ? WHERE id = ?`,
      args: [index, now, id],
    })),
    "write",
  );
}

/* ---------- svg library ---------- */

export async function createSvg(name: string, url: string): Promise<string> {
  const result = await db().execute(
    "SELECT sort_order FROM svg_library ORDER BY sort_order DESC LIMIT 1",
  );
  const top = result.rows[0];
  const id = newId();
  const now = Date.now();
  await db().execute({
    sql: "INSERT INTO svg_library (id, name, url, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [
      id,
      name,
      url,
      (top ? requiredInteger(top["sort_order"], "sort_order") : -1) + 1,
      now,
      now,
    ],
  });
  return id;
}

export async function updateSvg(id: string, name: string, url: string): Promise<void> {
  await db().execute({
    sql: "UPDATE svg_library SET name = ?, url = ?, updated_at = ? WHERE id = ?",
    args: [name, url, Date.now(), id],
  });
}

export async function deleteSvg(id: string): Promise<void> {
  await db().execute({ sql: "DELETE FROM svg_library WHERE id = ?", args: [id] });
}

/* ---------- rate limiting ---------- */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_GLOBAL_ATTEMPTS = 50;
// Hashed like an IP so the row is indistinguishable from per-IP buckets.
export const GLOBAL_LOCKOUT_KEY = "__global__";

async function lockoutRemainingForKey(keyHash: string, max: number): Promise<number> {
  const result = await db().execute({
    sql: "SELECT attempted_at FROM login_attempts WHERE ip_hash = ? AND attempted_at >= ? ORDER BY attempted_at ASC",
    args: [keyHash, Date.now() - WINDOW_MS],
  });
  const attempts = result.rows.map((row) => requiredInteger(row["attempted_at"], "attempted_at"));
  if (attempts.length < max) return 0;
  const oldest = attempts[attempts.length - max] ?? Date.now();
  return Math.max(0, oldest + WINDOW_MS - Date.now());
}

export async function lockoutRemainingMs(ip: string): Promise<number> {
  return lockoutRemainingForKey(hashIp(ip), MAX_ATTEMPTS);
}

export async function globalLockoutRemainingMs(): Promise<number> {
  return lockoutRemainingForKey(hashIp(GLOBAL_LOCKOUT_KEY), MAX_GLOBAL_ATTEMPTS);
}

async function insertFailedAttempt(keyHash: string): Promise<void> {
  await db().batch(
    [
      {
        sql: "INSERT INTO login_attempts (ip_hash, attempted_at) VALUES (?, ?)",
        args: [keyHash, Date.now()],
      },
      {
        sql: "DELETE FROM login_attempts WHERE attempted_at < ?",
        args: [Date.now() - 24 * 60 * 60 * 1000],
      },
    ],
    "write",
  );
}

export async function recordFailedAttempt(ip: string): Promise<void> {
  await insertFailedAttempt(hashIp(ip));
}

export async function recordGlobalFailedAttempt(): Promise<void> {
  await insertFailedAttempt(hashIp(GLOBAL_LOCKOUT_KEY));
}

export async function clearAttempts(ip: string): Promise<void> {
  // A successful unlock also clears the IP-agnostic budget: it exists to stop
  // password guessing, so once the correct password is presented the accrued
  // failures no longer protect anything.
  await db().execute({
    sql: "DELETE FROM login_attempts WHERE ip_hash IN (?, ?)",
    args: [hashIp(ip), hashIp(GLOBAL_LOCKOUT_KEY)],
  });
}

/* ---------- preview fetching (SSRF-guarded) ---------- */

const MAX_HTML_BYTES = 600_000;
const MAX_REDIRECTS = 3;

const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
};

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .trim();
}

function metaContent(html: string, keys: readonly string[]): string | null {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const forward = new RegExp(
      `<meta[^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]*?content=["']([^"']*)["']`,
      "i",
    );
    const reversed = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*?(?:property|name|itemprop)=["']${escaped}["']`,
      "i",
    );
    const match = forward.exec(html) ?? reversed.exec(html);
    const value = match?.[1] ? decodeEntities(match[1]) : "";
    if (value.length > 0) return value;
  }
  return null;
}

function jsonLdValue(html: string, keys: readonly string[]): string | null {
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of blocks) {
    const raw = block[1];
    if (!raw) continue;
    for (const key of keys) {
      const match = new RegExp(`"${key}"\\s*:\\s*"([^"]{2,300})"`, "i").exec(raw);
      if (match?.[1]) return decodeEntities(match[1]);
    }
  }
  return null;
}

function charsetOf(contentType: string | null, html: string): string {
  const fromHeader = /charset=([\w-]+)/i.exec(contentType ?? "")?.[1];
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(html)?.[1];
  return (fromHeader ?? fromMeta ?? "utf-8").toLowerCase();
}

function absolute(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

export type ScrapeResult = {
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  ogSiteName: string | null;
  status: "ok" | "failed";
  errorMessage: string | null;
};

function prettyDomainTitle(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const first = host.split(".")[0] ?? host;
    return first.charAt(0).toUpperCase() + first.slice(1);
  } catch {
    return url;
  }
}

async function fetchHtml(
  url: string,
  timeoutMs = 4000,
): Promise<{ html: string; finalUrl: string } | null> {
  const deadline = Date.now() + timeoutMs;
  let current = url;
  // Redirects are followed manually: every hop (including the initial URL)
  // must re-pass the hostname screen and the resolved-address check, so a
  // public URL cannot 302 into loopback or metadata endpoints.
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const safe = await resolveSafeUrl(current);
    if (!safe) return null;
    const remaining = deadline - Date.now();
    if (remaining <= 0) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const response = await fetch(safe, {
        signal: controller.signal,
        redirect: "manual",
        headers: BROWSER_HEADERS,
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) return null;
        current = new URL(location, safe).toString();
        continue;
      }
      const buffer = await response.arrayBuffer();
      const slice = buffer.slice(0, MAX_HTML_BYTES);
      const provisional = new TextDecoder("utf-8").decode(slice);
      const charset = charsetOf(response.headers.get("content-type"), provisional);
      let html = provisional;
      if (charset !== "utf-8" && charset !== "utf8") {
        try {
          html = new TextDecoder(charset).decode(slice);
        } catch {
          html = provisional;
        }
      }
      // 4xx/5xx pages still often carry usable metadata, so only bail when empty.
      if (!response.ok && html.trim().length === 0) return null;
      return { html, finalUrl: safe.toString() || url };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/**
 * Robust preview: browser-identified fetch, then OG → Twitter → JSON-LD →
 * <title> → domain, with an icon fallback chain so a card always has a visual.
 */
export async function scrapePreview(url: string, timeoutMs = 4000): Promise<ScrapeResult> {
  if (!isSafePublicUrl(url)) {
    return {
      ogTitle: null,
      ogDescription: null,
      ogImageUrl: null,
      ogSiteName: null,
      status: "failed",
      errorMessage: "Address not allowed",
    };
  }

  const screenshotFallback = mshotsUrl(url);
  const fetched = await fetchHtml(url, timeoutMs);
  const domainTitle = prettyDomainTitle(url);

  if (!fetched) {
    // Unreachable / SPA client-rendered host: return domain title and live screenshot preview
    return {
      ogTitle: domainTitle,
      ogDescription: null,
      ogImageUrl: screenshotFallback,
      ogSiteName: null,
      status: "ok",
      errorMessage: null,
    };
  }

  const { html, finalUrl } = fetched;
  const titleTag = /<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(html)?.[1];
  const headingTag = /<h1[^>]*>([\s\S]{0,200}?)<\/h1>/i.exec(html)?.[1];

  const title =
    metaContent(html, ["og:title", "twitter:title", "apple-mobile-web-app-title"]) ??
    jsonLdValue(html, ["name", "headline"]) ??
    (titleTag ? decodeEntities(titleTag.replace(/<[^>]+>/g, "")) : null) ??
    (headingTag ? decodeEntities(headingTag.replace(/<[^>]+>/g, "")) : null) ??
    domainTitle;

  const description =
    metaContent(html, ["og:description", "description", "twitter:description"]) ??
    jsonLdValue(html, ["description"]);

  const ogImage =
    absolute(
      metaContent(html, [
        "og:image",
        "og:image:url",
        "og:image:secure_url",
        "twitter:image",
        "twitter:image:src",
      ]),
      finalUrl,
    ) ??
    absolute(jsonLdValue(html, ["image", "thumbnailUrl"]), finalUrl) ??
    absolute(metaContent(html, ["msapplication-TileImage"]), finalUrl);

  const liveScreenshot = mshotsUrl(finalUrl || url);

  return {
    ogTitle: title.length > 0 ? title.slice(0, 200) : domainTitle,
    ogDescription: description ? description.slice(0, 400) : null,
    ogImageUrl: ogImage || liveScreenshot,
    ogSiteName: metaContent(html, ["og:site_name", "application-name"]),
    status: "ok",
    errorMessage: null,
  };
}

export async function storePreview(assetId: string, result: ScrapeResult): Promise<void> {
  await db().execute({
    sql: PREVIEW_UPSERT_SQL,
    args: [
      assetId,
      result.ogTitle,
      result.ogDescription,
      result.ogImageUrl,
      result.ogSiteName,
      result.status,
      Date.now(),
      result.errorMessage,
    ],
  });
}

export async function refreshPreviewFor(assetId: string, knownUrl?: string): Promise<void> {
  let url = knownUrl;
  if (!url) {
    const result = await db().execute({
      sql: "SELECT url, preview_enabled FROM assets WHERE id = ?",
      args: [assetId],
    });
    const row = result.rows[0];
    if (!row) return;
    if (requiredInteger(row["preview_enabled"], "preview_enabled") !== 1) return;
    url = requiredText(row["url"], "url");
  }
  await storePreview(assetId, await scrapePreview(url));
}

/**
 * Refreshes previews in bounded batches so each serverless invocation stays
 * well under platform timeouts; the client loops until remaining hits zero.
 */
export async function refreshAllPreviews(
  sectionId?: string,
  offset = 0,
  limit = 8,
): Promise<{ count: number; remaining: number }> {
  const result = sectionId
    ? await db().execute({
        sql: "SELECT id, url FROM assets WHERE preview_enabled = 1 AND section_id = ? ORDER BY sort_order, id",
        args: [sectionId],
      })
    : await db().execute(
        "SELECT id, url FROM assets WHERE preview_enabled = 1 ORDER BY sort_order, id",
      );

  const items = result.rows.map((row) => ({
    id: requiredText(row["id"], "id"),
    url: requiredText(row["url"], "url"),
  }));

  const slice = items.slice(offset, offset + limit);

  if (slice.length > 0) {
    // Scrape in parallel chunks of 4 with a tighter timeout for bulk refresh.
    const BATCH_SIZE = 4;
    for (let i = 0; i < slice.length; i += BATCH_SIZE) {
      const chunk = slice.slice(i, i + BATCH_SIZE);
      const chunkResults = await Promise.all(
        chunk.map(async (item) => ({
          id: item.id,
          preview: await scrapePreview(item.url, 2500),
        })),
      );

      const now = Date.now();
      const statements: InStatement[] = chunkResults.map(({ id, preview }) => ({
        sql: PREVIEW_UPSERT_SQL,
        args: [
          id,
          preview.ogTitle,
          preview.ogDescription,
          preview.ogImageUrl,
          preview.ogSiteName,
          preview.status,
          now,
          preview.errorMessage,
        ],
      }));

      // Write chunk updates immediately so partial progress is saved
      // if the background function is terminated by serverless limits
      await db().batch(statements, "write");
    }
  }

  return { count: slice.length, remaining: Math.max(0, items.length - (offset + slice.length)) };
}

/* ---------- section mutations ---------- */

export async function createSection(
  name: string,
  colorToken: SectionColor | null,
  svgUrl: string | null,
): Promise<{ id: string; slug: string }> {
  const existing = await db().execute(
    "SELECT id, slug, color_token, sort_order FROM sections ORDER BY sort_order DESC",
  );
  if (existing.rows.length >= MAX_SECTIONS) {
    throw new Error(`STORE holds a maximum of ${MAX_SECTIONS} sections.`);
  }

  const takenSlugs = new Set(existing.rows.map((row) => requiredText(row["slug"], "slug")));
  const base = slugify(name);
  let slug = base;
  if (takenSlugs.has(base)) {
    let suffix = 2;
    while (takenSlugs.has(`${base}-${suffix}`)) suffix += 1;
    slug = `${base}-${suffix}`;
  }

  const usedColors = new Set(existing.rows.map((row) => String(row["color_token"])));
  const color = colorToken ?? SECTION_COLORS.find((c) => !usedColors.has(c)) ?? SECTION_COLORS[0];
  const top = existing.rows[0];
  const sortOrder = (top ? requiredInteger(top["sort_order"], "sort_order") : -1) + 1;

  const id = newId();
  const now = Date.now();
  try {
    await db().execute({
      sql: "INSERT INTO sections (id, name, slug, color_token, svg_url, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [id, name, slug, color, svgUrl, sortOrder, now, now],
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      throw new Error("That name produces a duplicate section address — pick another name.");
    }
    throw error;
  }
  return { id, slug };
}

export async function updateSection(
  id: string,
  name: string,
  colorToken: SectionColor,
  svgUrl: string | null,
): Promise<{ slug: string }> {
  const slug = await uniqueSlug(name, id);
  try {
    await db().execute({
      sql: "UPDATE sections SET name = ?, slug = ?, color_token = ?, svg_url = ?, updated_at = ? WHERE id = ?",
      args: [name, slug, colorToken, svgUrl, Date.now(), id],
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      throw new Error("That name produces a duplicate section address — pick another name.");
    }
    throw error;
  }
  return { slug };
}

export async function recolorSection(id: string, colorToken: SectionColor): Promise<void> {
  await db().execute({
    sql: "UPDATE sections SET color_token = ?, updated_at = ? WHERE id = ?",
    args: [colorToken, Date.now(), id],
  });
}

export async function deleteRow(table: "sections" | "assets", id: string): Promise<void> {
  // Explicit cascades in one atomic batch: no reliance on the connection's
  // foreign_keys pragma being enabled.
  if (table === "sections") {
    await db().batch(
      [
        {
          sql: "DELETE FROM asset_rows WHERE asset_id IN (SELECT id FROM assets WHERE section_id = ?)",
          args: [id],
        },
        {
          sql: "DELETE FROM preview_cache WHERE asset_id IN (SELECT id FROM assets WHERE section_id = ?)",
          args: [id],
        },
        { sql: "DELETE FROM assets WHERE section_id = ?", args: [id] },
        { sql: "DELETE FROM sections WHERE id = ?", args: [id] },
      ],
      "write",
    );
    return;
  }
  await db().batch(
    [
      { sql: "DELETE FROM asset_rows WHERE asset_id = ?", args: [id] },
      { sql: "DELETE FROM preview_cache WHERE asset_id = ?", args: [id] },
      { sql: "DELETE FROM assets WHERE id = ?", args: [id] },
    ],
    "write",
  );
}

/* ---------- export / import ---------- */

export async function exportVault(): Promise<Vault & { version: 1; exportedAt: number }> {
  const vault = await loadVault();
  return { version: 1, exportedAt: Date.now(), ...vault };
}

type VaultBackup = {
  sections?: {
    name?: string;
    colorToken?: string;
    svgUrl?: string | null;
    assets?: {
      url?: string;
      title?: string | null;
      iconSvgUrl?: string | null;
      previewEnabled?: boolean;
      actionMode?: string;
      rows?: { svgUrl?: string | null; label?: string | null; url?: string; mode?: string }[];
    }[];
  }[];
  svgs?: { name?: string; url?: string }[];
};

function isHttpUrl(raw: string | undefined | null): boolean {
  if (!raw || typeof raw !== "string") return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isHttpOrStaticUrl(raw: string | undefined | null): boolean {
  if (!raw || typeof raw !== "string") return false;
  if (raw.startsWith("/")) return true;
  return isHttpUrl(raw);
}

export async function svgCount(): Promise<number> {
  const result = await db().execute("SELECT COUNT(*) AS count FROM svg_library");
  return requiredInteger(result.rows[0]?.["count"], "count");
}

const MAX_IMPORT_ASSETS = 500;
const MAX_IMPORT_ASSETS_PER_SECTION = 200;
const IMPORT_BATCH_CHUNK = 250;

async function batchChunked(statements: InStatement[]): Promise<void> {
  for (let i = 0; i < statements.length; i += IMPORT_BATCH_CHUNK) {
    await db().batch(statements.slice(i, i + IMPORT_BATCH_CHUNK), "write");
  }
}

export async function importVault(
  payload: string,
): Promise<{ sections: number; svgs: number; skipped: number }> {
  let parsed: VaultBackup;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error("Invalid backup file: Not valid JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid backup file: Root must be an object");
  }

  // Everything is computed in memory from a single initial read, so cap
  // breaches abort before any write lands (no partial imports) and the
  // restore costs a bounded number of round-trips instead of one per row.
  const [sectionResult, svgTopResult] = await Promise.all([
    db().execute("SELECT id, slug, color_token, sort_order FROM sections"),
    db().execute("SELECT sort_order FROM svg_library ORDER BY sort_order DESC LIMIT 1"),
  ]);

  const takenSlugs = new Set(sectionResult.rows.map((row) => requiredText(row["slug"], "slug")));
  const usedColors = new Set(sectionResult.rows.map((row) => String(row["color_token"])));
  const roomForSections = Math.max(0, MAX_SECTIONS - sectionResult.rows.length);
  let nextSectionOrder =
    sectionResult.rows.reduce(
      (max, row) => Math.max(max, requiredInteger(row["sort_order"], "sort_order")),
      -1,
    ) + 1;
  let nextSvgOrder =
    (svgTopResult.rows[0]
      ? requiredInteger(svgTopResult.rows[0]["sort_order"], "sort_order")
      : -1) + 1;

  const now = Date.now();
  const svgStatements: InStatement[] = [];
  const sectionStatements: InStatement[] = [];
  const assetStatements: InStatement[] = [];

  // Import SVGs with sanitization
  let svgs = 0;
  for (const svg of Array.isArray(parsed.svgs) ? parsed.svgs : []) {
    if (!svg || typeof svg !== "object") continue;
    const name = typeof svg.name === "string" ? svg.name.trim().slice(0, 40) : "";
    const url = typeof svg.url === "string" ? svg.url.trim() : "";
    if (!name || !isHttpOrStaticUrl(url)) continue;
    svgStatements.push({
      sql: "INSERT INTO svg_library (id, name, url, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [newId(), name, url, nextSvgOrder, now, now],
    });
    nextSvgOrder += 1;
    svgs += 1;
  }

  // Import Sections & Links with sanitization
  let sections = 0;
  let skipped = 0;
  let totalAssets = 0;

  for (const section of Array.isArray(parsed.sections) ? parsed.sections : []) {
    if (!section || typeof section !== "object") continue;
    const name = typeof section.name === "string" ? section.name.trim().slice(0, 60) : "";
    if (!name) continue;
    if (sections >= roomForSections) {
      skipped += 1;
      continue;
    }

    const svgUrl = section.svgUrl && isHttpOrStaticUrl(section.svgUrl) ? section.svgUrl : null;
    const colorToken = SECTION_COLORS.find((c) => c === section.colorToken) ?? null;

    const base = slugify(name);
    let slug = base;
    if (takenSlugs.has(base)) {
      let suffix = 2;
      while (takenSlugs.has(`${base}-${suffix}`)) suffix += 1;
      slug = `${base}-${suffix}`;
    }
    takenSlugs.add(slug);

    const color = colorToken ?? SECTION_COLORS.find((c) => !usedColors.has(c)) ?? SECTION_COLORS[0];
    usedColors.add(color);

    const sectionId = newId();
    sectionStatements.push({
      sql: "INSERT INTO sections (id, name, slug, color_token, svg_url, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [sectionId, name, slug, color, svgUrl, nextSectionOrder, now, now],
    });
    nextSectionOrder += 1;
    sections += 1;

    let sectionAssets = 0;
    for (const asset of Array.isArray(section.assets) ? section.assets : []) {
      if (!asset || typeof asset !== "object") continue;
      const assetUrl = typeof asset.url === "string" ? asset.url.trim() : "";
      if (!isHttpUrl(assetUrl)) continue;

      if (totalAssets >= MAX_IMPORT_ASSETS || sectionAssets >= MAX_IMPORT_ASSETS_PER_SECTION) {
        throw new Error(
          `Backup too large: imports are capped at ${MAX_IMPORT_ASSETS_PER_SECTION} links per section and ${MAX_IMPORT_ASSETS} in total.`,
        );
      }

      const title = typeof asset.title === "string" ? asset.title.trim().slice(0, 120) : null;
      const iconSvgUrl =
        asset.iconSvgUrl && isHttpOrStaticUrl(asset.iconSvgUrl) ? asset.iconSvgUrl : null;
      const previewEnabled = asset.previewEnabled !== false;
      const actionMode = asset.actionMode === "copy" ? "copy" : "open";

      const validRows = (Array.isArray(asset.rows) ? asset.rows : [])
        .filter(
          (
            row,
          ): row is { url: string; label?: string | null; svgUrl?: string | null; mode?: string } =>
            Boolean(
              row && typeof row === "object" && typeof row.url === "string" && isHttpUrl(row.url),
            ),
        )
        .slice(0, 6)
        .map((row) => ({
          svgUrl: row.svgUrl && isHttpOrStaticUrl(row.svgUrl) ? row.svgUrl : null,
          label: typeof row.label === "string" ? row.label.trim().slice(0, 40) : null,
          url: row.url.trim(),
          mode: (row.mode === "copy" ? "copy" : "open") as ActionMode,
        }));

      const id = newId();
      assetStatements.push({
        sql: `INSERT INTO assets (id, section_id, url, title, icon_svg_url, preview_enabled, action_mode, sort_order, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          sectionId,
          assetUrl,
          title,
          iconSvgUrl,
          previewEnabled ? 1 : 0,
          actionMode,
          sectionAssets,
          now,
          now,
        ],
      });
      assetStatements.push(...rowStatements(id, validRows, now));
      if (previewEnabled && isSafePublicUrl(assetUrl)) {
        assetStatements.push({
          sql: PREVIEW_UPSERT_SQL,
          args: [
            id,
            title || prettyDomainTitle(assetUrl),
            null,
            mshotsUrl(assetUrl),
            domainOf(assetUrl),
            "ok",
            now,
            null,
          ],
        });
      }
      sectionAssets += 1;
      totalAssets += 1;
    }
  }

  await batchChunked(svgStatements);
  await batchChunked(sectionStatements);
  await batchChunked(assetStatements);

  return { sections, svgs, skipped };
}

export async function wipeVaultData(): Promise<{ ok: true }> {
  await db().batch(
    [
      { sql: "DELETE FROM preview_cache", args: [] },
      { sql: "DELETE FROM asset_rows", args: [] },
      { sql: "DELETE FROM assets", args: [] },
      { sql: "DELETE FROM sections", args: [] },
      { sql: "DELETE FROM svg_library", args: [] },
    ],
    "write",
  );
  return { ok: true };
}
