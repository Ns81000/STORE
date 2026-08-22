import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hashIp } from "./session.server";
import {
  MAX_SECTIONS,
  MAX_SVGS,
  SECTION_COLORS,
  coerceColor,
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
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length > 0 ? base : `section-${newId().slice(0, 6)}`;
}

export async function uniqueSlug(name: string, ignoreId?: string): Promise<string> {
  const base = slugify(name);
  const { data } = await supabaseAdmin.from("sections").select("id, slug");
  const taken = new Set((data ?? []).filter((row) => row.id !== ignoreId).map((row) => row.slug));
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export async function nextSectionColor(): Promise<SectionColor> {
  const { data } = await supabaseAdmin.from("sections").select("color_token");
  const used = new Set((data ?? []).map((row) => row.color_token));
  return SECTION_COLORS.find((color) => !used.has(color)) ?? SECTION_COLORS[0];
}

export async function sectionCount(): Promise<number> {
  const { count } = await supabaseAdmin
    .from("sections")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function nextSectionOrder(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("sections")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  return (data?.[0]?.sort_order ?? -1) + 1;
}

export async function nextAssetOrder(sectionId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("assets")
    .select("sort_order")
    .eq("section_id", sectionId)
    .order("sort_order", { ascending: false })
    .limit(1);
  return (data?.[0]?.sort_order ?? -1) + 1;
}

export async function loadVault(): Promise<Vault> {
  const [sectionRows, assetRows, previewRows, linkRows, svgRows] = await Promise.all([
    supabaseAdmin.from("sections").select("*").order("sort_order"),
    supabaseAdmin.from("assets").select("*").order("sort_order"),
    supabaseAdmin.from("preview_cache").select("*"),
    supabaseAdmin.from("asset_rows").select("*").order("sort_order"),
    supabaseAdmin.from("svg_library").select("*").order("sort_order"),
  ]);

  const previews = new Map((previewRows.data ?? []).map((row) => [row.asset_id, row]));

  const rowsByAsset = new Map<string, AssetRow[]>();
  for (const row of linkRows.data ?? []) {
    const bucket = rowsByAsset.get(row.asset_id) ?? [];
    bucket.push({
      id: row.id,
      svgUrl: row.svg_url,
      label: row.label,
      url: row.url,
      mode: row.mode === "copy" ? "copy" : "open",
      sortOrder: row.sort_order,
    });
    rowsByAsset.set(row.asset_id, bucket);
  }

  const assetsBySection = new Map<string, Asset[]>();
  for (const row of assetRows.data ?? []) {
    const cached = previews.get(row.id);
    const asset: Asset = {
      id: row.id,
      sectionId: row.section_id,
      url: row.url,
      title: row.title,
      iconSvgUrl: row.icon_svg_url,
      previewEnabled: row.preview_enabled === 1,
      actionMode: row.action_mode === "copy" ? "copy" : "open",
      sortOrder: row.sort_order,
      rows: rowsByAsset.get(row.id) ?? [],
      preview: cached
        ? {
            ogTitle: cached.og_title,
            ogDescription: cached.og_description,
            ogImageUrl: cached.og_image_url,
            ogSiteName: cached.og_site_name,
            status:
              cached.status === "ok" || cached.status === "failed" ? cached.status : "pending",
            fetchedAt: Number(cached.fetched_at),
            errorMessage: cached.error_message,
          }
        : null,
    };
    const bucket = assetsBySection.get(row.section_id) ?? [];
    bucket.push(asset);
    assetsBySection.set(row.section_id, bucket);
  }

  const sections: Section[] = (sectionRows.data ?? []).map((row, index) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    colorToken: coerceColor(row.color_token, index),
    svgUrl: row.svg_url,
    sortOrder: row.sort_order,
    assets: assetsBySection.get(row.id) ?? [],
  }));

  const svgs: SvgIcon[] = (svgRows.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    url: row.url,
    sortOrder: row.sort_order,
  }));

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
};

async function replaceRows(assetId: string, rows: readonly RowInput[]): Promise<void> {
  await supabaseAdmin.from("asset_rows").delete().eq("asset_id", assetId);
  if (rows.length === 0) return;
  const now = Date.now();
  const { error } = await supabaseAdmin.from("asset_rows").insert(
    rows.map((row, index) => ({
      id: newId(),
      asset_id: assetId,
      svg_url: row.svgUrl,
      label: row.label,
      url: row.url,
      mode: row.mode,
      sort_order: index,
      created_at: now,
      updated_at: now,
    })),
  );
  if (error) throw new Error(error.message);
}

