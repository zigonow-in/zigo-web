import { Router } from "express";
import { z } from "zod";
import { requirePermission } from "../../http/auth.js";
import { HttpError } from "../../http/errors.js";
import { reverseBookingLocation, searchBookingLocations, validateBookingLocation } from "../operations/operations.repository.js";
import { createAdminCustomerAddress, createAdminCustomerPreviousUsedLocation, deleteAdminCustomer, deleteAdminCustomerAddress, getAdminCustomer, listAdminCustomerAddresses, listAdminCustomerPreviousUsedLocations, listAdminCustomers, saveAdminCustomerPreviousUsedLocationAsAddress, updateAdminCustomerAddress, updateAdminCustomer } from "./customers.repository.js";
export const adminCustomersRouter = Router();
const idParamsSchema = z.object({ id: z.string().uuid() });
const addressParamsSchema = z.object({ id: z.string().uuid(), addressId: z.string().uuid() });
const locationSearchQuerySchema = z.object({ q: z.string().trim().min(3).max(200) });
const reverseLocationQuerySchema = z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180)
});
const customerBodySchema = z.object({
    displayName: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    phone: z.string().nullable().optional(),
    status: z.string().nullable().optional()
});
const customerAddressBodySchema = z.object({
    label: z.string().trim().min(2).max(80).default("Home"),
    customLabel: z.string().trim().max(80).nullable().optional(),
    address: z.string().trim().min(3).max(2000),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    flatNo: z.string().trim().max(250).nullable().optional(),
    buildingName: z.string().trim().max(250).nullable().optional(),
    additionalDetail: z.string().trim().max(1000).nullable().optional(),
    personName: z.string().trim().max(150).nullable().optional(),
    contactNumber: z.string().trim().max(30).nullable().optional(),
    source: z.enum(["current", "map", "search", "reverse", "manual", "coordinates", "saved"]).default("manual"),
    isDefault: z.coerce.boolean().default(false)
});
const previousUsedLocationBodySchema = customerAddressBodySchema.omit({ label: true, customLabel: true, isDefault: true });
adminCustomersRouter.get("/", requirePermission("customers.view"), async (_req, res, next) => {
    try {
        res.json({ data: await listAdminCustomers() });
    }
    catch (error) {
        next(error);
    }
});
adminCustomersRouter.get("/locations/search", requirePermission("customers.view"), async (req, res, next) => {
    try {
        const query = locationSearchQuerySchema.parse(req.query);
        res.json({ data: await searchBookingLocations(query.q) });
    }
    catch (error) {
        next(error);
    }
});
adminCustomersRouter.get("/locations/reverse", requirePermission("customers.view"), async (req, res, next) => {
    try {
        const query = reverseLocationQuerySchema.parse(req.query);
        res.json({ data: await reverseBookingLocation(query) });
    }
    catch (error) {
        next(error);
    }
});
adminCustomersRouter.get("/:id/addresses", requirePermission("customers.view"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        res.json({ data: await listAdminCustomerAddresses(id) });
    }
    catch (error) {
        next(error);
    }
});
adminCustomersRouter.get("/:id/previous-used-locations", requirePermission("customers.view"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        res.json({ data: await listAdminCustomerPreviousUsedLocations(id) });
    }
    catch (error) {
        next(error);
    }
});
adminCustomersRouter.post("/:id/addresses", requirePermission("customers.edit"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const body = customerAddressBodySchema.parse(req.body);
        const finalLabel = body.label === "Other" ? body.customLabel?.trim() : body.label;
        if (!finalLabel)
            throw new HttpError(400, "Enter address label name.");
        if (body.label === "Other" && ["home", "work", "other"].includes(finalLabel.toLowerCase())) {
            throw new HttpError(400, "This label is already used by default labels, try different.");
        }
        const serviceability = await validateBookingLocation({
            customerId: id,
            address: body.address,
            latitude: body.latitude,
            longitude: body.longitude,
            source: body.source === "current" ? "manual" : body.source
        });
        if (!serviceability.isServiceable || !serviceability.cluster?.clusterId) {
            throw new HttpError(400, serviceability.message || "Selected location is outside active working clusters.");
        }
        const created = await createAdminCustomerAddress(id, {
            label: finalLabel,
            address: body.address,
            latitude: body.latitude,
            longitude: body.longitude,
            clusterId: serviceability.cluster?.clusterId ?? null,
            isDefault: body.isDefault,
            metadata: {
                flatNo: body.flatNo || "",
                buildingName: body.buildingName || "",
                additionalDetail: body.additionalDetail || "",
                personName: body.personName || "",
                contactNumber: body.contactNumber || "",
                latitude: body.latitude,
                longitude: body.longitude,
                source: body.source,
                serviceability
            },
            userId: req.auth.sub
        });
        res.status(201).json({ data: created });
    }
    catch (error) {
        next(error);
    }
});
adminCustomersRouter.post("/:id/previous-used-locations", requirePermission("customers.edit"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const body = previousUsedLocationBodySchema.parse(req.body);
        const serviceability = await validateBookingLocation({
            customerId: id,
            address: body.address,
            latitude: body.latitude,
            longitude: body.longitude,
            source: body.source === "current" ? "manual" : body.source
        });
        if (!serviceability.isServiceable || !serviceability.cluster?.clusterId) {
            throw new HttpError(400, serviceability.message || "Selected location is outside active working clusters.");
        }
        const created = await createAdminCustomerPreviousUsedLocation(id, {
            label: "Previous used",
            address: body.address,
            latitude: body.latitude,
            longitude: body.longitude,
            clusterId: serviceability.cluster?.clusterId ?? null,
            metadata: {
                flatNo: body.flatNo || "",
                buildingName: body.buildingName || "",
                additionalDetail: body.additionalDetail || "",
                personName: body.personName || "",
                contactNumber: body.contactNumber || "",
                latitude: body.latitude,
                longitude: body.longitude,
                source: body.source,
                serviceability
            },
            userId: req.auth.sub
        });
        res.status(201).json({ data: created });
    }
    catch (error) {
        next(error);
    }
});
adminCustomersRouter.post("/:id/previous-used-locations/:addressId/save-as", requirePermission("customers.edit"), async (req, res, next) => {
    try {
        const { id, addressId } = addressParamsSchema.parse(req.params);
        const body = customerAddressBodySchema.parse(req.body);
        const finalLabel = body.label === "Other" ? body.customLabel?.trim() : body.label;
        if (!finalLabel)
            throw new HttpError(400, "Enter address label name.");
        if (body.label === "Other" && ["home", "work", "other"].includes(finalLabel.toLowerCase())) {
            throw new HttpError(400, "This label is already used by default labels, try different.");
        }
        const serviceability = await validateBookingLocation({
            customerId: id,
            address: body.address,
            latitude: body.latitude,
            longitude: body.longitude,
            source: body.source === "current" ? "manual" : body.source
        });
        if (!serviceability.isServiceable || !serviceability.cluster?.clusterId) {
            throw new HttpError(400, serviceability.message || "Selected location is outside active working clusters.");
        }
        const saved = await saveAdminCustomerPreviousUsedLocationAsAddress(id, addressId, {
            label: finalLabel,
            address: body.address,
            latitude: body.latitude,
            longitude: body.longitude,
            clusterId: serviceability.cluster?.clusterId ?? null,
            isDefault: body.isDefault,
            metadata: {
                flatNo: body.flatNo || "",
                buildingName: body.buildingName || "",
                additionalDetail: body.additionalDetail || "",
                personName: body.personName || "",
                contactNumber: body.contactNumber || "",
                latitude: body.latitude,
                longitude: body.longitude,
                source: body.source,
                serviceability
            },
            userId: req.auth.sub
        });
        if (!saved)
            throw new HttpError(404, "Previous used location not found");
        res.json({ data: saved });
    }
    catch (error) {
        next(error);
    }
});
adminCustomersRouter.post("/:id/addresses/validate", requirePermission("customers.view"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const body = customerAddressBodySchema.pick({
            address: true,
            latitude: true,
            longitude: true,
            source: true
        }).parse(req.body);
        res.json({
            data: await validateBookingLocation({
                customerId: id,
                address: body.address,
                latitude: body.latitude,
                longitude: body.longitude,
                source: body.source === "current" ? "manual" : body.source
            })
        });
    }
    catch (error) {
        next(error);
    }
});
adminCustomersRouter.put("/:id/addresses/:addressId", requirePermission("customers.edit"), async (req, res, next) => {
    try {
        const { id, addressId } = addressParamsSchema.parse(req.params);
        const body = customerAddressBodySchema.parse(req.body);
        const finalLabel = body.label === "Other" ? body.customLabel?.trim() : body.label;
        if (!finalLabel)
            throw new HttpError(400, "Enter address label name.");
        if (body.label === "Other" && ["home", "work", "other"].includes(finalLabel.toLowerCase())) {
            throw new HttpError(400, "This label is already used by default labels, try different.");
        }
        const serviceability = await validateBookingLocation({
            customerId: id,
            address: body.address,
            latitude: body.latitude,
            longitude: body.longitude,
            source: body.source === "current" ? "manual" : body.source
        });
        if (!serviceability.isServiceable || !serviceability.cluster?.clusterId) {
            throw new HttpError(400, serviceability.message || "Selected location is outside active working clusters.");
        }
        const updated = await updateAdminCustomerAddress(id, addressId, {
            label: finalLabel,
            address: body.address,
            latitude: body.latitude,
            longitude: body.longitude,
            clusterId: serviceability.cluster?.clusterId ?? null,
            isDefault: body.isDefault,
            metadata: {
                flatNo: body.flatNo || "",
                buildingName: body.buildingName || "",
                additionalDetail: body.additionalDetail || "",
                personName: body.personName || "",
                contactNumber: body.contactNumber || "",
                latitude: body.latitude,
                longitude: body.longitude,
                source: body.source,
                serviceability
            },
            userId: req.auth.sub
        });
        if (!updated)
            throw new HttpError(404, "Customer address not found");
        res.json({ data: updated });
    }
    catch (error) {
        next(error);
    }
});
adminCustomersRouter.delete("/:id/addresses/:addressId", requirePermission("customers.edit"), async (req, res, next) => {
    try {
        const { id, addressId } = addressParamsSchema.parse(req.params);
        const deleted = await deleteAdminCustomerAddress(id, addressId, req.auth.sub);
        if (!deleted)
            throw new HttpError(404, "Customer address not found");
        res.json({ data: deleted });
    }
    catch (error) {
        next(error);
    }
});
adminCustomersRouter.get("/:id", requirePermission("customers.view"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const customer = await getAdminCustomer(id);
        if (!customer)
            throw new HttpError(404, "Customer not found");
        res.json({ data: customer });
    }
    catch (error) {
        next(error);
    }
});
adminCustomersRouter.put("/:id", requirePermission("customers.edit"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const updated = await updateAdminCustomer(id, { ...customerBodySchema.parse(req.body), userId: req.auth.sub });
        if (!updated)
            throw new HttpError(404, "Customer not found");
        res.json({ data: updated });
    }
    catch (error) {
        next(error);
    }
});
adminCustomersRouter.delete("/:id", requirePermission("customers.delete"), async (req, res, next) => {
    try {
        const { id } = idParamsSchema.parse(req.params);
        const deleted = await deleteAdminCustomer(id, req.auth.sub);
        if (!deleted)
            throw new HttpError(404, "Customer not found");
        res.json({ data: deleted });
    }
    catch (error) {
        next(error);
    }
});
