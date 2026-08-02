import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";
import fs from "node:fs/promises";
import path from "node:path";

type Queryable = Pick<typeof pool, "query">;

export const MEDIA_PATH_SETTING_KEYS = {
  image: "media.image_save_path",
  document: "media.document_save_path"
} as const;

export const BOOKING_CART_MIX_SETTING_KEY = "booking.personal_assistant_cart_mix";
export const BOOKING_TYPE_AUTOMATION_SETTING_KEY = "booking.type_automation";
export const BOOKING_LIVE_SYNC_SETTING_KEY = "booking.live_sync";
export const BOOKING_ENGINE_SETTING_KEY = "booking.engine";
export const OTP_PROVIDER_SETTING_KEY = "otp.providers";

const DEFAULT_MEDIA_PATHS = {
  [MEDIA_PATH_SETTING_KEYS.image]: "/uploads/images",
  [MEDIA_PATH_SETTING_KEYS.document]: "/uploads/documents"
} as const;

const DEFAULT_BOOKING_CART_MIX = {
  personalAssistantServiceId: null,
  allowedWithMode: "none",
  allowedServiceIds: []
} as const;

const DEFAULT_BOOKING_TYPE_AUTOMATION = {
  maxReachMinutes: 30,
  freeSoonMinutes: 15,
  averageReachMinutes: 20
} as const;

export const DEFAULT_BOOKING_LIVE_SYNC = {
  isEnabled: true,
  transport: "sse",
  refreshOnEvent: true,
  playSound: true,
  showBell: true,
  showToast: true,
  fallbackPollingEnabled: false,
  fallbackPollingSeconds: 60,
  reconnectSeconds: 5,
  eventScope: "bookings"
} as const;

export const DEFAULT_BOOKING_ENGINE_SETTINGS = {
  isEnabled: true,
  orchestrationWorkerEnabled: true,
  orchestrationIntervalSeconds: 30,
  batchSize: 100,
  businessModel: "managed_supply",
  riskLookaheadMinutes: 15,
  slaGraceMinutes: 10,
  manualAssignBeforeStartMinutes: 15,
  instantAutoMaxWaitMinutes: 45,
  defaultWaitWindowMinutes: 0,
  customerCancelInstantMinutes: 5,
  customerCancelScheduleMinutes: 30,
  capacityHoldMinutes: 10,
  paymentHoldMinutes: 10,
  assignmentAcceptanceTimeoutSeconds: 120,
  autoReassignEnabled: true,
  autoReassignAfterSeconds: 120,
  allowManualInstantWhenNoSupply: true,
  releaseCapacityOnPaymentFailure: true,
  releaseCapacityOnCancel: true,
  notifyOnRiskChange: true,
  customerPortal: {
    isEnabled: true,
    shareUrlPath: "/customer",
    allowSelfRegistration: true,
    loginWithMobileOtp: true,
    allowBookService: true,
    allowOnlinePayment: true,
    allowLiveTracking: true,
    allowTextUpdates: true,
    allowImageUpdates: true,
    allowVoiceUpdates: true,
    linkExpiryMinutes: 1440
  },
  assistantPortal: {
    isEnabled: true,
    shareUrlPath: "/assistant",
    loginWithMobileOtp: true,
    loginWithPassword: true,
    allowGoOnline: true,
    allowTaskExecution: true,
    allowTextUpdates: true,
    allowImageUpdates: true,
    allowVoiceUpdates: true,
    allowDailyReport: true,
    requireClusterVehicleDocuments: true
  },
  adminOverride: {
    canBookForCustomer: true,
    canAssignForAssistant: true,
    canRespondForCustomer: true,
    canRespondForAssistant: true,
    canForceCompleteTask: true,
    canSwitchInstantToSchedule: true,
    overrideReasonRequired: true,
    autoEscalateNoResponseMinutes: 5
  },
  communication: {
    realtimeUpdatesEnabled: true,
    customerNotifyOnAssignment: true,
    customerNotifyOnDelay: true,
    assistantNotifyOnAssignment: true,
    adminNotifyOnNoResponse: true,
    allowCustomerAssistantChat: true,
    storeTaskMediaInTimeline: true
  },
  hurdles: {
    assistantOffline: { enabled: true, action: "auto_reassign", escalationMinutes: 2 },
    previousTaskDelay: { enabled: true, action: "warn_then_reassign", escalationMinutes: 5 },
    customerExtension: { enabled: true, action: "recalculate_supply", escalationMinutes: 0 },
    waitingTimeExtend: { enabled: true, action: "recalculate_supply", escalationMinutes: 0 },
    vehicleIssue: { enabled: true, action: "manual_dispatch", escalationMinutes: 3 },
    locationIssue: { enabled: true, action: "manual_dispatch", escalationMinutes: 3 }
  }
} as const;

