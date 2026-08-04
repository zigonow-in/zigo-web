import { Router } from "express";
import { z } from "zod";
import { requirePermission, requireSuperAdmin } from "../../http/auth.js";
import { HttpError } from "../../http/errors.js";
import {
  createCategory,
  createCategoryServiceMaster,
  createCategoryPriceRule,
  createBookingEngineQuickReply,
  createBookingEngineRule,
  createBookingType,
  createCity,
  createCluster,
  createDeliveryType,
  createPriceMasterRule,
  createPaymentModeRule,
  createState,
  createService,
  createSurgeRule,
  createTaxMasterRule,
  createZone,
  deleteCategory,
  deleteCategoryServiceMaster,
  deleteCategoryPriceRule,
  deleteBookingEngineQuickReply,
  deleteBookingEngineRule,
  deleteBookingType,
  deleteCity,
  deleteCluster,
  deleteClusterBookingTypeSetting,
  deleteClusterCategorySetting,
  deleteClusterServiceSetting,
  deletePriceMasterRule,
  deletePaymentModeRule,
  deleteService,
  deleteState,
  deleteSurgeRule,
  deleteTaxMasterRule,
  deleteZone,
  evaluateHighDemandSurge,
  getBookingCatalog,
  listCategories,
  listCategoryServiceMasters,
  listCategoryPriceRules,
  listBookingEngineQuickReplies,
  listBookingEngineRules,
  listBookingTypes,
  listCities,
  listClusterCategorySettings,
  listClusters,
  listClusterReport,
  listClusterBookingTypeSettings,
  listClusterServiceSettings,
  listDeliveryTypes,
  listPriceMasterRules,
  listPaymentModeRules,
  listServices,
  listStates,
  listSurgeRules,
  listTaxMasterRules,
  listZones,
  quotePriceMaster,
  updateCategory,
  updateCategoryServiceMaster,
  updateCategoryPriceRule,
  updateBookingEngineQuickReply,
  updateBookingEngineRule,
  updateBookingType,
  updateCity,
  updateCluster,
  updateDeliveryType,
  updatePriceMasterRule,
  updatePaymentModeRule,
  updateService,
  updateState,
  updateSurgeRule,
  updateTaxMasterRule,
  updateZone,
  upsertClusterCategorySetting,
  applyClusterBookingTypeSetting,
  upsertClusterServiceSetting
} from "./masters.repository.js";

export const mastersRouter = Router();