export async function insertAsset(input: AssetInput): Promise<string> {
  const id = newId();
  const now = Date.now();
  const { error } = await supabaseAdmin.from("assets").insert({
    id,
    section_id: input.sectionId,
    url: input.url,
    title: input.title,
    icon_svg_url: input.iconSvgUrl,
    preview_enabled: input.previewEnabled ? 1 : 0,
    action_mode: input.actionMode,
    sort_order: await nextAssetOrder(input.sectionId),
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(error.message);
  await replaceRows(id, input.rows);
  return id;
}

export async function updateAsset(id: string, input: AssetInput): Promise<void> {
  const { error } = await supabaseAdmin
    .from("assets")
    .update({
      url: input.url,
      title: input.title,
      icon_svg_url: input.iconSvgUrl,
      preview_enabled: input.previewEnabled ? 1 : 0,
      action_mode: input.actionMode,
      updated_at: Date.now(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await replaceRows(id, input.rows);
}

export async function applyOrder(
  table: "sections" | "assets",
  ids: readonly string[],
): Promise<void> {
  await Promise.all(
    ids.map((id, index) =>
      supabaseAdmin.from(table).update({ sort_order: index, updated_at: Date.now() }).eq("id", id),
    ),
  );
}

/* ---------- svg library ---------- */

export async function createSvg(name: string, url: string): Promise<string> {
  const id = newId();
  const now = Date.now();
  const { count } = await supabaseAdmin
    .from("svg_library")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MAX_SVGS) {
    throw new Error(`The library holds ${MAX_SVGS} marks — delete one to add another.`);
  }
  const { data } = await supabaseAdmin
    .from("svg_library")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  const { error } = await supabaseAdmin.from("svg_library").insert({
    id,
    name,
    url,
    sort_order: (data?.[0]?.sort_order ?? -1) + 1,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(error.message);
  return id;
}

export async function updateSvg(id: string, name: string, url: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("svg_library")
    .update({ name, url, updated_at: Date.now() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteSvg(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("svg_library").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------- rate limiting ---------- */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function lockoutRemainingMs(ip: string): Promise<number> {
  const since = Date.now() - WINDOW_MS;
  const { data } = await supabaseAdmin
    .from("login_attempts")
    .select("attempted_at")
    .eq("ip_hash", hashIp(ip))
    .gte("attempted_at", since)
    .order("attempted_at", { ascending: true });
  const attempts = data ?? [];
  if (attempts.length < MAX_ATTEMPTS) return 0;
  const oldest = Number(attempts[attempts.length - MAX_ATTEMPTS]?.attempted_at ?? Date.now());
  return Math.max(0, oldest + WINDOW_MS - Date.now());
}

export async function recordFailedAttempt(ip: string): Promise<void> {
  await supabaseAdmin
    .from("login_attempts")
    .insert({ ip_hash: hashIp(ip), attempted_at: Date.now() });
  await supabaseAdmin
    .from("login_attempts")
    .delete()
    .lt("attempted_at", Date.now() - 24 * 60 * 60 * 1000);
}

export async function clearAttempts(ip: string): Promise<void> {
  await supabaseAdmin.from("login_attempts").delete().eq("ip_hash", hashIp(ip));
}

/* ---------- preview fetching (SSRF-guarded) ---------- */

const PRIVATE_HOST = /^(localhost|0\.0\.0\.0|\[?::1\]?|.*\.local|.*\.internal)$/i;
const PRIVATE_IPV4 =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

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

const MAX_HTML_BYTES = 600_000;

const BROWSER_HEADERS: Record<string, string> = {
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

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: BROWSER_HEADERS,
    });
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
    return { html, finalUrl: response.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Robust preview: browser-identified fetch, then OG → Twitter → JSON-LD →
 * <title> → domain, with an icon fallback chain so a card always has a visual.
 */
export async function scrapePreview(url: string): Promise<ScrapeResult> {
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

  const fetched = await fetchHtml(url);
  const domainTitle = prettyDomainTitle(url);

  if (!fetched) {
    // Even unreachable/JS-only hosts get a usable card from the domain + icon service.
    return {
      ogTitle: domainTitle,
      ogDescription: null,
      // No favicon stand-in: the card renders a generated branded cover instead.
      ogImageUrl: null,
      ogSiteName: null,
      status: "ok",
      errorMessage: "Metadata unavailable — showing domain details",
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
    metaContent(html, ["og:description", "twitter:description", "description"]) ??
    jsonLdValue(html, ["description"]);

  const image =
    absolute(
      metaContent(html, ["og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src"]),
      finalUrl,
    ) ??
    absolute(jsonLdValue(html, ["image", "thumbnailUrl"]), finalUrl) ??
    absolute(metaContent(html, ["msapplication-TileImage"]), finalUrl);

  return {
    ogTitle: title.length > 0 ? title.slice(0, 200) : domainTitle,
    ogDescription: description ? description.slice(0, 400) : null,
    ogImageUrl: image,
    ogSiteName: metaContent(html, ["og:site_name", "application-name"]),
    status: "ok",
    errorMessage: null,
  };
}

export async function storePreview(assetId: string, result: ScrapeResult): Promise<void> {
  await supabaseAdmin.from("preview_cache").upsert({
    asset_id: assetId,
    og_title: result.ogTitle,
    og_description: result.ogDescription,
    og_image_url: result.ogImageUrl,
    og_site_name: result.ogSiteName,
    status: result.status,
    fetched_at: Date.now(),
    error_message: result.errorMessage,
  });
}

export async function refreshPreviewFor(assetId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("assets")
    .select("url, preview_enabled")
    .eq("id", assetId)
    .maybeSingle();
  if (!data || data.preview_enabled !== 1) return;
  await storePreview(assetId, await scrapePreview(data.url));
}

export async function refreshAllPreviews(sectionId?: string): Promise<number> {
  const base = supabaseAdmin.from("assets").select("id").eq("preview_enabled", 1);
  const { data } = sectionId ? await base.eq("section_id", sectionId) : await base;
  const ids = (data ?? []).map((row) => row.id);
  const BATCH = 4;
  for (let i = 0; i < ids.length; i += BATCH) {
    await Promise.all(ids.slice(i, i + BATCH).map((id) => refreshPreviewFor(id)));
  }
  return ids.length;
}

/* ---------- section mutations ---------- */

export async function createSection(
  name: string,
  colorToken: SectionColor | null,
  svgUrl: string | null,
): Promise<{ id: string; slug: string }> {
  if ((await sectionCount()) >= MAX_SECTIONS) {
    throw new Error(`STORE holds a maximum of ${MAX_SECTIONS} sections.`);
  }
  const id = newId();
  const now = Date.now();
  const slug = await uniqueSlug(name);
  const { error } = await supabaseAdmin.from("sections").insert({
    id,
    name,
    slug,
    color_token: colorToken ?? (await nextSectionColor()),
    svg_url: svgUrl,
    sort_order: await nextSectionOrder(),
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(error.message);
  return { id, slug };
}

export async function updateSection(
  id: string,
  name: string,
  colorToken: SectionColor,
  svgUrl: string | null,
): Promise<{ slug: string }> {
  const slug = await uniqueSlug(name, id);
  const { error } = await supabaseAdmin
    .from("sections")
    .update({ name, slug, color_token: colorToken, svg_url: svgUrl, updated_at: Date.now() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { slug };
}

export async function recolorSection(id: string, colorToken: SectionColor): Promise<void> {
  const { error } = await supabaseAdmin
    .from("sections")
    .update({ color_token: colorToken, updated_at: Date.now() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteRow(table: "sections" | "assets", id: string): Promise<void> {
  const { error } = await supabaseAdmin.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------- export / import ---------- */

export async function exportVault(): Promise<Vault & { version: 1; exportedAt: number }> {
  const vault = await loadVault();
  return { version: 1, exportedAt: Date.now(), ...vault };
}

type ImportShape = {
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

export async function importVault(payload: string): Promise<{ sections: number; svgs: number }> {
  const parsed: ImportShape = JSON.parse(payload);
  let sections = 0;
  let svgs = 0;

  for (const svg of parsed.svgs ?? []) {
    if (!svg.name || !svg.url) continue;
    await createSvg(svg.name, svg.url);
    svgs += 1;
  }

  for (const section of parsed.sections ?? []) {
    if (!section.name) continue;
    if ((await sectionCount()) >= MAX_SECTIONS) break;
    const created = await createSection(
      section.name,
      SECTION_COLORS.find((color) => color === section.colorToken) ?? null,
      section.svgUrl ?? null,
    );
    sections += 1;
    for (const asset of section.assets ?? []) {
      if (!asset.url) continue;
      await insertAsset({
        sectionId: created.id,
        url: asset.url,
        title: asset.title ?? null,
        iconSvgUrl: asset.iconSvgUrl ?? null,
        previewEnabled: asset.previewEnabled !== false,
        actionMode: asset.actionMode === "copy" ? "copy" : "open",
        rows: (asset.rows ?? [])
          .filter((row): row is { url: string } & typeof row => Boolean(row.url))
          .map((row) => ({
            svgUrl: row.svgUrl ?? null,
            label: row.label ?? null,
            url: row.url,
            mode: row.mode === "copy" ? "copy" : "open",
          })),
      });
    }
  }

  return { sections, svgs };
}
