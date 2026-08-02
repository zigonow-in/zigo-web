import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { isSuperAdmin, requirePermission } from "../../http/auth.js";
import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";
import { getBookingCartMixSetting, getBookingEngineSetting, getBookingLiveSyncSetting, getBookingTypeAutomationSetting, getMediaPaths, getOtpProviderSettings, saveDocumentUpload, saveImageUpload, updateBookingCartMixSetting, updateBookingEngineSetting, updateBookingLiveSyncSetting, updateBookingTypeAutomationSetting, updateMediaPaths, updateOtpProviderSettings } from "./settings.repository.js";

export const settingsRouter = Router();

const mediaPathsBodySchema = z.object({
  imageSavePath: z.string().trim().min(1, "Image save path is required."),
  documentSavePath: z.string().trim().min(1, "Document save path is required.")
});

const imageUploadBodySchema = z.object({
  originalName: z.string().trim().min(1, "Image file name is required."),
  mimeType: z.string().trim().min(1, "Image MIME type is required."),
  dataBase64: z.string().min(1, "Image file content is required.")
});

const documentUploadBodySchema = z.object({
  originalName: z.string().trim().min(1, "Document file name is required."),
  mimeType: z.string().trim().optional().default(""),
  dataBase64: z.string().min(1, "Document file content is required.")
});

const bookingCartMixBodySchema = z.object({
  personalAssistantServiceId: z.string().uuid().nullable().optional(),
  allowedWithMode: z.enum(["none", "all", "selected"]).default("none"),
  allowedServiceIds: z.array(z.string().uuid()).default([])
});