const idParamsSchema = z.object({ id: z.string().uuid() });
const active = z.coerce.boolean().default(true);
const stateBodySchema = z.object({ code: z.string().min(2), name: z.string().min(2), countryName: z.string().optional(), isActive: active });
const cityBodySchema = z.object({ stateId: z.string().uuid().nullable().optional(), code: z.string().min(2), name: z.string().min(2), isActive: active });
const zoneBodySchema = z.object({ cityId: z.string().uuid().nullable().optional(), code: z.string().min(2), name: z.string().min(2), isActive: active });
const clusterBodySchema = z.object({
  cityId: z.string().uuid(),
  zoneId: z.string().uuid().nullable().optional(),
  name: z.string().trim().max(160).default(""),
  code: z.string().min(2),
  description: z.string().nullable().optional(),
  areasDescription: z.string().nullable().optional(),
  polygonDescription: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  isPinned: z.coerce.boolean().default(false),
  pinPriority: z.coerce.number().int().min(0).default(0),
  priority: z.coerce.number().int().min(0).default(0),
  isBookingEnabled: z.coerce.boolean().default(false)
});
const clusterReportQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  cityId: z.string().uuid().optional(),
  zoneId: z.string().uuid().optional(),
  status: z.enum(["active", "inactive"]).optional()
});
const serviceBodySchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  locationMode: z.enum(["current", "multi"]).default("current"),
  maxLocationsLimit: z.coerce.number().int().min(1).max(50).default(1),
  priority: z.coerce.number().int().min(0).default(0),
  isRecommended: z.coerce.boolean().default(false),
  isEnabled: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: active
});
const categoryBodySchema = z.object({
  serviceId: z.string().uuid().nullable().optional(),
  serviceMasterId: z.string().uuid().nullable().optional(),
  parentCategoryId: z.string().uuid().nullable().optional(),
  code: z.string().trim().nullable().optional(),
  name: z.string().trim().max(160).default(""),
  description: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  imageUrls: z.array(z.string().trim()).default([]),
  locationMode: z.enum(["current", "multi"]).default("current"),
  maxLocationsLimit: z.coerce.number().int().min(1).max(50).default(1),
  showInHomePage: z.coerce.boolean().default(true),
  homeDisplayMode: z.enum(["category", "categoryPrice"]).default("category"),
  categoryImageHeight: z.coerce.number().int().min(0).max(600).default(0),
  categoryImageWidth: z.coerce.number().int().min(0).max(600).default(0),
  priceDisplayMode: z.enum(["row", "grid"]).default("row"),
  priceGridRows: z.coerce.number().int().min(1).max(10).default(3),
  priceGridColumns: z.coerce.number().int().min(1).max(10).default(3),
  supplyUnavailableAction: z.enum(["", "auto_hide", "show_popup", "redirect_schedule"]).default(""),
  supplyUnavailableMessage: z.string().trim().max(500).nullable().optional(),
  addWithOtherCategory: z.coerce.boolean().default(false),
  expandPriority: z.coerce.number().int().min(0).default(0),
  expandTitle: z.string().trim().nullable().optional(),
  expandDuration: z.string().trim().nullable().optional(),
  expandDescription: z.string().trim().nullable().optional(),
  taskListTitle: z.string().trim().nullable().optional(),
  taskList: z.array(z.string().trim()).default([]),
  canDoTitle: z.string().trim().nullable().optional(),
  canDoList: z.array(z.string().trim()).default([]),
  cantDoTitle: z.string().trim().nullable().optional(),
  cantDoList: z.array(z.string().trim()).default([]),
  priority: z.coerce.number().int().min(0).default(0),
  isRecommended: z.coerce.boolean().default(false),
  isEnabled: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: active
});
const categoryServiceMasterBodySchema = z.object({
  serviceTitle: z.string().trim().max(160).default(""),
  serviceSubtitle: z.string().trim().max(300).nullable().optional(),
  bookingType: z.enum(["both", "instant", "schedule"]).default("both"),
  showEta: z.coerce.boolean().default(false),
  serviceTitleFontSize: z.coerce.number().int().min(8).max(80).default(18),
  serviceTitleFontWeight: z.coerce.number().int().min(100).max(900).default(400),
  serviceTitleColor: z.string().trim().max(7).regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i).or(z.literal("")).default(""),
  serviceSubtitleFontSize: z.coerce.number().int().min(8).max(80).default(13),
  serviceSubtitleFontWeight: z.coerce.number().int().min(100).max(900).default(400),
  serviceSubtitleColor: z.string().trim().max(7).regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i).or(z.literal("")).default(""),
  icons: z.array(z.object({
    icon: z.string().trim().min(1).max(120),
    size: z.coerce.number().int().min(8).max(96).default(18),
    target: z.enum(["serviceTitle", "serviceSubtitle"]).default("serviceTitle"),
    position: z.enum(["left", "right"]).default("left")
  })).default([]),
  serviceCategoryGridSize: z.enum(["1x1", "2x2", "3x3", "4x4", "5x5"]).default("3x3"),
  servicePosition: z.coerce.number().int().min(0).default(0),
  isEnabled: z.coerce.boolean().default(true),
  isActive: active
});
const bookingTypeBodySchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  bookingType: z.enum(["instant", "schedule"]).default("instant"),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365).default(1),
  allowedDays: z.array(z.string()).default([]),
  timeCategories: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    sortOrder: z.coerce.number().int().min(1).default(1),
    isActive: z.coerce.boolean().default(true),
    timeSlots: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).default([])
  })).default([]),
  timeSlots: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).default([]),
  isDefault: z.coerce.boolean().default(false),
  isActive: active
});
const clusterServiceSettingBodySchema = z.object({
  clusterId: z.string().uuid(),
  serviceId: z.string().uuid(),
  isVisible: z.coerce.boolean().default(true),
  isEnabled: z.coerce.boolean().default(true),
  isActive: active
});
const clusterCategorySettingBodySchema = z.object({
  clusterId: z.string().uuid(),
  categoryId: z.string().uuid(),
  isVisible: z.coerce.boolean().default(true),
  isEnabled: z.coerce.boolean().default(true),
  basePrice: z.coerce.number().min(0).default(0),
  additionalCharges: z.coerce.number().min(0).default(0),
  discountType: z.enum(["none", "percent", "flat"]).default("none"),
  discountValue: z.coerce.number().min(0).default(0),
  discountLabel: z.string().nullable().optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  surgeLabel: z.string().nullable().optional(),
  surgeRuleIds: z.array(z.string().uuid()).default([]),
  isActive: active
});
const clusterBookingTypeSettingBodySchema = z.object({
  clusterId: z.string().uuid(),
  bookingType: z.enum(["both", "instant", "schedule"]).default("both"),
  serviceScope: z.enum(["all", "select"]).default("all"),
  serviceIds: z.array(z.string().uuid()).default([]),
  waitWindowMinutes: z.coerce.number().int().min(0).max(1440).default(0),
  instantMode: z.enum(["both", "automate", "manual"]).default("both"),
  isActive: active,
  individualSettings: z.array(z.object({
    targetType: z.literal("service"),
    serviceId: z.string().uuid().nullable().optional(),
    bookingType: z.enum(["both", "instant", "schedule"]).default("both"),
    waitWindowMinutes: z.coerce.number().int().min(0).max(1440).default(0),
    instantMode: z.enum(["both", "automate", "manual"]).default("both"),
    isActive: active
  })).default([]),
  replaceConfigKey: z.string().optional()
});
const clusterBookingTypeParamsSchema = z.object({
  targetType: z.literal("service"),
  id: z.string().uuid()
});
const surgeDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const surgeTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const surgeDay = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const surgeTimeRange = z.object({
  startTime: surgeTime.nullable().optional(),
  endTime: surgeTime.nullable().optional()
});
const demandSurgeSlabSchema = z.object({
  minOrders: z.coerce.number().min(0).max(100).default(0),
  maxOrders: z.coerce.number().min(0).max(100).default(100),
  minSupply: z.coerce.number().min(0).max(100).default(0),
  maxSupply: z.coerce.number().min(0).max(100).default(100),
  maxAvailableAssistants: z.coerce.number().min(0).max(100).optional(),
  adjustmentType: z.enum(["percent", "flat"]).default("percent"),
  adjustmentValue: z.coerce.number().default(0)
});
const surgeScopeSchema = z.object({
  scopeType: z.enum(["all", "state", "city", "zone", "cluster", "service", "category"]).default("all"),
  stateId: z.string().uuid().nullable().optional(),
  cityId: z.string().uuid().nullable().optional(),
  zoneId: z.string().uuid().nullable().optional(),
  clusterId: z.string().uuid().nullable().optional(),
  serviceId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  clusterIds: z.array(z.string().uuid()).default([]),
  serviceIds: z.array(z.string().uuid()).default([]),
  categoryIds: z.array(z.string().uuid()).default([])
});
const demandAnalyticsSchema = z.object({
  lookbackDays: z.coerce.number().int().min(1).max(365).default(3),
  startTime: surgeTime.nullable().optional(),
  endTime: surgeTime.nullable().optional(),
  days: z.array(surgeDay).default([]),
  selectedDates: z.array(surgeDate).default([]),
  includeHolidays: z.coerce.boolean().default(false)
});
const surgeRuleBodySchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  ruleType: z.enum(["time", "day", "holiday", "weather", "demand"]).default("time"),
  scheduleMode: z.enum(["date_time", "weekly"]).default("date_time"),
  days: z.array(surgeDay).default([]),
  selectedDates: z.array(surgeDate).default([]),
  dateTimes: z.array(surgeTimeRange.extend({ date: surgeDate })).default([]),
  dayTimes: z.record(surgeDay, surgeTimeRange).default({}),
  weeklyCalendar: z.record(surgeDay, z.array(surgeTimeRange)).default({}),
  demandSlabs: z.array(demandSurgeSlabSchema).default([]),
  demandAnalytics: demandAnalyticsSchema.default({}),
  scope: surgeScopeSchema.default({}),
  startTime: surgeTime.nullable().optional(),
  endTime: surgeTime.nullable().optional(),
  adjustmentType: z.enum(["percent", "flat"]).default("percent"),
  adjustmentValue: z.coerce.number().default(0),
  priority: z.coerce.number().int().min(0).default(0),
  isActive: active
});
const clusterSettingQuerySchema = z.object({
  clusterId: z.string().uuid().optional()
});
const bookingCatalogQuerySchema = z.object({
  clusterId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  q: z.string().trim().optional()
});
const highDemandEvaluateQuerySchema = z.object({
  orders: z.coerce.number().int().min(0),
  availableAssistants: z.coerce.number().int().min(0)
});
const priceMasterBodySchema = z.object({
  priceType: z.enum(["task", "time"]).default("task"),
  scopeType: z.enum(["all", "state", "city", "zone", "cluster"]).default("all"),
  stateId: z.string().uuid().nullable().optional(),
  cityId: z.string().uuid().nullable().optional(),
  zoneId: z.string().uuid().nullable().optional(),
  clusterId: z.string().uuid().nullable().optional(),
  serviceId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  storeId: z.string().uuid().nullable().optional(),
  basePrice: z.coerce.number().min(0).default(0),
  discountType: z.enum(["none", "percent", "flat"]).default("none"),
  discountValue: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0).optional(),
  cartAdded: z.coerce.boolean().default(false),
  complexityBase: z.enum(["none", "base", "selling"]).default("none"),
  complexityMultiplier: z.coerce.number().min(0).default(0),
  complexitySlabs: z.array(z.object({
    storeNumber: z.coerce.number().int().min(1),
    multiplier: z.coerce.number().min(0),
    durationMinutes: z.coerce.number().int().min(0).max(1440).default(0)
  })).default([]),
  maxStoresPerCategory: z.coerce.number().int().min(1).default(1),
  maxStoresTotal: z.coerce.number().int().min(1).default(10),
  timeSlabs: z.array(z.object({
    label: z.string().optional(),
    durationMinutes: z.coerce.number().int().min(1),
    price: z.coerce.number().min(0).optional(),
    basePrice: z.coerce.number().min(0).optional(),
    discountType: z.enum(["none", "percent", "flat"]).default("none"),
    discountValue: z.coerce.number().min(0).default(0),
    sellingPrice: z.coerce.number().min(0).optional(),
    isActive: z.coerce.boolean().default(true)
  })).default([]),
  description: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
  isActive: active
});
const taxMasterBodySchema = z.object({
  taxApplicableOn: z.enum(["base_price", "selling_price"]).default("selling_price"),
  taxApplicability: z.enum(["inclusive", "exclusive"]).default("exclusive"),
  taxType: z.enum(["percent", "flat"]).default("percent"),
  taxValue: z.coerce.number().min(0).default(0),
  formula: z.string().trim().min(1).max(1000).default("(taxApplicablePrice * taxValue / (100 + taxValue))"),
  taxLabel: z.string().trim().min(1).max(120),
  taxNote: z.string().trim().max(1000).nullable().optional(),
  isActive: active
});
const paymentModeBodySchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  subtitle: z.string().trim().max(240).nullable().optional(),
  icon: z.enum(["wallet", "receipt", "business", "package"]).default("wallet"),
  handler: z.enum(["wallet", "cash", "razorpay"]).default("cash"),
  customerSelectable: z.coerce.boolean().default(true),
  scopeType: z.enum(["all", "state", "city", "zone", "cluster"]).default("all"),
  stateId: z.string().uuid().nullable().optional(),
  cityId: z.string().uuid().nullable().optional(),
  zoneId: z.string().uuid().nullable().optional(),
  clusterId: z.string().uuid().nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  description: z.string().trim().max(1000).nullable().optional(),
  isEnabled: z.coerce.boolean().default(true),
  isActive: active
});
const categoryPriceQuerySchema = z.object({
  search: z.string().trim().optional(),
  scopeType: z.enum(["all", "state", "city", "zone", "cluster"]).optional(),
  stateId: z.string().uuid().optional(),
  cityId: z.string().uuid().optional(),
  zoneId: z.string().uuid().optional(),
  clusterId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(["active", "inactive"]).optional()
});
const categoryPriceBodySchema = z.object({
  scopeType: z.enum(["all", "state", "city", "zone", "cluster"]).default("all"),
  stateId: z.string().uuid().nullable().optional(),
  cityId: z.string().uuid().nullable().optional(),
  zoneId: z.string().uuid().nullable().optional(),
  clusterId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid(),
  label: z.string().trim().max(80).optional(),
  timeDurationMinutes: z.coerce.number().int().min(0).max(1440).default(0),
  basePrice: z.coerce.number().min(0).default(0),
  discountType: z.enum(["none", "percent", "flat"]).default("none"),
  discountValue: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0).optional(),
  waitingChargeAmount: z.coerce.number().min(0).default(0),
  waitingChargeTimeMinutes: z.coerce.number().int().min(0).max(1440).default(0),
  availableForDuration: z.coerce.boolean().default(true),
  availableForExtend: z.coerce.boolean().default(false),
  availableForExpand: z.coerce.boolean().default(false),
  isEnabled: z.coerce.boolean().default(true),
  isActive: active
});
const bookingEngineQuerySchema = z.object({
  search: z.string().trim().optional(),
  scopeType: z.enum(["all", "state", "city", "zone", "cluster", "category"]).optional(),
  stateId: z.string().uuid().optional(),
  cityId: z.string().uuid().optional(),
  zoneId: z.string().uuid().optional(),
  clusterId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(["active", "inactive"]).optional()
});
const bookingEngineBodySchema = z.object({
  scopeType: z.enum(["all", "state", "city", "zone", "cluster", "category"]).default("all"),
  stateId: z.string().uuid().nullable().optional(),
  cityId: z.string().uuid().nullable().optional(),
  zoneId: z.string().uuid().nullable().optional(),
  clusterId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  serviceControlMode: z.enum(["manual", "auto"]).default("manual"),
  manualServiceStatus: z.enum(["start", "stop"]).default("stop"),
  autoStartAt: z.string().trim().nullable().optional(),
  autoEndAt: z.string().trim().nullable().optional(),
  autoStartTime: z.string().trim().nullable().optional(),
  autoEndTime: z.string().trim().nullable().optional(),
  instantEtaMinutes: z.coerce.number().int().min(0).max(1440).default(0),
  instantInitiateMinutes: z.coerce.number().int().min(0).max(1440).default(0),
  instantWrapUpMinutes: z.coerce.number().int().min(0).max(1440).default(0),
  instantTravelMinutes: z.coerce.number().int().min(0).max(1440).default(0),
  scheduleEtaMinutes: z.coerce.number().int().min(0).max(1440).default(0),
  scheduleInitiateMinutes: z.coerce.number().int().min(0).max(1440).default(0),
  scheduleWrapUpMinutes: z.coerce.number().int().min(0).max(1440).default(0),
  scheduleTravelMinutes: z.coerce.number().int().min(0).max(1440).default(0),
  assistantAssignmentMode: z.enum(["auto", "manual"]).default("manual"),
  note: z.string().trim().max(4000).nullable().optional(),
  imageUrl: z.string().trim().max(1000).nullable().optional(),
  isActive: active
});
const bookingEngineQuickReplyActorSchema = z.enum(["admin", "customer", "assistant"]);
const bookingEngineQuickReplyStageSchema = z.enum(["pending_assign", "assigned", "accepted", "working", "completed", "cancelled", "rejected", "hold"]);
const bookingEngineQuickReplyActionSchema = z.enum([
  "message",
  "status_update",
  "cancel",
  "reject",
  "payment_request",
  "approval_request",
  "time_extension_request",
  "delay_update",
  "location_share"
]);
const bookingEngineQuickReplyQuerySchema = z.object({
  search: z.string().trim().optional(),
  scopeType: z.enum(["all", "state", "city", "zone", "cluster", "category"]).optional(),
  stateId: z.string().uuid().optional(),
  cityId: z.string().uuid().optional(),
  zoneId: z.string().uuid().optional(),
  clusterId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  actor: bookingEngineQuickReplyActorSchema.optional(),
  audience: bookingEngineQuickReplyActorSchema.optional(),
  bookingStage: bookingEngineQuickReplyStageSchema.optional(),
  actionType: bookingEngineQuickReplyActionSchema.optional(),
  status: z.enum(["active", "inactive"]).optional()
});
const bookingEngineQuickReplyBodySchema = z.object({
  scopeType: z.enum(["all", "state", "city", "zone", "cluster", "category"]).default("all"),
  stateId: z.string().uuid().nullable().optional(),
  cityId: z.string().uuid().nullable().optional(),
  zoneId: z.string().uuid().nullable().optional(),
  clusterId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  actor: bookingEngineQuickReplyActorSchema,
  audience: bookingEngineQuickReplyActorSchema,
  bookingStage: bookingEngineQuickReplyStageSchema,
  actionType: bookingEngineQuickReplyActionSchema,
  title: z.string().trim().min(2).max(160),
  message: z.string().trim().min(1).max(2000),
  sortOrder: z.coerce.number().int().min(0).default(0),
  metadata: z.record(z.string(), z.unknown()).default({}),
  isActive: active
});
const priceQuoteBodySchema = z.object({
  priceType: z.enum(["task", "time"]),
  stateId: z.string().uuid().nullable().optional(),
  cityId: z.string().uuid().nullable().optional(),
  zoneId: z.string().uuid().nullable().optional(),
  clusterId: z.string().uuid().nullable().optional(),
  serviceId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  durationMinutes: z.coerce.number().int().min(1).optional(),
  cartItems: z.array(z.object({
    serviceId: z.string().uuid().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    storeId: z.string().uuid().nullable().optional(),
    priceType: z.enum(["task", "time"]).optional(),
    durationMinutes: z.coerce.number().int().min(1).optional()
  })).default([])
});
const deliveryTypeBodySchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  description: z.string().nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true)
});

