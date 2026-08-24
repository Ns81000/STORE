import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { LockKeyhole, Plus, Settings, Shapes } from "lucide-react";
import {
  isSessionExpired,
  useVault,
  useVaultMutation,
  useToast,
  VAULT_KEY,
} from "@/hooks/useVault";
import { getSessionState } from "@/lib/auth.functions";
import { deleteSection, reorderSections } from "@/lib/vault.functions";
import { MAX_SECTIONS, type Section, type Vault } from "@/lib/store.types";
import { SectionTile } from "@/components/store/cards";
import { SectionModal } from "@/components/store/SectionModal";
import { SvgLibrary } from "@/components/store/SvgLibrary";
import { ConfirmDialog } from "@/components/store/ConfirmDialog";
import { BottomNav, OfflineBanner, TopBar, useLock } from "@/components/store/chrome";
import { PageBackdrop } from "@/components/store/PageBackdrop";
import { Button, EmptyState, IconButton, Skeleton, Toast } from "@/components/store/primitives";
import type { MenuItem } from "@/components/store/Menu";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Vault — STORE" },
      { name: "description", content: "Your sections: every saved link, one tap away." },
      { property: "og:title", content: "Vault — STORE" },
      { property: "og:description", content: "Your sections: every saved link, one tap away." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  beforeLoad: async () => {
    const state = await getSessionState();
    if (!state.unlocked) throw redirect({ to: "/" });
  },
  component: HomeRoute,
});

/** Bento spans keep five tiles filling the grid at any count. */
const SPANS: Record<number, string[]> = {
  1: ["md:col-span-6 md:row-span-2"],
  2: ["md:col-span-3 md:row-span-2", "md:col-span-3 md:row-span-2"],
  3: ["md:col-span-4 md:row-span-2", "md:col-span-2", "md:col-span-2"],
  4: ["md:col-span-4 md:row-span-2", "md:col-span-2", "md:col-span-3", "md:col-span-3"],
  5: [
    "md:col-span-4 md:row-span-2",
    "md:col-span-2",
    "md:col-span-2",
    "md:col-span-3",
    "md:col-span-3",
  ],
};

function HomeRoute() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { vault, isPending, isError, error, refetch } = useVault();
  const { toast, setToast } = useToast();
  const lock = useLock(() => setToast("Couldn't lock — check your connection"));

  const [editing, setEditing] = useState<Section | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Section | null>(null);

  const removeSection = useVaultMutation(useServerFn(deleteSection));
  const reorder = useVaultMutation(useServerFn(reorderSections));

  const sections = vault.sections;
  const spans = useMemo(() => SPANS[Math.min(sections.length, 5)] ?? [], [sections.length]);
  const atLimit = sections.length >= MAX_SECTIONS;

  const move = async (index: number, delta: number) => {
    if (reorder.isPending) return;
    const next = [...sections];
    const current = next[index];
    const swap = next[index + delta];
    if (!current || !swap) return;
    next[index] = swap;
    next[index + delta] = current;

    // Optimistic: swap locally so tiles respond instantly; the mutation's
    // onSettled invalidation reconciles with the server order.
    const previous = queryClient.getQueryData<Vault>(VAULT_KEY);
    queryClient.setQueryData<Vault>(VAULT_KEY, (currentVault) =>
      currentVault ? { ...currentVault, sections: next } : currentVault,
    );
    try {
      await reorder.mutateAsync({ data: { ids: next.map((section) => section.id) } });
    } catch (cause) {
      if (previous) queryClient.setQueryData(VAULT_KEY, previous);
      if (!isSessionExpired(cause)) setToast("Couldn't move that section");
    }
  };

  const menuFor = (section: Section, index: number): MenuItem[] => {
    const items: MenuItem[] = [
      {
        label: "Edit section",
        onSelect: () => {
          setEditing(section);
          setModalOpen(true);
        },
      },
    ];
    if (index > 0) items.push({ label: "Move earlier", onSelect: () => void move(index, -1) });
    if (index < sections.length - 1)
      items.push({ label: "Move later", onSelect: () => void move(index, 1) });
    items.push({
      label: "Delete section",
      destructive: true,
      onSelect: () => setPendingDelete(section),
    });
    return items;
  };

  const openNew = () => {
    if (atLimit) return setToast(`Five sections is the limit — edit one instead.`);
    setEditing(null);
    setModalOpen(true);
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-32 md:pb-16">
      <PageBackdrop />
      <OfflineBanner />
      <TopBar
        eyebrow={`${sections.length}/${MAX_SECTIONS} sections`}
        title="Vault"
        actions={
          <>
            <IconButton label="SVG library" onClick={() => setLibraryOpen(true)}>
              <Shapes size={18} />
            </IconButton>
            <IconButton label="Settings" onClick={() => void navigate({ to: "/settings" })}>
              <Settings size={18} />
            </IconButton>
            <IconButton label="Lock vault" onClick={() => void lock()}>
              <LockKeyhole size={18} />
            </IconButton>
            <Button
              size="sm"
              onClick={openNew}
              disabled={atLimit}
              className="hidden md:inline-flex"
            >
              <Plus size={16} /> Section
            </Button>
          </>
        }
      />

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-6">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className={`h-40 ${SPANS[5]?.[index] ?? ""}`} />
          ))}
        </div>
      ) : isError && !isSessionExpired(error) ? (
        <EmptyState
          title="Couldn't load the vault"
          body="STORE couldn't reach the server. Check your connection and try again."
          action={<Button onClick={() => void refetch()}>Try again</Button>}
        />
      ) : sections.length === 0 ? (
        <EmptyState
          title="Nothing stored yet"
          body="Create your first section — think Design, Work, Reading. Each one holds its own links."
          action={
            <Button onClick={openNew}>
              <Plus size={16} /> Create section
            </Button>
          }
        />
      ) : (
        <div className="grid auto-rows-[minmax(11rem,1fr)] gap-3.5 sm:grid-cols-2 md:grid-cols-6">
          {sections.map((section, index) => (
            <div key={section.id} className={spans[index] ?? "md:col-span-2"}>
              <SectionTile section={section} index={index} menu={menuFor(section, index)} />
            </div>
          ))}
        </div>
      )}

      <BottomNav active="home" addLabel="Section" onAdd={openNew} />

      <SectionModal
        open={modalOpen}
        section={editing}
        svgs={vault.svgs}
        onClose={() => setModalOpen(false)}
        onDone={setToast}
        onOpenLibrary={() => {
          setModalOpen(false);
          setLibraryOpen(true);
        }}
      />
      <SvgLibrary
        open={libraryOpen}
        svgs={vault.svgs}
        onClose={() => setLibraryOpen(false)}
        onDone={setToast}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.name ?? ""}?`}
        body="Every link inside this section is deleted too. This cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (!target) return;
          try {
            await removeSection.mutateAsync({ data: { id: target.id } });
            setToast("Section deleted");
          } catch (cause) {
            if (!isSessionExpired(cause)) setToast("Couldn't delete the section");
          }
        }}
      />
      <Toast message={toast} />
    </main>
  );
}