type BookingEngineHurdleAction = "warn_only" | "auto_reassign" | "warn_then_reassign" | "recalculate_supply" | "manual_dispatch";
type BookingEngineHurdleSetting = {
  enabled: boolean;
  action: BookingEngineHurdleAction;
  escalationMinutes: number;
};
type CustomerPortalSettings = {
  isEnabled: boolean;
  shareUrlPath: string;
  allowSelfRegistration: boolean;
  loginWithMobileOtp: boolean;
  allowBookService: boolean;
  allowOnlinePayment: boolean;
  allowLiveTracking: boolean;
  allowTextUpdates: boolean;
  allowImageUpdates: boolean;
  allowVoiceUpdates: boolean;
  linkExpiryMinutes: number;
};
type AssistantPortalSettings = {
  isEnabled: boolean;
  shareUrlPath: string;
  loginWithMobileOtp: boolean;
  loginWithPassword: boolean;
  allowGoOnline: boolean;
  allowTaskExecution: boolean;
  allowTextUpdates: boolean;
  allowImageUpdates: boolean;
  allowVoiceUpdates: boolean;
  allowDailyReport: boolean;
  requireClusterVehicleDocuments: boolean;
};
type AdminOverrideSettings = {
  canBookForCustomer: boolean;
  canAssignForAssistant: boolean;
  canRespondForCustomer: boolean;
  canRespondForAssistant: boolean;
  canForceCompleteTask: boolean;
  canSwitchInstantToSchedule: boolean;
  overrideReasonRequired: boolean;
  autoEscalateNoResponseMinutes: number;
};
type CommunicationSettings = {
  realtimeUpdatesEnabled: boolean;
  customerNotifyOnAssignment: boolean;
  customerNotifyOnDelay: boolean;
  assistantNotifyOnAssignment: boolean;
  adminNotifyOnNoResponse: boolean;
  allowCustomerAssistantChat: boolean;
  storeTaskMediaInTimeline: boolean;
};
export type BookingEngineSettings = {
  isEnabled: boolean;
  orchestrationWorkerEnabled: boolean;
  orchestrationIntervalSeconds: number;
  batchSize: number;
  businessModel: "managed_supply" | "marketplace" | "hybrid";
  riskLookaheadMinutes: number;
  slaGraceMinutes: number;
  manualAssignBeforeStartMinutes: number;
  instantAutoMaxWaitMinutes: number;
  defaultWaitWindowMinutes: number;
  customerCancelInstantMinutes: number;
  customerCancelScheduleMinutes: number;
  capacityHoldMinutes: number;
  paymentHoldMinutes: number;
  assignmentAcceptanceTimeoutSeconds: number;
  autoReassignEnabled: boolean;
  autoReassignAfterSeconds: number;
  allowManualInstantWhenNoSupply: boolean;
  releaseCapacityOnPaymentFailure: boolean;
  releaseCapacityOnCancel: boolean;
  notifyOnRiskChange: boolean;
  customerPortal: CustomerPortalSettings;
  assistantPortal: AssistantPortalSettings;
  adminOverride: AdminOverrideSettings;
  communication: CommunicationSettings;
  hurdles: {
    assistantOffline: BookingEngineHurdleSetting;
    previousTaskDelay: BookingEngineHurdleSetting;
    customerExtension: BookingEngineHurdleSetting;
    waitingTimeExtend: BookingEngineHurdleSetting;
    vehicleIssue: BookingEngineHurdleSetting;
    locationIssue: BookingEngineHurdleSetting;
  };
};

export const DEFAULT_OTP_PROVIDER_SETTINGS = {
  smsProviders: [
    {
      id: "startmessaging",
      name: "StartMessaging",
      isActive: true,
      method: "POST",
      url: "https://api.startmessaging.com/otp/send",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ""
      },
      bodyTemplate: {
        phoneNumber: "{{phoneNumber}}",
        templateId: "",
        variables: { otp: "{{otp}}", appName: "ZIGO", message: "ZIGO SMS Verification Code: {{otp}}" }
      },
      successPath: "success",
      messageIdPath: "data.messageId",
      requestSample: {},
      responseSample: {}
    }
  ],
  emailProviders: [
    {
      id: "zigo-smtp",
      name: "ZIGO GoDaddy SMTP",
      isActive: true,
      host: "smtpout.secureserver.net",
      port: 465,
      secure: true,
      user: "admin@zigonow.in",
      password: "",
      from: "admin@zigonow.in",
      subjectTemplate: "ZIGO Email Verification Code",
      bodyTemplate: "ZIGO Email Verification Code: {{otp}}\n\nUse this 6 digit code to verify your ZIGO account. It expires in 10 minutes.",
      requestSample: {},
      responseSample: {}
    }
  ]
} as const;

type MediaPathKey = (typeof MEDIA_PATH_SETTING_KEYS)[keyof typeof MEDIA_PATH_SETTING_KEYS];

function isUndefinedTableError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "42P01";
}

function normalizePath(value: string) {
  return value.trim();
}

async function ensureDefaultSetting(client: Queryable, key: MediaPathKey, description: string, actorUserId?: string | null) {
  await client.query(
    `
      insert into zigo.app_settings ("key", value, description, is_active, created_by, updated_by)
      values ($1, $2, $3, true, $4, $4)
      on conflict ("key") do update
        set description = excluded.description,
            is_active = true,
            is_deleted = false,
            deleted_by = null,
            deleted_at = null,
            updated_at = now()
    `,
    [key, DEFAULT_MEDIA_PATHS[key], description, actorUserId ?? null]
  );
}

async function ensureBookingCartMixSetting(client: Queryable = pool, actorUserId?: string | null) {
  await client.query(
    `
      insert into zigo.app_settings ("key", value, description, is_active, created_by, updated_by)
      values ($1, $2, 'Personal Assistant service cart mixing rules', true, $3, $3)
      on conflict ("key") do update
        set description = excluded.description,
            is_active = true,
            is_deleted = false,
            deleted_by = null,
            deleted_at = null,
            updated_at = now()
    `,
    [BOOKING_CART_MIX_SETTING_KEY, JSON.stringify(DEFAULT_BOOKING_CART_MIX), actorUserId ?? null]
  );
}

async function ensureBookingTypeAutomationSetting(client: Queryable = pool, actorUserId?: string | null) {
  await client.query(
    `
      insert into zigo.app_settings ("key", value, description, is_active, created_by, updated_by)
      values ($1, $2, 'Instant automate reach and availability thresholds', true, $3, $3)
      on conflict ("key") do update
        set description = excluded.description,
            is_active = true,
            is_deleted = false,
            deleted_by = null,
            deleted_at = null,
            updated_at = now()
    `,
    [BOOKING_TYPE_AUTOMATION_SETTING_KEY, JSON.stringify(DEFAULT_BOOKING_TYPE_AUTOMATION), actorUserId ?? null]
  );
}

