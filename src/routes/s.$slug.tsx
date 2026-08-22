import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { LayoutGrid, LockKeyhole, Plus, RefreshCw, Rows3 } from "lucide-react";
import { useStoredChoice, useToast, useVault, useVaultMutation } from "@/hooks/useVault";
import { getSessionState } from "@/lib/auth.functions";
import { deleteAsset, refreshPreview, refreshPreviews, reorderAssets } from "@/lib/vault.functions";
import { assetLabel, type Asset } from "@/lib/store.types";
import { AssetCard } from "@/components/store/cards";
import { SearchField } from "@/components/store/SearchField";
import { PageBackdrop } from "@/components/store/PageBackdrop";
import { SvgLibrary } from "@/components/store/SvgLibrary";
import { AssetEditor } from "@/components/store/AssetEditor";
import { ConfirmDialog } from "@/components/store/ConfirmDialog";
import { BottomNav, OfflineBanner, TopBar, useLock } from "@/components/store/chrome";
import { Button, EmptyState, IconButton, Skeleton, Toast } from "@/components/store/primitives";
import type { MenuItem } from "@/components/store/Menu";

export const Route = createFileRoute("/s/$slug")({
  head: ({ params }) => {
    const label = params.slug.replace(/-/g, " ");
    const title = `${label} — STORE`;
    return {
      meta: [
        { title },
        { name: "description", content: `Links saved in your ${label} section.` },
        { property: "og:title", content: title },
        { property: "og:description", content: `Links saved in your ${label} section.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },
  beforeLoad: async () => {
    const state = await getSessionState();
    if (!state.unlocked) throw redirect({ to: "/" });
  },
  component: SectionRoute,
});

function SectionRoute() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { vault, isPending } = useVault();
  const { toast, setToast } = useToast();
  const lock = useLock();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Asset | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [view, setView] = useStoredChoice<"preview" | "compact">("store:card-view", "preview", [
    "preview",
    "compact",
  ]);

  const removeAsset = useVaultMutation(useServerFn(deleteAsset));
  const reorder = useVaultMutation(useServerFn(reorderAssets));
  const refreshOne = useVaultMutation(useServerFn(refreshPreview));
  const refreshAll = useVaultMutation(useServerFn(refreshPreviews));

  const section = vault.sections.find((item) => item.slug === slug);

  if (!isPending && !section) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 pb-32">
        <TopBar title="Not found" back={{ to: "/home", label: "Vault" }} />
        <EmptyState
          title="This section is gone"
          body="It may have been renamed or deleted."
          action={<Button onClick={() => void navigate({ to: "/home" })}>Back to vault</Button>}
        />
      </main>
    );
  }

  const assets = section?.assets ?? [];

  // Search spans title, url, description and every action row label.
  const visible = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return assets;
    return assets.filter((asset) =>
      [
        asset.title ?? "",
        asset.url,
        asset.preview?.ogTitle ?? "",
        asset.preview?.ogDescription ?? "",
        ...asset.rows.map((row) => `${row.label ?? ""} ${row.url}`),
      ]
        .join(" ")
        .toLowerCase()
        .includes(clean),
    );
  }, [assets, query]);

  const move = async (index: number, delta: number) => {
    if (!section) return;
    const next = [...assets];
    const current = next[index];
    const swap = next[index + delta];
    if (!current || !swap) return;
    next[index] = swap;
    next[index + delta] = current;
    await reorder.mutateAsync({
      data: { sectionId: section.id, ids: next.map((asset) => asset.id) },
    });
  };

  const menuFor = (asset: Asset, index: number): MenuItem[] => {
    const items: MenuItem[] = [
      {
        label: "Edit link",
        onSelect: () => {
          setEditing(asset);
          setEditorOpen(true);
        },
      },
      {
        label: "Refresh preview",
        onSelect: async () => {
          setRefreshingId(asset.id);
          await refreshOne.mutateAsync({ data: { id: asset.id } });
          setRefreshingId(null);
          setToast("Preview refreshed");
        },
      },
    ];
    if (index > 0) items.push({ label: "Move up", onSelect: () => void move(index, -1) });
    if (index < assets.length - 1)
      items.push({ label: "Move down", onSelect: () => void move(index, 1) });
    items.push({
      label: "Delete link",
      destructive: true,
      onSelect: () => setPendingDelete(asset),
    });
    return items;
  };

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-32 md:pb-16">
      <PageBackdrop />
      <OfflineBanner />
      <TopBar
        back={{ to: "/home", label: "Vault" }}
        title={section?.name ?? "Loading"}
        actions={
          <>
            <IconButton
              label="Refresh all previews"
              onClick={async () => {
                if (!section) return;
                await refreshAll.mutateAsync({ data: { sectionId: section.id } });
                setToast("Previews refreshed");
              }}
            >
              <RefreshCw size={18} className={refreshAll.isPending ? "animate-spin" : undefined} />
            </IconButton>
            <IconButton label="Lock vault" onClick={() => void lock()}>
              <LockKeyhole size={18} />
            </IconButton>
            <Button size="sm" onClick={openNew} className="hidden md:inline-flex">
              <Plus size={16} /> Link
            </Button>
          </>
        }
        below={
          assets.length > 0 ? (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <SearchField
                shortcut
                value={query}
                onChange={setQuery}
                placeholder={`Search ${assets.length} ${assets.length === 1 ? "link" : "links"}`}
                results={`${visible.length} found`}
              />
              <div className="flex shrink-0 items-center gap-0.5 rounded-pill bg-surface-2/80 p-1">
                <IconButton
                  label="Preview cards"
                  size="sm"
                  onClick={() => setView("preview")}
                  className={view === "preview" ? "bg-surface-3 text-ink" : "text-ink-faint"}
                >
                  <LayoutGrid size={16} />
                </IconButton>
                <IconButton
                  label="Compact list"
                  size="sm"
                  onClick={() => setView("compact")}
                  className={view === "compact" ? "bg-surface-3 text-ink" : "text-ink-faint"}
                >
                  <Rows3 size={16} />
                </IconButton>
              </div>
            </div>
          ) : null
        }
      />

      {isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-64" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          title="No links here yet"
          body="Paste any URL — STORE pulls the title, description and image automatically."
          action={
            <Button onClick={openNew}>
              <Plus size={16} /> Add link
            </Button>
          }
        />
      ) : (
        <div
          className={
            view === "compact"
              ? "flex flex-col gap-2"
              : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          }
        >
          {visible.length === 0 ? (
            <p className="type-caption col-span-full py-10 text-center">
              No link matches “{query}”.
            </p>
          ) : null}
          {visible.map((asset, index) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              index={index}
              compact={view === "compact"}
              menu={menuFor(asset, index)}
              onToast={setToast}
              refreshing={refreshingId === asset.id}
            />
          ))}
        </div>
      )}

      <BottomNav active="home" addLabel="Link" onAdd={openNew} />

      {section ? (
        <AssetEditor
          open={editorOpen}
          sectionId={section.id}
          asset={editing}
          svgs={vault.svgs}
          onClose={() => setEditorOpen(false)}
          onDone={setToast}
          onOpenLibrary={() => setLibraryOpen(true)}
        />
      ) : null}

      <SvgLibrary
        open={libraryOpen}
        svgs={vault.svgs}
        onClose={() => setLibraryOpen(false)}
        onDone={setToast}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this link?"
        body={pendingDelete ? `${assetLabel(pendingDelete)} will be removed for good.` : ""}
        confirmLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (!target) return;
          await removeAsset.mutateAsync({ data: { id: target.id } });
          setToast("Link deleted");
        }}
      />
      <Toast message={toast} />
    </main>
  );
}
