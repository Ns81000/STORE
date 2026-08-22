import { useMemo, useState } from "react";
import { Search, Shapes, X } from "lucide-react";
import type { SvgIcon } from "@/lib/store.types";
import { SvgMark } from "./SvgMark";
import { cn } from "@/lib/utils";

type SvgPickerProps = {
  label: string;
  svgs: readonly SvgIcon[];
  value: string | null;
  onChange: (next: string | null) => void;
  compact?: boolean | undefined;
  onOpenLibrary?: (() => void) | undefined;
};

const SEARCH_THRESHOLD = 10;

/**
 * Marks come only from the library. The rail is a fixed-height scroll area so
 * a full 30-mark library never stretches the panel it sits in.
 */
export function SvgPicker({
  label,
  svgs,
  value,
  onChange,
  compact,
  onOpenLibrary,
}: SvgPickerProps) {
  const [query, setQuery] = useState("");
  const showSearch = svgs.length > SEARCH_THRESHOLD;

  const visible = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return svgs;
    return svgs.filter((icon) => icon.name.toLowerCase().includes(clean));
  }, [svgs, query]);

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      {label || onOpenLibrary || value ? (
        <div className="flex items-center justify-between gap-3">
          <span className="type-label">{label}</span>
          <div className="flex items-center gap-3">
            {value ? (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="focus-ring type-caption inline-flex items-center gap-1 rounded-sm hover:text-ink"
              >
                <X size={12} /> Clear
              </button>
            ) : null}
            {onOpenLibrary ? (
              <button
                type="button"
                onClick={onOpenLibrary}
                className="focus-ring type-caption inline-flex items-center gap-1 rounded-sm hover:text-ink"
              >
                <Shapes size={12} /> Library
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showSearch ? (
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search marks"
            className="h-9 w-full rounded-pill bg-surface-3 pl-8 pr-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:shadow-[var(--glow-accent)]"
          />
        </div>
      ) : null}

      {svgs.length === 0 ? (
        <p className="type-caption">
          No marks saved yet. Add some in the library and they appear here.
        </p>
      ) : visible.length === 0 ? (
        <p className="type-caption">No mark matches “{query}”.</p>
      ) : (
        <div
          className={cn(
            "-mx-1 flex flex-wrap gap-1.5 overflow-y-auto px-1 py-0.5",
            compact ? "max-h-[4.75rem]" : "max-h-[7.5rem]",
          )}
        >
          {visible.map((icon) => (
            <button
              key={icon.id}
              type="button"
              title={icon.name}
              aria-label={icon.name}
              aria-pressed={value === icon.url}
              onClick={() => onChange(icon.url)}
              className={cn(
                "press focus-ring inline-flex shrink-0 items-center justify-center rounded-md transition-[background-color,box-shadow] duration-150 hover:bg-surface-3",
                compact ? "h-9 w-9" : "h-11 w-11",
                value === icon.url && "bg-surface-3 shadow-[var(--glow-accent)]",
              )}
            >
              <SvgMark url={icon.url} fallback={icon.name} size={compact ? 20 : 26} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
