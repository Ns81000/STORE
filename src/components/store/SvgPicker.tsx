import { useMemo, useState } from "react";
import { Plus, Search, Shapes, X } from "lucide-react";
import type { SvgIcon } from "@/lib/store.types";
import { Modal } from "./Modal";
import { SvgMark } from "./SvgMark";
import { Button } from "./primitives";
import { cn } from "@/lib/utils";

type SvgPickerProps = {
  label: string;
  svgs: readonly SvgIcon[];
  value: string | null;
  onChange: (next: string | null) => void;
  compact?: boolean | undefined;
  onOpenLibrary?: (() => void) | undefined;
};

const MAX_INLINE_MARKS = 5;

/**
 * High-craft mark picker:
 * - Single-row inline strip for quick picking without form clutter.
 * - Auto-pins selected mark even if it's further in the library.
 * - Dedicated full selector modal with live search for large libraries.
 * - Distinct, tactile Clear and Library action buttons.
 */
export function SvgPicker({
  label,
  svgs,
  value,
  onChange,
  compact,
  onOpenLibrary,
}: SvgPickerProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Determine inline marks to display: prioritize first N marks, but ensure active selection is included.
  const inlineMarks = useMemo(() => {
    if (svgs.length <= MAX_INLINE_MARKS) return svgs;
    const initial = svgs.slice(0, MAX_INLINE_MARKS);
    if (value && !initial.some((icon) => icon.url === value)) {
      const selectedIcon = svgs.find((icon) => icon.url === value);
      if (selectedIcon) {
        return [...initial.slice(0, MAX_INLINE_MARKS - 1), selectedIcon];
      }
    }
    return initial;
  }, [svgs, value]);

  const hiddenCount = Math.max(0, svgs.length - inlineMarks.length);

  // Filtered marks inside the full selector modal
  const modalVisibleMarks = useMemo(() => {
    const clean = searchQuery.trim().toLowerCase();
    if (!clean) return svgs;
    return svgs.filter((icon) => icon.name.toLowerCase().includes(clean));
  }, [svgs, searchQuery]);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {/* Header bar: Label + Tactile Action Buttons */}
      {label || onOpenLibrary || value ? (
        <div className="flex items-center justify-between gap-3">
          <span className="type-label truncate">{label}</span>
          <div className="flex shrink-0 items-center gap-2">
            {value ? (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="press focus-ring inline-flex items-center gap-1 rounded-md bg-surface-3 px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-error/15 hover:text-error active:bg-error/25"
                title="Clear selected mark"
              >
                <X size={12} />
                <span>Clear</span>
              </button>
            ) : null}
            {onOpenLibrary ? (
              <button
                type="button"
                onClick={onOpenLibrary}
                className="press focus-ring inline-flex items-center gap-1.5 rounded-md bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/25 active:bg-accent/35"
                title="Open mark library to add or manage icons"
              >
                <Shapes size={12} />
                <span>Library</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Empty State */}
      {svgs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl bg-surface-2/60 p-4 text-center hairline-soft">
          <p className="type-caption text-xs">
            No marks saved yet. Add icons to your library to use them here.
          </p>
          {onOpenLibrary ? (
            <button
              type="button"
              onClick={onOpenLibrary}
              className="press focus-ring inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-on-accent transition-transform hover:brightness-110"
            >
              <Shapes size={13} /> Open mark library
            </button>
          ) : null}
        </div>
      ) : (
        /* Single-Row Clean Mark Strip (Zero ugly vertical scrollbars) */
        <div className="flex items-center gap-1.5 py-0.5">
          {inlineMarks.map((icon) => {
            const selected = value === icon.url;
            return (
              <button
                key={icon.id}
                type="button"
                title={icon.name}
                aria-label={icon.name}
                aria-pressed={selected}
                onClick={() => onChange(selected ? null : icon.url)}
                className={cn(
                  "press focus-ring group relative flex shrink-0 items-center justify-center rounded-lg transition-colors duration-150",
                  compact ? "h-9 w-9" : "h-10 w-10",
                  selected
                    ? "border-2 border-accent bg-accent/15 text-accent"
                    : "border-2 border-transparent bg-surface-3/50 text-ink-muted hover:bg-surface-3 hover:text-ink",
                )}
              >
                <SvgMark
                  url={icon.url}
                  fallback={icon.name}
                  size={compact ? 18 : 22}
                  className="transition-transform group-hover:scale-105"
                />
              </button>
            );
          })}

          {/* "+ More" Button if library has more marks */}
          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectorOpen(true);
              }}
              className={cn(
                "press focus-ring flex shrink-0 items-center justify-center gap-1 rounded-lg border-2 border-dashed border-hairline bg-surface-3/30 text-xs font-medium text-ink-muted transition-colors hover:border-hairline-strong hover:bg-surface-3 hover:text-ink",
                compact ? "h-9 px-2.5" : "h-10 px-3",
              )}
              title={`View all ${svgs.length} marks`}
            >
              <Plus size={12} />
              <span>{hiddenCount} more</span>
            </button>
          ) : null}
        </div>
      )}

      {/* Full Mark Selector Modal for Large Libraries */}
      <Modal
        open={selectorOpen}
        title="Select mark"
        subtitle={`Choose from your ${svgs.length} saved marks.`}
        onClose={() => setSelectorOpen(false)}
        width="md"
        zIndex="z-[80]"
        footer={
          <div className="flex items-center justify-between gap-3">
            {onOpenLibrary ? (
              <button
                type="button"
                onClick={() => {
                  setSelectorOpen(false);
                  onOpenLibrary();
                }}
                className="press focus-ring inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
              >
                <Shapes size={13} />
                <span>Manage library</span>
              </button>
            ) : (
              <span />
            )}
            <Button variant="surface" size="sm" onClick={() => setSelectorOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 pb-2">
          {/* Instant Search Bar */}
          {svgs.length >= 4 ? (
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search marks by name…"
                className="h-10 w-full rounded-xl border border-hairline bg-surface-2 pl-9 pr-8 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent focus:bg-surface-3"
                autoFocus
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          ) : null}

          {modalVisibleMarks.length === 0 ? (
            <div className="py-8 text-center">
              <p className="type-caption text-ink-faint">No marks match “{searchQuery}”.</p>
            </div>
          ) : (
            <div className="grid max-h-[22rem] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 md:grid-cols-5">
              {modalVisibleMarks.map((icon) => {
                const selected = value === icon.url;
                return (
                  <button
                    key={icon.id}
                    type="button"
                    title={icon.name}
                    aria-label={icon.name}
                    aria-pressed={selected}
                    onClick={() => {
                      onChange(selected ? null : icon.url);
                      setSelectorOpen(false);
                    }}
                    className={cn(
                      "press focus-ring group flex aspect-square flex-col items-center justify-center gap-2 rounded-xl p-2 transition-all duration-150",
                      selected
                        ? "border-2 border-accent bg-accent/15 text-accent"
                        : "border-2 border-transparent bg-surface-2/70 text-ink-muted hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    <SvgMark
                      url={icon.url}
                      fallback={icon.name}
                      size={28}
                      className="transition-transform group-hover:scale-110"
                    />
                    <span className="type-caption w-full truncate text-center text-[11px] font-medium">
                      {icon.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