const bookingTypeAutomationBodySchema = z.object({
  maxReachMinutes: z.coerce.number().int().min(1).max(240).default(30),
  freeSoonMinutes: z.coerce.number().int().min(1).max(240).default(15),
  averageReachMinutes: z.coerce.number().int().min(1).max(240).default(20)
});
const bookingLiveSyncBodySchema = z.object({
  isEnabled: z.boolean().default(true),
  transport: z.enum(["sse", "polling", "off"]).default("sse"),
  refreshOnEvent: z.boolean().default(true),
  playSound: z.boolean().default(true),
  showBell: z.boolean().default(true),
  showToast: z.boolean().default(true),
  fallbackPollingEnabled: z.boolean().default(false),
  fallbackPollingSeconds: z.coerce.number().int().min(10).max(3600).default(60),
  reconnectSeconds: z.coerce.number().int().min(2).max(300).default(5),
  eventScope: z.string().trim().max(80).optional().default("bookings")
});
const bookingEngineHurdleSchema = z.object({
  enabled: z.boolean().default(true),
  action: z.enum(["warn_only", "auto_reassign", "warn_then_reassign", "recalculate_supply", "manual_dispatch"]).default("warn_only"),
  escalationMinutes: z.coerce.number().int().min(0).max(1440).default(0)
});
const customerPortalSchema = z.object({
  isEnabled: z.boolean().default(true),
  shareUrlPath: z.string().trim().min(1).max(160).default("/customer"),
  allowSelfRegistration: z.boolean().default(true),
  loginWithMobileOtp: z.boolean().default(true),
  allowBookService: z.boolean().default(true),
  allowOnlinePayment: z.boolean().default(true),
  allowLiveTracking: z.boolean().default(true),
  allowTextUpdates: z.boolean().default(true),
  allowImageUpdates: z.boolean().default(true),
  allowVoiceUpdates: z.boolean().default(true),
  linkExpiryMinutes: z.coerce.number().int().min(5).max(10080).default(1440)
});
const assistantPortalSchema = z.object({
  isEnabled: z.boolean().default(true),
  shareUrlPath: z.string().trim().min(1).max(160).default("/assistant"),
  loginWithMobileOtp: z.boolean().default(true),
  loginWithPassword: z.boolean().default(true),
  allowGoOnline: z.boolean().default(true),
  allowTaskExecution: z.boolean().default(true),
  allowTextUpdates: z.boolean().default(true),
  allowImageUpdates: z.boolean().default(true),
  allowVoiceUpdates: z.boolean().default(true),
  allowDailyReport: z.boolean().default(true),
  requireClusterVehicleDocuments: z.boolean().default(true)
});
const adminOverrideSchema = z.object({
  canBookForCustomer: z.boolean().default(true),
  canAssignForAssistant: z.boolean().default(true),
  canRespondForCustomer: z.boolean().default(true),
  canRespondForAssistant: z.boolean().default(true),
  canForceCompleteTask: z.boolean().default(true),
  canSwitchInstantToSchedule: z.boolean().default(true),
  overrideReasonRequired: z.boolean().default(true),
  autoEscalateNoResponseMinutes: z.coerce.number().int().min(1).max(1440).default(5)
});
const communicationSchema = z.object({
  realtimeUpdatesEnabled: z.boolean().default(true),
  customerNotifyOnAssignment: z.boolean().default(true),
  customerNotifyOnDelay: z.boolean().default(true),
  assistantNotifyOnAssignment: z.boolean().default(true),
  adminNotifyOnNoResponse: z.boolean().default(true),
  allowCustomerAssistantChat: z.boolean().default(true),
  storeTaskMediaInTimeline: z.boolean().default(true)
});
const bookingEngineBodySchema = z.object({
  isEnabled: z.boolean().default(true),
  orchestrationWorkerEnabled: z.boolean().default(true),
  orchestrationIntervalSeconds: z.coerce.number().int().min(5).max(3600).default(30),
  batchSize: z.coerce.number().int().min(10).max(500).default(100),
  businessModel: z.enum(["managed_supply", "marketplace", "hybrid"]).default("managed_supply"),
  riskLookaheadMinutes: z.coerce.number().int().min(1).max(1440).default(15),
  slaGraceMinutes: z.coerce.number().int().min(0).max(1440).default(10),
  manualAssignBeforeStartMinutes: z.coerce.number().int().min(0).max(1440).default(15),
  instantAutoMaxWaitMinutes: z.coerce.number().int().min(1).max(240).default(45),
  defaultWaitWindowMinutes: z.coerce.number().int().min(0).max(240).default(0),
  customerCancelInstantMinutes: z.coerce.number().int().min(1).max(240).default(5),
  customerCancelScheduleMinutes: z.coerce.number().int().min(1).max(240).default(30),
  customerAssistantDelayCancelOpenMinutes: z.coerce.number().int().min(1).max(240).default(10),
  customerAssistantDelayAutoCancelMinutes: z.coerce.number().int().min(1).max(240).default(30),
  capacityHoldMinutes: z.coerce.number().int().min(1).max(240).default(10),
  paymentHoldMinutes: z.coerce.number().int().min(1).max(240).default(10),
  assignmentAcceptanceTimeoutSeconds: z.coerce.number().int().min(10).max(3600).default(120),
  autoReassignEnabled: z.boolean().default(true),
  autoReassignAfterSeconds: z.coerce.number().int().min(10).max(3600).default(120),
  allowManualInstantWhenNoSupply: z.boolean().default(true),
  releaseCapacityOnPaymentFailure: z.boolean().default(true),
  releaseCapacityOnCancel: z.boolean().default(true),
  notifyOnRiskChange: z.boolean().default(true),
  customerPortal: customerPortalSchema,
  assistantPortal: assistantPortalSchema,
  adminOverride: adminOverrideSchema,
  communication: communicationSchema,
  hurdles: z.object({
    assistantOffline: bookingEngineHurdleSchema,
    previousTaskDelay: bookingEngineHurdleSchema,
    customerExtension: bookingEngineHurdleSchema,
    waitingTimeExtend: bookingEngineHurdleSchema,
    vehicleIssue: bookingEngineHurdleSchema,
    locationIssue: bookingEngineHurdleSchema
  })
}).refine((value) => value.customerAssistantDelayAutoCancelMinutes >= value.customerAssistantDelayCancelOpenMinutes, {
  message: "Auto cancel delay minutes must be greater than or equal to customer cancel open minutes.",
  path: ["customerAssistantDelayAutoCancelMinutes"]
});
const otpProviderBodySchema = z.object({
  smsProviders: z.array(z.record(z.unknown())).default([]),
  emailProviders: z.array(z.record(z.unknown())).default([])
});

function requireAnyPermission(permissionCodes: string[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw new HttpError(401, "Authorization token required");
      if (isSuperAdmin(req)) {
        next();
        return;
      }
      const result = await pool.query<{ allowed: boolean }>(
        `
          select exists (
            select 1
            from zigo.user_roles ur
            join zigo.roles r on r.id = ur.role_id
            join zigo.role_permissions rp on rp.role_id = r.id
            join zigo.permissions p on p.id = rp.permission_id
            where ur.user_id = $1
              and p.code = any($2::text[])
            union
            select 1
            from zigo.user_permissions up
            join zigo.permissions p on p.id = up.permission_id
            where up.user_id = $1
              and p.code = any($2::text[])
          ) as allowed
        `,
        [req.auth.sub, permissionCodes]
      );
      if (!result.rows[0]?.allowed) throw new HttpError(403, `Permission required: ${permissionCodes.join(" or ")}`);
      next();
    } catch (error) {
      next(error);
    }
  };
}

