import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { Download, LockKeyhole, RefreshCw, Trash2, Upload } from "lucide-react";
import { getSessionState } from "@/lib/auth.functions";
import { exportVault, importVault, refreshPreviews, wipeVault } from "@/lib/vault.functions";
import { isSessionExpired, useToast, useVault, VAULT_KEY } from "@/hooks/useVault";
import { BottomNav, OfflineBanner, TopBar, useLock } from "@/components/store/chrome";
import { ConfirmDialog } from "@/components/store/ConfirmDialog";
import { Button, Toast } from "@/components/store/primitives";
import { PageBackdrop } from "@/components/store/PageBackdrop";
import type { ReactNode } from "react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — STORE" },
      { name: "description", content: "Backup, restore and session controls for your vault." },
      { property: "og:title", content: "Settings — STORE" },
      {
        property: "og:description",
        content: "Backup, restore and session controls for your vault.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  beforeLoad: async () => {
    const state = await getSessionState();
    if (!state.unlocked) throw redirect({ to: "/" });
  },
  component: SettingsPage,
});

function Group({
  label,
  children,
  danger,
}: {
  label: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className={danger ? "type-label px-1 text-error" : "type-label px-1"}>{label}</h2>
      <div className="overflow-hidden row-divide rounded-xl bg-surface elev-1">{children}</div>
    </section>
  );
}

function Row({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="type-title-sm">{title}</p>
        <p className="type-caption mt-0.5">{body}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function SettingsPage() {
  const navigate = useNavigate();
  const lock = useLock(() => setToast("Couldn't lock — check your connection"));
  const queryClient = useQueryClient();
  const { vault } = useVault();
  const { toast, setToast } = useToast();
  const refreshFn = useServerFn(refreshPreviews);
  const exportFn = useServerFn(exportVault);
  const importFn = useServerFn(importVault);
  const wipeFn = useServerFn(wipeVault);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"refresh" | "export" | "import" | "wipe" | null>(null);
  const [confirmWipeOpen, setConfirmWipeOpen] = useState(false);

  const refreshAll = async () => {
    if (busy !== null) return;
    setBusy("refresh");
    try {
      let offset = 0;
      let total = 0;
      // Bounded batches server-side; loop until the whole vault is done.
      for (;;) {
        const { count, remaining } = await refreshFn({ data: { sectionId: null, offset } });
        total += count;
        if (remaining === 0) break;
        offset += count;
      }
      await queryClient.invalidateQueries({ queryKey: VAULT_KEY });
      setToast(`Refreshed ${total} ${total === 1 ? "preview" : "previews"}`);
    } catch (cause) {
      if (!isSessionExpired(cause)) setToast("Couldn't refresh previews");
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setBusy("export");
    try {
      const payload = await exportFn();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `store-vault-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(href);
      setToast("Backup downloaded");
    } catch {
      setToast("Export failed");
    } finally {
      setBusy(null);
    }
  };

  // Zod validation failures serialize as a JSON array of issues — useless to a
  // human. Map those (and anything else opaque) onto plain-English copy.
  const importErrorMessage = (cause: unknown): string => {
    if (!(cause instanceof Error)) return "Import failed";
    if (cause.name === "ZodError" || cause.message.trim().startsWith("[")) {
      return "That file doesn't look like a STORE backup.";
    }
    return cause.message || "Import failed";
  };

  const restore = async (file: File) => {
    // The server rejects payloads over 2MB; match that cap client-side so
    // users get told before the upload instead of after a failed request.
    if (file.size > 2 * 1024 * 1024) {
      return setToast("File too large (max 2MB)");
    }
    setBusy("import");
    try {
      const payload = await file.text();
      const res = await importFn({ data: { payload } });
      const skippedNote =
        res.skipped > 0
          ? ` (${res.skipped} section${res.skipped === 1 ? "" : "s"} skipped — vault full)`
          : "";
      setToast(`Restored ${res.sections} sections and ${res.svgs} marks${skippedNote}`);
      await queryClient.invalidateQueries({ queryKey: VAULT_KEY });
    } catch (cause) {
      if (!isSessionExpired(cause)) setToast(importErrorMessage(cause));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleWipe = async () => {
    setConfirmWipeOpen(false);
    setBusy("wipe");
    try {
      await wipeFn();
      await queryClient.invalidateQueries({ queryKey: VAULT_KEY });
      setToast("All vault data wiped");
    } catch {
      setToast("Could not wipe vault");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageBackdrop />
      <OfflineBanner />
      <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 pb-32 md:pb-16">
        <TopBar
          title="Settings"
          eyebrow={`${vault.sections.length} sections · ${vault.svgs.length} marks`}
          back={{ to: "/home", label: "Vault" }}
        />

        <div className="flex flex-col gap-8">
          <Group label="Previews">
            <Row
              title="Refresh all previews"
              body="Re-fetch titles, descriptions and images for all links."
              action={
                <Button
                  variant="surface"
                  size="sm"
                  onClick={() => void refreshAll()}
                  disabled={busy !== null}
                >
                  <RefreshCw
                    size={15}
                    className={busy === "refresh" ? "animate-spin" : undefined}
                  />
                  {busy === "refresh" ? "Refreshing…" : "Refresh"}
                </Button>
              }
            />
          </Group>

          <Group label="Backup & Restore">
            <Row
              title="Export vault"
              body="Download every section, link and mark as JSON."
              action={
                <Button
                  variant="surface"
                  size="sm"
                  onClick={() => void download()}
                  disabled={busy !== null}
                >
                  <Download size={15} /> {busy === "export" ? "Exporting…" : "Export"}
                </Button>
              }
            />

            <Row
              title="Import vault"
              body="Restore from a previously exported JSON backup."
              action={
                <Button
                  variant="surface"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy !== null}
                >
                  <Upload size={15} /> {busy === "import" ? "Importing…" : "Import"}
                </Button>
              }
            />
          </Group>

          <Group label="Session">
            <Row
              title="Lock the vault"
              body="Ends this session in this browser."
              action={
                <Button size="sm" onClick={() => void lock()}>
                  <LockKeyhole size={15} /> Lock
                </Button>
              }
            />
          </Group>

          <Group label="Danger Zone" danger>
            <Row
              title="Wipe vault data"
              body="Permanently deletes all sections, links and marks."
              action={
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirmWipeOpen(true)}
                  disabled={busy !== null}
                >
                  <Trash2 size={15} /> {busy === "wipe" ? "Wiping…" : "Wipe vault"}
                </Button>
              }
            />
          </Group>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void restore(file);
          }}
        />
      </main>

      <BottomNav active="settings" addLabel="Vault" onAdd={() => void navigate({ to: "/home" })} />

      <ConfirmDialog
        open={confirmWipeOpen}
        title="Wipe all vault data?"
        body="This will permanently delete every section, link, action button and mark. This cannot be undone. Make sure you have downloaded a backup first."
        confirmLabel="Wipe everything"
        onConfirm={() => void handleWipe()}
        onCancel={() => setConfirmWipeOpen(false)}
      />

      <Toast message={toast} />
    </>
  );
}