function crudRoutes(
  path: string,
  permissionModule: string,
  schema: z.ZodTypeAny,
  handlers: {
    list: () => Promise<unknown>;
    create: (body: any) => Promise<unknown>;
    update: (id: string, body: any) => Promise<unknown>;
    remove: (id: string, userId: string) => Promise<unknown>;
  },
  options: { superAdminDelete?: boolean } = {}
) {
  mastersRouter.get(path, requirePermission(`${permissionModule}.view`), async (_req, res, next) => {
    try {
      res.json({ data: await handlers.list() });
    } catch (error) {
      next(error);
    }
  });
  mastersRouter.post(path, requirePermission(`${permissionModule}.create`), async (req, res, next) => {
    try {
      res.status(201).json({ data: await handlers.create({ ...schema.parse(req.body), userId: req.auth!.sub }) });
    } catch (error) {
      next(error);
    }
  });
  mastersRouter.put(`${path}/:id`, requirePermission(`${permissionModule}.edit`), async (req, res, next) => {
    try {
      const { id } = idParamsSchema.parse(req.params);
      const updated = await handlers.update(id, { ...schema.parse(req.body), userId: req.auth!.sub });
      if (!updated) throw new HttpError(404, "Record not found");
      res.json({ data: updated });
    } catch (error) {
      next(error);
    }
  });
  mastersRouter.delete(`${path}/:id`, requirePermission(`${permissionModule}.delete`), ...(options.superAdminDelete ? [requireSuperAdmin] : []), async (req, res, next) => {
    try {
      const { id } = idParamsSchema.parse(req.params);
      const deleted = await handlers.remove(id, req.auth!.sub);
      if (!deleted) throw new HttpError(404, "Record not found");
      res.json({ data: deleted });
    } catch (error) {
      next(error);
    }
  });
}

