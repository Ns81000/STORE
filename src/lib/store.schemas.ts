import { z } from "zod";
import { MAX_ROWS, SECTION_COLORS } from "./store.types";

export const scrapeResultSchema = z.object({
  ogTitle: z.string().nullable(),
  ogDescription: z.string().nullable(),
  ogImageUrl: z.string().nullable(),
  ogSiteName: z.string().nullable(),
  status: z.enum(["ok", "failed"]),
  errorMessage: z.string().nullable(),
});

export const unlockInput = z.object({ password: z.string().min(1).max(512) });

export const idInput = z.object({ id: z.string().min(1).max(64) });

export const svgUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (val) => /^https?:\/\/\S+$/i.test(val) || val.startsWith("/"),
    { message: "Must be a valid URL or path." }
  );

const optionalSvgUrl = svgUrlSchema.nullable();

export const createSectionInput = z.object({
  name: z.string().trim().min(1).max(60),
  colorToken: z.enum(SECTION_COLORS).nullable(),
  svgUrl: optionalSvgUrl,
});

export const updateSectionInput = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(60),
  colorToken: z.enum(SECTION_COLORS),
  svgUrl: optionalSvgUrl,
});

export const recolorSectionInput = z.object({
  id: z.string().min(1).max(64),
  colorToken: z.enum(SECTION_COLORS),
});

export const reorderInput = z.object({
  ids: z.array(z.string().min(1).max(64)).max(500),
});

export const reorderAssetsInput = z.object({
  sectionId: z.string().min(1).max(64),
  ids: z.array(z.string().min(1).max(64)).max(500),
});

const rowInput = z.object({
  svgUrl: optionalSvgUrl,
  label: z.string().trim().max(40).nullable(),
  url: z.string().trim().url().max(2048),
  mode: z.enum(["open", "copy"]),
});

const assetFields = {
  url: z.string().trim().url().max(2048),
  title: z.string().trim().max(120).nullable(),
  iconSvgUrl: optionalSvgUrl,
  previewEnabled: z.boolean(),
  actionMode: z.enum(["open", "copy"]),
  rows: z.array(rowInput).max(MAX_ROWS),
  prefetchedPreview: scrapeResultSchema.optional(),
};

export const createAssetInput = z.object({
  sectionId: z.string().min(1).max(64),
  ...assetFields,
});

export const updateAssetInput = z.object({
  id: z.string().min(1).max(64),
  sectionId: z.string().min(1).max(64),
  ...assetFields,
});

export const refreshScopeInput = z.object({
  sectionId: z.string().min(1).max(64).nullable(),
});

export const refreshPreviewInput = z.object({
  id: z.string().min(1).max(64),
  url: z.string().url().max(2048).optional(),
});

export const createSvgInput = z.object({
  name: z.string().trim().min(1).max(40),
  url: svgUrlSchema,
});

export const updateSvgInput = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(40),
  url: svgUrlSchema,
});

export const importInput = z.object({
  payload: z.string().min(2).max(2_000_000),
});

export type RowValues = z.infer<typeof rowInput>;
export type CreateAssetValues = z.infer<typeof createAssetInput>;
export type UpdateAssetValues = z.infer<typeof updateAssetInput>;
