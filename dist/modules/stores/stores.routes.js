import { Router } from "express";
import { z } from "zod";
import { requirePermission } from "../../http/auth.js";
import { HttpError } from "../../http/errors.js";
import { addStoreImage, createCategoryStore, createClusterStore, createStore, createStoreCategory, createStoreCategoryMap, createStoreKeyword, deleteCategoryStore, deleteClusterStore, deleteStore, deleteStoreCategory, deleteStoreCategoryMap, deleteStoreImage, deleteStoreKeyword, listCategoryStores, listClusterStores, listStoreCategories, listStoreCategoryMaps, listStoreKeywords, listStores, setStoreImagePrimary, updateStoreCategory, updateStoreKeyword, updateStore } from "./stores.repository.js";
export const storesRouter = Router();
const idParamsSchema = z.object({ id: z.string().uuid() });
const storeBodySchema = z.object({
    code: z.string().trim().optional().nullable(),
    name: z.string().min(2),
    description: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    contact: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    latitude: z.coerce.number().nullable().optional(),
    longitude: z.coerce.number().nullable().optional(),
    priority: z.coerce.number().int().min(0).default(0),
    operatingHours: z.record(z.object({
        enabled: z.coerce.boolean().default(false),
        openTime: z.string().nullable().optional(),
        closeTime: z.string().nullable().optional()
    })).default({}),
    serviceCategoryIds: z.array(z.string().uuid()).default([]),
    storeCategoryIds: z.array(z.string().uuid()).default([]),
    storeKeywordIds: z.array(z.string().uuid()).default([]),
    clusterIds: z.array(z.string().uuid()).min(1, "Select at least one Cluster for this Store."),
    imageUrls: z.array(z.string().min(1)).default([]),
    isActive: z.coerce.boolean().default(true)
});
const storeCategoryBodySchema = z.object({
    code: z.string().min(2),
    name: z.string().min(2),
    serviceId: z.string().uuid("Select a valid Service."),
    serviceCategoryId: z.string().uuid("Select a valid Service Category."),
    imageUrl: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    priority: z.coerce.number().int().min(0).default(0),
    isActive: z.coerce.boolean().default(true)
});
const storeKeywordBodySchema = z.object({
    code: z.string().trim().optional().nullable(),
    name: z.string().min(2),
    serviceId: z.string().uuid("Select a valid Service."),
    serviceCategoryId: z.string().uuid("Select a valid Service Category."),
    description: z.string().nullable().optional(),
    priority: z.coerce.number().int().min(0).default(0),
    isActive: z.coerce.boolean().default(true)
});
const storeImageBodySchema = z.object({
    fileId: z.string().uuid().nullable().optional(),
    imageUrl: z.string().min(1),
    isPrimary: z.coerce.boolean().default(false),
    priority: z.coerce.number().int().min(0).default(0)
});
const categoryStoreBodySchema = z.object({ categoryId: z.string().uuid(), storeId: z.string().uuid() });
const storeCategoryMapBodySchema = z.object({ storeCategoryId: z.string().uuid(), storeId: z.string().uuid() });
const clusterStoreBodySchema = z.object({ clusterId: z.string().uuid(), storeId: z.string().uuid() });
storesRouter.get("/store-categories", requirePermission("stores.view"), async (_req, res, next) => {
    try {
        res.json({ data: await listStoreCategories() });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.post("/store-categories", requirePermission("stores.create"), async (req, res, next) => {
    try {
        res.status(201).json({ data: await createStoreCategory({ ...storeCategoryBodySchema.parse(req.body), userId: req.auth.sub }) });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.put("/store-categories/:id", requirePermission("stores.edit"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const updated = await updateStoreCategory(id, { ...storeCategoryBodySchema.parse(req.body), userId: req.auth.sub });
        if (!updated)
            throw new HttpError(404, "Store Category not found");
        res.json({ data: updated });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.delete("/store-categories/:id", requirePermission("stores.delete"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const deleted = await deleteStoreCategory(id, req.auth.sub);
        if (!deleted)
            throw new HttpError(404, "Store Category not found");
        res.json({ data: deleted });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.get("/store-keywords", requirePermission("stores.view"), async (_req, res, next) => {
    try {
        res.json({ data: await listStoreKeywords() });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.post("/store-keywords", requirePermission("stores.create"), async (req, res, next) => {
    try {
        res.status(201).json({ data: await createStoreKeyword({ ...storeKeywordBodySchema.parse(req.body), userId: req.auth.sub }) });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.put("/store-keywords/:id", requirePermission("stores.edit"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const updated = await updateStoreKeyword(id, { ...storeKeywordBodySchema.parse(req.body), userId: req.auth.sub });
        if (!updated)
            throw new HttpError(404, "Store Keyword not found");
        res.json({ data: updated });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.delete("/store-keywords/:id", requirePermission("stores.delete"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const deleted = await deleteStoreKeyword(id, req.auth.sub);
        if (!deleted)
            throw new HttpError(404, "Store Keyword not found");
        res.json({ data: deleted });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.get("/", requirePermission("stores.view"), async (_req, res, next) => {
    try {
        res.json({ data: await listStores() });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.post("/", requirePermission("stores.create"), async (req, res, next) => {
    try {
        res.status(201).json({ data: await createStore({ ...storeBodySchema.parse(req.body), userId: req.auth.sub }) });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.put("/:id", requirePermission("stores.edit"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const updated = await updateStore(id, { ...storeBodySchema.parse(req.body), userId: req.auth.sub });
        if (!updated)
            throw new HttpError(404, "Store not found");
        res.json({ data: updated });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.delete("/:id", requirePermission("stores.delete"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const deleted = await deleteStore(id, req.auth.sub);
        if (!deleted)
            throw new HttpError(404, "Store not found");
        res.json({ data: deleted });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.post("/:id/images", requirePermission("stores.edit"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        res.status(201).json({ data: await addStoreImage({ storeId: id, ...storeImageBodySchema.parse(req.body), userId: req.auth.sub }) });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.delete("/:id/images/:imageId", requirePermission("stores.edit"), async (req, res, next) => {
    try {
        const { id, imageId } = z.object({ id: z.string().uuid(), imageId: z.string().uuid() }).parse(req.params);
        const deleted = await deleteStoreImage(id, imageId, req.auth.sub);
        if (!deleted)
            throw new HttpError(404, "Store image not found");
        res.json({ data: deleted });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.patch("/:id/images/:imageId/primary", requirePermission("stores.edit"), async (req, res, next) => {
    try {
        const { id, imageId } = z.object({ id: z.string().uuid(), imageId: z.string().uuid() }).parse(req.params);
        const updated = await setStoreImagePrimary(id, imageId, req.auth.sub);
        if (!updated)
            throw new HttpError(404, "Store image not found");
        res.json({ data: updated });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.get("/category-stores", requirePermission("stores.view"), async (_req, res, next) => {
    try {
        res.json({ data: await listCategoryStores() });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.post("/category-stores", requirePermission("stores.create"), async (req, res, next) => {
    try {
        res.status(201).json({ data: await createCategoryStore({ ...categoryStoreBodySchema.parse(req.body), userId: req.auth.sub }) });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.delete("/category-stores/:id", requirePermission("stores.delete"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const deleted = await deleteCategoryStore(id, req.auth.sub);
        if (!deleted)
            throw new HttpError(404, "Mapping not found");
        res.json({ data: deleted });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.get("/store-category-maps", requirePermission("stores.view"), async (_req, res, next) => {
    try {
        res.json({ data: await listStoreCategoryMaps() });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.post("/store-category-maps", requirePermission("stores.create"), async (req, res, next) => {
    try {
        res.status(201).json({ data: await createStoreCategoryMap({ ...storeCategoryMapBodySchema.parse(req.body), userId: req.auth.sub }) });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.delete("/store-category-maps/:id", requirePermission("stores.delete"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const deleted = await deleteStoreCategoryMap(id, req.auth.sub);
        if (!deleted)
            throw new HttpError(404, "Mapping not found");
        res.json({ data: deleted });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.get("/cluster-stores", requirePermission("stores.view"), async (_req, res, next) => {
    try {
        res.json({ data: await listClusterStores() });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.post("/cluster-stores", requirePermission("stores.create"), async (req, res, next) => {
    try {
        res.status(201).json({ data: await createClusterStore({ ...clusterStoreBodySchema.parse(req.body), userId: req.auth.sub }) });
    }
    catch (error) {
        next(error);
    }
});
storesRouter.delete("/cluster-stores/:id", requirePermission("stores.delete"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const deleted = await deleteClusterStore(id, req.auth.sub);
        if (!deleted)
            throw new HttpError(404, "Mapping not found");
        res.json({ data: deleted });
    }
    catch (error) {
        next(error);
    }
});