mastersRouter.get("/clusters/report", requirePermission("locations.view"), async (req, res, next) => {
  try {
    const query = clusterReportQuerySchema.parse(req.query);
    res.json(await listClusterReport(query));
  } catch (error) {
    next(error);
  }
});

crudRoutes("/states", "locations", stateBodySchema, { list: listStates, create: createState, update: updateState, remove: deleteState });
crudRoutes("/cities", "locations", cityBodySchema, { list: listCities, create: createCity, update: updateCity, remove: deleteCity });
crudRoutes("/zones", "locations", zoneBodySchema, { list: listZones, create: createZone, update: updateZone, remove: deleteZone });
crudRoutes("/clusters", "locations", clusterBodySchema, { list: listClusters, create: createCluster, update: updateCluster, remove: deleteCluster }, { superAdminDelete: true });
crudRoutes("/services", "services", serviceBodySchema, { list: listServices, create: createService, update: updateService, remove: deleteService });
crudRoutes("/service-categories", "services", categoryBodySchema, { list: listCategories, create: createCategory, update: updateCategory, remove: deleteCategory });
crudRoutes("/booking-types", "services", bookingTypeBodySchema, { list: listBookingTypes, create: createBookingType, update: updateBookingType, remove: deleteBookingType });
crudRoutes("/surge-rules", "services", surgeRuleBodySchema, { list: listSurgeRules, create: createSurgeRule, update: updateSurgeRule, remove: deleteSurgeRule });
crudRoutes("/price-master", "services", priceMasterBodySchema, { list: listPriceMasterRules, create: createPriceMasterRule, update: updatePriceMasterRule, remove: deletePriceMasterRule });
crudRoutes("/tax-master", "services", taxMasterBodySchema, { list: listTaxMasterRules, create: createTaxMasterRule, update: updateTaxMasterRule, remove: deleteTaxMasterRule });
crudRoutes("/payment-modes", "services", paymentModeBodySchema, { list: listPaymentModeRules, create: createPaymentModeRule, update: updatePaymentModeRule, remove: deletePaymentModeRule });