async function ensureBookingLiveSyncSetting(client: Queryable = pool, actorUserId?: string | null) {
  await client.query(
    `
      insert into zigo.app_settings ("key", value, description, is_active, created_by, updated_by)
      values ($1, $2, 'Booking live sync controls for Admin Panel realtime updates', true, $3, $3)
      on conflict ("key") do update
        set description = excluded.description,
            is_active = true,
            is_deleted = false,
            deleted_by = null,
            deleted_at = null,
            updated_at = now()
    `,
    [BOOKING_LIVE_SYNC_SETTING_KEY, JSON.stringify(DEFAULT_BOOKING_LIVE_SYNC), actorUserId ?? null]
  );
}

async function ensureBookingEngineSetting(client: Queryable = pool, actorUserId?: string | null) {
  await client.query(
    `
      insert into zigo.app_settings ("key", value, description, is_active, created_by, updated_by)
      values ($1, $2, 'Booking engine SLA, demand, supply, capacity, hurdle, and business model controls', true, $3, $3)
      on conflict ("key") do update
        set description = excluded.description,
            is_active = true,
            is_deleted = false,
            deleted_by = null,
            deleted_at = null,
            updated_at = now()
    `,
    [BOOKING_ENGINE_SETTING_KEY, JSON.stringify(DEFAULT_BOOKING_ENGINE_SETTINGS), actorUserId ?? null]
  );
}

async function ensureOtpProviderSetting(client: Queryable = pool, actorUserId?: string | null) {
  await client.query(
    `
      insert into zigo.app_settings ("key", value, description, is_active, created_by, updated_by)
      values ($1, $2, 'Dynamic OTP SMS API and email SMTP provider settings', true, $3, $3)
      on conflict ("key") do update
        set description = excluded.description,
            is_active = true,
            is_deleted = false,
            deleted_by = null,
            deleted_at = null,
            updated_at = now()
    `,
    [OTP_PROVIDER_SETTING_KEY, JSON.stringify(DEFAULT_OTP_PROVIDER_SETTINGS), actorUserId ?? null]
  );
}

export async function ensureMediaPathSettings(actorUserId?: string | null, client: Queryable = pool) {
  await ensureDefaultSetting(client, MEDIA_PATH_SETTING_KEYS.image, "Base save path for image metadata", actorUserId);
  await ensureDefaultSetting(client, MEDIA_PATH_SETTING_KEYS.document, "Base save path for document metadata", actorUserId);
}

export async function getMediaPaths(client: Queryable = pool) {
  try {
    await ensureMediaPathSettings(null, client);
    const result = await client.query<{
      key: string;
      value: string;
      updatedAt: Date | null;
    }>(
      `
        select "key", value, updated_at as "updatedAt"
        from zigo.app_settings
        where "key" = any($1::text[])
          and coalesce(is_deleted, false) = false
          and is_active = true
      `,
      [[MEDIA_PATH_SETTING_KEYS.image, MEDIA_PATH_SETTING_KEYS.document]]
    );

    const settings = new Map(result.rows.map((row) => [row.key, row]));
    return {
      imageSavePath: settings.get(MEDIA_PATH_SETTING_KEYS.image)?.value ?? DEFAULT_MEDIA_PATHS[MEDIA_PATH_SETTING_KEYS.image],
      documentSavePath:
        settings.get(MEDIA_PATH_SETTING_KEYS.document)?.value ?? DEFAULT_MEDIA_PATHS[MEDIA_PATH_SETTING_KEYS.document],
      updatedAt:
        settings.get(MEDIA_PATH_SETTING_KEYS.image)?.updatedAt ??
        settings.get(MEDIA_PATH_SETTING_KEYS.document)?.updatedAt ??
        null
    };
  } catch (error) {
    if (isUndefinedTableError(error)) {
      return {
        imageSavePath: DEFAULT_MEDIA_PATHS[MEDIA_PATH_SETTING_KEYS.image],
        documentSavePath: DEFAULT_MEDIA_PATHS[MEDIA_PATH_SETTING_KEYS.document],
        updatedAt: null
      };
    }
    throw error;
  }
}

