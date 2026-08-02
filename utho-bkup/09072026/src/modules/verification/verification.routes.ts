import { Router } from "express";
import { z } from "zod";
import { requirePermission } from "../../http/auth.js";
import { logAssistantMasterEvent } from "../assistant-master/assistantMaster.repository.js";
import {
  attachVehicleDocument,
  attachAssistantDocument,
  createAssistantForVerification,
  deleteAssistantDocument,
  deleteAssistantForVerification,
  deleteAssistantVehicle,
  decideAssistantVerification,
  getAssistantVehicle,
  listAssistantVehicles,
  listAssistantDocuments,
  listAssistantVerifications,
  listDocumentTypes,
  listRoleVerificationRequirements,
  listVehicleDocuments,
  mapAssistantToCluster,
  updateAssistantVerificationStatus,
  updateAssistantForVerification,
  updateAssistantVehicle,
  upsertAssistantVehicle,
  verifyAssistantDocument
} from "./verification.repository.js";

export const verificationRouter = Router();

const vehicleBodySchema = z.object({
  assistantId: z.string().uuid(),
  vehicleType: z.string().min(2),
  registrationNumber: z.string().min(3),
  make: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  color: z.string().nullable().optional()
});

const vehicleIdParamsSchema = z.object({
  vehicleId: z.string().uuid()
});

const vehicleDocumentBodySchema = z.object({
  documentTypeId: z.string().uuid(),
  originalName: z.string().min(2),
  mimeType: z.string().nullable().optional(),
  previewUrl: z.string().min(2)
});

const createAssistantBodySchema = z
  .object({
    displayName: z.string().min(2),
    email: z.string().email().nullable().optional(),
    phone: z.string().min(6).max(20).nullable().optional(),
    password: z.string().min(8),
    assistantCode: z.string().min(2)
  })
  .refine((value) => value.email || value.phone, { message: "Email or phone is required" });

const updateAssistantBodySchema = z
  .object({
    displayName: z.string().min(2),
    email: z.string().email().nullable().optional(),
    phone: z.string().min(6).max(20).nullable().optional(),
    assistantCode: z.string().min(2),
    isActive: z.coerce.boolean().optional()
  })
  .refine((value) => value.email || value.phone, { message: "Email or phone is required" });

const assistantIdParamsSchema = z.object({
  assistantId: z.string().uuid()
});

const assistantDocumentBodySchema = z.object({
  documentTypeId: z.string().uuid(),
  originalName: z.string().min(2),
  mimeType: z.string().nullable().optional(),
  previewUrl: z.string().min(2)
});

const assistantDecisionBodySchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().nullable().optional()
});

const assistantStatusBodySchema = z.object({
  status: z.enum(["verifying", "verified", "pending_document", "invalid_document", "rejected"]),
  reason: z.string().nullable().optional()
});

const documentIdParamsSchema = z.object({
  assistantId: z.string().uuid(),
  documentId: z.string().uuid()
});

const documentDecisionBodySchema = z.object({
  status: z.enum(["verifying", "verified", "pending_document", "invalid_document", "rejected"]),
  remarks: z.string().nullable().optional()
});

const assistantClusterBodySchema = z.object({
  clusterId: z.string().uuid(),
  isPrimary: z.coerce.boolean().default(true)
});

verificationRouter.get("/document-types", requirePermission("verification.view"), async (_req, res, next) => {
  try {
    res.json({ data: await listDocumentTypes() });
  } catch (error) {
    next(error);
  }
});

verificationRouter.get("/role-requirements", requirePermission("verification.view"), async (_req, res, next) => {
  try {
    res.json({ data: await listRoleVerificationRequirements() });
  } catch (error) {
    next(error);
  }
});

verificationRouter.get("/assistant-vehicles", requirePermission("verification.view"), async (_req, res, next) => {
  try {
    res.json({ data: await listAssistantVehicles() });
  } catch (error) {
    next(error);
  }
});

verificationRouter.get("/assistants", requirePermission("verification.view"), async (_req, res, next) => {
  try {
    res.json({ data: await listAssistantVerifications() });
  } catch (error) {
    next(error);
  }
});