mastersRouter.get("/category-prices", requirePermission("services.view"), async (req, res, next) => {
  try {
    res.json({ data: await listCategoryPriceRules(categoryPriceQuerySchema.parse(req.query)) });
  } catch (error) {
    next(error);
  }
});

mastersRouter.post("/category-prices", requirePermission("services.create"), async (req, res, next) => {
  try {
    res.status(201).json({ data: await createCategoryPriceRule({ ...categoryPriceBodySchema.parse(req.body), userId: req.auth!.sub }) });
  } catch (error) {
    next(error);
  }
});

mastersRouter.put("/category-prices/:id", requirePermission("services.edit"), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const updated = await updateCategoryPriceRule(id, { ...categoryPriceBodySchema.parse(req.body), userId: req.auth!.sub });
    if (!updated) throw new HttpError(404, "Record not found");
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

mastersRouter.delete("/category-prices/:id", requirePermission("services.delete"), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const deleted = await deleteCategoryPriceRule(id, req.auth!.sub);
    if (!deleted) throw new HttpError(404, "Record not found");
    res.json({ data: deleted });
  } catch (error) {
    next(error);
  }
});

mastersRouter.get("/booking-engine", requirePermission("services.view"), async (req, res, next) => {
  try {
    res.json({ data: await listBookingEngineRules(bookingEngineQuerySchema.parse(req.query)) });
  } catch (error) {
    next(error);
  }
});

