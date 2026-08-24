import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { IconButton } from "./primitives";
import { cn } from "@/lib/utils";

export type MenuItem = {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  icon?: ReactNode;
};

type MenuProps = {
  items: readonly MenuItem[];
  label?: string;
  size?: "md" | "sm";
};

type Position = { top: number; left: number; origin: string };

const WIDTH = 200;
const GAP = 8;

/**
 * Responsive menu: Opens an iOS-style bottom action sheet on mobile phones,
 * and a floating positioned popover on desktop.
 */
export function Menu({ items, label = "More actions", size = "md" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const check = () => setIsMobile(query.matches);
    check();
    query.addEventListener("change", check);
    return () => query.removeEventListener("change", check);
  }, []);

  useLayoutEffect(() => {
    if (!open || isMobile) return setPosition(null);
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const height = Math.min(items.length * 40 + 12, window.innerHeight - 24);
    const flipUp = rect.bottom + GAP + height > window.innerHeight - 8;
    const left = Math.min(
      Math.max(8, rect.right - WIDTH),
      Math.max(8, window.innerWidth - WIDTH - 8),
    );
    setPosition({
      top: flipUp ? Math.max(8, rect.top - GAP - height) : rect.bottom + GAP,
      left,
      origin: flipUp ? "bottom right" : "top right",
    });
  }, [open, items.length, isMobile]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    if (!isMobile) {
      window.addEventListener("scroll", close, true);
    }
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [open, isMobile]);

  return (
    <>
      <IconButton
        ref={triggerRef}
        label={label}
        size={size}
        tone="solid"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          setOpen((value) => !value);
        }}
        className="bg-surface-2/80 backdrop-blur"
      >
        <MoreHorizontal size={16} />
      </IconButton>

      {open && isMobile
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-end justify-center">
              <button
                tabIndex={-1}
                type="button"
                aria-label="Close menu"
                className="animate-fade absolute inset-0 bg-canvas/70 backdrop-blur-sm"
                onClick={() => setOpen(false)}
              />
              <div
                ref={panelRef}
                role="menu"
                className="relative flex w-full flex-col overflow-hidden rounded-t-2xl bg-surface-2 p-3 pb-7 elev-3"
                style={{
                  animation: "store-rise 200ms var(--ease-out-strong) both",
                  paddingBottom: "max(1.75rem, env(safe-area-inset-bottom))",
                }}
              >
                <div className="mx-auto mb-3 mt-1 h-1 w-9 rounded-full bg-surface-3" />
                {label ? (
                  <p className="type-label mb-2.5 px-2 text-[11px] text-ink-faint">{label}</p>
                ) : null}
                <div className="flex flex-col gap-1">
                  {items.map((item) => (
                    <button
                      key={item.label}
                      role="menuitem"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpen(false);
                        item.onSelect();
                      }}
                      className={cn(
                        "press focus-ring flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-left text-sm font-medium transition-colors",
                        item.destructive
                          ? "bg-error/10 text-error active:bg-error/20"
                          : "bg-surface-3/40 text-ink hover:bg-surface-3 active:bg-surface-3/80",
                      )}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="press focus-ring mt-2.5 flex h-11 w-full items-center justify-center rounded-xl bg-surface-3 text-sm font-medium text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}

      {open && !isMobile && position
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              className="fixed z-[120] rounded-md bg-surface-2 p-1.5 elev-3"
              style={{
                top: position.top,
                left: position.left,
                width: WIDTH,
                transformOrigin: position.origin,
                animation: "store-pop 160ms var(--ease-out-strong) both",
              }}
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  role="menuitem"
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={cn(
                    "focus-ring flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-sm transition-colors duration-150",
                    item.destructive
                      ? "text-error hover:bg-error/15"
                      : "text-ink-muted hover:bg-surface-3 hover:text-ink",
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