verificationRouter.post("/assistants", requirePermission("verification.edit"), async (req, res, next) => {
  try {
    const body = createAssistantBodySchema.parse(req.body);
    const data = await createAssistantForVerification(body);
    await logAssistantMasterEvent({
      assistantId: data.assistantId,
      action: "assistant_created",
      entityType: "assistant",
      entityId: data.assistantId,
      details: { assistantCode: body.assistantCode, displayName: body.displayName },
      actorUserId: req.auth?.sub ?? null
    });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

verificationRouter.put("/assistants/:assistantId", requirePermission("verification.edit"), async (req, res, next) => {
  try {
    const params = assistantIdParamsSchema.parse(req.params);
    const body = updateAssistantBodySchema.parse(req.body);
    const updated = await updateAssistantForVerification(params.assistantId, body);
    if (!updated) throw new Error("Assistant not found");
    await logAssistantMasterEvent({
      assistantId: params.assistantId,
      action: "profile_updated",
      entityType: "assistant",
      entityId: params.assistantId,
      details: {
        displayName: body.displayName,
        assistantCode: body.assistantCode,
        phone: body.phone ?? null,
        email: body.email ?? null
      },
      actorUserId: req.auth?.sub ?? null
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

verificationRouter.delete("/assistants/:assistantId", requirePermission("verification.edit"), async (req, res, next) => {
  try {
    const params = assistantIdParamsSchema.parse(req.params);
    const deleted = await deleteAssistantForVerification(params.assistantId, req.auth!.sub);
    if (!deleted) throw new Error("Assistant not found");
    await logAssistantMasterEvent({
      assistantId: params.assistantId,
      action: "assistant_deleted",
      entityType: "assistant",
      entityId: params.assistantId,
      details: {},
      actorUserId: req.auth?.sub ?? null
    });
    res.json({ data: deleted });
  } catch (error) {
    next(error);
  }
});

verificationRouter.get("/assistants/:assistantId/documents", requirePermission("verification.view"), async (req, res, next) => {
  try {
    const params = assistantIdParamsSchema.parse(req.params);
    res.json({ data: await listAssistantDocuments(params.assistantId) });
  } catch (error) {
    next(error);
  }
});

verificationRouter.post("/assistants/:assistantId/documents", requirePermission("verification.edit"), async (req, res, next) => {
  try {
    const params = assistantIdParamsSchema.parse(req.params);
    await attachAssistantDocument({
      assistantId: params.assistantId,
      ...assistantDocumentBodySchema.parse(req.body)
    });
    await logAssistantMasterEvent({
      assistantId: params.assistantId,
      action: "document_uploaded",
      entityType: "assistant_document",
      details: assistantDocumentBodySchema.parse(req.body),
      actorUserId: req.auth?.sub ?? null
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

verificationRouter.delete("/assistants/:assistantId/documents/:documentId", requirePermission("verification.edit"), async (req, res, next) => {
  try {
    const params = documentIdParamsSchema.parse(req.params);
    const deleted = await deleteAssistantDocument({
      assistantId: params.assistantId,
      documentId: params.documentId,
      actorUserId: req.auth!.sub
    });
    if (!deleted) throw new Error("Assistant document not found");
    await logAssistantMasterEvent({
      assistantId: params.assistantId,
      action: "document_deleted",
      entityType: "assistant_document",
      entityId: params.documentId,
      details: {},
      actorUserId: req.auth?.sub ?? null
    });
    res.json({ data: deleted });
  } catch (error) {
    next(error);
  }
});

verificationRouter.post(
  "/assistants/:assistantId/documents/:documentId/verify",
  requirePermission("verification.edit"),
  async (req, res, next) => {
    try {
      const params = documentIdParamsSchema.parse(req.params);
      const body = documentDecisionBodySchema.parse(req.body);
      const result = await verifyAssistantDocument({
        assistantId: params.assistantId,
        documentId: params.documentId,
        status: body.status,
        remarks: body.remarks,
        actorUserId: req.auth!.sub
      });
      await logAssistantMasterEvent({
        assistantId: params.assistantId,
        action: "document_verified",
        entityType: "assistant_document",
        entityId: params.documentId,
        details: { status: body.status, remarks: body.remarks ?? null },
        actorUserId: req.auth?.sub ?? null
      });
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

verificationRouter.post("/assistants/:assistantId/decision", requirePermission("verification.approve"), async (req, res, next) => {
  try {
    const params = assistantIdParamsSchema.parse(req.params);
    const body = assistantDecisionBodySchema.parse(req.body);
    const result = await decideAssistantVerification({
      assistantId: params.assistantId,
      decision: body.decision,
      reason: body.reason,
      actorUserId: req.auth?.sub ?? ""
    });
    await logAssistantMasterEvent({
      assistantId: params.assistantId,
      action: `assistant_${body.decision}`,
      entityType: "assistant",
      entityId: params.assistantId,
      details: { reason: body.reason ?? null },
      actorUserId: req.auth?.sub ?? null
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

verificationRouter.patch("/assistants/:assistantId/status", requirePermission("verification.approve"), async (req, res, next) => {
  try {
    const params = assistantIdParamsSchema.parse(req.params);
    const body = assistantStatusBodySchema.parse(req.body);
    const data = await updateAssistantVerificationStatus({
        assistantId: params.assistantId,
        status: body.status,
        reason: body.reason
      });
    await logAssistantMasterEvent({
      assistantId: params.assistantId,
      action: "status_updated",
      entityType: "assistant",
      entityId: params.assistantId,
      details: { status: body.status, reason: body.reason ?? null },
      actorUserId: req.auth?.sub ?? null
    });
    res.json({
      data
    });
  } catch (error) {
    next(error);
  }
});

verificationRouter.post("/assistants/:assistantId/clusters", requirePermission("verification.edit"), async (req, res, next) => {
  try {
    const params = assistantIdParamsSchema.parse(req.params);
    await mapAssistantToCluster({
      assistantId: params.assistantId,
      ...assistantClusterBodySchema.parse(req.body)
    });
    await logAssistantMasterEvent({
      assistantId: params.assistantId,
      action: "cluster_mapped",
      entityType: "assistant_cluster",
      details: assistantClusterBodySchema.parse(req.body),
      actorUserId: req.auth?.sub ?? null
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

verificationRouter.post("/assistant-vehicles", requirePermission("verification.edit"), async (req, res, next) => {
  try {
    res.status(201).json({ data: await upsertAssistantVehicle(vehicleBodySchema.parse(req.body)) });
  } catch (error) {
    next(error);
  }
});

verificationRouter.get("/assistant-vehicles/:vehicleId", requirePermission("verification.view"), async (req, res, next) => {
  try {
    const params = vehicleIdParamsSchema.parse(req.params);
    res.json({ data: await getAssistantVehicle(params.vehicleId) });
  } catch (error) {
    next(error);
  }
});

verificationRouter.put("/assistant-vehicles/:vehicleId", requirePermission("verification.edit"), async (req, res, next) => {
  try {
    const params = vehicleIdParamsSchema.parse(req.params);
    const updated = await updateAssistantVehicle(params.vehicleId, vehicleBodySchema.omit({ assistantId: true }).parse(req.body));
    if (!updated) throw new Error("Vehicle not found");
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

verificationRouter.delete("/assistant-vehicles/:vehicleId", requirePermission("verification.edit"), async (req, res, next) => {
  try {
    const params = vehicleIdParamsSchema.parse(req.params);
    const deleted = await deleteAssistantVehicle(params.vehicleId, req.auth!.sub);
    if (!deleted) throw new Error("Vehicle not found");
    res.json({ data: deleted });
  } catch (error) {
    next(error);
  }
});

verificationRouter.get("/assistant-vehicles/:vehicleId/documents", requirePermission("verification.view"), async (req, res, next) => {
  try {
    const params = vehicleIdParamsSchema.parse(req.params);
    res.json({ data: await listVehicleDocuments(params.vehicleId) });
  } catch (error) {
    next(error);
  }
});

verificationRouter.post("/assistant-vehicles/:vehicleId/documents", requirePermission("verification.edit"), async (req, res, next) => {
  try {
    const params = vehicleIdParamsSchema.parse(req.params);
    await attachVehicleDocument({ vehicleId: params.vehicleId, ...vehicleDocumentBodySchema.parse(req.body) });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
