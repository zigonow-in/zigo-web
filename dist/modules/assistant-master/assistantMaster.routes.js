import { Router } from "express";
import { z } from "zod";
import { requirePermission } from "../../http/auth.js";
import { emitBookingRealtimeEvent } from "../operations/bookingRealtime.js";
import { assignAssistantCluster, saveAssistantAreas, assignAssistantVehicle, createVehicleDamageReport, getAssistantRealtimeSnapshot, listAssistantMasterLogs, listAssistantMasters, removeAssistantCluster, removeAssistantVehicle, updateAssistantAvailability, updateAssistantLoginStatus, updateAssistantWork } from "./assistantMaster.repository.js";
export const assistantMasterRouter = Router();
const assistantParamsSchema = z.object({
    assistantId: z.string().uuid()
});
const workBodySchema = z.object({
    workingType: z.enum(["full_time", "part_time"]),
    workingTimeSlot: z.string().trim().optional().nullable(),
    workingSchedule: z.record(z.object({
        enabled: z.boolean().optional(),
        openTime: z.string().nullable().optional(),
        closeTime: z.string().nullable().optional()
    })).optional().nullable(),
    payType: z.enum(["salaried", "per_day", "per_task"])
});
const clusterBodySchema = z.object({
    clusterId: z.string().uuid()
});
const areaSelectionSchema = z.object({
    stateId: z.string().uuid(),
    cityId: z.string().uuid(),
    zoneId: z.string().uuid().nullable(),
    clusters: z.array(z.string().uuid()).max(10000),
    microMarkets: z.array(z.string().uuid()).max(10000),
    nanoMarkets: z.array(z.string().uuid()).max(10000),
    allClusters: z.boolean(),
    allMicroMarkets: z.boolean(),
    allNanoMarkets: z.boolean()
});
assistantMasterRouter.post("/:assistantId/areas", requirePermission("verification.edit"), async (req, res, next) => {
    try {
        const { assistantId } = assistantParamsSchema.parse(req.params);
        const body = z.object({ working: areaSelectionSchema, assign: areaSelectionSchema }).parse(req.body);
        await saveAssistantAreas(assistantId, body, req.auth.sub);
        await emitAssistantRealtimeChange({ type: "assistant.cluster.changed", assistantId, message: "Assistant areas changed" });
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
const vehicleBodySchema = z.object({
    vehicleMasterId: z.string().uuid()
});
const availabilityBodySchema = z.object({
    isOnline: z.coerce.boolean()
});
const loginStatusBodySchema = z.object({
    isLoggedIn: z.coerce.boolean()
});
const damageBodySchema = z.object({
    vehicleMasterId: z.string().uuid().optional().nullable(),
    reason: z.string().trim().min(2, "Damage reason is required."),
    proofPictureUrls: z.array(z.string().trim().min(1)).default([]),
    expense: z.coerce.number().nonnegative("Expense cannot be negative.").optional().nullable(),
    paidBy: z.enum(["self", "company"]),
    paymentProofUrl: z.string().trim().optional().nullable()
});
async function emitAssistantRealtimeChange(input) {
    const assistant = await getAssistantRealtimeSnapshot(input.assistantId);
    await emitBookingRealtimeEvent({
        type: input.type,
        assistantId: input.assistantId,
        clusterId: assistant?.currentClusterId ?? undefined,
        message: input.message,
        payload: {
            assistantId: input.assistantId,
            assistant
        }
    });
}
assistantMasterRouter.get("/", requirePermission("verification.view"), async (_req, res, next) => {
    try {
        res.json({ data: await listAssistantMasters() });
    }
    catch (error) {
        next(error);
    }
});
assistantMasterRouter.get("/:assistantId/logs", requirePermission("verification.view"), async (req, res, next) => {
    try {
        const params = assistantParamsSchema.parse(req.params);
        res.json({ data: await listAssistantMasterLogs(params.assistantId) });
    }
    catch (error) {
        next(error);
    }
});
assistantMasterRouter.put("/:assistantId/work", requirePermission("verification.edit"), async (req, res, next) => {
    try {
        const params = assistantParamsSchema.parse(req.params);
        const body = workBodySchema.parse(req.body);
        res.json({
            data: await updateAssistantWork(params.assistantId, {
                ...body,
                actorUserId: req.auth.sub
            })
        });
    }
    catch (error) {
        next(error);
    }
});
assistantMasterRouter.patch("/:assistantId/availability", requirePermission("verification.edit"), async (req, res, next) => {
    try {
        const params = assistantParamsSchema.parse(req.params);
        const body = availabilityBodySchema.parse(req.body);
        const data = await updateAssistantAvailability({
            assistantId: params.assistantId,
            isOnline: body.isOnline,
            actorUserId: req.auth.sub
        });
        await emitAssistantRealtimeChange({
            type: "assistant.availability.changed",
            assistantId: params.assistantId,
            message: body.isOnline ? "Assistant is online" : "Assistant is offline"
        });
        res.json({
            data
        });
    }
    catch (error) {
        next(error);
    }
});
assistantMasterRouter.patch("/:assistantId/login-status", requirePermission("verification.edit"), async (req, res, next) => {
    try {
        const params = assistantParamsSchema.parse(req.params);
        const body = loginStatusBodySchema.parse(req.body);
        const data = await updateAssistantLoginStatus({
            assistantId: params.assistantId,
            isLoggedIn: body.isLoggedIn,
            actorUserId: req.auth.sub
        });
        await emitAssistantRealtimeChange({
            type: "assistant.login.changed",
            assistantId: params.assistantId,
            message: body.isLoggedIn ? "Assistant logged in" : "Assistant logged out"
        });
        res.json({
            data
        });
    }
    catch (error) {
        next(error);
    }
});
assistantMasterRouter.post("/:assistantId/cluster", requirePermission("verification.edit"), async (req, res, next) => {
    try {
        const params = assistantParamsSchema.parse(req.params);
        const body = clusterBodySchema.parse(req.body);
        await assignAssistantCluster({
            assistantId: params.assistantId,
            clusterId: body.clusterId,
            actorUserId: req.auth.sub
        });
        await emitAssistantRealtimeChange({
            type: "assistant.cluster.changed",
            assistantId: params.assistantId,
            message: "Assistant cluster changed"
        });
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
assistantMasterRouter.delete("/:assistantId/cluster", requirePermission("verification.edit"), async (req, res, next) => {
    try {
        const params = assistantParamsSchema.parse(req.params);
        await removeAssistantCluster(params.assistantId, req.auth.sub);
        await emitAssistantRealtimeChange({
            type: "assistant.cluster.changed",
            assistantId: params.assistantId,
            message: "Assistant cluster removed"
        });
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
assistantMasterRouter.post("/:assistantId/vehicle", requirePermission("verification.edit"), async (req, res, next) => {
    try {
        const params = assistantParamsSchema.parse(req.params);
        const body = vehicleBodySchema.parse(req.body);
        await assignAssistantVehicle({
            assistantId: params.assistantId,
            vehicleMasterId: body.vehicleMasterId,
            actorUserId: req.auth.sub
        });
        await emitAssistantRealtimeChange({
            type: "assistant.vehicle.changed",
            assistantId: params.assistantId,
            message: "Assistant vehicle changed"
        });
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
assistantMasterRouter.delete("/:assistantId/vehicle", requirePermission("verification.edit"), async (req, res, next) => {
    try {
        const params = assistantParamsSchema.parse(req.params);
        await removeAssistantVehicle(params.assistantId, req.auth.sub);
        await emitAssistantRealtimeChange({
            type: "assistant.vehicle.changed",
            assistantId: params.assistantId,
            message: "Assistant vehicle removed"
        });
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
assistantMasterRouter.post("/:assistantId/damage", requirePermission("verification.edit"), async (req, res, next) => {
    try {
        const params = assistantParamsSchema.parse(req.params);
        res.status(201).json({
            data: await createVehicleDamageReport({
                assistantId: params.assistantId,
                ...damageBodySchema.parse(req.body),
                actorUserId: req.auth.sub
            })
        });
    }
    catch (error) {
        next(error);
    }
});
