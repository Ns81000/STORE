import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Copy, Plus, Shapes, Trash2 } from "lucide-react";
import { createAsset, updateAsset } from "@/lib/vault.functions";
import { useVaultMutation } from "@/hooks/useVault";
import {
  MAX_ROWS,
  domainOf,
  initialsOf,
  toneForKey,
  type ActionMode,
  type Asset,
  type SvgIcon,
} from "@/lib/store.types";
import type { RowValues } from "@/lib/store.schemas";
import { Modal } from "./Modal";
import { SvgMark } from "./SvgMark";
import { SvgPicker } from "./SvgPicker";
import { Button, IconButton, SegmentedControl, Switch, TextInput } from "./primitives";
import { cn } from "@/lib/utils";

const MODE_OPTIONS = [
  { value: "open" as ActionMode, label: "Open", icon: <ArrowUpRight size={14} /> },
  { value: "copy" as ActionMode, label: "Copy", icon: <Copy size={14} /> },
];

const emptyRow = (): RowValues => ({ svgUrl: null, label: null, url: "", mode: "open" });

type AssetEditorProps = {
  open: boolean;
  sectionId: string;
  asset: Asset | null;
  svgs: readonly SvgIcon[];
  onClose: () => void;
  onDone: (message: string) => void;
  onOpenLibrary?: () => void;
};

