import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Home, Plus, Settings } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { lockStore } from "@/lib/auth.functions";
import { useOnline } from "@/hooks/useVault";
import { IconButton } from "./primitives";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="animate-fade sticky top-0 z-40 bg-warm px-4 py-2 text-center text-sm font-medium text-on-accent">
      Offline — showing the last loaded vault.
    </div>
  );
}

type TopBarProps = {
  eyebrow?: string;
  title: string;
  back?: { to: string; label: string };
  actions?: ReactNode;
  below?: ReactNode;
};

export function TopBar({ eyebrow, title, back, actions, below }: TopBarProps) {
  return (
    <header className="mb-9 pt-8 sm:pt-12">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="min-w-0">
          {back ? (
            <Link
              to={back.to}
              className="focus-ring type-label mb-6 inline-flex items-center gap-1.5 rounded-sm transition-colors duration-150 hover:text-ink"
            >
              <ArrowLeft size={12} /> {back.label}
            </Link>
          ) : eyebrow ? (
            <p className="type-label mb-6">{eyebrow}</p>
          ) : null}
          <h1 className="type-display-lg truncate">{title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      </div>
      {below ? <div className="mt-6">{below}</div> : null}
    </header>
  );
}

/** Hides the thumb bar while scrolling down, brings it back on scroll up. */
function useHideOnScroll() {
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    last.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - last.current;
      if (Math.abs(delta) > 8) {
        setHidden(delta > 0 && y > 90);
        last.current = y;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return hidden;
}

type BottomNavProps = {
  onAdd: () => void;
  addLabel: string;
  active: "home" | "settings";
};

export function BottomNav({ onAdd, addLabel, active }: BottomNavProps) {
  const navigate = useNavigate();
  const hidden = useHideOnScroll();

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 md:hidden",
        hidden && "translate-y-[calc(100%+1rem)]",
      )}
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom), 10px)",
        transitionTimingFunction: "var(--ease-out-strong)",
      }}
    >
      <div className="mx-auto flex w-fit items-center gap-1 rounded-pill bg-surface-2/90 p-1.5 backdrop-blur-xl elev-3">
        <IconButton
          label="Sections"
          size="sm"
          onClick={() => void navigate({ to: "/home" })}
          className={cn("h-10 w-10", active === "home" ? "text-ink" : "text-ink-muted")}
        >
          <Home size={18} />
        </IconButton>
        <button
          type="button"
          onClick={onAdd}
          aria-label={addLabel}
          className="press focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-pill bg-accent px-4 text-sm font-medium text-on-accent"
        >
          <Plus size={16} />
          {addLabel}
        </button>
        <IconButton
          label="Settings"
          size="sm"
          onClick={() => void navigate({ to: "/settings" })}
          className={cn("h-10 w-10", active === "settings" ? "text-ink" : "text-ink-muted")}
        >
          <Settings size={18} />
        </IconButton>
      </div>
    </nav>
  );
}

export function useLock() {
  const navigate = useNavigate();
  const lock = useServerFn(lockStore);
  return async () => {
    await lock();
    await navigate({ to: "/" });
  };
}
