export const SECTION_COLORS = ["ember", "moss", "steel", "sand", "rose"] as const;

export type SectionColor = (typeof SECTION_COLORS)[number];

export const MAX_SECTIONS = 5;
export const MAX_ROWS = 6;

export type ActionMode = "open" | "copy";

export type PreviewStatus = "ok" | "failed" | "pending";

export type Preview = {
  ogTitle: string | null;
  ogImageUrl: string | null;
  ogSiteName: string | null;
  status: PreviewStatus;
  fetchedAt: number;
  errorMessage: string | null;
};

export type AssetRow = {
  id: string;
  svgUrl: string | null;
  label: string | null;
  url: string;
  mode: ActionMode;
  sortOrder: number;
};

export type Asset = {
  id: string;
  sectionId: string;
  url: string;
  title: string | null;
  iconSvgUrl: string | null;
  previewEnabled: boolean;
  actionMode: ActionMode;
  sortOrder: number;
  preview: Preview | null;
  rows: AssetRow[];
};

export type Section = {
  id: string;
  name: string;
  slug: string;
  colorToken: SectionColor;
  svgUrl: string | null;
  sortOrder: number;
  assets: Asset[];
};

export type SvgIcon = {
  id: string;
  name: string;
  url: string;
  sortOrder: number;
};

export type Vault = {
  sections: Section[];
  svgs: SvgIcon[];
};

/** Section identity hue, used as light (glow/tint) — never as a flat fill. */
export const TONE_VAR: Record<SectionColor, string> = {
  ember: "var(--tone-ember)",
  moss: "var(--tone-moss)",
  steel: "var(--tone-steel)",
  sand: "var(--tone-sand)",
  rose: "var(--tone-rose)",
};

/** Deterministic hue for a domain, so generated covers stay stable per site. */
export function toneForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  const tones = ["ember", "moss", "steel", "sand", "rose"] as const;
  return TONE_VAR[tones[Math.abs(hash) % tones.length] ?? "ember"];
}

export const TONE_SWATCH: Record<SectionColor, string> = {
  ember: "bg-tone-ember",
  moss: "bg-tone-moss",
  steel: "bg-tone-steel",
  sand: "bg-tone-sand",
  rose: "bg-tone-rose",
};

export function coerceColor(value: string, index: number): SectionColor {
  const found = SECTION_COLORS.find((color) => color === value);
  return found ?? SECTION_COLORS[index % SECTION_COLORS.length] ?? "ember";
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function assetLabel(asset: Asset): string {
  if (asset.title && asset.title.trim().length > 0) return asset.title;
  if (asset.preview?.ogTitle) return asset.preview.ogTitle;
  return domainOf(asset.url);
}

export function initialsOf(value: string): string {
  const clean = value.replace(/^www\./, "");
  return clean.slice(0, 2).toUpperCase();
}
