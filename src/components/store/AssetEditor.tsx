import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Copy, Plus, Trash2 } from "lucide-react";
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
}

export function AssetEditor({
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
    setError(null);
  }, [open, asset]);

  const patchRow = (index: number, patch: Partial<RowValues>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const submit = async () => {
    const cleanUrl = url.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) return setError("Enter a full URL starting with https://");
    const cleanRows = rows.filter((row) => row.url.trim().length > 0);
    if (cleanRows.some((row) => !/^https?:\/\//i.test(row.url.trim()))) {
      return setError("Every action row needs a full https:// URL.");
    }

    const payload = {
      sectionId,
      url: cleanUrl,
      title: title.trim() ? title.trim() : null,
      iconSvgUrl,
      previewEnabled,
      actionMode,
      rows: cleanRows.map((row) => ({
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

  const domain = url.trim() ? domainOf(url.trim()) : "example.com";
  const displayTitle = title.trim() || asset?.preview?.ogTitle || domain;

  return (
    <Modal
      open={open}
      title={asset ? "Edit link" : "Add link"}
      subtitle="Paste a URL — everything else is optional."
      onClose={onClose}
      width="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className={`type-caption truncate ${error ? "text-error" : ""}`}>
            {error ?? `${rows.length}/${MAX_ROWS} action rows`}
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
      <div className="grid gap-8 pb-2 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-10">
        <div className="flex min-w-0 flex-col gap-7">
          <Field label="Link">
            <div className="flex flex-col gap-3">
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
                placeholder="Title (optional — falls back to the page title)"
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
          </Field>

          <Field label="Behaviour">
            <div className="grid gap-3 sm:grid-cols-2">
              <SegmentedControl
                value={actionMode}
                options={MODE_OPTIONS}
                onChange={setActionMode}
              />
              <div className="flex h-11 min-w-0 items-center justify-between gap-3 rounded-md bg-surface-2 pl-3.5 pr-2.5">
                <span className="type-title-sm min-w-0 truncate">Rich preview</span>
                <Switch checked={previewEnabled} onChange={setPreviewEnabled} label="Rich preview" />
              </div>
            </div>
          </Field>

          <SvgPicker
            label="Mark"
            svgs={svgs}
            value={iconSvgUrl}
            onChange={setIconSvgUrl}
            onOpenLibrary={onOpenLibrary}
          />

          <Field label="Action rows" hint="Small one-tap buttons on the card">
            <div className="flex flex-col gap-3">
              {rows.map((row, index) => (
                <div
                  key={index}
                  className="animate-pop flex flex-col gap-2.5 rounded-lg bg-surface-2 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="type-label">Row {index + 1}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-[9.5rem]">
                        <SegmentedControl
                          size="sm"
                          value={row.mode}
                          options={MODE_OPTIONS}
                          onChange={(mode) => patchRow(index, { mode })}
                        />
                      </div>
                      <IconButton
                        label="Remove row"
                        size="sm"
                        onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                        className="hover:text-error"
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                    <TextInput
                      value={row.url}
                      inputMode="url"
                      placeholder="https://…"
                      className="h-9 bg-surface-3 text-sm"
                      onChange={(event) => patchRow(index, { url: event.target.value })}
                    />
                    <TextInput
                      value={row.label ?? ""}
                      placeholder="Label"
                      maxLength={40}
                      className="h-9 bg-surface-3 text-sm"
                      onChange={(event) => patchRow(index, { label: event.target.value })}
                    />
                  </div>

                  <SvgPicker
                    compact
                    label=""
                    svgs={svgs}
                    value={row.svgUrl}
                    onChange={(next) => patchRow(index, { svgUrl: next })}
                  />
                </div>
              ))}

              <Button
                variant="surface"
                size="sm"
                disabled={rows.length >= MAX_ROWS}
                onClick={() => setRows((current) => [...current, emptyRow()])}
                className="self-start"
              >
                <Plus size={14} /> Add row
              </Button>
            </div>
          </Field>
        </div>

        {/* Live card preview — desktop only, the phone sheet keeps one column. */}
        <aside className="hidden lg:flex lg:flex-col lg:gap-3">
          <span className="type-label">Preview</span>
          <div className="overflow-hidden rounded-xl bg-surface-2 elev-1">
            {previewEnabled ? (
              <div
                className="generated-cover flex aspect-[16/9] flex-col items-center justify-center gap-2"
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
          <p className="type-caption">
            Real title, description and artwork are fetched right after you save.
          </p>
        </aside>
      </div>
    </Modal>
  );
}
