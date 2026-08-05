import { Router } from "express";
import { z } from "zod";
import { requirePermission } from "../../http/auth.js";
import { OfferEligibilityService, OfferMasterService, OfferReportingService } from "./offers.service.js";

export const offersRouter = Router();

const offerMaster = new OfferMasterService();
const offerReporting = new OfferReportingService();

const idParamsSchema = z.object({ id: z.string().uuid() });
const offerQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(["all", "DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "EXPIRED", "ARCHIVED"]).default("all"),
  offerType: z.enum(["all", "PACKAGE", "DISCOUNT", "BUY_X_GET_Y", "FREE_SERVICE", "CREDIT", "FIXED_PRICE"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(200).default(20)
});

const uuidArray = z.array(z.string().uuid()).default([]);
const nullableUuid = z.string().uuid().nullable().optional();
const offerBodySchema = z.object({
  internalName: z.string().trim().min(1).max(160),
  offerType: z.enum(["PACKAGE", "DISCOUNT", "BUY_X_GET_Y", "FREE_SERVICE", "CREDIT", "FIXED_PRICE"]),
  status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "EXPIRED", "ARCHIVED"]).default("DRAFT"),
  title: z.string().trim().min(1).max(180),
  subtitle: z.string().trim().max(300).nullable().optional(),
  description: z.string().trim().max(3000).nullable().optional(),
  note: z.string().trim().max(1500).nullable().optional(),
  iconUrl: z.string().trim().max(600).nullable().optional(),
  imageUrl: z.string().trim().max(600).nullable().optional(),
  priority: z.coerce.number().int().min(0).default(0),
  customOfferExclusive: z.coerce.boolean().default(true),
  fallbackToGeneralOffer: z.coerce.boolean().default(false),
  stackingAllowed: z.coerce.boolean().default(false),
  audienceType: z.enum(["all", "selected_users"]).default("all"),
  userSegment: z.enum(["new", "old", "all"]).default("all"),
  validityMode: z.enum(["fixed_dates", "days_from_purchase", "days_from_issue", "days_from_first_use", "no_expiry"]).default("fixed_dates"),
  activeFrom: z.string().trim().nullable().optional(),
  activeUntil: z.string().trim().nullable().optional(),
  validDays: z.coerce.number().int().min(0).nullable().optional(),
  redeemLimitPerUser: z.coerce.number().int().min(1).default(1),
  redeemLimitTotal: z.coerce.number().int().min(0).nullable().optional(),
  redeemLimitDaily: z.coerce.number().int().min(0).nullable().optional(),
  redeemLimitCluster: z.coerce.number().int().min(0).nullable().optional(),
  cooldownMinutes: z.coerce.number().int().min(0).default(0),
  packagePurchaseLimit: z.coerce.number().int().min(0).nullable().optional(),
  autoApply: z.coerce.boolean().default(false),
  publicCode: z.string().trim().max(80).nullable().optional(),
  referralEnabled: z.coerce.boolean().default(false),
  referralScope: z.enum(["none", "all_assistants", "selected_assistants"]).default("none"),
  commonReferralCode: z.string().trim().max(80).nullable().optional(),
  discountType: z.enum(["none", "percent", "flat"]).default("none"),
  discountValue: z.coerce.number().min(0).default(0),
  discountCapPaise: z.coerce.number().int().min(0).nullable().optional(),
  fixedPricePaise: z.coerce.number().int().min(0).nullable().optional(),
  buyQuantity: z.coerce.number().int().min(0).nullable().optional(),
  freeQuantity: z.coerce.number().int().min(0).nullable().optional(),
  creditAmountPaise: z.coerce.number().int().min(0).nullable().optional(),
  packagePricePaise: z.coerce.number().int().min(0).nullable().optional(),
  isEnabled: z.coerce.boolean().default(true),
  isActive: z.coerce.boolean().default(true),
  scopes: z.array(z.object({
    scopeType: z.enum(["all", "state", "city", "zone", "cluster"]).default("all"),
    stateId: nullableUuid,
    cityId: nullableUuid,
    zoneId: nullableUuid,
    clusterId: nullableUuid
  })).default([{ scopeType: "all" }]),
  includedUserIds: uuidArray,
  excludedUserIds: uuidArray,
  serviceMasterIds: uuidArray,
  legacyServiceIds: uuidArray,
  categoryIds: uuidArray,
  bookingTypes: z.array(z.enum(["instant", "schedule", "both"])).default([]),
  durationIds: uuidArray,
  paymentModeIds: uuidArray,
  paymentModeCodes: z.array(z.string().trim().min(1).max(80)).default([]),
  referralCodes: z.array(z.object({
    assistantId: z.string().uuid().nullable().optional(),
    code: z.string().trim().min(1).max(80),
    rewardType: z.string().trim().max(80).default("none"),
    rewardValue: z.coerce.number().min(0).default(0),
    maxUses: z.coerce.number().int().min(0).nullable().optional(),
    isActive: z.coerce.boolean().default(true)
  })).default([]),
  contentItems: z.array(z.object({
    contentType: z.enum(["service", "do", "dont", "term"]),
    title: z.string().trim().max(180).nullable().optional(),
    subtitle: z.string().trim().max(300).nullable().optional(),
    body: z.string().trim().max(1500).nullable().optional(),
    iconUrl: z.string().trim().max(600).nullable().optional(),
    imageUrl: z.string().trim().max(600).nullable().optional(),
    sortOrder: z.coerce.number().int().min(0).default(0),
    metadata: z.record(z.string(), z.unknown()).default({})
  })).default([]),
  metadata: z.record(z.string(), z.unknown()).default({})
});

offersRouter.use(requirePermission("services.view"));

offersRouter.get("/", async (req, res, next) => {
  try {
    res.json(await offerMaster.list(offerQuerySchema.parse(req.query)));
  } catch (error) {
    next(error);
  }
});

offersRouter.get("/:id", async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    res.json({ data: await offerMaster.get(id) });
  } catch (error) {
    next(error);
  }
});

offersRouter.post("/", requirePermission("services.create"), async (req, res, next) => {
  try {
    res.status(201).json({ data: await offerMaster.create({ ...offerBodySchema.parse(req.body), userId: req.auth!.sub }) });
  } catch (error) {
    next(error);
  }
});

offersRouter.put("/:id", requirePermission("services.edit"), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    res.json({ data: await offerMaster.update(id, { ...offerBodySchema.parse(req.body), userId: req.auth!.sub }) });
  } catch (error) {
    next(error);
  }
});

offersRouter.post("/:id/validate", async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    res.json({ data: await offerMaster.validate(id) });
  } catch (error) {
    next(error);
  }
});

offersRouter.post("/:id/publish", requirePermission("services.edit"), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    res.json({ data: await offerMaster.publish(id, req.auth!.sub) });
  } catch (error) {
    next(error);
  }
});

offersRouter.post("/:id/pause", requirePermission("services.edit"), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    res.json({ data: await offerMaster.pause(id, req.auth!.sub) });
  } catch (error) {
    next(error);
  }
});

offersRouter.post("/:id/archive", requirePermission("services.edit"), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    res.json({ data: await offerMaster.archive(id, req.auth!.sub) });
  } catch (error) {
    next(error);
  }
});

offersRouter.get("/:id/redemptions", async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    res.json({ data: await offerReporting.redemptions(id) });
  } catch (error) {
    next(error);
  }
});

export const offerEligibilityService = new OfferEligibilityService();
