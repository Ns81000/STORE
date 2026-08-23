import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Copy, Globe, Grid, Plus, Search, Shapes, Trash2, X } from "lucide-react";
import { createSvg, deleteSvg } from "@/lib/vault.functions";
import { useVaultMutation } from "@/hooks/useVault";
import { MAX_SVGS, type SvgIcon } from "@/lib/store.types";
import { Modal } from "./Modal";
import { ConfirmDialog } from "./ConfirmDialog";
import { SvgMark } from "./SvgMark";
import { Button, SegmentedControl, TextInput } from "./primitives";

type SvgLibraryProps = {
  open: boolean;
  svgs: readonly SvgIcon[];
  onClose: () => void;
  onDone: (message: string) => void;
};

const SUGGESTED_MARKS = [
  { name: "GitHub", url: "https://cdn.simpleicons.org/github/white" },
  { name: "YouTube", url: "https://cdn.simpleicons.org/youtube/ff0000" },
  { name: "Notion", url: "https://cdn.simpleicons.org/notion/white" },
  { name: "VS Code", url: "https://cdn.simpleicons.org/visualstudiocode/007acc" },
  { name: "Figma", url: "https://cdn.simpleicons.org/figma" },
  { name: "Discord", url: "https://cdn.simpleicons.org/discord/5865f2" },
  { name: "Google", url: "https://cdn.simpleicons.org/google" },
  { name: "X", url: "https://cdn.simpleicons.org/x/white" },
  { name: "React", url: "https://cdn.simpleicons.org/react/61dafb" },
  { name: "Tailwind", url: "https://cdn.simpleicons.org/tailwindcss/38bdf8" },
  { name: "OpenAI", url: "https://cdn.simpleicons.org/openai/white" },
] as const;

