import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "./primitives";
import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg" | "xl" | "2xl";
  zIndex?: string;
};

const WIDTH = {
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-3xl",
  xl: "sm:max-w-5xl",
  "2xl": "sm:max-w-[78rem]",
} as const;

/**
 * Centred command-style modal on tablet+, full-height sheet on phones.
 * Borderless: separation comes from surface steps and elevation.
 * Portaled to document.body to prevent parent transform containment traps.
 */
export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = "md",
  zIndex = "z-[70]",
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const modalNode = (
    <div
      className={cn("fixed inset-0 flex items-end justify-center sm:items-center sm:p-6", zIndex)}
    >
      <button
        tabIndex={-1}
        aria-label="Close"
        onClick={onClose}
        className="animate-fade absolute inset-0 bg-canvas/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl bg-surface elev-3",
          "sm:rounded-xl",
          WIDTH[width],
        )}
        style={{
          animation: "store-pop 260ms var(--ease-out-strong) both",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
          <div className="min-w-0">
            <h2 className="type-display-sm truncate">{title}</h2>
            {subtitle ? <p className="type-caption mt-1">{subtitle}</p> : null}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 sm:px-7">{children}</div>
        {footer ? <div className="bg-surface-2/60 px-5 py-4 sm:px-7">{footer}</div> : null}
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}