export async function updateMediaPaths(input: {
  imageSavePath: string;
  documentSavePath: string;
  actorUserId: string;
}) {
  const imageSavePath = normalizePath(input.imageSavePath);
  const documentSavePath = normalizePath(input.documentSavePath);
  const client = await pool.connect();

  try {
    await client.query("begin");
    await ensureMediaPathSettings(input.actorUserId, client);
    await client.query(
      `
        update zigo.app_settings
        set value = $2,
            updated_by = $3,
            updated_at = now(),
            is_active = true
        where "key" = $1
      `,
      [MEDIA_PATH_SETTING_KEYS.image, imageSavePath, input.actorUserId]
    );
    await client.query(
      `
        update zigo.app_settings
        set value = $2,
            updated_by = $3,
            updated_at = now(),
            is_active = true
        where "key" = $1
      `,
      [MEDIA_PATH_SETTING_KEYS.document, documentSavePath, input.actorUserId]
    );
    await client.query("commit");
    return await getMediaPaths();
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getBookingCartMixSetting(client: Queryable = pool) {
  try {
    await ensureBookingCartMixSetting(client);
    const result = await client.query<{ value: string; updatedAt: Date | null }>(
      `
        select value, updated_at as "updatedAt"
        from zigo.app_settings
        where "key" = $1
          and coalesce(is_deleted, false) = false
          and is_active = true
        limit 1
      `,
      [BOOKING_CART_MIX_SETTING_KEY]
    );
    const parsed = JSON.parse(result.rows[0]?.value || "{}") as Partial<{
      personalAssistantServiceId: string | null;
      allowedWithMode: "none" | "all" | "selected";
      allowedServiceIds: string[];
    }>;
    return {
      personalAssistantServiceId: parsed.personalAssistantServiceId ?? null,
      allowedWithMode: ["all", "selected"].includes(String(parsed.allowedWithMode)) ? parsed.allowedWithMode : "none",
      allowedServiceIds: Array.isArray(parsed.allowedServiceIds) ? parsed.allowedServiceIds : [],
      updatedAt: result.rows[0]?.updatedAt ?? null
    };
  } catch (error) {
    if (isUndefinedTableError(error)) return { ...DEFAULT_BOOKING_CART_MIX, updatedAt: null };
    throw error;
  }
}

export async function updateBookingCartMixSetting(input: {
  personalAssistantServiceId?: string | null;
  allowedWithMode: "none" | "all" | "selected";
  allowedServiceIds: string[];
  actorUserId: string;
}) {
  const value = {
    personalAssistantServiceId: input.personalAssistantServiceId || null,
    allowedWithMode: input.allowedWithMode,
    allowedServiceIds: input.allowedWithMode === "selected" ? input.allowedServiceIds : []
  };
  await ensureBookingCartMixSetting(pool, input.actorUserId);
  await pool.query(
    `
      update zigo.app_settings
      set value = $2,
          updated_by = $3,
          updated_at = now(),
          is_active = true
      where "key" = $1
    `,
    [BOOKING_CART_MIX_SETTING_KEY, JSON.stringify(value), input.actorUserId]
  );
  return getBookingCartMixSetting();
}

function positiveInt(value: unknown, fallback: number) {
  const numberValue = Math.round(Number(value));
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}

export async function getBookingTypeAutomationSetting(client: Queryable = pool) {
  try {
    await ensureBookingTypeAutomationSetting(client);
    const result = await client.query<{ value: string; updatedAt: Date | null }>(
      `
        select value, updated_at as "updatedAt"
        from zigo.app_settings
        where "key" = $1
          and coalesce(is_deleted, false) = false
          and is_active = true
        limit 1
      `,
      [BOOKING_TYPE_AUTOMATION_SETTING_KEY]
    );
    const parsed = JSON.parse(result.rows[0]?.value || "{}") as Partial<typeof DEFAULT_BOOKING_TYPE_AUTOMATION>;
    return {
      maxReachMinutes: positiveInt(parsed.maxReachMinutes, DEFAULT_BOOKING_TYPE_AUTOMATION.maxReachMinutes),
      freeSoonMinutes: positiveInt(parsed.freeSoonMinutes, DEFAULT_BOOKING_TYPE_AUTOMATION.freeSoonMinutes),
      averageReachMinutes: positiveInt(parsed.averageReachMinutes, DEFAULT_BOOKING_TYPE_AUTOMATION.averageReachMinutes),
      updatedAt: result.rows[0]?.updatedAt ?? null
    };
  } catch (error) {
    if (isUndefinedTableError(error)) return { ...DEFAULT_BOOKING_TYPE_AUTOMATION, updatedAt: null };
    throw error;
  }
}

export async function updateBookingTypeAutomationSetting(input: {
  maxReachMinutes: number;
  freeSoonMinutes: number;
  averageReachMinutes: number;
  actorUserId: string;
}) {
  const value = {
    maxReachMinutes: positiveInt(input.maxReachMinutes, DEFAULT_BOOKING_TYPE_AUTOMATION.maxReachMinutes),
    freeSoonMinutes: positiveInt(input.freeSoonMinutes, DEFAULT_BOOKING_TYPE_AUTOMATION.freeSoonMinutes),
    averageReachMinutes: positiveInt(input.averageReachMinutes, DEFAULT_BOOKING_TYPE_AUTOMATION.averageReachMinutes)
  };
  await ensureBookingTypeAutomationSetting(pool, input.actorUserId);
  await pool.query(
    `
      update zigo.app_settings
      set value = $2,
          updated_by = $3,
          updated_at = now(),
          is_active = true
      where "key" = $1
    `,
    [BOOKING_TYPE_AUTOMATION_SETTING_KEY, JSON.stringify(value), input.actorUserId]
  );
  return getBookingTypeAutomationSetting();
}

function boolValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function nonNegativeInt(value: unknown, fallback: number) {
  const numberValue = Math.round(Number(value));
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback;
}

function boundedInt(value: unknown, fallback: number, min: number, max: number) {
  const numberValue = Math.round(Number(value));
  return Number.isFinite(numberValue) ? Math.max(min, Math.min(max, numberValue)) : fallback;
}

function textChoice<T extends string>(value: unknown, choices: readonly T[], fallback: T) {
  return choices.includes(value as T) ? (value as T) : fallback;
}

function normalizeHurdleConfig(value: unknown, fallback: BookingEngineHurdleSetting) {
  const parsed = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  return {
    enabled: boolValue(parsed.enabled, fallback.enabled),
    action: textChoice(String(parsed.action || fallback.action), ["warn_only", "auto_reassign", "warn_then_reassign", "recalculate_supply", "manual_dispatch"], fallback.action),
    escalationMinutes: nonNegativeInt(parsed.escalationMinutes, fallback.escalationMinutes)
  };
}

function normalizeSharePath(value: unknown, fallback: string) {
  const text = String(value || fallback).trim() || fallback;
  return text.startsWith("/") ? text : `/${text}`;
}

function normalizeCustomerPortalSettings(value: unknown): CustomerPortalSettings {
  const parsed = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const fallback = DEFAULT_BOOKING_ENGINE_SETTINGS.customerPortal;
  return {
    isEnabled: boolValue(parsed.isEnabled, fallback.isEnabled),
    shareUrlPath: normalizeSharePath(parsed.shareUrlPath, fallback.shareUrlPath),
    allowSelfRegistration: boolValue(parsed.allowSelfRegistration, fallback.allowSelfRegistration),
    loginWithMobileOtp: boolValue(parsed.loginWithMobileOtp, fallback.loginWithMobileOtp),
    allowBookService: boolValue(parsed.allowBookService, fallback.allowBookService),
    allowOnlinePayment: boolValue(parsed.allowOnlinePayment, fallback.allowOnlinePayment),
    allowLiveTracking: boolValue(parsed.allowLiveTracking, fallback.allowLiveTracking),
    allowTextUpdates: boolValue(parsed.allowTextUpdates, fallback.allowTextUpdates),
    allowImageUpdates: boolValue(parsed.allowImageUpdates, fallback.allowImageUpdates),
    allowVoiceUpdates: boolValue(parsed.allowVoiceUpdates, fallback.allowVoiceUpdates),
    linkExpiryMinutes: boundedInt(parsed.linkExpiryMinutes, fallback.linkExpiryMinutes, 5, 10080)
  };
}

function normalizeAssistantPortalSettings(value: unknown): AssistantPortalSettings {
  const parsed = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const fallback = DEFAULT_BOOKING_ENGINE_SETTINGS.assistantPortal;
  return {
    isEnabled: boolValue(parsed.isEnabled, fallback.isEnabled),
    shareUrlPath: normalizeSharePath(parsed.shareUrlPath, fallback.shareUrlPath),
    loginWithMobileOtp: boolValue(parsed.loginWithMobileOtp, fallback.loginWithMobileOtp),
    loginWithPassword: boolValue(parsed.loginWithPassword, fallback.loginWithPassword),
    allowGoOnline: boolValue(parsed.allowGoOnline, fallback.allowGoOnline),
    allowTaskExecution: boolValue(parsed.allowTaskExecution, fallback.allowTaskExecution),
    allowTextUpdates: boolValue(parsed.allowTextUpdates, fallback.allowTextUpdates),
    allowImageUpdates: boolValue(parsed.allowImageUpdates, fallback.allowImageUpdates),
    allowVoiceUpdates: boolValue(parsed.allowVoiceUpdates, fallback.allowVoiceUpdates),
    allowDailyReport: boolValue(parsed.allowDailyReport, fallback.allowDailyReport),
    requireClusterVehicleDocuments: boolValue(parsed.requireClusterVehicleDocuments, fallback.requireClusterVehicleDocuments)
  };
}

function normalizeAdminOverrideSettings(value: unknown): AdminOverrideSettings {
  const parsed = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const fallback = DEFAULT_BOOKING_ENGINE_SETTINGS.adminOverride;
  return {
    canBookForCustomer: boolValue(parsed.canBookForCustomer, fallback.canBookForCustomer),
    canAssignForAssistant: boolValue(parsed.canAssignForAssistant, fallback.canAssignForAssistant),
    canRespondForCustomer: boolValue(parsed.canRespondForCustomer, fallback.canRespondForCustomer),
    canRespondForAssistant: boolValue(parsed.canRespondForAssistant, fallback.canRespondForAssistant),
    canForceCompleteTask: boolValue(parsed.canForceCompleteTask, fallback.canForceCompleteTask),
    canSwitchInstantToSchedule: boolValue(parsed.canSwitchInstantToSchedule, fallback.canSwitchInstantToSchedule),
    overrideReasonRequired: boolValue(parsed.overrideReasonRequired, fallback.overrideReasonRequired),
    autoEscalateNoResponseMinutes: boundedInt(parsed.autoEscalateNoResponseMinutes, fallback.autoEscalateNoResponseMinutes, 1, 1440)
  };
}

function normalizeCommunicationSettings(value: unknown): CommunicationSettings {
  const parsed = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const fallback = DEFAULT_BOOKING_ENGINE_SETTINGS.communication;
  return {
    realtimeUpdatesEnabled: boolValue(parsed.realtimeUpdatesEnabled, fallback.realtimeUpdatesEnabled),
    customerNotifyOnAssignment: boolValue(parsed.customerNotifyOnAssignment, fallback.customerNotifyOnAssignment),
    customerNotifyOnDelay: boolValue(parsed.customerNotifyOnDelay, fallback.customerNotifyOnDelay),
    assistantNotifyOnAssignment: boolValue(parsed.assistantNotifyOnAssignment, fallback.assistantNotifyOnAssignment),
    adminNotifyOnNoResponse: boolValue(parsed.adminNotifyOnNoResponse, fallback.adminNotifyOnNoResponse),
    allowCustomerAssistantChat: boolValue(parsed.allowCustomerAssistantChat, fallback.allowCustomerAssistantChat),
    storeTaskMediaInTimeline: boolValue(parsed.storeTaskMediaInTimeline, fallback.storeTaskMediaInTimeline)
  };
}

function normalizeBookingEngineSettings(parsed: Partial<BookingEngineSettings> = {}): BookingEngineSettings {
  const hurdleSource = typeof parsed.hurdles === "object" && parsed.hurdles !== null ? parsed.hurdles as Record<string, unknown> : {};
  return {
    isEnabled: boolValue(parsed.isEnabled, DEFAULT_BOOKING_ENGINE_SETTINGS.isEnabled),
    orchestrationWorkerEnabled: boolValue(parsed.orchestrationWorkerEnabled, DEFAULT_BOOKING_ENGINE_SETTINGS.orchestrationWorkerEnabled),
    orchestrationIntervalSeconds: boundedInt(parsed.orchestrationIntervalSeconds, DEFAULT_BOOKING_ENGINE_SETTINGS.orchestrationIntervalSeconds, 5, 3600),
    batchSize: boundedInt(parsed.batchSize, DEFAULT_BOOKING_ENGINE_SETTINGS.batchSize, 10, 500),
    businessModel: textChoice(String(parsed.businessModel || DEFAULT_BOOKING_ENGINE_SETTINGS.businessModel), ["managed_supply", "marketplace", "hybrid"], DEFAULT_BOOKING_ENGINE_SETTINGS.businessModel),
    riskLookaheadMinutes: boundedInt(parsed.riskLookaheadMinutes, DEFAULT_BOOKING_ENGINE_SETTINGS.riskLookaheadMinutes, 1, 1440),
    slaGraceMinutes: nonNegativeInt(parsed.slaGraceMinutes, DEFAULT_BOOKING_ENGINE_SETTINGS.slaGraceMinutes),
    manualAssignBeforeStartMinutes: nonNegativeInt(parsed.manualAssignBeforeStartMinutes, DEFAULT_BOOKING_ENGINE_SETTINGS.manualAssignBeforeStartMinutes),
    instantAutoMaxWaitMinutes: boundedInt(parsed.instantAutoMaxWaitMinutes, DEFAULT_BOOKING_ENGINE_SETTINGS.instantAutoMaxWaitMinutes, 1, 240),
    defaultWaitWindowMinutes: nonNegativeInt(parsed.defaultWaitWindowMinutes, DEFAULT_BOOKING_ENGINE_SETTINGS.defaultWaitWindowMinutes),
    customerCancelInstantMinutes: boundedInt(parsed.customerCancelInstantMinutes, DEFAULT_BOOKING_ENGINE_SETTINGS.customerCancelInstantMinutes, 1, 240),
    customerCancelScheduleMinutes: boundedInt(parsed.customerCancelScheduleMinutes, DEFAULT_BOOKING_ENGINE_SETTINGS.customerCancelScheduleMinutes, 1, 240),
    capacityHoldMinutes: boundedInt(parsed.capacityHoldMinutes, DEFAULT_BOOKING_ENGINE_SETTINGS.capacityHoldMinutes, 1, 240),
    paymentHoldMinutes: boundedInt(parsed.paymentHoldMinutes, DEFAULT_BOOKING_ENGINE_SETTINGS.paymentHoldMinutes, 1, 240),
    assignmentAcceptanceTimeoutSeconds: boundedInt(parsed.assignmentAcceptanceTimeoutSeconds, DEFAULT_BOOKING_ENGINE_SETTINGS.assignmentAcceptanceTimeoutSeconds, 10, 3600),
    autoReassignEnabled: boolValue(parsed.autoReassignEnabled, DEFAULT_BOOKING_ENGINE_SETTINGS.autoReassignEnabled),
    autoReassignAfterSeconds: boundedInt(parsed.autoReassignAfterSeconds, DEFAULT_BOOKING_ENGINE_SETTINGS.autoReassignAfterSeconds, 10, 3600),
    allowManualInstantWhenNoSupply: boolValue(parsed.allowManualInstantWhenNoSupply, DEFAULT_BOOKING_ENGINE_SETTINGS.allowManualInstantWhenNoSupply),
    releaseCapacityOnPaymentFailure: boolValue(parsed.releaseCapacityOnPaymentFailure, DEFAULT_BOOKING_ENGINE_SETTINGS.releaseCapacityOnPaymentFailure),
    releaseCapacityOnCancel: boolValue(parsed.releaseCapacityOnCancel, DEFAULT_BOOKING_ENGINE_SETTINGS.releaseCapacityOnCancel),
    notifyOnRiskChange: boolValue(parsed.notifyOnRiskChange, DEFAULT_BOOKING_ENGINE_SETTINGS.notifyOnRiskChange),
    customerPortal: normalizeCustomerPortalSettings(parsed.customerPortal),
    assistantPortal: normalizeAssistantPortalSettings(parsed.assistantPortal),
    adminOverride: normalizeAdminOverrideSettings(parsed.adminOverride),
    communication: normalizeCommunicationSettings(parsed.communication),
    hurdles: {
      assistantOffline: normalizeHurdleConfig(hurdleSource.assistantOffline, DEFAULT_BOOKING_ENGINE_SETTINGS.hurdles.assistantOffline as BookingEngineHurdleSetting),
      previousTaskDelay: normalizeHurdleConfig(hurdleSource.previousTaskDelay, DEFAULT_BOOKING_ENGINE_SETTINGS.hurdles.previousTaskDelay as BookingEngineHurdleSetting),
      customerExtension: normalizeHurdleConfig(hurdleSource.customerExtension, DEFAULT_BOOKING_ENGINE_SETTINGS.hurdles.customerExtension as BookingEngineHurdleSetting),
      waitingTimeExtend: normalizeHurdleConfig(hurdleSource.waitingTimeExtend, DEFAULT_BOOKING_ENGINE_SETTINGS.hurdles.waitingTimeExtend as BookingEngineHurdleSetting),
      vehicleIssue: normalizeHurdleConfig(hurdleSource.vehicleIssue, DEFAULT_BOOKING_ENGINE_SETTINGS.hurdles.vehicleIssue as BookingEngineHurdleSetting),
      locationIssue: normalizeHurdleConfig(hurdleSource.locationIssue, DEFAULT_BOOKING_ENGINE_SETTINGS.hurdles.locationIssue as BookingEngineHurdleSetting)
    }
  };
}

export async function getBookingLiveSyncSetting(client: Queryable = pool) {
  try {
    await ensureBookingLiveSyncSetting(client);
    const result = await client.query<{ value: string; updatedAt: Date | null }>(
      `
        select value, updated_at as "updatedAt"
        from zigo.app_settings
        where "key" = $1
          and coalesce(is_deleted, false) = false
          and is_active = true
        limit 1
      `,
      [BOOKING_LIVE_SYNC_SETTING_KEY]
    );
    const parsed = JSON.parse(result.rows[0]?.value || "{}") as Partial<typeof DEFAULT_BOOKING_LIVE_SYNC>;
    const transport = ["sse", "polling", "off"].includes(String(parsed.transport)) ? parsed.transport : DEFAULT_BOOKING_LIVE_SYNC.transport;
    return {
      isEnabled: boolValue(parsed.isEnabled, DEFAULT_BOOKING_LIVE_SYNC.isEnabled),
      transport,
      refreshOnEvent: boolValue(parsed.refreshOnEvent, DEFAULT_BOOKING_LIVE_SYNC.refreshOnEvent),
      playSound: boolValue(parsed.playSound, DEFAULT_BOOKING_LIVE_SYNC.playSound),
      showBell: boolValue(parsed.showBell, DEFAULT_BOOKING_LIVE_SYNC.showBell),
      showToast: boolValue(parsed.showToast, DEFAULT_BOOKING_LIVE_SYNC.showToast),
      fallbackPollingEnabled: boolValue(parsed.fallbackPollingEnabled, DEFAULT_BOOKING_LIVE_SYNC.fallbackPollingEnabled),
      fallbackPollingSeconds: positiveInt(parsed.fallbackPollingSeconds, DEFAULT_BOOKING_LIVE_SYNC.fallbackPollingSeconds),
      reconnectSeconds: positiveInt(parsed.reconnectSeconds, DEFAULT_BOOKING_LIVE_SYNC.reconnectSeconds),
      eventScope: String(parsed.eventScope || DEFAULT_BOOKING_LIVE_SYNC.eventScope),
      updatedAt: result.rows[0]?.updatedAt ?? null
    };
  } catch (error) {
    if (isUndefinedTableError(error)) return { ...DEFAULT_BOOKING_LIVE_SYNC, updatedAt: null };
    throw error;
  }
}

export async function updateBookingLiveSyncSetting(input: {
  isEnabled: boolean;
  transport: "sse" | "polling" | "off";
  refreshOnEvent: boolean;
  playSound: boolean;
  showBell: boolean;
  showToast: boolean;
  fallbackPollingEnabled: boolean;
  fallbackPollingSeconds: number;
  reconnectSeconds: number;
  eventScope?: string;
  actorUserId: string;
}) {
  const value = {
    isEnabled: input.isEnabled,
    transport: input.isEnabled ? input.transport : "off",
    refreshOnEvent: input.refreshOnEvent,
    playSound: input.playSound,
    showBell: input.showBell,
    showToast: input.showToast,
    fallbackPollingEnabled: input.fallbackPollingEnabled,
    fallbackPollingSeconds: positiveInt(input.fallbackPollingSeconds, DEFAULT_BOOKING_LIVE_SYNC.fallbackPollingSeconds),
    reconnectSeconds: positiveInt(input.reconnectSeconds, DEFAULT_BOOKING_LIVE_SYNC.reconnectSeconds),
    eventScope: input.eventScope || DEFAULT_BOOKING_LIVE_SYNC.eventScope
  };
  await ensureBookingLiveSyncSetting(pool, input.actorUserId);
  await pool.query(
    `
      update zigo.app_settings
      set value = $2,
          updated_by = $3,
          updated_at = now(),
          is_active = true
      where "key" = $1
    `,
    [BOOKING_LIVE_SYNC_SETTING_KEY, JSON.stringify(value), input.actorUserId]
  );
  return getBookingLiveSyncSetting();
}

export async function getBookingEngineSetting(client: Queryable = pool) {
  try {
    await ensureBookingEngineSetting(client);
    const result = await client.query<{ value: string; updatedAt: Date | null }>(
      `
        select value, updated_at as "updatedAt"
        from zigo.app_settings
        where "key" = $1
          and coalesce(is_deleted, false) = false
          and is_active = true
        limit 1
      `,
      [BOOKING_ENGINE_SETTING_KEY]
    );
    const parsed = JSON.parse(result.rows[0]?.value || "{}") as Partial<BookingEngineSettings>;
    return {
      ...normalizeBookingEngineSettings(parsed),
      updatedAt: result.rows[0]?.updatedAt ?? null
    };
  } catch (error) {
    if (isUndefinedTableError(error)) return { ...DEFAULT_BOOKING_ENGINE_SETTINGS, updatedAt: null };
    throw error;
  }
}

export async function updateBookingEngineSetting(input: Partial<BookingEngineSettings> & {
  actorUserId: string;
}) {
  const value = normalizeBookingEngineSettings(input);
  await ensureBookingEngineSetting(pool, input.actorUserId);
  await pool.query(
    `
      update zigo.app_settings
      set value = $2,
          updated_by = $3,
          updated_at = now(),
          is_active = true
      where "key" = $1
    `,
    [BOOKING_ENGINE_SETTING_KEY, JSON.stringify(value), input.actorUserId]
  );
  return getBookingEngineSetting();
}

export async function getOtpProviderSettings(client: Queryable = pool) {
  try {
    await ensureOtpProviderSetting(client);
    const result = await client.query<{ value: string; updatedAt: Date | null }>(
      `
        select value, updated_at as "updatedAt"
        from zigo.app_settings
        where "key" = $1
          and coalesce(is_deleted, false) = false
          and is_active = true
        limit 1
      `,
      [OTP_PROVIDER_SETTING_KEY]
    );
    const parsed = JSON.parse(result.rows[0]?.value || "{}");
    return {
      smsProviders: Array.isArray(parsed.smsProviders) ? parsed.smsProviders : DEFAULT_OTP_PROVIDER_SETTINGS.smsProviders,
      emailProviders: Array.isArray(parsed.emailProviders) ? parsed.emailProviders : DEFAULT_OTP_PROVIDER_SETTINGS.emailProviders,
      updatedAt: result.rows[0]?.updatedAt ?? null
    };
  } catch (error) {
    if (isUndefinedTableError(error)) return { ...DEFAULT_OTP_PROVIDER_SETTINGS, updatedAt: null };
    throw error;
  }
}

export async function updateOtpProviderSettings(input: {
  smsProviders: unknown[];
  emailProviders: unknown[];
  actorUserId: string;
}) {
  const value = {
    smsProviders: input.smsProviders,
    emailProviders: input.emailProviders
  };
  await ensureOtpProviderSetting(pool, input.actorUserId);
  await pool.query(
    `
      update zigo.app_settings
      set value = $2,
          updated_by = $3,
          updated_at = now(),
          is_active = true
      where "key" = $1
    `,
    [OTP_PROVIDER_SETTING_KEY, JSON.stringify(value), input.actorUserId]
  );
  return getOtpProviderSettings();
}

export async function getMediaPathValue(key: MediaPathKey, client: Queryable = pool) {
  try {
    const result = await client.query<{ value: string }>(
      `
        select value
        from zigo.app_settings
        where "key" = $1
          and coalesce(is_deleted, false) = false
          and is_active = true
        limit 1
      `,
      [key]
    );
    return result.rows[0]?.value ?? DEFAULT_MEDIA_PATHS[key];
  } catch (error) {
    if (isUndefinedTableError(error)) return DEFAULT_MEDIA_PATHS[key];
    throw error;
  }
}

function safeFileName(fileName: string, fallbackExtension = ".jpg", fallbackBase = "image") {
  const parsed = path.parse(fileName);
  const base = parsed.name.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || fallbackBase;
  const extension = parsed.ext.toLowerCase().replace(/[^a-z0-9.]/g, "") || fallbackExtension;
  return `${base}-${Date.now()}${extension}`;
}

function decodeBase64Data(value: string) {
  const match = value.match(/^data:[^,]*;base64,(.+)$/);
  return Buffer.from(match ? match[1] : value, "base64");
}

function inferDocumentMimeType(originalName: string, mimeType = "") {
  const normalizedMime = mimeType.trim().toLowerCase();
  if (normalizedMime && normalizedMime !== "application/octet-stream") return normalizedMime;
  const extension = path.extname(originalName).toLowerCase();
  const mimeByExtension: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  };
  return mimeByExtension[extension] || normalizedMime;
}

function documentFallbackExtension(mimeType: string) {
  const extensionByMime: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/x-m4a": ".m4a",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx"
  };
  return extensionByMime[mimeType] || ".bin";
}

