import { z } from "zod";
import { MAX_ROWS, SECTION_COLORS } from "./store.types";

export const unlockInput = z.object({ password: z.string().min(1).max(512) });

export const idInput = z.object({ id: z.string().min(1).max(64) });

const optionalUrl = z.string().trim().url().max(2048).nullable();

export const createSectionInput = z.object({
  name: z.string().trim().min(1).max(60),
  colorToken: z.enum(SECTION_COLORS).nullable(),
  svgUrl: optionalUrl,
});

export const updateSectionInput = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(60),
  colorToken: z.enum(SECTION_COLORS),
  svgUrl: optionalUrl,
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
  svgUrl: optionalUrl,
  label: z.string().trim().max(40).nullable(),
  url: z.string().trim().url().max(2048),
  mode: z.enum(["open", "copy"]),
});

const assetFields = {
  url: z.string().trim().url().max(2048),
  title: z.string().trim().max(120).nullable(),
  iconSvgUrl: optionalUrl,
  previewEnabled: z.boolean(),
  actionMode: z.enum(["open", "copy"]),
  rows: z.array(rowInput).max(MAX_ROWS),
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

export const createSvgInput = z.object({
  name: z.string().trim().min(1).max(40),
  url: z.string().trim().url().max(2048),
});

export const updateSvgInput = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(40),
  url: z.string().trim().url().max(2048),
});

export const importInput = z.object({
  payload: z.string().min(2).max(2_000_000),
});

export type RowValues = z.infer<typeof rowInput>;
export type CreateAssetValues = z.infer<typeof createAssetInput>;
export type UpdateAssetValues = z.infer<typeof updateAssetInput>;
