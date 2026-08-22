import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Check, Copy, GripVertical, Pencil, RefreshCw } from "lucide-react";
import {
  TONE_VAR,
  assetLabel,
  domainOf,
  initialsOf,
  toneForKey,
  type Asset,
  type AssetRow,
  type Section,
} from "@/lib/store.types";
import { Menu, type MenuItem } from "./Menu";
import { SvgMark } from "./SvgMark";
import { cn } from "@/lib/utils";

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

type SectionTileProps = {
  section: Section;
  index: number;
  menu: readonly MenuItem[];
  dragHandle?: React.HTMLAttributes<HTMLButtonElement>;
};

/**
 * Bento tile: near-black card, hairline edge, and the section's hue delivered
 * as light bleeding from the top-left — colour reads as glow, not paint.
 */
export function SectionTile({ section, index, menu, dragHandle }: SectionTileProps) {
  const count = section.assets.length;
  const tone = TONE_VAR[section.colorToken];

  return (
    <div
      className="stagger-in group relative h-full min-h-[8.5rem]"
      style={{ animationDelay: `${index * 55}ms`, ["--tone" as string]: tone }}
    >
      <Link
        to="/s/$slug"
        params={{ slug: section.slug }}
        className={cn(
          "focus-ring relative flex h-full flex-col justify-between overflow-hidden rounded-xl p-5",
          "bg-surface-2 elev-1 transition-[transform,box-shadow] duration-300",
          "hover:-translate-y-[2px] hover:elev-2",
        )}
        style={{ transitionTimingFunction: "var(--ease-out-strong)" }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-pill opacity-60 blur-[46px] transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: "color-mix(in srgb, var(--tone) 42%, transparent)" }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, color-mix(in srgb, var(--tone) 55%, transparent), transparent)",
          }}
        />

        <span className="relative flex h-8 items-center">
          {section.svgUrl ? (
            <SvgMark url={section.svgUrl} fallback={section.name} size={30} />
          ) : (
            <span className="text-sm font-semibold" style={{ color: "var(--tone)" }}>
              {initialsOf(section.name)}
            </span>
          )}
        </span>

        <span className="relative mt-5 block">
          <span className="type-display-md block truncate text-ink">{section.name}</span>
          <span className="type-caption mt-1 flex items-center gap-1.5">
            {count} {count === 1 ? "link" : "links"}
            <ArrowUpRight
              size={13}
              className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </span>
        </span>
      </Link>

      <div className="absolute right-2.5 top-2.5 flex items-center gap-1 opacity-100 transition-opacity duration-200 md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100">
        {dragHandle ? (
          <button
            {...dragHandle}
            type="button"
            aria-label={`Reorder ${section.name}`}
            className="focus-ring inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md bg-canvas/40 text-ink-subtle backdrop-blur active:cursor-grabbing"
          >
            <GripVertical size={15} />
          </button>
        ) : null}
        <Menu items={menu} size="sm" label={`${section.name} actions`} />
      </div>
    </div>
  );
}

type RowButtonProps = { row: AssetRow; onCopied: (message: string) => void };

function RowButton({ row, onCopied }: RowButtonProps) {
  const [done, setDone] = useState(false);
  const label = row.label?.trim() || domainOf(row.url);
  // No plate behind the mark — just a hover-only hit area.
  const shell =
    "press focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-subtle transition-colors duration-150 hover:bg-surface-3 hover:text-ink";

  if (row.mode === "copy") {
    return (
      <button
        type="button"
        title={`Copy ${label}`}
        aria-label={`Copy ${label}`}
        onClick={async () => {
          const ok = await copyText(row.url);
          if (!ok) return onCopied("Copy blocked by the browser");
          setDone(true);
          onCopied(`Copied ${label}`);
          window.setTimeout(() => setDone(false), 1400);
        }}
        className={shell}
      >
        {done ? (
          <Check size={15} className="animate-pop text-success" />
        ) : row.svgUrl ? (
          <SvgMark url={row.svgUrl} fallback={label} size={20} />
        ) : (
          <Copy size={15} />
        )}
      </button>
    );
  }

  return (
    <a
      href={row.url}
      target="_blank"
      rel="noreferrer noopener"
      title={`Open ${label}`}
      aria-label={`Open ${label}`}
      className={shell}
    >
      {row.svgUrl ? (
        <SvgMark url={row.svgUrl} fallback={label} size={20} />
      ) : (
        <ArrowUpRight size={15} />
      )}
    </a>
  );
}

type CoverProps = { asset: Asset; title: string; domain: string };