settingsRouter.get("/media-paths", requirePermission("settings.view"), async (_req, res, next) => {
  try {
    res.json({ data: await getMediaPaths() });
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/media-paths", requirePermission("settings.edit"), async (req, res, next) => {
  try {
    const body = mediaPathsBodySchema.parse(req.body);
    res.json({
      data: await updateMediaPaths({
        ...body,
        actorUserId: req.auth!.sub
      })
    });
  } catch (error) {
    next(error);
  }
});

settingsRouter.get("/booking-cart-mix", requireAnyPermission(["settings.view", "services.view"]), async (_req, res, next) => {
  try {
    res.json({ data: await getBookingCartMixSetting() });
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/booking-cart-mix", requirePermission("settings.edit"), async (req, res, next) => {
  try {
    const body = bookingCartMixBodySchema.parse(req.body);
    res.json({
      data: await updateBookingCartMixSetting({
        ...body,
        actorUserId: req.auth!.sub
      })
    });
  } catch (error) {
    next(error);
  }
});

settingsRouter.get("/booking-type-automation", requireAnyPermission(["settings.view", "services.view"]), async (_req, res, next) => {
  try {
    res.json({ data: await getBookingTypeAutomationSetting() });
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/booking-type-automation", requirePermission("settings.edit"), async (req, res, next) => {
  try {
    const body = bookingTypeAutomationBodySchema.parse(req.body);
    res.json({
      data: await updateBookingTypeAutomationSetting({
        ...body,
        actorUserId: req.auth!.sub
      })
    });
  } catch (error) {
    next(error);
  }
});

settingsRouter.get("/booking-live-sync", requirePermission("settings.view"), async (_req, res, next) => {
  try {
    res.json({ data: await getBookingLiveSyncSetting() });
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/booking-live-sync", requirePermission("settings.edit"), async (req, res, next) => {
  try {
    const body = bookingLiveSyncBodySchema.parse(req.body);
    res.json({
      data: await updateBookingLiveSyncSetting({
        ...body,
        actorUserId: req.auth!.sub
      })
    });
  } catch (error) {
    next(error);
  }
});

settingsRouter.get("/booking-engine", requirePermission("settings.view"), async (_req, res, next) => {
  try {
    res.json({ data: await getBookingEngineSetting() });
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/booking-engine", requirePermission("settings.edit"), async (req, res, next) => {
  try {
    const body = bookingEngineBodySchema.parse(req.body);
    res.json({
      data: await updateBookingEngineSetting({
        ...body,
        actorUserId: req.auth!.sub
      })
    });
  } catch (error) {
    next(error);
  }
});

settingsRouter.get("/otp-providers", requirePermission("settings.view"), async (_req, res, next) => {
  try {
    res.json({ data: await getOtpProviderSettings() });
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/otp-providers", requirePermission("settings.edit"), async (req, res, next) => {
  try {
    const body = otpProviderBodySchema.parse(req.body);
    res.json({
      data: await updateOtpProviderSettings({
        ...body,
        actorUserId: req.auth!.sub
      })
    });
  } catch (error) {
    next(error);
  }
});

settingsRouter.post("/media-images", requireAnyPermission(["service_requests.view", "tasks.assign", "services.edit", "stores.edit", "verification.edit"]), async (req, res, next) => {
  try {
    res.status(201).json({
      data: await saveImageUpload({
        ...imageUploadBodySchema.parse(req.body),
        actorUserId: req.auth!.sub
      })
    });
  } catch (error) {
    next(error);
  }
});

settingsRouter.post("/media-documents", requireAnyPermission(["users.create", "service_requests.view", "tasks.assign", "services.edit", "stores.edit", "verification.edit"]), async (req, res, next) => {
  try {
    res.status(201).json({
      data: await saveDocumentUpload({
        ...documentUploadBodySchema.parse(req.body),
        actorUserId: req.auth!.sub
      })
    });
  } catch (error) {
    next(error);
  }
});