function publicPathFromSetting(savePath: string, fileName: string) {
  const normalized = savePath.trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\.\./g, "");
  const publicUrlBase = `/${normalized}`.replace(/\/+$/g, "");
  return {
    directory: path.resolve(process.cwd(), "public", normalized),
    publicUrl: `${publicUrlBase}/${fileName}`
  };
}

export async function saveImageUpload(input: {
  originalName: string;
  mimeType: string;
  dataBase64: string;
  actorUserId: string;
}) {
  const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!allowedMimeTypes.has(input.mimeType)) {
    throw new HttpError(400, "Only JPG, PNG, WEBP, and GIF image files are allowed.");
  }

  const buffer = decodeBase64Data(input.dataBase64);
  if (!buffer.length) throw new HttpError(400, "Image file content is required.");
  if (buffer.length > 2 * 1024 * 1024) throw new HttpError(400, "Image file must be 2 MB or smaller.");

  const savePath = await getMediaPathValue(MEDIA_PATH_SETTING_KEYS.image);
  const fileName = safeFileName(input.originalName);
  const target = publicPathFromSetting(savePath, fileName);
  await fs.mkdir(target.directory, { recursive: true });
  await fs.writeFile(path.join(target.directory, fileName), buffer);

  const file = await pool.query(
    `
      insert into zigo.files (storage_provider, bucket, object_key, original_name, mime_type, metadata)
      values ('local_public', $1, $2, $3, $4, jsonb_build_object('preview', true, 'savePath', $1::text, 'uploadedBy', $5::text))
      returning id
    `,
    [savePath, target.publicUrl, input.originalName, input.mimeType, input.actorUserId]
  );

  return {
    fileId: file.rows[0].id,
    imageUrl: target.publicUrl,
    savePath
  };
}

