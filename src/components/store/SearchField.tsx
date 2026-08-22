import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

type SearchFieldProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  /** Optional live result count shown on the right while typing. */
  results?: string;
  shortcut?: boolean;
};

/** Pill search field with a "/" focus shortcut and inline clear. */
export function SearchField({ value, onChange, placeholder, results, shortcut }: SearchFieldProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (typing) return;
      if (event.key === "/" || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  return (
    <div className="group relative flex h-11 items-center rounded-pill bg-surface-2/80 pl-4 pr-2 transition-[background-color,box-shadow] duration-200 focus-within:bg-surface-3 focus-within:shadow-[var(--glow-accent)]">
      <Search size={16} className="pointer-events-none shrink-0 text-ink-faint" />
      <input
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent px-3 text-sm text-ink outline-none placeholder:text-ink-faint"
      />
      {value ? (
        <>
          {results ? <span className="type-caption mr-1 shrink-0">{results}</span> : null}
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="focus-ring inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-pill text-ink-subtle hover:text-ink"
          >
            <X size={15} />
          </button>
        </>
      ) : shortcut ? (
        <kbd className="type-caption mr-1.5 hidden shrink-0 rounded-sm bg-surface-3 px-1.5 py-0.5 text-[0.6875rem] sm:inline">
          /
        </kbd>
      ) : null}
    </div>
  );
}