mastersRouter.post("/booking-engine", requirePermission("services.create"), async (req, res, next) => {
  try {
    res.status(201).json({ data: await createBookingEngineRule({ ...bookingEngineBodySchema.parse(req.body), userId: req.auth!.sub }) });
  } catch (error) {
    next(error);
  }
});

mastersRouter.get("/booking-engine/quick-replies", requirePermission("services.view"), async (req, res, next) => {
  try {
    res.json({ data: await listBookingEngineQuickReplies(bookingEngineQuickReplyQuerySchema.parse(req.query)) });
  } catch (error) {
    next(error);
  }
});

mastersRouter.post("/booking-engine/quick-replies", requirePermission("services.create"), async (req, res, next) => {
  try {
    res.status(201).json({ data: await createBookingEngineQuickReply({ ...bookingEngineQuickReplyBodySchema.parse(req.body), userId: req.auth!.sub }) });
  } catch (error) {
    next(error);
  }
});

mastersRouter.put("/booking-engine/quick-replies/:id", requirePermission("services.edit"), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const updated = await updateBookingEngineQuickReply(id, { ...bookingEngineQuickReplyBodySchema.parse(req.body), userId: req.auth!.sub });
    if (!updated) throw new HttpError(404, "Record not found");
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

mastersRouter.delete("/booking-engine/quick-replies/:id", requirePermission("services.delete"), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const deleted = await deleteBookingEngineQuickReply(id, req.auth!.sub);
    if (!deleted) throw new HttpError(404, "Record not found");
    res.json({ data: deleted });
  } catch (error) {
    next(error);
  }
});

