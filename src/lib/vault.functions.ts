import { createServerFn } from "@tanstack/react-start";
import {
  createAssetInput,
  createSectionInput,
  createSvgInput,
  idInput,
  importInput,
  recolorSectionInput,
  refreshPreviewInput,
  refreshScopeInput,
  reorderAssetsInput,
  reorderInput,
  updateAssetInput,
  updateSectionInput,
  updateSvgInput,
} from "./store.schemas";
import { requireUnlocked } from "./session.server";
import {
  applyOrder,
  createSection as createSectionRow,
  createSvg as createSvgRow,
  deleteRow,
  deleteSvg as deleteSvgRow,
  exportVault as exportVaultData,
  importVault as importVaultData,
  insertAsset,
  loadVault,
  recolorSection as recolorSectionRow,
  refreshAllPreviews,
  refreshPreviewFor,
  scrapePreview,
  updateAsset as updateAssetRow,
  updateSection as updateSectionRow,
  updateSvg as updateSvgRow,
  wipeVaultData,
} from "./store.server";

export const listVault = createServerFn({ method: "POST" }).handler(async () => {
  await requireUnlocked();
  return loadVault();
});

export const createSection = createServerFn({ method: "POST" })
  .validator((data: unknown) => createSectionInput.parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    return createSectionRow(data.name, data.colorToken, data.svgUrl);
  });

export const updateSection = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateSectionInput.parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    await updateSectionRow(data.id, data.name, data.colorToken, data.svgUrl);
    return { ok: true as const };
  });

export const recolorSection = createServerFn({ method: "POST" })
  .validator((data: unknown) => recolorSectionInput.parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    await recolorSectionRow(data.id, data.colorToken);
    return { ok: true as const };
  });

export const deleteSection = createServerFn({ method: "POST" })
  .validator((data: unknown) => idInput.parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    await deleteRow("sections", data.id);
    return { ok: true as const };
  });

export const reorderSections = createServerFn({ method: "POST" })
  .validator((data: unknown) => reorderInput.parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    await applyOrder("sections", data.ids);
    return { ok: true as const };
  });

export const createAsset = createServerFn({ method: "POST" })
  .validator((data: unknown) => createAssetInput.parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const id = await insertAsset(data);
    return { id };
  });

export const updateAsset = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateAssetInput.parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    await updateAssetRow(data.id, data);
    return { ok: true as const };
  });

export const deleteAsset = createServerFn({ method: "POST" })
  .validator((data: unknown) => idInput.parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    await deleteRow("assets", data.id);
    return { ok: true as const };
  });

export const reorderAssets = createServerFn({ method: "POST" })
  .validator((data: unknown) => reorderAssetsInput.parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    await applyOrder("assets", data.ids);
    return { ok: true as const };
  });

export const refreshPreview = createServerFn({ method: "POST" })
  .validator((data: unknown) => refreshPreviewInput.parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    await refreshPreviewFor(data.id, data.url);
    return { ok: true as const };
  });

export const refreshPreviews = createServerFn({ method: "POST" })
  .validator((data: unknown) => refreshScopeInput.parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const count = await refreshAllPreviews(data.sectionId ?? undefined);
    return { count };
  });

export const getPreviewData = createServerFn({ method: "POST" })
  .validator((url: string) => url)
  .handler(async ({ data }) => {
    await requireUnlocked();
    return scrapePreview(data);
  });

export const createSvg = createServerFn({ method: "POST" })
  .validator((data: unknown) => createSvgInput.parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const id = await createSvgRow(data.name, data.url);
    return { id };
  });

export const updateSvg = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateSvgInput.parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    await updateSvgRow(data.id, data.name, data.url);
    return { ok: true as const };
  });

export const deleteSvg = createServerFn({ method: "POST" })
  .validator((data: unknown) => idInput.parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    await deleteSvgRow(data.id);
    return { ok: true as const };
  });

export const exportVault = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  return exportVaultData();
});

export const importVault = createServerFn({ method: "POST" })
  .validator((data: unknown) => importInput.parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    return importVaultData(data.payload);
  });

export const wipeVault = createServerFn({ method: "POST" }).handler(async () => {
  await requireUnlocked();
  return wipeVaultData();
});
