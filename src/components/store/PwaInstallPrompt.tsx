import { useEffect, useState } from "react";
import { ArrowUpRight, Download, Share, SquarePlus, X } from "lucide-react";
import { isIos, isStandalone } from "@/lib/pwa";
import { Button } from "./primitives";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = "store_pwa_install_dismissed_at";
const DISMISS_DAYS = 14; // Don't show again for 14 days if dismissed

// localStorage throws SecurityError in locked-down privacy modes/webviews —
// treat persistence as best-effort and never let it crash the prompt.
function readDismissedAt(): number | null {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    return raw === null ? null : Number.parseInt(raw, 10);
  } catch {
    return null;
  }
}

function writeDismissedAt(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, Date.now().toString());
  } catch {
    // Persistence unavailable; the banner may simply reappear next visit.
  }
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [iosDevice, setIosDevice] = useState(false);

  useEffect(() => {
    // 1. If already installed/standalone, never show
    if (isStandalone()) return;

    // 2. Check if user recently dismissed
    const dismissedAt = readDismissedAt();
    if (dismissedAt !== null && !Number.isNaN(dismissedAt)) {
      const elapsed = Date.now() - dismissedAt;
      if (elapsed < DISMISS_DAYS * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    const isAppleIos = isIos();
    setIosDevice(isAppleIos);

    const timers: number[] = [];

    // 3. Listen for Chromium/Android install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Gentle delay after page load before displaying banner
      timers.push(window.setTimeout(() => setVisible(true), 2500));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // If on iOS Safari, also gently show after delay
    if (isAppleIos) {
      timers.push(window.setTimeout(() => setVisible(true), 3500));
    }

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    setShowIosInstructions(false);
    writeDismissedAt();
  };

  const handleInstallClick = async () => {
    if (iosDevice) {
      setShowIosInstructions((prev) => !prev);
      return;
    }

    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
      } else {
        dismiss();
      }
    } catch {
      dismiss();
    } finally {
      setDeferredPrompt(null);
    }
  };

  if (!visible) return null;

  return (
    <aside
      aria-label="Install STORE App"
      className={cn(
        "fixed z-50 transition-all duration-300",
        // Desktop: Floating bottom-right card
        "sm:bottom-6 sm:right-6 sm:max-w-sm",
        // Mobile: Floating above bottom-nav / bottom sheet
        "inset-x-3 bottom-20 sm:inset-x-auto",
      )}
      style={{
        animation: "store-rise 300ms var(--ease-out-strong) both",
      }}
    >
      <div className="relative flex flex-col overflow-hidden rounded-2xl bg-surface-2/95 p-4 shadow-2xl backdrop-blur-xl border border-hairline elev-3">
        {/* Close Button */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install banner"
          className="press focus-ring absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-surface-3/60 text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <X size={14} />
        </button>

        <div className="flex items-start gap-3.5 pr-6">
          {/* App Icon (Current STORE Logo) */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-3 p-1">
            <img
              src="/store-icon-bg.svg"
              alt="STORE Logo"
              className="h-full w-full rounded-lg object-contain shadow-sm"
            />
          </div>

          {/* Title & Copy */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="type-title-sm font-semibold text-ink">Install STORE</h3>
              <span className="rounded bg-accent/15 px-1.5 py-0.2 text-[10px] font-medium text-accent">
                App
              </span>
            </div>
            <p className="type-caption mt-0.5 text-xs text-ink-muted leading-relaxed">
              {iosDevice
                ? "Install on your home screen for quick offline vault access."
                : "Faster launch, offline-ready & native standalone window."}
            </p>
          </div>
        </div>

        {/* iOS Step-by-Step Instructions Drawer */}
        {showIosInstructions ? (
          <div className="mt-3 flex flex-col gap-2 rounded-xl bg-surface-3/70 p-3 text-xs text-ink-muted">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface text-[11px] font-bold text-ink">
                1
              </span>
              <span>
                Tap the <strong className="text-ink">Share</strong> button{" "}
                <Share size={13} className="inline text-accent" /> in Safari.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface text-[11px] font-bold text-ink">
                2
              </span>
              <span>
                Select <strong className="text-ink">Add to Home Screen</strong>{" "}
                <SquarePlus size={13} className="inline text-accent" />.
              </span>
            </div>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="mt-3.5 flex items-center justify-end gap-2">
          <Button variant="surface" size="sm" onClick={dismiss} className="text-xs">
            Later
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleInstallClick()}
            className="text-xs font-medium"
          >
            {iosDevice ? (
              <>
                <span>How to Install</span>
                <ArrowUpRight size={14} />
              </>
            ) : (
              <>
                <Download size={14} />
                <span>Install Now</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </aside>
  );
}
