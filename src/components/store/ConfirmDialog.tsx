import { useEffect } from "react";
import { Button } from "./primitives";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-5">
      <button
        aria-label="Cancel"
        tabIndex={-1}
        onClick={onCancel}
        className="animate-fade absolute inset-0 bg-canvas/70 backdrop-blur-sm"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-sm rounded-xl bg-surface p-6 elev-3"
        style={{ animation: "store-pop 220ms var(--ease-out-strong) both" }}
      >
        <h2 className="type-display-sm">{title}</h2>
        <p className="type-body mt-2.5 text-ink-muted">{body}</p>
        <div className="mt-7 flex justify-end gap-2">
          <Button variant="surface" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
