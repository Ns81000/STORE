import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { Download, LockKeyhole, RefreshCw, Upload } from "lucide-react";
import { getSessionState } from "@/lib/auth.functions";
import { exportVault, importVault, refreshPreviews } from "@/lib/vault.functions";
import { useToast, useVault } from "@/hooks/useVault";
import { BottomNav, OfflineBanner, TopBar, useLock } from "@/components/store/chrome";
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

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-label px-1">{label}</h2>
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
  const lock = useLock();
  const { vault } = useVault();
  const { toast, setToast } = useToast();
  const refreshFn = useServerFn(refreshPreviews);
  const exportFn = useServerFn(exportVault);
  const importFn = useServerFn(importVault);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"refresh" | "export" | "import" | null>(null);

  const refreshAll = async () => {
    setBusy("refresh");
    try {
      const { count } = await refreshFn({ data: { sectionId: null } });
      setToast(`Refreshed ${count} ${count === 1 ? "preview" : "previews"}`);
    } catch {
      setToast("Couldn't refresh previews");
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
      anchor.click();
      URL.revokeObjectURL(href);
      setToast("Backup downloaded");
    } catch {
      setToast("Export failed");
    } finally {
      setBusy(null);
    }
  };

  const restore = async (file: File) => {
    setBusy("import");
    try {
      const payload = await file.text();
      await importFn({ data: { payload } });
      setToast("Vault restored");
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : "Import failed");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
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
              body="Re-fetch titles, descriptions and images."
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

          <Group label="Backup">
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
                  <Download size={15} /> Export
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
      <BottomNav active="settings" addLabel="Vault" onAdd={() => window.location.assign("/home")} />
      <Toast message={toast} />
    </>
  );
}