export async function saveDocumentUpload(input: {
  originalName: string;
  mimeType: string;
  dataBase64: string;
  actorUserId: string;
}) {
  const mimeType = inferDocumentMimeType(input.originalName, input.mimeType);
  const allowedMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/webm",
    "audio/ogg",
    "audio/x-m4a",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ]);
  if (!allowedMimeTypes.has(mimeType)) {
    throw new HttpError(400, "Only PDF, image, audio, video, and Office document files are allowed.");
  }

  const buffer = decodeBase64Data(input.dataBase64);
  if (!buffer.length) throw new HttpError(400, "Document file content is required.");
  if (buffer.length > 25 * 1024 * 1024) throw new HttpError(400, "Document file must be 25 MB or smaller.");

  const savePath = await getMediaPathValue(MEDIA_PATH_SETTING_KEYS.document);
  const fallbackExtension = documentFallbackExtension(mimeType);
  const fileName = safeFileName(input.originalName, fallbackExtension, "document");
  const target = publicPathFromSetting(savePath, fileName);
  await fs.mkdir(target.directory, { recursive: true });
  await fs.writeFile(path.join(target.directory, fileName), buffer);

  const file = await pool.query(
    `
      insert into zigo.files (storage_provider, bucket, object_key, original_name, mime_type, metadata)
      values ('local_public', $1, $2, $3, $4, jsonb_build_object('preview', true, 'savePath', $1::text, 'uploadedBy', $5::text))
      returning id
    `,
    [savePath, target.publicUrl, input.originalName, mimeType, input.actorUserId]
  );

  return {
    fileId: file.rows[0].id,
    previewUrl: target.publicUrl,
    savePath
  };
}
