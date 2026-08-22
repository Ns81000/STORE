import { createServerFn } from "@tanstack/react-start";
import {
  createAssetInput,
  createSectionInput,
  createSvgInput,
  idInput,
  importInput,
  recolorSectionInput,
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
  updateAsset as updateAssetRow,
  updateSection as updateSectionRow,
  updateSvg as updateSvgRow,
} from "./store.server";

// POST, not GET: a GET server function can be served from the browser's HTTP
// cache, which made freshly saved rows appear only after a hard refresh.
export const listVault = createServerFn({ method: "POST" }).handler(async () => {
  await requireUnlocked();
  return loadVault();
});

export const createSection = createServerFn({ method: "POST" })
  .inputValidator(createSectionInput.parse)
  .handler(async ({ data }) => {
    await requireUnlocked();
    return createSectionRow(data.name, data.colorToken, data.svgUrl);
  });

export const updateSection = createServerFn({ method: "POST" })
  .inputValidator(updateSectionInput.parse)
  .handler(async ({ data }) => {
    await requireUnlocked();
    return updateSectionRow(data.id, data.name, data.colorToken, data.svgUrl);
  });

export const recolorSection = createServerFn({ method: "POST" })
  .inputValidator(recolorSectionInput.parse)
  .handler(async ({ data }) => {
    await requireUnlocked();
    await recolorSectionRow(data.id, data.colorToken);
    return { ok: true as const };
  });

export const deleteSection = createServerFn({ method: "POST" })
  .inputValidator(idInput.parse)
  .handler(async ({ data }) => {
    await requireUnlocked();
    await deleteRow("sections", data.id);
    return { ok: true as const };
  });

export const reorderSections = createServerFn({ method: "POST" })
  .inputValidator(reorderInput.parse)
  .handler(async ({ data }) => {
    await requireUnlocked();
    await applyOrder("sections", data.ids);
    return { ok: true as const };
  });

export const createAsset = createServerFn({ method: "POST" })
  .inputValidator(createAssetInput.parse)
  .handler(async ({ data }) => {
    await requireUnlocked();
    const id = await insertAsset(data);
    if (data.previewEnabled) await refreshPreviewFor(id);
    return { id };
  });

export const updateAsset = createServerFn({ method: "POST" })
  .inputValidator(updateAssetInput.parse)
  .handler(async ({ data }) => {
    await requireUnlocked();
    await updateAssetRow(data.id, data);
    if (data.previewEnabled) await refreshPreviewFor(data.id);
    return { ok: true as const };
  });

export const deleteAsset = createServerFn({ method: "POST" })
  .inputValidator(idInput.parse)
  .handler(async ({ data }) => {
    await requireUnlocked();
    await deleteRow("assets", data.id);
    return { ok: true as const };
  });

export const reorderAssets = createServerFn({ method: "POST" })
  .inputValidator(reorderAssetsInput.parse)
  .handler(async ({ data }) => {
    await requireUnlocked();
    await applyOrder("assets", data.ids);
    return { ok: true as const };
  });

export const refreshPreview = createServerFn({ method: "POST" })
  .inputValidator(idInput.parse)
  .handler(async ({ data }) => {
    await requireUnlocked();
    await refreshPreviewFor(data.id);
    return { ok: true as const };
  });

export const refreshPreviews = createServerFn({ method: "POST" })
  .inputValidator(refreshScopeInput.parse)
  .handler(async ({ data }) => {
    await requireUnlocked();
    const count = await refreshAllPreviews(data.sectionId ?? undefined);
    return { count };
  });

export const createSvg = createServerFn({ method: "POST" })
  .inputValidator(createSvgInput.parse)
  .handler(async ({ data }) => {
    await requireUnlocked();
    const id = await createSvgRow(data.name, data.url);
    return { id };
  });

export const updateSvg = createServerFn({ method: "POST" })
  .inputValidator(updateSvgInput.parse)
  .handler(async ({ data }) => {
    await requireUnlocked();
    await updateSvgRow(data.id, data.name, data.url);
    return { ok: true as const };
  });

export const deleteSvg = createServerFn({ method: "POST" })
  .inputValidator(idInput.parse)
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
  .inputValidator(importInput.parse)
  .handler(async ({ data }) => {
    await requireUnlocked();
    return importVaultData(data.payload);
  });