mastersRouter.put("/booking-engine/:id", requirePermission("services.edit"), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const updated = await updateBookingEngineRule(id, { ...bookingEngineBodySchema.parse(req.body), userId: req.auth!.sub });
    if (!updated) throw new HttpError(404, "Record not found");
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

mastersRouter.delete("/booking-engine/:id", requirePermission("services.delete"), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const deleted = await deleteBookingEngineRule(id, req.auth!.sub);
    if (!deleted) throw new HttpError(404, "Record not found");
    res.json({ data: deleted });
  } catch (error) {
    next(error);
  }
});

mastersRouter.post("/price-master/quote", requirePermission("services.view"), async (req, res, next) => {
  try {
    res.json({ data: await quotePriceMaster(priceQuoteBodySchema.parse(req.body)) });
  } catch (error) {
    next(error);
  }
});

mastersRouter.get("/booking-catalog", requirePermission("services.view"), async (req, res, next) => {
  try {
    res.json({ data: await getBookingCatalog(bookingCatalogQuerySchema.parse(req.query)) });
  } catch (error) {
    next(error);
  }
});

mastersRouter.get("/surge-rules/high-demand/evaluate", requirePermission("services.view"), async (req, res, next) => {
  try {
    const query = highDemandEvaluateQuerySchema.parse(req.query);
    res.json({ data: await evaluateHighDemandSurge(query) });
  } catch (error) {
    next(error);
  }
});

mastersRouter.get("/cluster-services", requirePermission("services.view"), async (req, res, next) => {
  try {
    const query = clusterSettingQuerySchema.parse(req.query);
    res.json({ data: await listClusterServiceSettings(query.clusterId) });
  } catch (error) {
    next(error);
  }
});

mastersRouter.post("/cluster-services", requirePermission("services.edit"), async (req, res, next) => {
  try {
    res.status(201).json({ data: await upsertClusterServiceSetting({ ...clusterServiceSettingBodySchema.parse(req.body), userId: req.auth!.sub }) });
  } catch (error) {
    next(error);
  }
});