/** One labelled block — keeps the composer's geometry on a single rhythm. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="type-label">{label}</span>
        {hint ? <span className="type-caption truncate">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}export function AssetEditor({
  open,
  sectionId,
  asset,
  svgs,
  onClose,
  onDone,
  onOpenLibrary,
}: AssetEditorProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [iconSvgUrl, setIconSvgUrl] = useState<string | null>(null);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [actionMode, setActionMode] = useState<ActionMode>("open");
  const [rows, setRows] = useState<RowValues[]>([]);
  const [activePickerRow, setActivePickerRow] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = useVaultMutation(useServerFn(createAsset));
  const update = useVaultMutation(useServerFn(updateAsset));
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setUrl(asset?.url ?? "");
    setTitle(asset?.title ?? "");
    setIconSvgUrl(asset?.iconSvgUrl ?? null);
    setPreviewEnabled(asset?.previewEnabled ?? true);
    setActionMode(asset?.actionMode ?? "open");
    setRows(
      asset?.rows.map((row) => ({
        svgUrl: row.svgUrl,
        label: row.label,
        url: row.url,
        mode: row.mode,
      })) ?? [],
    );
    setActivePickerRow(null);
    setError(null);
  }, [open, asset]);

  const patchRow = (index: number, patch: Partial<RowValues>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const submit = async () => {
    const cleanUrl = url.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) return setError("Enter a full URL starting with https://");

    if (rows.length > 0) {
      const emptyRowIndex = rows.findIndex((row) => !row.url.trim());
      if (emptyRowIndex !== -1) {
        return setError(
          `Row ${emptyRowIndex + 1} is empty. Enter a URL (https://…) or remove the row.`,
        );
      }
      const invalidRowIndex = rows.findIndex((row) => !/^https?:\/\//i.test(row.url.trim()));
      if (invalidRowIndex !== -1) {
        return setError(`Row ${invalidRowIndex + 1} needs a full URL starting with https://`);
      }
    }

    const payload = {
      sectionId,
      url: cleanUrl,
      title: title.trim() ? title.trim() : null,
      iconSvgUrl,
      previewEnabled,
      actionMode,
      rows: rows.map((row) => ({
        ...row,
        url: row.url.trim(),
        label: row.label?.trim() ? row.label.trim() : null,
      })),
    };

    try {
      if (asset) await update.mutateAsync({ data: { id: asset.id, ...payload } });
      else await create.mutateAsync({ data: payload });
      onDone(asset ? "Link updated" : "Link added");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the link.");
    }
  };

  const cleanUrl = url.trim();
  const hasValidUrl = /^https?:\/\//i.test(cleanUrl);
  const domain = hasValidUrl ? domainOf(cleanUrl) : "example.com";
  const displayTitle =
    title.trim() ||
    (asset && asset.url === cleanUrl ? asset.preview?.ogTitle : null) ||
    domain;

  const previewImageUrl =
    previewEnabled && hasValidUrl
      ? (asset && asset.url === cleanUrl && asset.preview?.ogImageUrl
          ? asset.preview.ogImageUrl
          : `https://s0.wp.com/mshots/v1/${encodeURIComponent(cleanUrl)}?w=600`)
      : null;

  return (
    <Modal
      open={open}
      title={asset ? "Edit link" : "Add link"}
      subtitle="Paste a URL — everything else is optional."
      onClose={onClose}
      width="2xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className={`type-caption truncate ${error ? "text-error" : ""}`}>
            {error ?? `${rows.length}/${MAX_ROWS} action rows configured`}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="surface" size="sm" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void submit()} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 pb-2 md:grid-cols-[18.5rem_minmax(0,1fr)] lg:grid-cols-[18.5rem_minmax(0,1fr)_16.5rem] lg:gap-7">
        {/* Column 1: Core Link Info & Appearance */}
        <div className="flex min-w-0 flex-col gap-5">
          <Field label="Link">
            <div className="flex flex-col gap-2.5">
              <TextInput
                value={url}
                autoFocus={!asset}
                inputMode="url"
                placeholder="https://example.com"
                onChange={(event) => setUrl(event.target.value)}
                invalid={Boolean(error)}
              />
              <TextInput
                value={title}
                placeholder="Title (optional — falls back to page title)"
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
          </Field>

          <Field label="Behaviour">
            <div className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3 hairline-soft">
              <div className="flex flex-col gap-1.5">
                <span className="type-label text-[10px] text-ink-faint">Default Action</span>
                <SegmentedControl
                  size="sm"
                  value={actionMode}
                  options={MODE_OPTIONS}
                  onChange={setActionMode}
                />
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="min-w-0">
                  <span className="type-title-sm block text-xs">Rich preview</span>
                  <span className="type-caption text-[11px] text-ink-faint">Fetch metadata & cover</span>
                </div>
                <Switch
                  checked={previewEnabled}
                  onChange={setPreviewEnabled}
                  label="Rich preview"
                />
              </div>
            </div>
          </Field>

          <SvgPicker
            label="Card mark"
            svgs={svgs}
            value={iconSvgUrl}
            onChange={setIconSvgUrl}
            onOpenLibrary={onOpenLibrary}
            compact
          />
        </div>

        {/* Column 2: Dedicated Action Rows Workspace */}
        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <span className="type-label">Action rows</span>
              <span className="type-caption ml-2 text-ink-faint">({rows.length}/{MAX_ROWS})</span>
            </div>
            <span className="type-caption text-ink-faint">
              Small one-tap buttons on card
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl bg-surface-2/60 px-5 py-12 text-center hairline-soft">
              <p className="type-title-sm text-ink-muted">No action rows yet</p>
              <p className="type-caption mt-1.5 max-w-xs text-ink-subtle">
                Add up to 6 quick buttons with their own URLs, custom marks and Open or Copy actions.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setRows((current) => [...current, emptyRow()])}
                className="mt-4"
              >
                <Plus size={14} /> Add first row
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {rows.map((row, index) => (
                <div
                  key={index}
                  className="animate-pop flex flex-col gap-2 rounded-xl bg-surface-2 p-3 hairline-soft"
                >
                  {/* Row Top Bar: Label, Full Mode SegmentedControl, Delete button */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="type-label text-ink-muted">Row {index + 1}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-[8.75rem]">
                        <SegmentedControl
                          size="sm"
                          value={row.mode}
                          options={MODE_OPTIONS}
                          onChange={(mode) => patchRow(index, { mode })}
                        />
                      </div>
                      <IconButton
                        label={`Delete row ${index + 1}`}
                        size="sm"
                        onClick={() => {
                          if (activePickerRow === index) setActivePickerRow(null);
                          setRows((current) => current.filter((_, i) => i !== index));
                        }}
                        className="h-8 w-8 text-ink-subtle hover:text-error"
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </div>

                  {/* Row Inputs: Mark Trigger, URL, Label */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      title={row.svgUrl ? "Change row mark" : "Add row mark"}
                      onClick={() =>
                        setActivePickerRow(activePickerRow === index ? null : index)
                      }
                      className={cn(
                        "press focus-ring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors",
                        row.svgUrl
                          ? "bg-surface-3 hover:bg-surface-3/80"
                          : "border border-dashed border-hairline bg-surface-3/40 text-ink-faint hover:border-hairline-strong hover:text-ink",
                        activePickerRow === index && "ring-1 ring-accent",
                      )}
                    >
                      {row.svgUrl ? (
                        <SvgMark url={row.svgUrl} fallback={row.label || `R${index + 1}`} size={18} />
                      ) : (
                        <Shapes size={14} />
                      )}
                    </button>

                    <TextInput
                      value={row.url}
                      inputMode="url"
                      placeholder="https://…"
                      className="h-9 min-w-0 flex-[1.6] bg-surface-3 text-sm"
                      onChange={(event) => patchRow(index, { url: event.target.value })}
                    />

                    <TextInput
                      value={row.label ?? ""}
                      placeholder="Label"
                      maxLength={30}
                      className="h-9 min-w-0 flex-1 bg-surface-3 text-sm"
                      onChange={(event) => patchRow(index, { label: event.target.value })}
                    />
                  </div>

                  {/* Row Mark Picker (Inline) */}
                  {activePickerRow === index ? (
                    <div className="animate-fade mt-1 rounded-lg bg-surface-3/90 p-2.5">
                      <SvgPicker
                        compact
                        label={`Row ${index + 1} mark`}
                        svgs={svgs}
                        value={row.svgUrl}
                        onChange={(next) => {
                          patchRow(index, { svgUrl: next });
                          setActivePickerRow(null);
                        }}
                        onOpenLibrary={onOpenLibrary}
                      />
                    </div>
                  ) : null}
                </div>
              ))}

              {rows.length < MAX_ROWS ? (
                <Button
                  variant="surface"
                  size="sm"
                  onClick={() => setRows((current) => [...current, emptyRow()])}
                  className="mt-1 self-start"
                >
                  <Plus size={14} /> Add row ({rows.length}/{MAX_ROWS})
                </Button>
              ) : null}
            </div>
          )}
        </div>

        {/* Column 3: Live Card Preview (Top on mobile, right column on desktop) */}
        <div className="order-first flex min-w-0 flex-col gap-3 lg:order-none">
          <span className="type-label">Live Card Preview</span>
          <div className="overflow-hidden rounded-xl bg-surface-2 elev-1">
            {previewEnabled ? (
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface">
                {previewImageUrl ? (
                  <img
                    key={previewImageUrl}
                    src={previewImageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-300"
                  />
                ) : (
                  <div
                    className="generated-cover flex h-full w-full flex-col items-center justify-center gap-2"
                    style={{ ["--tone" as string]: toneForKey(domain) }}
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-canvas/40 hairline-soft">
                      {iconSvgUrl ? (
                        <SvgMark url={iconSvgUrl} fallback={domain} size={24} />
                      ) : (
                        <span className="text-sm font-semibold" style={{ color: "var(--tone)" }}>
                          {initialsOf(domain)}
                        </span>
                      )}
                    </span>
                    <span className="type-caption">{domain}</span>
                  </div>
                )}
              </div>
            ) : null}
            <div className="flex flex-col gap-3 p-3.5">
              <div className="flex items-start gap-2.5">
                <SvgMark url={iconSvgUrl} fallback={domain} size={22} className="mt-0.5" />
                <div className="min-w-0">
                  <p className="type-title-sm truncate">{displayTitle}</p>
                  <p className="type-caption truncate">{domain}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={`inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium ${
                    actionMode === "copy"
                      ? "bg-surface-3 text-ink"
                      : "bg-accent text-on-accent"
                  }`}
                >
                  {actionMode === "copy" ? "Copy link" : "Open"}
                </span>
                {rows.map((row, index) => (
                  <span
                    key={index}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-3 text-ink-subtle"
                  >
                    {row.svgUrl ? (
                      <SvgMark url={row.svgUrl} fallback={row.label ?? "row"} size={15} />
                    ) : row.mode === "copy" ? (
                      <Copy size={13} />
                    ) : (
                      <ArrowUpRight size={13} />
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <p className="type-caption text-[11px] text-ink-faint">
            {previewEnabled
              ? "Live visual preview will be displayed on your card."
              : "Rich preview is disabled. Card will use a clean compact cover."}
          </p>
        </div>
      </div>
    </Modal>
  );
}
