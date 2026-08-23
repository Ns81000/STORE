import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createSection, updateSection } from "@/lib/vault.functions";
import { useVaultMutation } from "@/hooks/useVault";
import {
  SECTION_COLORS,
  TONE_VAR,
  type Section,
  type SectionColor,
  type SvgIcon,
} from "@/lib/store.types";
import { Modal } from "./Modal";
import { SvgPicker } from "./SvgPicker";
import { Button, TextInput } from "./primitives";
import { cn } from "@/lib/utils";

type SectionModalProps = {
  open: boolean;
  section: Section | null;
  svgs: readonly SvgIcon[];
  onClose: () => void;
  onDone: (message: string) => void;
  onOpenLibrary?: () => void;
};

export function SectionModal({
  open,
  section,
  svgs,
  onClose,
  onDone,
  onOpenLibrary,
}: SectionModalProps) {
  const [name, setName] = useState("");
  const [tone, setTone] = useState<SectionColor>("ember");
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = useVaultMutation(useServerFn(createSection));
  const update = useVaultMutation(useServerFn(updateSection));
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setName(section?.name ?? "");
    setTone(section?.colorToken ?? "ember");
    setSvgUrl(section?.svgUrl ?? null);
    setError(null);
  }, [open, section]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setError("Give the section a name.");
    try {
      if (section) {
        await update.mutateAsync({
          data: { id: section.id, name: trimmed, colorToken: tone, svgUrl },
        });
      } else {
        await create.mutateAsync({ data: { name: trimmed, colorToken: tone, svgUrl } });
      }
      onDone(section ? "Section updated" : "Section created");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the section.");
    }
  };

  return (
    <Modal
      open={open}
      title={section ? "Edit section" : "New section"}
      subtitle="Sections are the five tiles on your home grid."
      onClose={onClose}
      width="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="surface" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void submit()} disabled={pending}>
            {pending ? "Saving…" : section ? "Save changes" : "Create section"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6 pb-2">
        <TextInput
          label="Name"
          value={name}
          autoFocus
          placeholder="Design"
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
          invalid={Boolean(error)}
          hint={error}
        />

        <div className="flex flex-col gap-2.5">
          <span className="type-label">Tone</span>
          <div className="flex gap-2.5">
            {SECTION_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                aria-pressed={tone === color}
                onClick={() => setTone(color)}
                className={cn(
                  "press focus-ring relative h-12 flex-1 overflow-hidden rounded-md bg-surface-2 transition-[transform,box-shadow] duration-200",
                  tone === color ? "shadow-[var(--glow-accent)]" : "opacity-70 hover:opacity-100",
                )}
                style={{ ["--tone" as string]: TONE_VAR[color] }}
              >
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(70% 90% at 30% 10%, color-mix(in srgb, var(--tone) 55%, transparent), transparent 70%)",
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        <SvgPicker
          label="Section mark"
          svgs={svgs}
          value={svgUrl}
          onChange={setSvgUrl}
          onOpenLibrary={onOpenLibrary}
          compact
        />
      </div>
    </Modal>
  );
}
