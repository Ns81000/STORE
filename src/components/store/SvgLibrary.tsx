import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search, Trash2 } from "lucide-react";
import { createSvg, deleteSvg } from "@/lib/vault.functions";
import { useVaultMutation } from "@/hooks/useVault";
import { MAX_SVGS, type SvgIcon } from "@/lib/store.types";
import { Modal } from "./Modal";
import { SvgMark } from "./SvgMark";
import { Button, IconButton, TextInput } from "./primitives";

type SvgLibraryProps = {
  open: boolean;
  svgs: readonly SvgIcon[];
  onClose: () => void;
  onDone: (message: string) => void;
};

export function SvgLibrary({ open, svgs, onClose, onDone }: SvgLibraryProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

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
      onDone("Mark saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the mark.");
    }
  };

  return (
    <Modal
      open={open}
      title="Mark library"
      subtitle={`${svgs.length} of ${MAX_SVGS} marks — reusable across sections, links and action rows.`}
      onClose={onClose}
      width="lg"
    >
      <div className="flex flex-col gap-7 pb-2">
        {/* Composer: live preview tile sits beside the fields as you type. */}
        <div className="flex flex-col gap-4 rounded-xl bg-surface-2 p-4 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl">
              {previewable ? (
                <SvgMark key={cleanUrl} url={cleanUrl} fallback={name || "?"} size={40} />
              ) : (
                <span className="type-caption">Preview</span>
              )}
            </div>
            <span className="type-caption max-w-20 truncate text-center">{name || "Untitled"}</span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <TextInput
              label="Name"
              value={name}
              placeholder="Figma"
              maxLength={40}
              className="bg-surface-3"
              onChange={(event) => setName(event.target.value)}
            />
            <TextInput
              label="Image or SVG URL"
              value={url}
              inputMode="url"
              placeholder="https://…/icon.svg"
              className="bg-surface-3"
              onChange={(event) => setUrl(event.target.value)}
              hint={error ?? (previewable ? "Looks good — preview on the left." : undefined)}
              invalid={Boolean(error)}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={() => void submit()} disabled={add.isPending || full}>
                <Plus size={15} /> {full ? "Library full" : "Add to library"}
              </Button>
            </div>
          </div>
        </div>

        {svgs.length > 0 ? (
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                type="search"
                placeholder="Search the library"
                className="h-11 w-full rounded-pill bg-surface-2 pl-10 pr-4 text-sm text-ink outline-none placeholder:text-ink-faint focus:shadow-[var(--glow-accent)]"
              />
            </div>

            {visible.length === 0 ? (
              <p className="type-caption">Nothing matches “{query}”.</p>
            ) : (
              <ul className="grid max-h-[24rem] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 md:grid-cols-5">
                {visible.map((icon) => (
                  <li key={icon.id} className="animate-pop group relative">
                    <div className="flex aspect-square flex-col items-center justify-center gap-2.5 rounded-xl p-2 transition-colors duration-200 hover:bg-surface-2">
                      <SvgMark url={icon.url} fallback={icon.name} size={44} />
                      <span className="type-caption w-full truncate text-center">{icon.name}</span>
                    </div>
                    <IconButton
                      label={`Delete ${icon.name}`}
                      size="sm"
                      className="absolute right-1 top-1 bg-canvas/70 opacity-0 backdrop-blur transition-opacity duration-150 hover:text-error focus-visible:opacity-100 group-hover:opacity-100"
                      onClick={async () => {
                        await remove.mutateAsync({ data: { id: icon.id } });
                        onDone("Mark deleted");
                      }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-surface-2 px-6 py-10 text-center">
            <p className="type-title-sm">Your library is empty</p>
            <p className="type-caption mx-auto mt-2 max-w-sm">
              Marks are small icons you reuse — on section tiles, link cards and action rows. Paste
              any icon URL above and it lands here.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