/** Real OG art when we have it, otherwise a branded generated cover. */
export function AssetCover({ asset, title, domain }: CoverProps) {
  const [broken, setBroken] = useState(false);
  const image = asset.previewEnabled && !broken ? asset.preview?.ogImageUrl : null;

  if (image) {
    return (
      <img
        src={image}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        style={{ transitionTimingFunction: "var(--ease-out-strong)" }}
      />
    );
  }

  return (
    <div
      className="generated-cover flex h-full w-full flex-col items-center justify-center gap-3"
      style={{ ["--tone" as string]: toneForKey(domain) }}
    >
      {asset.iconSvgUrl ? (
        <SvgMark url={asset.iconSvgUrl} fallback={title} size={40} />
      ) : (
        <span className="text-xl font-semibold" style={{ color: "var(--tone)" }}>
          {initialsOf(domain)}
        </span>
      )}
      <span className="type-caption max-w-[80%] truncate text-center">{domain}</span>
    </div>
  );
}

type AssetCardProps = {
  asset: Asset;
  index: number;
  menu: readonly MenuItem[];
  onToast: (message: string) => void;
  onEdit?: () => void;
  refreshing?: boolean;
  compact?: boolean;
  dragHandle?: React.HTMLAttributes<HTMLButtonElement>;
};

/** Primary action, shared by both densities. */
function PrimaryAction({
  asset,
  onToast,
  dense,
}: {
  asset: Asset;
  onToast: (message: string) => void;
  dense?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const shell = cn(
    "press focus-ring inline-flex items-center justify-center gap-1.5 rounded-md font-medium",
    dense ? "h-8 px-3.5 text-xs" : "h-9 min-w-[6rem] flex-1 px-4 text-sm",
  );

  if (asset.actionMode === "copy") {
    return (
      <button
        type="button"
        onClick={async () => {
          const ok = await copyText(asset.url);
          if (!ok) return onToast("Copy blocked by the browser");
          setCopied(true);
          onToast("Link copied");
          window.setTimeout(() => setCopied(false), 1400);
        }}
        className={cn(shell, "bg-surface-3 text-ink hover:bg-surface-3/70")}
      >
        {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
        {copied ? "Copied" : dense ? "Copy" : "Copy link"}
      </button>
    );
  }

  return (
    <a
      href={asset.url}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(shell, "bg-accent text-on-accent hover:brightness-110")}
    >
      Open <ArrowUpRight size={15} />
    </a>
  );
}

export function AssetCard({
  asset,
  index,
  menu,
  onToast,
  refreshing,
  compact,
  dragHandle,
}: AssetCardProps) {
  const title = assetLabel(asset);
  const domain = domainOf(asset.url);
  const description = asset.preview?.ogDescription;

  const controls = (
    <div className="flex shrink-0 items-center gap-0.5">
      {dragHandle ? (
        <button
          {...dragHandle}
          type="button"
          aria-label={`Reorder ${title}`}
          className="focus-ring hidden h-8 w-8 cursor-grab items-center justify-center rounded-md text-ink-faint hover:text-ink active:cursor-grabbing md:inline-flex"
        >
          <GripVertical size={15} />
        </button>
      ) : null}
      <Menu items={menu} size="sm" label={`${title} actions`} />
    </div>
  );

  if (compact) {
    return (
      <article
        className="stagger-in group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-surface-2 px-3.5 py-3 transition-colors duration-200 hover:bg-surface-3/60"
        style={{ animationDelay: `${index * 25}ms` }}
      >
        <SvgMark url={asset.iconSvgUrl ?? null} fallback={domain} size={24} />
        <div className="min-w-0">
          <h3 className="type-title-sm truncate text-ink">{title}</h3>
          <p className="type-caption truncate">{domain}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="hidden items-center gap-0.5 sm:flex">
            {asset.rows.map((row) => (
              <RowButton key={row.id} row={row} onCopied={onToast} />
            ))}
          </div>
          <PrimaryAction asset={asset} onToast={onToast} dense />
          {controls}
        </div>
      </article>
    );
  }

  return (
    <article
      className="stagger-in group relative flex flex-col overflow-hidden rounded-xl bg-surface-2 elev-1 transition-[transform,box-shadow] duration-300 hover:-translate-y-[2px] hover:elev-2"
      style={{
        animationDelay: `${index * 45}ms`,
        transitionTimingFunction: "var(--ease-out-strong)",
      }}
    >
      {asset.previewEnabled ? (
        <div className="relative aspect-[2/1] w-full overflow-hidden bg-surface">
          <AssetCover asset={asset} title={title} domain={domain} />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-surface-2 to-transparent"
          />
          {refreshing ? (
            <span className="absolute inset-0 flex items-center justify-center bg-canvas/60 backdrop-blur-sm">
              <RefreshCw size={18} className="animate-spin text-ink-muted" />
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex items-start gap-2.5">
          <SvgMark url={asset.iconSvgUrl ?? null} fallback={domain} size={24} className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h3 className="type-title-sm truncate text-ink">{title}</h3>
            <p className="type-caption truncate">{domain}</p>
          </div>
          {controls}
        </div>

        {description ? <p className="type-caption line-clamp-2">{description}</p> : null}

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <PrimaryAction asset={asset} onToast={onToast} />
          {asset.rows.map((row) => (
            <RowButton key={row.id} row={row} onCopied={onToast} />
          ))}
        </div>
      </div>
    </article>
  );
}