mastersRouter.delete("/cluster-services/:id", requirePermission("services.edit"), requireSuperAdmin, async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const deleted = await deleteClusterServiceSetting(id, req.auth!.sub);
    if (!deleted) throw new HttpError(404, "Cluster service setting not found");
    res.json({ data: deleted });
  } catch (error) {
    next(error);
  }
});

mastersRouter.get("/cluster-booking-types", requirePermission("services.view"), async (req, res, next) => {
  try {
    const query = clusterSettingQuerySchema.parse(req.query);
    res.json({ data: await listClusterBookingTypeSettings(query.clusterId) });
  } catch (error) {
    next(error);
  }
});

mastersRouter.post("/cluster-booking-types", requirePermission("services.edit"), async (req, res, next) => {
  try {
    res.status(201).json({ data: await applyClusterBookingTypeSetting({ ...clusterBookingTypeSettingBodySchema.parse(req.body), userId: req.auth!.sub }) });
  } catch (error) {
    next(error);
  }
});

mastersRouter.delete("/cluster-booking-types/:targetType/:id", requirePermission("services.edit"), async (req, res, next) => {
  try {
    const { targetType, id } = clusterBookingTypeParamsSchema.parse(req.params);
    const deleted = await deleteClusterBookingTypeSetting(targetType, id, req.auth!.sub);
    if (!deleted) throw new HttpError(404, "Cluster Booking Type setting not found");
    res.json({ data: deleted });
  } catch (error) {
    next(error);
  }
});

mastersRouter.get("/cluster-categories", requirePermission("services.view"), async (req, res, next) => {
  try {
    const query = clusterSettingQuerySchema.parse(req.query);
    res.json({ data: await listClusterCategorySettings(query.clusterId) });
  } catch (error) {
    next(error);
  }
});

mastersRouter.post("/cluster-categories", requirePermission("services.edit"), async (req, res, next) => {
  try {
    res.status(201).json({ data: await upsertClusterCategorySetting({ ...clusterCategorySettingBodySchema.parse(req.body), userId: req.auth!.sub }) });
  } catch (error) {
    next(error);
  }
});

mastersRouter.delete("/cluster-categories/:id", requirePermission("services.edit"), requireSuperAdmin, async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const deleted = await deleteClusterCategorySetting(id, req.auth!.sub);
    if (!deleted) throw new HttpError(404, "Cluster category setting not found");
    res.json({ data: deleted });
  } catch (error) {
    next(error);
  }
});

mastersRouter.get("/categories", requirePermission("services.view"), async (_req, res, next) => {
  try {
    res.json({ data: await listCategories() });
  } catch (error) {
    next(error);
  }
});
mastersRouter.post("/categories", requirePermission("services.create"), async (req, res, next) => {
  try {
    res.status(201).json({ data: await createCategory({ ...categoryBodySchema.parse(req.body), userId: req.auth!.sub }) });
  } catch (error) {
    next(error);
  }
});
mastersRouter.put("/categories/:id", requirePermission("services.edit"), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const updated = await updateCategory(id, { ...categoryBodySchema.parse(req.body), userId: req.auth!.sub });
    if (!updated) throw new HttpError(404, "Category not found");
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});
mastersRouter.delete("/categories/:id", requirePermission("services.delete"), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const deleted = await deleteCategory(id, req.auth!.sub);
    if (!deleted) throw new HttpError(404, "Category not found");
    res.json({ data: deleted });
  } catch (error) {
    next(error);
  }
});

crudRoutes("/category-service-masters", "services", categoryServiceMasterBodySchema, {
  list: listCategoryServiceMasters,
  create: createCategoryServiceMaster,
  update: updateCategoryServiceMaster,
  remove: deleteCategoryServiceMaster
});

mastersRouter.get("/delivery-types", requirePermission("services.view"), async (_req, res, next) => {
  try {
    res.json({ data: await listDeliveryTypes() });
  } catch (error) {
    next(error);
  }
});
mastersRouter.post("/delivery-types", requirePermission("services.create"), async (req, res, next) => {
  try {
    res.status(201).json({ data: await createDeliveryType(deliveryTypeBodySchema.parse(req.body)) });
  } catch (error) {
    next(error);
  }
});
mastersRouter.put("/delivery-types/:id", requirePermission("services.edit"), async (req, res, next) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const updated = await updateDeliveryType(id, deliveryTypeBodySchema.parse(req.body));
    if (!updated) throw new HttpError(404, "Delivery type not found");
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});