export function SvgLibrary({ open, svgs, onClose, onDone }: SvgLibraryProps) {
  const [activeTab, setActiveTab] = useState<"marks" | "add">("marks");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SvgIcon | null>(null);
  const [inspecting, setInspecting] = useState<SvgIcon | null>(null);

  const add = useVaultMutation(useServerFn(createSvg));
  const remove = useVaultMutation(useServerFn(deleteSvg));

  const cleanUrl = url.trim();
  const previewable = /^https?:\/\/\S+$/i.test(cleanUrl);

  const visible = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return svgs;
    return svgs.filter((icon) => icon.name.toLowerCase().includes(clean));
  }, [svgs, query]);

  const full = svgs.length >= MAX_SVGS;

  const submit = async () => {
    const cleanName = name.trim();
    if (full) return setError(`The library holds ${MAX_SVGS} marks — delete one first.`);
    if (!cleanName) return setError("Name the mark.");
    if (!previewable) return setError("Paste a full https:// URL.");
    try {
      await add.mutateAsync({ data: { name: cleanName, url: cleanUrl } });
      setName("");
      setUrl("");
      setError(null);
      setActiveTab("marks");
      onDone("Mark saved to library");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the mark.");
    }
  };

  const applyPreset = (preset: (typeof SUGGESTED_MARKS)[number]) => {
    setName(preset.name);
    setUrl(preset.url);
    setError(null);
  };

  // Composer Form Component (shared across desktop left pane & mobile Add tab)
  const composer = (
    <div className="flex flex-col gap-4 rounded-xl bg-surface-2 p-4">
      <div className="flex items-center justify-between">
        <span className="type-label text-ink-muted">Add New Mark</span>
        <span className="type-caption text-xs text-ink-faint">
          {svgs.length}/{MAX_SVGS} marks
        </span>
      </div>

      {/* Live Preview Card */}
      <div className="flex items-center gap-3.5 rounded-lg bg-surface-3/60 p-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-3">
          {previewable ? (
            <SvgMark key={cleanUrl} url={cleanUrl} fallback={name || "?"} size={32} />
          ) : (
            <Shapes size={22} className="text-ink-faint" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="type-title-sm truncate text-ink">{name || "Untitled Mark"}</p>
          <p className="type-caption truncate text-xs text-ink-faint">
            {previewable ? cleanUrl : "Paste icon URL below"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <TextInput
          label="Mark Name"
          value={name}
          placeholder="e.g. GitHub"
          maxLength={40}
          className="bg-surface-3"
          onChange={(event) => setName(event.target.value)}
        />
        <TextInput
          label="Image or SVG URL"
          value={url}
          inputMode="url"
          placeholder="https://cdn.simpleicons.org/..."
          className="bg-surface-3"
          onChange={(event) => setUrl(event.target.value)}
          hint={error ?? (previewable ? "Preview loaded above" : undefined)}
          invalid={Boolean(error)}
        />
      </div>

      {/* Resource link: thesvg.org */}
      <a
        href="https://thesvg.org/"
        target="_blank"
        rel="noreferrer noopener"
        className="press focus-ring flex items-center justify-between rounded-lg bg-surface-3/60 px-3 py-2 text-xs text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
      >
        <span className="flex items-center gap-2">
          <Globe size={13} className="text-accent" />
          <span>
            Find SVGs on <strong className="text-ink">thesvg.org</strong>
          </span>
        </span>
        <ArrowUpRight size={13} className="text-ink-faint" />
      </a>

      {/* Quick 1-Click Presets */}
      <div className="flex flex-col gap-1.5 pt-0.5">
        <span className="type-label text-[10px] text-ink-faint">Popular Presets:</span>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_MARKS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyPreset(preset)}
              className="press focus-ring rounded-md bg-surface-3 px-2 py-0.5 text-xs text-ink-muted transition-colors hover:bg-surface-3/80 hover:text-ink"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2">
        <Button
          size="md"
          className="w-full justify-center"
          onClick={() => void submit()}
          disabled={add.isPending || full}
        >
          <Plus size={16} /> {full ? "Library Full" : "Add to Library"}
        </Button>
      </div>
    </div>
  );

  // Marks Grid Component (shared across desktop right pane & mobile Marks tab)
  const marksGrid = (
    <div className="flex flex-1 flex-col gap-3.5">
      {/* Search Bar with unclipped border */}
      {svgs.length > 0 ? (
        <div className="relative pt-0.5">
          <Search
            size={14}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            placeholder={`Search ${svgs.length} marks…`}
            className="h-10 w-full rounded-xl border border-hairline bg-surface-2 pl-9 pr-8 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent focus:bg-surface-3"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Grid of Marks */}
      {svgs.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl bg-surface-2 px-6 py-12 text-center">
          <Shapes size={36} className="mb-3 text-ink-faint" />
          <p className="type-title-sm text-ink">Your library is empty</p>
          <p className="type-caption mx-auto mt-1.5 max-w-xs text-xs">
            Marks are reusable icons for your sections, links and action buttons.
          </p>
          <div className="mt-4 lg:hidden">
            <Button size="sm" onClick={() => setActiveTab("add")}>
              <Plus size={14} /> Add your first mark
            </Button>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl bg-surface-2 py-10 text-center">
          <p className="type-caption text-ink-faint">No marks match “{query}”.</p>
        </div>
      ) : (
        <ul className="grid max-h-[30rem] grid-cols-3 gap-2.5 overflow-y-auto p-1 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((icon) => (
            <li key={icon.id}>
              <button
                type="button"
                onClick={() => setInspecting(icon)}
                className="press focus-ring flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl bg-surface-2/70 p-2.5 transition-all duration-150 hover:bg-surface-2 hover:-translate-y-0.5"
              >
                <SvgMark
                  url={icon.url}
                  fallback={icon.name}
                  size={36}
                  className="transition-transform group-hover:scale-105"
                />
                <span className="type-caption w-full truncate text-center text-xs font-medium text-ink-muted">
                  {icon.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <>
      <Modal
        open={open}
        title="Mark Library"
        subtitle={`${svgs.length} of ${MAX_SVGS} marks saved — reusable across sections, links and action rows.`}
        onClose={onClose}
        width="xl"
      >
        <div className="flex flex-col gap-4 pb-2">
          {/* Mobile View Switcher (< 1024px) */}
          <div className="lg:hidden">
            <SegmentedControl
              value={activeTab}
              onChange={setActiveTab}
              options={[
                {
                  value: "marks",
                  label: `Saved Marks (${svgs.length})`,
                  icon: <Grid size={14} />,
                },
                {
                  value: "add",
                  label: "Add New Mark",
                  icon: <Plus size={14} />,
                },
              ]}
            />
          </div>

          {/* Mobile View: Render active tab */}
          <div className="lg:hidden">{activeTab === "marks" ? marksGrid : composer}</div>

          {/* Desktop View (>= 1024px): Panoramic 2-Column Workstation */}
          <div className="hidden lg:grid lg:grid-cols-[20.5rem_minmax(0,1fr)] lg:gap-6 lg:items-start">
            {composer}
            {marksGrid}
          </div>
        </div>
      </Modal>

      {/* Mark Details Inspection Modal (Mobile tap & Desktop details) */}
      <Modal
        open={inspecting !== null}
        title={inspecting?.name ?? "Mark Details"}
        subtitle="Saved mark in your library"
        onClose={() => setInspecting(null)}
        width="sm"
        zIndex="z-[85]"
      >
        {inspecting ? (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-2 p-3">
              <SvgMark url={inspecting.url} fallback={inspecting.name} size={48} />
            </div>
            <div className="w-full">
              <p className="type-title-sm text-ink">{inspecting.name}</p>
              <p className="type-caption truncate mt-1 text-xs text-ink-faint">{inspecting.url}</p>
            </div>
            <div className="flex w-full gap-2 pt-2">
              <Button
                variant="surface"
                size="sm"
                className="flex-1 justify-center"
                onClick={async () => {
                  await navigator.clipboard.writeText(inspecting.url);
                  onDone("Mark URL copied");
                }}
              >
                <Copy size={14} /> Copy URL
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="flex-1 justify-center"
                onClick={() => {
                  const toDelete = inspecting;
                  setInspecting(null);
                  setPendingDelete(toDelete);
                }}
              >
                <Trash2 size={14} /> Delete
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Safe Delete Confirmation Dialog */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete "${pendingDelete?.name}"?`}
        body="This mark will be permanently removed from your library."
        confirmLabel="Delete mark"
        onConfirm={async () => {
          if (!pendingDelete) return;
          const target = pendingDelete;
          setPendingDelete(null);
          await remove.mutateAsync({ data: { id: target.id } });
          onDone(`Deleted ${target.name}`);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
