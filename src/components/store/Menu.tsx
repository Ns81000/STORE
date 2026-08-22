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
 * The popover renders in a portal with fixed coordinates, so a card with
 * `overflow-hidden` or a tight grid cell can never clip it. It flips up or
 * left when it would leave the viewport.
 */
export function Menu({ items, label = "More actions", size = "md" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return setPosition(null);
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
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointer = (event: MouseEvent) => {
      // SAFETY: a mousedown target from a document listener is always a DOM Node.
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

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

      {open && position
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
