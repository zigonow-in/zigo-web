const root = document.querySelector("#portalRoot");
const toast = document.querySelector("#portalToast");
const actor = location.pathname.includes("assistant") ? "assistant" : "customer";
const zigoBasePath = (() => {
  const fromMeta = document.querySelector('meta[name="zigo-base-path"]')?.content || "";
  const normalized = String(fromMeta || "").trim().replace(/\/+$/, "");
  if (normalized && normalized !== "/") return normalized.startsWith("/") ? normalized : `/${normalized}`;
  const path = window.location?.pathname || "";
  const match = path.match(/^\/admin(?:\/|$)/);
  return match ? "/admin" : "";
})();

function withBasePath(path = "") {
  let value = String(path || "").trim();
  if (!value) return value;
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return value;
  if (!value.startsWith("/") && /^(?:assets|uploads)\//i.test(value)) value = `/${value}`;
  if (!value.startsWith("/") || !zigoBasePath) return value;
  if (value === zigoBasePath || value.startsWith(`${zigoBasePath}/`)) return value;
  return `${zigoBasePath}${value}`;
}

function assetUrl(path = "") {
  return withBasePath(path);
}

const tokenKey = `zigoPortalToken:${actor}`;
const sessionCacheKey = `zigoPortalSession:${actor}`;
const portalMasterResourcePrefixes = ["/portal/config", "/portal/customer/catalog", "/portal/customer/login-categories"];

function setPortalViewportHeight() {
  document.documentElement.style.setProperty("--portal-vh", `${window.innerHeight * 0.01}px`);
}

setPortalViewportHeight();
window.addEventListener("resize", setPortalViewportHeight);
window.addEventListener("orientationchange", () => setTimeout(setPortalViewportHeight, 220));
document.documentElement.dataset.portalActor = actor;
document.body.classList.add(`portal-${actor}`);
root.classList.add("zigo-native-root");

function readJsonStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // best effort only
  }
}

function parseNativeLocationPayload(payload) {
  const data = typeof payload === "string" ? (() => {
    try { return JSON.parse(payload); } catch (error) { return null; }
  })() : payload;
  if (!data || typeof data !== "object") return null;
  const source = data.coords && typeof data.coords === "object" ? data.coords : data;
  const latitude = Number(source.latitude ?? source.lat);
  const longitude = Number(source.longitude ?? source.lng ?? source.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function deliverNativeLocationResult(payload, isError = false) {
  const data = typeof payload === "string" ? (() => {
    try { return JSON.parse(payload); } catch (error) { return { message: payload }; }
  })() : (payload || {});
  const requestId = String(data.requestId || data.id || "");
  const entry = requestId ? nativeLocationRequests.get(requestId) : Array.from(nativeLocationRequests.values()).at(-1);
  if (!entry) return;
  clearTimeout(entry.timer);
  nativeLocationRequests.delete(entry.requestId);
  if (isError) {
    entry.reject(new Error(data.message || "Unable to read device location."));
    return;
  }
  const coords = parseNativeLocationPayload(data);
  if (!coords) {
    entry.reject(new Error("Unable to read device location."));
    return;
  }
  entry.resolve(coords);
}

function sendNativeAppMessage(type, payload = {}) {
  const message = { type, source: "zigo-portal", actor, ...payload };
  const json = JSON.stringify(message);
  let sent = false;
  const bridges = [window.ZigoAndroid, window.Android, window.ZigoNative].filter(Boolean);
  bridges.forEach((bridge) => {
    try {
      const method =
        type === "zigo.location.getCurrent"
          ? (bridge.getCurrentLocation || bridge.requestCurrentLocation || bridge.requestLocationPermission || bridge.getLocation || bridge.postMessage)
          : (bridge.openLocationSettings || bridge.requestLocationPermission || bridge.postMessage);
      if (typeof method === "function") {
        const result = method.call(bridge, json);
        const coords = parseNativeLocationPayload(result);
        if (coords && payload.requestId) deliverNativeLocationResult({ requestId: payload.requestId, ...coords });
        sent = true;
      }
    } catch (error) {
      // Try the next bridge.
    }
  });
  try {
    if (window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(json);
      sent = true;
    }
  } catch (error) {
    // optional bridge
  }
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(message, "*");
      sent = true;
    }
  } catch (error) {
    // optional iframe shell
  }
  return sent;
}

function hasDirectNativeLocationBridge() {
  return Boolean(
    window.ZigoAndroid?.getCurrentLocation
    || window.ZigoAndroid?.requestCurrentLocation
    || window.ZigoAndroid?.requestLocationPermission
    || window.ZigoAndroid?.postMessage
    || window.Android?.getCurrentLocation
    || window.Android?.requestCurrentLocation
    || window.Android?.requestLocationPermission
    || window.Android?.postMessage
    || window.ZigoNative?.getCurrentLocation
    || window.ZigoNative?.requestCurrentLocation
    || window.ZigoNative?.requestLocationPermission
    || window.ZigoNative?.postMessage
    || window.ReactNativeWebView?.postMessage
  );
}

function requestNativeCurrentLocation() {
  const requestId = `loc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      nativeLocationRequests.delete(requestId);
      reject(new Error("Device location did not respond."));
    }, 12000);
    nativeLocationRequests.set(requestId, { requestId, resolve, reject, timer });
    const sent = sendNativeAppMessage("zigo.location.getCurrent", { requestId });
    if (!sent) {
      clearTimeout(timer);
      nativeLocationRequests.delete(requestId);
      reject(new Error("Native location bridge is not available."));
    }
  });
}

function requestNativeLocationSettings(reason = "") {
  return sendNativeAppMessage("zigo.location.openSettings", { reason });
}

window.zigoNativeLocationResult = (payload) => deliverNativeLocationResult(payload, false);
window.zigoNativeLocationError = (payload) => deliverNativeLocationResult(payload, true);
window.onZigoLocationResult = window.zigoNativeLocationResult;
window.onZigoLocationError = window.zigoNativeLocationError;
window.addEventListener("message", (event) => {
  const data = typeof event.data === "string" ? (() => {
    try { return JSON.parse(event.data); } catch (error) { return null; }
  })() : event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "zigo.location.result") deliverNativeLocationResult(data, false);
  if (data.type === "zigo.location.error") deliverNativeLocationResult(data, true);
});

function portalResourceCacheAllowed(cacheKey = "") {
  const key = String(cacheKey || "");
  return portalMasterResourcePrefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}?`));
}

function jwtPayload(token) {
  try {
    const payload = String(token || "").split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch (error) {
    return null;
  }
}

function tokenIsExpired(token, skewSeconds = 30) {
  if (!token) return true;
  const payload = jwtPayload(token);
  if (!payload?.exp) return false;
  return Number(payload.exp) * 1000 <= Date.now() + skewSeconds * 1000;
}

const storedToken = localStorage.getItem(tokenKey) || "";
const resourceCacheKey = `zigoPortalResourceCache:${actor}`;
const portalBuildVersion = "connection-lost-png-v1-20260713";
const portalBuildVersionKey = `zigoPortalBuildVersion:${actor}`;
const portalBuildVersionChanged = localStorage.getItem(portalBuildVersionKey) !== portalBuildVersion;
if (portalBuildVersionChanged) {
  localStorage.removeItem(sessionCacheKey);
  localStorage.removeItem(resourceCacheKey);
  localStorage.setItem(portalBuildVersionKey, portalBuildVersion);
}
const cachedSession = portalBuildVersionChanged ? {} : (readJsonStorage(sessionCacheKey, {}) || {});
const cachedResourceStore = portalBuildVersionChanged ? {} : (readJsonStorage(resourceCacheKey, {}) || {});
const portalResourceCache = new Map(Object.entries(cachedResourceStore).filter(([key]) => portalResourceCacheAllowed(key)));
const portalResourceInflight = new Map();
const nativeLocationRequests = new Map();
localStorage.removeItem("zigoPortalFavorites:customer");
localStorage.removeItem("zigoPortalFavorites:assistant");
localStorage.removeItem("zigoAssistantPortalRealtimeLastEventId");
localStorage.removeItem("zigoCustomerPortalRealtimeLastEventId");
if (storedToken && tokenIsExpired(storedToken)) {
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(sessionCacheKey);
  localStorage.removeItem(resourceCacheKey);
}

function normalizeFavorites(input = {}) {
  return {
    services: Array.isArray(input.services) ? input.services.map(String) : [],
    categories: Array.isArray(input.categories) ? input.categories.map(String) : [],
    stores: Array.isArray(input.stores) ? input.stores.map(String) : []
  };
}

const state = {
  token: storedToken && !tokenIsExpired(storedToken) ? storedToken : "",
  user: null,
  bookings: [],
  tasks: [],
  assistantTaskTabIndex: {
    byTab: { accepted: [], working: [], success: [], rejected: [], cancelled: [], hold: [] },
    counts: { accepted: 0, working: 0, success: 0, rejected: 0, cancelled: 0, hold: 0 },
    total: 0
  },
  splashDone: false,
  sessionRestoring: false,
  connectionLost: !navigator.onLine,
  loginPhone: "",
  codeSent: false,
  loginBusy: false,
  otpResendAvailableAt: 0,
  loginCategories: normalizeArray(cachedSession.loginCategories),
  logoutConfirmOpen: false,
  assistantLoginMode: "code",
  assistantResetOpen: false,
  assistantResetCodeSent: false,
  assistantResetEmail: "",
  assistantResetIdentifier: "",
  assistantTaskTab: "accepted",
  assistantTaskConfirm: null,
  assistantChatTaskId: "",
  assistantChatAction: "",
  customerView: "home",
  customerBookingsTab: "all",
  customerBookingsPage: 1,
  customerBookingsPageSize: 10,
  customerBookingsTotalRecords: 0,
  customerBookingsHasMore: true,
  customerBookingsLoading: false,
  customerBookingsReturnScroll: null,
  customerSearchQuery: "",
  customerCatalogTab: "categories",
  customerHomeCategorySheetOpen: false,
  customerHomeCategorySheetId: "",
  customerHomeCategorySheetExpanded: false,
  customerHomeDurationSheetOpen: false,
  customerHomeDurationSheetCategoryId: "",
  selectedHomeDurationId: "",
  customerHomeScheduleSheetOpen: false,
  customerHomeScheduleSheetCategoryId: "",
  selectedHomeScheduleDate: "",
  selectedHomeScheduleDurationId: "",
  selectedHomeSchedulePeriod: "",
  selectedHomeScheduleTime: "",
  favoriteTab: "services",
  favorites: normalizeFavorites({}),
  catalog: normalizeCustomerCatalog(storedToken && !tokenIsExpired(storedToken) && cachedSession.catalog ? cachedSession.catalog : { clusters: [], services: [], categories: [], stores: [] }),
  personalAssistantCatalog: normalizeCustomerCatalog(storedToken && !tokenIsExpired(storedToken) && cachedSession.personalAssistantCatalog ? cachedSession.personalAssistantCatalog : { clusters: [], services: [], categories: [], stores: [] }),
  personalAssistantCatalogClusterId: storedToken && !tokenIsExpired(storedToken) && cachedSession.personalAssistantCatalogClusterId ? cachedSession.personalAssistantCatalogClusterId : "",
  customerAddresses: [],
  customerSavedLocationsPage: 1,
  customerSavedLocationsPageSize: 10,
  customerSavedLocationDeleteId: "",
  customerSavedLocationDeleting: false,
  customerReturnTargets: {},
  customerId: "",
  customerRecentLocations: [],
  customerLocationPickerSheetOpen: false,
  customerLocationPickerClosing: false,
  customerLocationPickerPurpose: "",
  customerLocationPermissionPopupOpen: false,
  customerLocationPermissionGranted: false,
  customerLocationPermissionRequesting: false,
  currentDeviceLocation: null,
  selectedLocation: null,
  locationPicked: null,
  locationStep: "permission",
  locationServiceability: null,
  locationResults: [],
  locationSearchQuery: "",
  locationBusy: false,
  locationMessage: "",
  locationSaveAsLabel: "",
  locationSaveAsOtherOpen: false,
  locationSaveAsCustomLabel: "",
  locationSaveAsDefault: false,
  locationSaveAsMessage: "",
  locationConfirmReturnStep: "manual",
  selectedServiceId: "",
  selectedCategoryId: "",
  customerCategorySheetOpen: false,
  customerStoreDetailId: "",
  cart: [],
  cartUploads: [],
  customerRoutePrimaryStop: null,
  customerRoutePrimaryCleared: false,
  customerLocationStops: [],
  customerCartRouteEditIndex: -1,
  customerCartRouteDeleteIndex: -1,
  customerCartRouteExpanded: false,
  customerCartLocationQuery: "",
  customerCartLocationResults: [],
  customerCartLocationBusy: false,
  customerCartLocationMessage: "",
  customerCartNotice: null,
  customerCartReplace: null,
  customerCartDeleteIndex: -1,
  customerCartNote: "",
  customerCartVoiceOpen: false,
  customerCartVoiceListening: false,
  customerCartVoiceTranscript: "",
  customerCartVoiceStatus: "",
  portalConfig: storedToken && !tokenIsExpired(storedToken) && cachedSession.portalConfig ? cachedSession.portalConfig : null,
  cartUploadPreviewIndex: -1,
  cartUploadDeleteIndex: -1,
  customerTrackPreviewFile: null,
  customerTrackMapSheet: null,
  customerTrackChatExpanded: false,
  customerTrackBillExpanded: false,
  customerTrackMediaExpanded: false,
  customerTrackLocationsExpanded: false,
  customerPaymentProofRequest: null,
  customerTrackRatingThanks: null,
  customerTrackTipAmount: 0,
  customerTrackTipCustom: "",
  customerTrackTipCustomOpen: false,
  customerTrackTipFuture: false,
  portalQuickReplies: {},
  customerCancelBookingId: "",
  customerDisputeBookingId: "",
  bookingType: "instant",
  selectedScheduleDate: "",
  selectedScheduleTime: "",
  selectedSchedulePeriod: "",
  customerScheduleSheetOpen: false,
  customerAvailabilityDecision: null,
  customerAvailabilityDecisionContext: null,
  customerAvailabilityLoading: false,
  customerAvailabilityError: "",
  selectedPayment: "cash",
  customerPaymentSheetOpen: false,
  customerPaymentBusy: false,
  customerRazorpayPayment: null,
  customerPaymentResult: null,
  customerPaymentResultReturnView: "cart",
  customerBookingReference: "",
  confirmedBooking: null
};

window.addEventListener("offline", () => {
  state.connectionLost = true;
  renderConnectionLostPage();
});
window.addEventListener("online", () => {
  void restoreAfterConnection();
});

const taskUpdateAttachmentPreviews = new Map();
let taskUpdateAttachmentPreviewSeq = 0;

let assistantRealtimeSource = null;
let assistantRealtimeRefreshTimer = null;
let assistantRealtimeRefreshBusy = false;
let assistantRealtimeLastEventId = "";
let customerRealtimeSource = null;
let customerRealtimeRefreshTimer = null;
let customerRealtimeRefreshBusy = false;
let customerRealtimeLastEventId = "";
let customerTrackSuppressOwnRealtimeUntil = 0;
let customerTrackSuppressOwnRealtimeBookingId = "";
let customerTrackScrollSettledTimer = null;
let customerTrackScrollActiveUntil = 0;
let customerTrackPendingRealtimeUpdate = false;
const portalBookingExpirySyncInFlight = new Set();
let customerPersonalAssistantCatalogBusy = false;
let customerPersonalAssistantCatalogTriedCluster = "";
let locationSearchTimer = null;
let locationSearchRequestId = 0;
let customerCartLocationSearchTimer = null;
let customerCartLocationSearchRequestId = 0;
let customerAvailabilityRequestId = 0;
let customerBookingsScrollTarget = null;
let customerBookingsScrollHandler = null;
let customerMapDrag = null;
let customerLocationSimpleMap = null;
let customerLocationMapPointers = new Map();
let customerLocationMapPinch = null;
let customerLocationMapSyncTimer = null;
let customerLocationLastMapSyncKey = "";
let customerOlaMapsScriptPromise = null;
let customerOlaLocationMap = null;
let customerOlaLocationMapResolved = null;
let customerSearchPlaceholderTimer = null;
let customerHomeCategoryImageSliderTimer = null;
let customerCartNoticeTimer = null;
let customerOtpResendTimer = null;
let customerCartRouteDrag = null;
let customerCartRouteSuppressClickUntil = 0;
let customerLocationPickerSuppressUntil = 0;
let customerCartStopPickerClosedAfterPick = false;
let customerBookingConfirmedTimer = null;
let customerPaymentResultTimer = null;
let assistantCountdownRefreshQueued = false;
let customerHomeCategorySheetDrag = null;
let assistantOverdueRefreshQueued = false;
const customerCatalogCacheMaxAgeMs = 60 * 1000;
const customerCatalogCacheVersion = "category_expand_title_visible_v1";
const customerSearchPlaceholders = ["personal assistant", "waiting queue", "health care", "errands"];
const zigoPaymentUpiId = "8899339136@hdfc";
const zigoPaymentPayeeName = "ZIGO";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));

function customerOtpResendRemainingMs() {
  return Math.max(0, Number(state.otpResendAvailableAt || 0) - Date.now());
}

function formatCountdownSeconds(totalSeconds = 0) {
  const safe = Math.max(0, Math.ceil(Number(totalSeconds || 0)));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function stopCustomerOtpResendTimer() {
  if (customerOtpResendTimer) clearInterval(customerOtpResendTimer);
  customerOtpResendTimer = null;
}

function syncCustomerOtpResendTimer() {
  stopCustomerOtpResendTimer();
  const button = root.querySelector("[data-otp-resend-button]");
  if (!button) return;
  const update = () => {
    const remainingMs = customerOtpResendRemainingMs();
    const isWaiting = remainingMs > 0;
    button.disabled = Boolean(state.loginBusy || isWaiting);
    button.textContent = isWaiting
      ? `Resend OTP in ${formatCountdownSeconds(remainingMs / 1000)}`
      : "Resend OTP";
    button.classList.toggle("is-counting", isWaiting);
    if (!isWaiting) stopCustomerOtpResendTimer();
  };
  update();
  if (customerOtpResendRemainingMs() > 0) customerOtpResendTimer = setInterval(update, 1000);
}

function syncCustomerOtpVerifyButton() {
  const input = root.querySelector("#customerLoginForm input[name='code']");
  const verifyButton = root.querySelector("[data-otp-verify-button]");
  if (!input || !verifyButton) return;
  const nextValue = String(input.value || "").replace(/\D/g, "").slice(0, 6);
  if (input.value !== nextValue) input.value = nextValue;
  verifyButton.disabled = Boolean(state.loginBusy || nextValue.length !== 6);
}

function syncCustomerLoginPhoneButton() {
  const input = root.querySelector("#customerLoginForm input[name='phone']");
  const proceedButton = root.querySelector("[data-login-phone-proceed]");
  if (!input || !proceedButton) return;
  const nextValue = String(input.value || "").replace(/\D/g, "").slice(-10);
  if (input.value !== nextValue) input.value = nextValue;
  state.loginPhone = nextValue;
  proceedButton.disabled = Boolean(state.loginBusy || nextValue.length !== 10);
}

function notify(message, _tone = "info", options = {}) {
  const shouldShow = options === true || options?.show === true;
  if (!shouldShow) {
    toast.textContent = "";
    toast.classList.add("hidden");
    return;
  }
  toast.textContent = message || "";
  toast.classList.toggle("hidden", !message);
  if (message) setTimeout(() => toast.classList.add("hidden"), 3500);
}

function persistPortalResourceCache() {
  try {
    localStorage.setItem(resourceCacheKey, JSON.stringify(Object.fromEntries([...portalResourceCache.entries()].filter(([key]) => portalResourceCacheAllowed(key)))));
  } catch (error) {
    // best effort cache only
  }
}

function clearPortalResourceCache(prefix = "") {
  if (!prefix) {
    portalResourceCache.clear();
    portalResourceInflight.clear();
    localStorage.removeItem(resourceCacheKey);
    return;
  }
  const normalizedPrefix = String(prefix);
  [...portalResourceCache.keys()].forEach((key) => {
    if (String(key).startsWith(normalizedPrefix)) portalResourceCache.delete(key);
  });
  [...portalResourceInflight.keys()].forEach((key) => {
    if (String(key).startsWith(normalizedPrefix)) portalResourceInflight.delete(key);
  });
  persistPortalResourceCache();
}

function readPortalResourceCache(cacheKey) {
  if (!portalResourceCacheAllowed(cacheKey)) return null;
  return portalResourceCache.get(cacheKey) || null;
}

function writePortalResourceCache(cacheKey, data) {
  if (!portalResourceCacheAllowed(cacheKey)) return;
  portalResourceCache.set(cacheKey, { data, cachedAt: new Date().toISOString() });
  persistPortalResourceCache();
}

function portalResourceCacheIsFresh(cacheKey, maxAgeMs = 0) {
  const cached = readPortalResourceCache(cacheKey);
  if (!cached || !Object.prototype.hasOwnProperty.call(cached, "data")) return false;
  if (!maxAgeMs) return true;
  const cachedAt = Date.parse(cached.cachedAt || "");
  return Number.isFinite(cachedAt) && Date.now() - cachedAt <= maxAgeMs;
}

function portalCachedGet(path, { cacheKey = path, forceRefresh = false, maxAgeMs = 0 } = {}) {
  const key = String(cacheKey || path || "");
  const cacheable = portalResourceCacheAllowed(key);
  if (!cacheable) {
    if (portalResourceInflight.has(key)) return portalResourceInflight.get(key);
    const request = api(path).finally(() => {
      portalResourceInflight.delete(key);
    });
    portalResourceInflight.set(key, request);
    return request;
  }
  if (!forceRefresh) {
    const cached = readPortalResourceCache(key);
    if (cached && Object.prototype.hasOwnProperty.call(cached, "data") && portalResourceCacheIsFresh(key, maxAgeMs)) {
      return Promise.resolve(cached.data);
    }
    if (cached && maxAgeMs) {
      portalResourceCache.delete(key);
      persistPortalResourceCache();
    }
    if (portalResourceInflight.has(key)) return portalResourceInflight.get(key);
  } else if (portalResourceInflight.has(key)) {
    return portalResourceInflight.get(key);
  }
  const request = api(path)
    .then((payload) => {
      writePortalResourceCache(key, payload);
      return payload;
    })
    .finally(() => {
      portalResourceInflight.delete(key);
    });
  portalResourceInflight.set(key, request);
  return request;
}

async function api(path, options = {}) {
  if (state.token && tokenIsExpired(state.token)) {
    clearPortalSession();
    const error = new Error("Session expired. Please login again.");
    error.status = 401;
    throw error;
  }
  let response;
  try {
    response = await fetch(withBasePath(path), {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch (error) {
    state.connectionLost = true;
    setTimeout(renderConnectionLostPage, 0);
    const networkError = new Error("Connection lost.");
    networkError.status = 0;
    throw networkError;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || payload.message || "Request failed.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

let razorpayCheckoutScriptPromise = null;

function loadRazorpayCheckoutScript() {
  if (window.Razorpay) return Promise.resolve();
  if (razorpayCheckoutScriptPromise) return razorpayCheckoutScriptPromise;
  razorpayCheckoutScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Razorpay checkout."));
    document.head.appendChild(script);
  });
  return razorpayCheckoutScriptPromise;
}

function cleanRazorpayContact(value = "") {
  const digits = String(value || "").replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? digits : "";
}

function cleanRazorpayEmail(value = "") {
  const email = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function customerPaymentBookingContext() {
  const item = normalizeArray(state.cart)[0] || {};
  const bookingType = String(state.bookingType || item.bookingType || "instant").toLowerCase() === "schedule" ? "schedule" : "instant";
  const category = customerHomeCategoryById(item.categoryId || state.selectedCategoryId || "")
    || normalizeArray(activeCatalog().categories).find((entry) => String(entry.id || "") === String(item.categoryId || state.selectedCategoryId || ""))
    || {};
  const service = normalizeArray(customerServices()).find((entry) => String(entry.id || "") === String(item.serviceId || state.selectedServiceId || categoryServiceId(category) || ""))
    || {};
  return {
    bookingReference: state.customerBookingReference || "",
    bookingType,
    serviceCode: service.code || item.serviceCode || "",
    serviceName: service.name || item.serviceName || "",
    categoryCode: category.code || item.categoryCode || "",
    categoryName: category.name || item.categoryName || item.name || ""
  };
}

async function startCustomerRazorpayCheckout() {
  const totals = cartTotals();
  const amountPaise = Math.round(Number(totals.toPay || 0) * 100);
  if (amountPaise < 100) throw new Error("Minimum online payment amount is ₹1.");
  await loadRazorpayCheckoutScript();
  const orderPayload = await api("/portal/customer/payments/razorpay/orders", {
    method: "POST",
    body: JSON.stringify({
      amountPaise,
      currency: "INR",
      ...customerPaymentBookingContext()
    })
  });
  const order = orderPayload.data || {};
  if (order.bookingReference) state.customerBookingReference = order.bookingReference;
  const checkoutAmount = Number(order.amount || amountPaise);
  const checkoutOrderId = order.order_id || order.orderId;
  if (!order.keyId || !checkoutOrderId || !Number(checkoutAmount || 0)) {
    throw new Error("Unable to initialize Razorpay payment order.");
  }
  return new Promise((resolve, reject) => {
    const failCheckout = (error) => {
      const normalized = error instanceof Error ? error : new Error("Razorpay checkout failed.");
      normalized.razorpayOrderId = checkoutOrderId;
      normalized.amountPaise = checkoutAmount;
      normalized.currency = order.currency || "INR";
      reject(normalized);
    };
    if (!window.Razorpay) {
      failCheckout(new Error("Razorpay checkout is not available."));
      return;
    }
    const checkoutOptions = {
      key: order.keyId,
      amount: checkoutAmount,
      currency: order.currency || "INR",
      name: "ZIGO",
      description: "Booking payment",
      order_id: checkoutOrderId,
      prefill: {
        name: String(state.user?.displayName || state.user?.name || "Customer").trim() || "Customer"
      },
      retry: { enabled: false },
      theme: { color: "#075eea" },
      modal: {
        ondismiss: () => failCheckout(new Error("Payment cancelled."))
      },
      handler: async (response) => {
        try {
          const verifyPayload = await api("/portal/customer/payments/razorpay/verify", {
            method: "POST",
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });
          resolve({
            ...(verifyPayload.data || {}),
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            amountPaise: Number(order.amount || amountPaise),
            currency: order.currency || "INR",
            bookingReference: order.bookingReference || state.customerBookingReference || "",
            verifiedAt: new Date().toISOString()
          });
        } catch (error) {
          failCheckout(error);
        }
      }
    };
    const contact = cleanRazorpayContact(state.user?.phone || state.loginPhone || "");
    const email = cleanRazorpayEmail(state.user?.email || state.loginEmail || "");
    if (contact) checkoutOptions.prefill.contact = contact;
    if (email) checkoutOptions.prefill.email = email;
    const checkout = new window.Razorpay(checkoutOptions);
    checkout.on("payment.failed", (response) => {
      const error = response?.error || {};
      failCheckout(new Error(error.description || error.reason || error.code || "Payment failed."));
    });
    try {
      checkout.open();
    } catch (error) {
      failCheckout(error instanceof Error ? error : new Error("Unable to open Razorpay checkout."));
    }
  });
}

function customerPaymentResultStatus(payment = {}) {
  const status = String(payment?.paymentStatus || payment?.providerStatus || payment?.status || "").toLowerCase();
  if (["paid", "captured", "success", "completed"].includes(status)) return "success";
  if (["authorized", "processing", "pending", "created"].includes(status)) return "pending";
  if (["failed", "cancelled", "canceled", "error"].includes(status)) return "failed";
  return payment?.verified ? "success" : "pending";
}

function showCustomerPaymentResult(result = {}, { autoReturn = true } = {}) {
  if (customerPaymentResultTimer) clearTimeout(customerPaymentResultTimer);
  const status = customerPaymentResultStatus(result);
  state.customerPaymentResult = {
    status,
    amountPaise: Number(result.amountPaise || Math.round(Number(cartTotals().toPay || 0) * 100)),
    orderId: result.razorpayOrderId || result.orderId || result.razorpay_order_id || "",
    paymentId: result.razorpayPaymentId || result.paymentId || result.razorpay_payment_id || "",
    message: result.message || result.errorDescription || result.description || ""
  };
  state.customerPaymentResultReturnView = state.customerView === "paymentResult" ? state.customerPaymentResultReturnView : (state.customerView || "cart");
  state.customerPaymentSheetOpen = false;
  state.customerPaymentBusy = false;
  state.customerView = "paymentResult";
  render();
  if (autoReturn && status === "success") {
    customerPaymentResultTimer = setTimeout(() => {
      if (state.customerView !== "paymentResult") return;
      state.customerPaymentResult = null;
      state.customerView = state.customerPaymentResultReturnView || "cart";
      render();
    }, 1400);
  }
}

function closeCustomerPaymentResult(targetView = "") {
  if (customerPaymentResultTimer) clearTimeout(customerPaymentResultTimer);
  state.customerPaymentResult = null;
  state.customerView = targetView || state.customerPaymentResultReturnView || "cart";
  render();
}

function portalQuickReplyKey(bookingId = "") {
  return `${actor}:${bookingId}`;
}

function portalQuickRepliesFor(bookingId = "") {
  return state.portalQuickReplies[portalQuickReplyKey(bookingId)]?.data || [];
}

async function loadPortalQuickReplies(bookingId = "") {
  if (!bookingId || !state.token) return [];
  const key = portalQuickReplyKey(bookingId);
  if (state.portalQuickReplies[key]) return state.portalQuickReplies[key].data || [];
  const payload = await api(`/portal/bookings/${encodeURIComponent(bookingId)}/quick-replies`);
  state.portalQuickReplies[key] = payload || { data: [] };
  return state.portalQuickReplies[key].data || [];
}

function portalQuickReplyChipsHtml(bookingId = "", assignmentId = "") {
  const replies = portalQuickRepliesFor(bookingId);
  if (!replies.length) return "";
  return `<div class="portal-quick-replies">
    ${replies.map((reply) => `<button type="button" data-portal-quick-reply-id="${escapeHtml(reply.id)}" data-booking-id="${escapeHtml(bookingId)}" data-assignment-id="${escapeHtml(assignmentId || "")}">
      ${escapeHtml(reply.title || reply.message || "Reply")}
    </button>`).join("")}
  </div>`;
}

function portalQuickReplyUpdateType(actionType = "") {
  if (actionType === "payment_request") return "payment_request";
  if (actionType === "approval_request") return "approval_request";
  if (actionType === "time_extension_request") return "time_extension_request";
  if (actionType === "location_share") return "location";
  if (["status_update", "delay_update", "cancel", "reject"].includes(actionType)) return "status";
  return "text";
}

function writePortalSessionCache() {
  if (!state.token) return;
  localStorage.setItem(sessionCacheKey, JSON.stringify({
    portalConfig: state.portalConfig,
    catalog: actor === "customer" ? state.catalog : undefined,
    personalAssistantCatalog: actor === "customer" ? state.personalAssistantCatalog : undefined,
    personalAssistantCatalogClusterId: actor === "customer" ? state.personalAssistantCatalogClusterId : undefined,
    selectedLocation: actor === "customer" ? state.selectedLocation : undefined,
    locationPicked: actor === "customer" ? state.locationPicked : undefined,
    customerId: actor === "customer" ? state.customerId : undefined,
    cachedAt: new Date().toISOString()
  }));
}

function clearPortalSession() {
  state.token = "";
  state.user = null;
  state.logoutConfirmOpen = false;
  state.tasks = [];
  state.bookings = [];
  state.cart = [];
  state.favorites = normalizeFavorites({});
  state.customerCartNote = "";
  state.confirmedBooking = null;
  state.cartUploads = [];
  state.customerLocationStops = [];
  state.customerRoutePrimaryStop = null;
  state.customerRoutePrimaryCleared = false;
  state.customerCartRouteEditIndex = -1;
  state.customerCartRouteDeleteIndex = -1;
  state.customerCartRouteExpanded = false;
  state.customerCartLocationQuery = "";
  state.customerCartLocationResults = [];
  state.customerCartLocationBusy = false;
  state.customerCartLocationMessage = "";
  state.portalQuickReplies = {};
  state.customerCancelBookingId = "";
  state.customerCartDeleteIndex = -1;
  state.customerCartVoiceOpen = false;
  state.customerCartVoiceListening = false;
  state.customerCartVoiceTranscript = "";
  state.customerScheduleSheetOpen = false;
  state.portalConfig = null;
  state.assistantTaskTabIndex = {
    byTab: { accepted: [], working: [], success: [], rejected: [], cancelled: [], hold: [] },
    counts: { accepted: 0, working: 0, success: 0, rejected: 0, cancelled: 0, hold: 0 },
    total: 0
  };
  state.customerId = "";
  state.customerRecentLocations = [];
  state.customerLocationPickerSheetOpen = false;
  state.customerAvailabilityDecision = null;
  state.customerAvailabilityLoading = false;
  state.customerAvailabilityError = "";
  state.customerPaymentSheetOpen = false;
  state.customerPaymentBusy = false;
  state.customerRazorpayPayment = null;
  revokeCustomerCartUploadUrls(state.cartUploads);
  state.cartUploads = [];
  state.cartUploadPreviewIndex = -1;
  state.cartUploadDeleteIndex = -1;
  state.customerCartDeleteIndex = -1;
  state.selectedLocation = null;
  state.locationPicked = null;
  state.locationStep = "permission";
  state.locationResults = [];
  state.locationSearchQuery = "";
  state.locationServiceability = null;
  state.customerAddresses = [];
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(sessionCacheKey);
  clearPortalResourceCache();
  stopAssistantRealtime();
  stopCustomerRealtime();
}

function portalLogoutConfirmHtml() {
  if (!state.logoutConfirmOpen) return "";
  return `<div class="portal-logout-confirm" role="dialog" aria-modal="true" aria-label="Confirm logout">
    <div class="portal-logout-backdrop" data-cancel-logout></div>
    <section class="portal-logout-sheet">
      <h2>Logout?</h2>
      <p>Are you sure you want to logout?</p>
      <div>
        <button class="portal-logout-cancel" data-cancel-logout type="button">Cancel</button>
        <button class="portal-logout-action" data-confirm-logout type="button">Logout</button>
      </div>
    </section>
  </div>`;
}

function executePortalLogout() {
  clearPortalSession();
  state.codeSent = false;
  state.loginPhone = "";
  state.otpResendAvailableAt = 0;
  stopCustomerOtpResendTimer();
  state.assistantResetOpen = false;
  state.assistantResetCodeSent = false;
  state.assistantResetEmail = "";
  state.assistantResetIdentifier = "";
  revokeCustomerCartUploadUrls(state.cartUploads);
  state.cart = [];
  state.cartUploads = [];
  state.cartUploadPreviewIndex = -1;
  state.cartUploadDeleteIndex = -1;
  invalidateCustomerAvailabilityDecision();
  state.customerLocationStops = [];
  state.customerRoutePrimaryStop = null;
  state.customerRoutePrimaryCleared = false;
  state.customerCartRouteEditIndex = -1;
  state.customerCartRouteDeleteIndex = -1;
  state.customerCartRouteExpanded = false;
  state.customerCartLocationQuery = "";
  state.customerCartLocationResults = [];
  state.customerCartLocationBusy = false;
  state.customerCartLocationMessage = "";
  state.selectedScheduleDate = "";
  state.selectedScheduleTime = "";
  state.selectedSchedulePeriod = "";
  state.customerScheduleSheetOpen = false;
  state.customerPaymentSheetOpen = false;
  state.customerPaymentBusy = false;
  state.customerRazorpayPayment = null;
  state.customerCartReplace = null;
  state.customerCancelBookingId = "";
}

function stopAssistantRealtime() {
  if (assistantRealtimeSource) assistantRealtimeSource.close();
  assistantRealtimeSource = null;
  if (assistantRealtimeRefreshTimer) clearTimeout(assistantRealtimeRefreshTimer);
  assistantRealtimeRefreshTimer = null;
  assistantRealtimeRefreshBusy = false;
}

function stopCustomerRealtime() {
  if (customerRealtimeSource) customerRealtimeSource.close();
  customerRealtimeSource = null;
  if (customerRealtimeRefreshTimer) clearTimeout(customerRealtimeRefreshTimer);
  customerRealtimeRefreshTimer = null;
  customerRealtimeRefreshBusy = false;
}

function scheduleAssistantTaskRefresh(message = null) {
  if (actor !== "assistant" || !state.token) return;
  if (assistantRealtimeRefreshTimer) clearTimeout(assistantRealtimeRefreshTimer);
  assistantRealtimeRefreshTimer = setTimeout(async () => {
    if (assistantRealtimeRefreshBusy) return;
    assistantRealtimeRefreshBusy = true;
    try {
  const tasks = await portalCachedGet("/portal/assistant/tasks", { cacheKey: "/portal/assistant/tasks", forceRefresh: true });
      state.tasks = tasks.data || [];
      rebuildAssistantTaskTabIndex();
      writePortalSessionCache();
      if (state.token) {
        if (!renderAssistantTaskView()) render();
      }
      if (message) notify(message);
    } catch (error) {
      if (Number(error.status) === 401) {
        clearPortalSession();
        render();
      } else {
        notify(error.message || "Unable to refresh tasks.");
      }
    } finally {
      assistantRealtimeRefreshBusy = false;
      assistantRealtimeRefreshTimer = null;
    }
  }, 250);
}

function startAssistantRealtime(force = false) {
  if (actor !== "assistant" || !state.token || !window.EventSource) return;
  if (assistantRealtimeSource && !force) return;
  stopAssistantRealtime();
  const params = new URLSearchParams({ access_token: state.token });
  if (assistantRealtimeLastEventId) params.set("lastEventId", assistantRealtimeLastEventId);
  assistantRealtimeSource = new EventSource(withBasePath(`/portal/assistant/events?${params.toString()}`));
  assistantRealtimeSource.addEventListener("assistant_task_changed", (event) => {
    try {
      const payload = JSON.parse(event.data || "{}");
      if (payload.id) {
        assistantRealtimeLastEventId = String(payload.id);
      }
      scheduleAssistantTaskRefresh();
    } catch (error) {
      scheduleAssistantTaskRefresh();
    }
  });
  assistantRealtimeSource.addEventListener("connected", () => {});
  assistantRealtimeSource.onerror = () => {
    // EventSource reconnects automatically. Keep the existing task list visible while it reconnects.
  };
}

function upsertCustomerBookingInState(booking = {}) {
  const bookingId = String(booking.id || booking.bookingId || "").trim();
  if (!bookingId) return null;
  let found = false;
  state.bookings = normalizeArray(state.bookings).map((item) => {
    if (String(item.id || item.bookingId || "") !== bookingId) return item;
    found = true;
    return { ...item, ...booking };
  });
  if (!found) state.bookings = [booking, ...normalizeArray(state.bookings)];
  if (state.confirmedBooking && String(state.confirmedBooking.id || state.confirmedBooking.bookingId || "") === bookingId) {
    state.confirmedBooking = { ...state.confirmedBooking, ...booking };
  }
  writePortalSessionCache();
  return booking;
}

function applyCustomerTrackRealtimePatch(eventPayload = {}, eventType = "") {
  const bookingId = String(eventPayload.bookingId || eventPayload.serviceRequestId || eventPayload.id || "").trim();
  const trackedBookingId = String(state.confirmedBooking?.id || state.confirmedBooking?.bookingId || "").trim();
  if (!bookingId || !trackedBookingId || bookingId !== trackedBookingId) return false;
  const assistant = eventPayload.assistant && typeof eventPayload.assistant === "object" ? eventPayload.assistant : {};
  const isCancelledEvent = String(eventType || eventPayload.eventType || "").toLowerCase() === "booking.cancelled"
    || String(eventPayload.statusCode || eventPayload.status || "").toLowerCase() === "cancelled";
  const isPaidEvent = String(eventPayload.updateType || "").toLowerCase() === "payment_received"
    || String(eventPayload.paymentStatus || "").toLowerCase() === "paid";
  const incomingPaymentStatus = String(eventPayload.paymentStatus || "").toLowerCase();
  const hasPaymentStatus = ["paid", "pending", "due"].includes(incomingPaymentStatus);
  const patch = {
    id: bookingId,
    assignmentId: eventPayload.assignmentId || state.confirmedBooking?.assignmentId || state.confirmedBooking?.acceptedAssignmentId || "",
    assignmentStatus: isCancelledEvent ? "cancelled" : eventPayload.assignmentStatus || "accepted",
    statusCode: isCancelledEvent ? "cancelled" : eventPayload.statusCode || state.confirmedBooking?.statusCode || "accepted",
    customerCancelEligibility: isCancelledEvent ? { canCancel: false, reasonCode: "not_cancellable" } : state.confirmedBooking?.customerCancelEligibility,
    assistantId: eventPayload.assistantId || assistant.id || state.confirmedBooking?.assistantId || "",
    assistantName: assistant.name || assistant.displayName || eventPayload.assistantName || state.confirmedBooking?.assistantName || "",
    assignedAssistantName: assistant.name || assistant.displayName || eventPayload.assistantName || state.confirmedBooking?.assignedAssistantName || "",
    assistantPhone: assistant.phone || eventPayload.assistantPhone || state.confirmedBooking?.assistantPhone || "",
    assignedAssistantPhone: assistant.phone || eventPayload.assistantPhone || state.confirmedBooking?.assignedAssistantPhone || "",
    assistantProfilePictureUrl: assistant.profilePictureUrl || eventPayload.assistantProfilePictureUrl || state.confirmedBooking?.assistantProfilePictureUrl || "",
    assignedAssistantProfilePictureUrl: assistant.profilePictureUrl || eventPayload.assistantProfilePictureUrl || state.confirmedBooking?.assignedAssistantProfilePictureUrl || "",
    paymentStatus: hasPaymentStatus ? incomingPaymentStatus : state.confirmedBooking?.paymentStatus,
    isPaid: isPaidEvent ? true : incomingPaymentStatus === "due" || incomingPaymentStatus === "pending" ? false : state.confirmedBooking?.isPaid,
    metadata: {
      ...(state.confirmedBooking?.metadata || {}),
      paymentStatus: hasPaymentStatus ? incomingPaymentStatus : state.confirmedBooking?.metadata?.paymentStatus,
      isPaid: isPaidEvent ? true : incomingPaymentStatus === "due" || incomingPaymentStatus === "pending" ? false : state.confirmedBooking?.metadata?.isPaid,
      chatLocked: isPaidEvent ? true : incomingPaymentStatus === "due" ? false : state.confirmedBooking?.metadata?.chatLocked,
      chatLockedAt: isPaidEvent ? new Date().toISOString() : incomingPaymentStatus === "due" ? "" : state.confirmedBooking?.metadata?.chatLockedAt,
      autoCancelled: isCancelledEvent ? Boolean(eventPayload.autoCancelled ?? true) : state.confirmedBooking?.metadata?.autoCancelled,
      cancellationReason: isCancelledEvent ? eventPayload.reason || eventPayload.message || state.confirmedBooking?.metadata?.cancellationReason : state.confirmedBooking?.metadata?.cancellationReason,
      cancellationReasonCode: isCancelledEvent ? eventPayload.reasonCode || state.confirmedBooking?.metadata?.cancellationReasonCode : state.confirmedBooking?.metadata?.cancellationReasonCode,
      cancelledAt: isCancelledEvent ? eventPayload.cancelledAt || new Date().toISOString() : state.confirmedBooking?.metadata?.cancelledAt,
      assignmentId: eventPayload.assignmentId || state.confirmedBooking?.metadata?.assignmentId,
      assistant: {
        ...(state.confirmedBooking?.metadata?.assistant || {}),
        id: eventPayload.assistantId || assistant.id || state.confirmedBooking?.metadata?.assistant?.id,
        name: assistant.name || assistant.displayName || eventPayload.assistantName || state.confirmedBooking?.metadata?.assistant?.name,
        displayName: assistant.displayName || assistant.name || eventPayload.assistantName || state.confirmedBooking?.metadata?.assistant?.displayName,
        phone: assistant.phone || eventPayload.assistantPhone || state.confirmedBooking?.metadata?.assistant?.phone,
        profilePictureUrl: assistant.profilePictureUrl || eventPayload.assistantProfilePictureUrl || state.confirmedBooking?.metadata?.assistant?.profilePictureUrl,
        status: assistant.status || eventPayload.assistantStatus || state.confirmedBooking?.metadata?.assistant?.status
      }
    }
  };
  const updated = upsertCustomerBookingInState({ ...(state.confirmedBooking || {}), ...patch });
  if (updated && state.customerView === "track") renderTrackRealtimeUpdate();
  return Boolean(updated);
}

async function loadCustomerTrackedBooking(bookingId = "", { silent = true } = {}) {
  const id = String(bookingId || "").trim();
  if (!id) return null;
  try {
    const payload = await api(`/portal/customer/bookings/${encodeURIComponent(id)}`);
    return upsertCustomerBookingInState(payload.data || payload || {});
  } catch (error) {
    if (Number(error.status) === 401) throw error;
    if (!silent) notify(error.message || "Unable to refresh booking.");
    return null;
  }
}

async function refreshCustomerTrackBookingRealtime(bookingId = "") {
  const id = String(bookingId || state.confirmedBooking?.id || state.confirmedBooking?.bookingId || "").trim();
  if (!id) return null;
  const updated = await loadCustomerTrackedBooking(id, { silent: true });
  if (updated && state.customerView === "track") {
    state.confirmedBooking = updated;
    renderTrackRealtimeUpdate();
  }
  return updated;
}

async function syncPortalBookingStatusNow(bookingId = "", source = "") {
  const id = String(bookingId || state.confirmedBooking?.id || state.confirmedBooking?.bookingId || "").trim();
  if (!id || !state.token) return null;
  const syncKey = `${actor}:${id}`;
  if (portalBookingExpirySyncInFlight.has(syncKey)) return null;
  portalBookingExpirySyncInFlight.add(syncKey);
  try {
    const payload = await api(`/portal/bookings/${encodeURIComponent(id)}/sync`, {
      method: "POST",
      body: JSON.stringify({ source: source || "timer_expired" })
    });
    if (actor === "customer" && state.customerView === "track") {
      await refreshCustomerTrackBookingRealtime(id);
    } else if (actor === "assistant") {
      const tasks = await portalCachedGet("/portal/assistant/tasks", { cacheKey: "/portal/assistant/tasks", forceRefresh: true });
      state.tasks = tasks.data || [];
      rebuildAssistantTaskTabIndex();
      writePortalSessionCache();
      if (!renderAssistantTaskView()) render();
    }
    return payload;
  } catch (error) {
    if (Number(error.status) === 401) {
      clearPortalSession();
      render();
    }
    return null;
  } finally {
    setTimeout(() => portalBookingExpirySyncInFlight.delete(syncKey), 15000);
  }
}

function scheduleCustomerBookingRefresh(message = "Booking updated.", options = {}) {
  if (actor !== "customer" || !state.token) return;
  const eventBookingId = String(options.bookingId || options.id || "").trim();
  const trackedBookingId = String(state.confirmedBooking?.id || state.confirmedBooking?.bookingId || "").trim();
  const shouldRefreshTrackBooking = state.customerView === "track"
    && trackedBookingId
    && (!eventBookingId || eventBookingId === trackedBookingId);
  if (shouldRefreshTrackBooking) {
    if (customerRealtimeRefreshBusy) return;
    customerRealtimeRefreshBusy = true;
    refreshCustomerTrackBookingRealtime(trackedBookingId)
      .catch((error) => {
        if (Number(error.status) === 401) {
          clearPortalSession();
          render();
        }
      })
      .finally(() => {
        customerRealtimeRefreshBusy = false;
      });
    return;
  }
  if (customerRealtimeRefreshTimer) clearTimeout(customerRealtimeRefreshTimer);
  customerRealtimeRefreshTimer = setTimeout(async () => {
    if (customerRealtimeRefreshBusy) return;
    customerRealtimeRefreshBusy = true;
    try {
      clearPortalResourceCache(`/portal/customer/bookings?`);
      await loadCustomerBookings({ reset: true, silent: true, forceRefresh: true });
      if (state.confirmedBooking?.id) {
        state.confirmedBooking = state.bookings.find((booking) => booking.id === state.confirmedBooking.id) || state.confirmedBooking;
      }
      writePortalSessionCache();
      if (state.token && state.customerView !== "bookings" && state.customerView !== "track") render();
      if (message && state.customerView !== "track") notify(message);
    } catch (error) {
      if (Number(error.status) === 401) {
        clearPortalSession();
        render();
      } else {
        notify(error.message || "Unable to refresh bookings.");
      }
    } finally {
      customerRealtimeRefreshBusy = false;
      customerRealtimeRefreshTimer = null;
    }
  }, 250);
}

function customerBookingsBottomLoaderHtml() {
  if (!state.customerBookingsHasMore && !state.customerBookingsLoading) return "";
  if (state.customerBookingsLoading) {
    return `<button class="booking-bottom-loader booking-bottom-loader-button" type="button" disabled data-bookings-load-more><span class="booking-bottom-spinner" aria-hidden="true"></span><b>Loading more bookings...</b></button>`;
  }
  return `<button class="booking-bottom-loader booking-bottom-loader-button booking-bottom-loader-ready" type="button" data-bookings-load-more><span>Load more bookings</span></button>`;
}

function loadCustomerBookings({ reset = false, append = false, silent = false, forceRefresh = false } = {}) {
  if (actor !== "customer" || !state.token) {
    return Promise.resolve({ data: [], pagination: null });
  }
  if (state.customerBookingsLoading) {
    return Promise.resolve({ data: state.bookings || [], pagination: null });
  }
  const nextPage = reset ? 1 : append ? Math.max(1, Number(state.customerBookingsPage || 1) + 1) : Math.max(1, Number(state.customerBookingsPage || 1));
  const pageSize = Math.min(50, Math.max(5, Number(state.customerBookingsPageSize || 10)));
  const query = new URLSearchParams({
    tab: String(state.customerBookingsTab || "all"),
    page: String(nextPage),
    pageSize: String(pageSize)
  });
  const snapshot = state.customerView === "bookings" ? customerScrollSnapshot() : null;
  if (reset) {
    state.customerBookingsPage = 1;
    state.customerBookingsHasMore = true;
    state.customerBookingsTotalRecords = 0;
  }
  const url = `/portal/customer/bookings?${query.toString()}`;
  state.customerBookingsLoading = true;
  return portalCachedGet(url, { cacheKey: url, forceRefresh })
    .then((payload) => {
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      const pagination = payload?.pagination || null;
      state.bookings = append ? [...(state.bookings || []), ...rows] : rows;
      state.customerBookingsPage = pagination?.page || nextPage;
      state.customerBookingsPageSize = pagination?.pageSize || pageSize;
      state.customerBookingsTotalRecords = pagination?.totalRecords || state.bookings.length;
      state.customerBookingsHasMore = Boolean(pagination ? pagination.hasMore : rows.length >= pageSize);
      writePortalSessionCache();
      if (state.customerView === "bookings") {
        syncCustomerBookingsDom({ append, snapshot });
      }
      return { data: rows, pagination };
    })
    .catch((error) => {
      if (Number(error.status) === 401) throw error;
      if (!silent) notify(error.message || "Unable to load bookings.");
      if (reset) {
        state.bookings = [];
        state.customerBookingsHasMore = false;
        state.customerBookingsTotalRecords = 0;
      }
      return { data: [], pagination: null };
    })
    .finally(() => {
      state.customerBookingsLoading = false;
      if (state.customerView === "bookings") {
        syncCustomerBookingsDom({ append, snapshot });
      }
    });
}

function syncCustomerBookingsDom({ append = false, snapshot = null } = {}) {
  const bookingsPage = document.querySelector(".customer-bookings-page");
  if (!bookingsPage) return;
  const bookingList = bookingsPage.querySelector(".booking-list");
  if (!bookingList) return;
  const keepSnapshot = snapshot || (append ? customerScrollSnapshot() : null);
  bookingList.innerHTML = `${bookingRows(state.customerBookingsTab, state.bookings)}${customerBookingsBottomLoaderHtml()}`;
  bookingsPage.querySelectorAll("[data-bookings-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.bookingsTab === state.customerBookingsTab);
  });
  if (keepSnapshot) {
    restoreCustomerScroll(keepSnapshot);
  }
}

function detachCustomerBookingsScrollLoader() {}

function attachCustomerBookingsScrollLoader() {}

function startCustomerRealtime(force = false) {
  if (actor !== "customer" || !state.token || !window.EventSource) return;
  if (customerRealtimeSource && !force) return;
  stopCustomerRealtime();
  const params = new URLSearchParams({ access_token: state.token });
  if (customerRealtimeLastEventId) params.set("lastEventId", customerRealtimeLastEventId);
  customerRealtimeSource = new EventSource(withBasePath(`/portal/customer/events?${params.toString()}`));
  customerRealtimeSource.addEventListener("customer_booking_changed", (event) => {
    try {
      const payload = JSON.parse(event.data || "{}");
      if (payload.id) {
        customerRealtimeLastEventId = String(payload.id);
      }
      const eventPayload = payload.payload || {};
      const isOwnTrackChatUpdate = state.customerView === "track"
        && eventPayload.actor === "customer"
        && Date.now() < customerTrackSuppressOwnRealtimeUntil
        && (!customerTrackSuppressOwnRealtimeBookingId || String(eventPayload.bookingId || "") === customerTrackSuppressOwnRealtimeBookingId);
      if (isOwnTrackChatUpdate) return;
      const eventType = String(payload.type || "");
      const patchedTrack = applyCustomerTrackRealtimePatch(eventPayload, eventType);
      if (patchedTrack && ["booking.assigned", "booking.reassigned", "booking.cancelled"].includes(eventType)) {
        const patchedBookingId = String(eventPayload.bookingId || eventPayload.serviceRequestId || eventPayload.id || "").trim();
        setTimeout(() => {
          void refreshCustomerTrackBookingRealtime(patchedBookingId);
        }, 500);
        return;
      }
      scheduleCustomerBookingRefresh(payload.message || "Booking updated.", { bookingId: eventPayload.bookingId || eventPayload.serviceRequestId || eventPayload.id });
    } catch (error) {
      scheduleCustomerBookingRefresh("Booking updated.");
    }
  });
  customerRealtimeSource.addEventListener("connected", () => {});
  customerRealtimeSource.onerror = () => {
    // EventSource reconnects automatically. Keep current bookings visible while it reconnects.
  };
}

function fallbackCatalog() {
  return {
    isFallback: true,
    clusters: [{ id: "fallback-cluster", name: "Gurgaon Cluster 1" }],
    services: [
      { id: "forgot", name: "Forgot Something", icon: "FS", tone: "tone-yellow", priceType: "task" },
      { id: "buy-bring", name: "Buy & Bring", icon: "BB", tone: "tone-green", priceType: "task" },
      { id: "pickup", name: "Pickup & Delivery", icon: "PD", tone: "tone-blue", priceType: "task" },
      { id: "send-someone", name: "Send Someone", icon: "SS", tone: "tone-peach", priceType: "task" },
      { id: "wait-coordinate", name: "Wait & Coordinate", icon: "WC", tone: "tone-purple", priceType: "time" },
      { id: "personal-assistant", name: "Personal Assistant", icon: "PA", tone: "tone-blue", priceType: "time" }
    ],
    categories: [
      { id: "food", serviceId: "buy-bring", name: "Food", sellingPrice: 49, durationMinutes: 30 },
      { id: "medicine", serviceId: "buy-bring", name: "Medicine", sellingPrice: 69, durationMinutes: 30 },
      { id: "flowers", serviceId: "buy-bring", name: "Gift & Flowers", sellingPrice: 79, durationMinutes: 30 },
      { id: "market", serviceId: "buy-bring", name: "Market Shopping", sellingPrice: 79, durationMinutes: 45 },
      { id: "documents", serviceId: "pickup", name: "Collect Documents", sellingPrice: 99, durationMinutes: 45 },
      { id: "pa-30", serviceId: "personal-assistant", name: "30 mins", sellingPrice: 49, durationMinutes: 30 },
      { id: "pa-60", serviceId: "personal-assistant", name: "1 hr", sellingPrice: 99, durationMinutes: 60 },
      { id: "pa-90", serviceId: "personal-assistant", name: "1.5 hrs", sellingPrice: 149, durationMinutes: 90 },
      { id: "pa-120", serviceId: "personal-assistant", name: "2 hrs", sellingPrice: 199, durationMinutes: 120 }
    ],
    stores: [
      { id: "nearby-food", name: "Buy from Nearby Store", serviceIds: ["buy-bring"], serviceCategoryIds: ["food"], address: "Nearby market", contact: "8899339136" },
      { id: "nearby-medicine", name: "Nearest Pharmacy", serviceIds: ["buy-bring"], serviceCategoryIds: ["medicine"], address: "Nearby pharmacy", contact: "8899339136" },
      { id: "nearby-docs", name: "Document Pickup Point", serviceIds: ["pickup"], serviceCategoryIds: ["documents"], address: "Customer selected store", contact: "8899339136" }
    ]
  };
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function booleanValue(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function customerChipLabel(value = "", fallback = "Z") {
  const raw = String(value || "").trim().toUpperCase();
  const fallbackText = String(fallback || "").trim().toUpperCase();
  const label = (raw || fallbackText).slice(0, 2);
  return label === "QA" ? "" : label;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCustomerCartItems(items = []) {
  return normalizeArray(items).map((item, index) => ({
    ...item,
    id: String(item.id || item.categoryId || item.storeId || `cart-${index}`),
    serviceId: item.serviceId != null ? String(item.serviceId) : null,
    categoryId: item.categoryId != null ? String(item.categoryId) : null,
    storeId: item.storeId != null ? String(item.storeId) : null,
    price: numberValue(item.price ?? item.sellingPrice ?? 0, 0),
    basePrice: numberValue(item.basePrice, 0),
    saveAmount: numberValue(item.saveAmount, 0),
    durationMinutes: numberValue(item.durationMinutes ?? item.cartDurationMinutes, 30)
  }));
}

function syncCustomerCartResourceCache(cartItems = state.cart, customerNote = state.customerCartNote || "") {
  const nextCartItems = normalizeCustomerCartItems(Array.isArray(cartItems) ? cartItems : []);
  const nextNote = String(customerNote || "");
  writePortalResourceCache("/portal/customer/cart", {
    data: {
      cartItems: nextCartItems,
      customerNote: nextNote
    }
  });
  const meCache = readPortalResourceCache("/portal/customer/me");
  if (meCache?.data) {
    const nextMe = {
      ...meCache,
      data: {
        ...meCache.data,
        cartItems: nextCartItems,
        customerNote: nextNote,
        cart: {
          ...(meCache.data.cart || {}),
          cartItems: nextCartItems,
          customerNote: nextNote
        }
      }
    };
    writePortalResourceCache("/portal/customer/me", nextMe);
  }
}

async function saveCustomerCartToServer(cartItems = state.cart, customerNote = state.customerCartNote || "") {
  if (actor !== "customer" || !state.token) return [];
  try {
    const payload = await api("/portal/customer/cart", {
      method: "PUT",
      body: JSON.stringify({ cartItems: Array.isArray(cartItems) ? cartItems : [], customerNote })
    });
    state.cart = normalizeCustomerCartItems(payload.data?.cartItems || payload.data || cartItems || []);
    state.customerCartNote = String(payload.data?.customerNote ?? customerNote ?? "");
    clearPortalResourceCache("/portal/customer/cart");
    clearPortalResourceCache("/portal/customer/me");
    syncCustomerCartResourceCache(state.cart, state.customerCartNote);
    writePortalSessionCache();
    return state.cart;
  } catch (error) {
    if (Number(error.status) === 401) {
      clearPortalSession();
      render();
      return [];
    }
    throw error;
  }
}

async function setCustomerReviewBookingItem(item = {}) {
  revokeCustomerCartUploadUrls(state.cartUploads);
  state.cart = item && Object.keys(item).length ? [item] : [];
  state.customerCartNote = "";
  state.cartUploads = [];
  state.cartUploadPreviewIndex = -1;
  state.cartUploadDeleteIndex = -1;
  state.customerCartDeleteIndex = -1;
  state.customerCartVoiceOpen = false;
  state.customerCartVoiceListening = false;
  state.customerCartVoiceTranscript = "";
  state.customerLocationStops = [];
  state.customerRoutePrimaryStop = null;
  state.customerRoutePrimaryCleared = false;
  state.customerCartRouteEditIndex = -1;
  state.customerCartRouteDeleteIndex = -1;
  state.customerCartRouteExpanded = false;
  state.customerCartLocationQuery = "";
  state.customerCartLocationResults = [];
  state.customerCartLocationBusy = false;
  state.customerCartLocationMessage = "";
  state.customerPaymentSheetOpen = false;
  state.customerBookingReference = "";
  state.customerRazorpayPayment = null;
  await saveCustomerCartToServer(state.cart, "");
  return state.cart;
}

function applyCustomerCartPayload(data = {}, fallbackItems = state.cart, fallbackNote = state.customerCartNote || "") {
  state.cart = normalizeCustomerCartItems(data?.cartItems || data || fallbackItems || []);
  state.customerCartNote = String(data?.customerNote ?? fallbackNote ?? "");
  clearPortalResourceCache("/portal/customer/cart");
  clearPortalResourceCache("/portal/customer/me");
  syncCustomerCartResourceCache(state.cart, state.customerCartNote);
  writePortalSessionCache();
  invalidateCustomerAvailabilityDecision();
  return state.cart;
}

async function addCustomerCartItemToServer(item = {}, options = {}) {
  if (actor !== "customer" || !state.token) return state.cart;
  const payload = await api("/portal/customer/cart/items", {
    method: "POST",
    body: JSON.stringify({
      item,
      customerNote: state.customerCartNote || "",
      replaceCart: Boolean(options.replaceCart)
    })
  });
  return applyCustomerCartPayload(payload.data, state.cart, state.customerCartNote);
}

async function deleteCustomerCartItemFromServer(criteria = {}) {
  if (actor !== "customer" || !state.token) return state.cart;
  const payload = await api("/portal/customer/cart/items", {
    method: "DELETE",
    body: JSON.stringify(criteria)
  });
  return applyCustomerCartPayload(payload.data, state.cart, state.customerCartNote);
}

let customerCartNoteSaveTimer = null;
let customerCartVoiceRecognition = null;
let customerCartVoiceFinalized = false;
let customerCartVoicePointerId = null;
let customerCartVoicePressElement = null;

function customerCartSpeechRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function customerCartSyncNote(nextValue = "") {
  state.customerCartNote = String(nextValue || "");
  writePortalSessionCache();
  if (customerCartNoteSaveTimer) clearTimeout(customerCartNoteSaveTimer);
  customerCartNoteSaveTimer = setTimeout(() => {
    if (actor !== "customer" || !state.token) return;
    saveCustomerCartToServer(state.cart, state.customerCartNote).catch((error) => {
      if (Number(error.status) !== 401) notify(error.message || "Unable to save note.");
    });
  }, 300);
}

function customerCartAppendVoiceText(text = "") {
  const chunk = String(text || "").trim();
  if (!chunk) return;
  const current = String(state.customerCartNote || "").trim();
  const next = current ? `${current}${/[.!?]$/.test(current) ? " " : " "}${chunk}` : chunk;
  customerCartSyncNote(next);
}

function openCustomerCartVoiceSheet() {
  state.customerCartVoiceOpen = true;
  state.customerCartVoiceTranscript = "";
  state.customerCartVoiceStatus = customerCartSpeechRecognitionCtor() ? "Press and hold to speak." : "Voice input is not supported in this browser.";
  customerCartVoicePointerId = null;
  customerCartVoicePressElement = null;
  render();
}

function closeCustomerCartVoiceSheet() {
  stopCustomerCartVoiceRecognition(false);
  state.customerCartVoiceOpen = false;
  state.customerCartVoiceTranscript = "";
  state.customerCartVoiceListening = false;
  state.customerCartVoiceStatus = "";
  customerCartVoiceFinalized = true;
  render();
}

function stopCustomerCartVoiceRecognition(commit = true) {
  customerCartVoiceFinalized = true;
  if (customerCartVoiceRecognition) {
    try {
      customerCartVoiceRecognition.onresult = null;
      customerCartVoiceRecognition.onerror = null;
      customerCartVoiceRecognition.onend = null;
      customerCartVoiceRecognition.stop();
    } catch (error) {
      /* noop */
    }
  }
  customerCartVoiceRecognition = null;
  state.customerCartVoiceListening = false;
  if (customerCartVoicePressElement) {
    try {
      if (typeof customerCartVoicePressElement.releasePointerCapture === "function" && customerCartVoicePointerId !== null) {
        customerCartVoicePressElement.releasePointerCapture(customerCartVoicePointerId);
      }
    } catch (error) {
      /* noop */
    }
  }
  customerCartVoicePressElement = null;
  if (commit && state.customerCartVoiceTranscript) {
    customerCartAppendVoiceText(state.customerCartVoiceTranscript);
  }
  state.customerCartVoiceTranscript = "";
  render();
}

async function startCustomerCartVoiceRecognition() {
  const Recognition = customerCartSpeechRecognitionCtor();
  if (!Recognition) {
    state.customerCartVoiceStatus = "Voice input is not supported in this browser. You can type the note manually.";
    render();
    return;
  }
  if (customerCartVoiceRecognition) return;
  state.customerCartVoiceOpen = true;
  state.customerCartVoiceListening = true;
  state.customerCartVoiceTranscript = "";
  state.customerCartVoiceStatus = "Listening...";
  customerCartVoiceFinalized = false;
  render();
  const recognition = new Recognition();
  customerCartVoiceRecognition = recognition;
  recognition.lang = "en-IN";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  let finalText = "";
  recognition.onresult = (event) => {
    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = String(result[0]?.transcript || "");
      if (result.isFinal) finalText += `${transcript} `;
      else interim += transcript;
    }
    state.customerCartVoiceTranscript = String(`${finalText}${interim}`).trim();
    render();
  };
  recognition.onerror = (event) => {
    const reason = String(event?.error || "speech error").toLowerCase();
    stopCustomerCartVoiceRecognition(false);
    if (reason.includes("not-allowed") || reason.includes("service-not-allowed")) {
      state.customerCartVoiceStatus = "Microphone permission is blocked. Please allow mic access in browser settings.";
    } else if (reason.includes("no-speech")) {
      state.customerCartVoiceStatus = "No speech detected. Try again.";
    } else {
      state.customerCartVoiceStatus = "Unable to read speech. Try again.";
    }
    render();
  };
  recognition.onend = () => {
    if (customerCartVoiceFinalized) {
      customerCartVoiceRecognition = null;
      state.customerCartVoiceListening = false;
      state.customerCartVoiceTranscript = "";
      render();
      return;
    }
    const transcript = String(state.customerCartVoiceTranscript || finalText || "").trim();
    customerCartVoiceFinalized = true;
    customerCartVoiceRecognition = null;
    state.customerCartVoiceListening = false;
    if (transcript) {
      customerCartAppendVoiceText(transcript);
      state.customerCartVoiceStatus = "Captured text ready.";
    } else {
      state.customerCartVoiceStatus = "No speech detected. Try again or type the note manually.";
    }
    state.customerCartVoiceTranscript = "";
    render();
  };
  try {
    recognition.start();
    render();
  } catch (error) {
    customerCartVoiceRecognition = null;
    state.customerCartVoiceListening = false;
    state.customerCartVoiceStatus = error?.message || "Unable to start voice input.";
    render();
  }
}

function customerCartVoicePressStart(event) {
  const button = event.target instanceof Element ? event.target.closest("[data-cart-note-voice-mic]") : null;
  if (!button || button.disabled) return false;
  if (customerCartVoicePointerId !== null && customerCartVoicePointerId !== event.pointerId) return false;
  if (event.button != null && event.button !== 0) return false;
  event.preventDefault?.();
  event.stopPropagation?.();
  customerCartVoicePointerId = event.pointerId ?? "mouse";
  customerCartVoicePressElement = button;
  if (typeof button.setPointerCapture === "function" && event.pointerId !== undefined) {
    try {
      button.setPointerCapture(event.pointerId);
    } catch (error) {
      /* noop */
    }
  }
  startCustomerCartVoiceRecognition();
  return true;
}

function customerCartVoicePressEnd(event, commit = true) {
  const pointerId = event?.pointerId ?? "mouse";
  if (customerCartVoicePointerId !== null && customerCartVoicePointerId !== pointerId) return false;
  customerCartVoicePointerId = null;
  if (customerCartVoicePressElement) {
    try {
      if (typeof customerCartVoicePressElement.releasePointerCapture === "function" && event?.pointerId !== undefined) {
        customerCartVoicePressElement.releasePointerCapture(event.pointerId);
      }
    } catch (error) {
      /* noop */
    }
  }
  customerCartVoicePressElement = null;
  if (customerCartVoiceRecognition || state.customerCartVoiceListening) {
    stopCustomerCartVoiceRecognition(commit);
  }
  return true;
}

window.zigoCustomerCartVoicePressStart = (el, event) => {
  const syntheticEvent = event || window.event;
  const target = el instanceof Element ? el : syntheticEvent?.target;
  if (!target) return false;
  if (syntheticEvent) syntheticEvent.preventDefault?.();
  return customerCartVoicePressStart({
    ...syntheticEvent,
    target,
    pointerId: syntheticEvent?.pointerId ?? "mouse",
    preventDefault: () => syntheticEvent?.preventDefault?.()
  });
};

window.zigoCustomerCartVoicePressEnd = (event, commit = true) => {
  const syntheticEvent = event || window.event;
  return customerCartVoicePressEnd({
    ...syntheticEvent,
    pointerId: syntheticEvent?.pointerId ?? "mouse"
  }, commit);
};

const customerWeekDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function normalizeServiceCategoryGridSize(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  return ["1x1", "2x2", "3x3", "4x4", "5x5"].includes(raw) ? raw : "3x3";
}

function normalizeServiceTextColor(value = "") {
  const raw = String(value || "").trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw) ? raw : "";
}

function normalizeServiceFontSize(value, fallback) {
  return Math.max(8, Math.min(80, Math.round(numberValue(value, fallback))));
}

function normalizeServiceFontWeight(value, fallback) {
  return Math.max(100, Math.min(900, Math.round(numberValue(value, fallback) / 100) * 100));
}

function safeServiceInlineHtml(value = "") {
  return escapeHtml(value || "")
    .replace(/&lt;(\/?)(b|strong|i|em|u)&gt;/gi, "<$1$2>")
    .replace(/&lt;br\s*\/?&gt;/gi, "<br>");
}

function serviceTextHasInlineMarkup(value = "") {
  return /<\/?(b|strong|i|em|u)>|<br\s*\/?>/i.test(String(value || ""));
}

function serviceCategoryGridColumns(service = {}) {
  const gridSize = normalizeServiceCategoryGridSize(service.serviceCategoryGridSize || service.categoryGridSize);
  return Math.max(1, Math.min(5, Number(gridSize.split("x")[0]) || 3));
}

function normalizeServiceMasterBookingType(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  return ["both", "instant", "schedule"].includes(raw) ? raw : "both";
}

function normalizeCustomerCatalog(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const services = normalizeArray(source.services).map((service, index) => {
    const id = String(service.serviceId || service.id || "");
    return {
      ...service,
      id,
      serviceId: String(service.serviceId || id),
      code: service.code || service.serviceCode || "",
      name: service.name || service.serviceName || "Service",
      description: service.description || service.serviceDescription || "",
      imageUrl: service.imageUrl || service.serviceImageUrl || "",
      priceType: service.priceType || service.servicePriceType || "task",
      maxLocationsLimit: numberValue(service.maxLocationsLimit, 1),
      icon: customerChipLabel(service.icon || service.name || service.serviceName || "Service"),
      tone: service.tone || ["tone-yellow", "tone-green", "tone-blue", "tone-peach", "tone-purple"][index % 5],
      clusterIds: normalizeArray(service.clusterIds).length ? normalizeArray(service.clusterIds).map(String) : [service.clusterId].filter(Boolean).map(String),
      isActive: service.isActive !== false,
      isEnabled: service.isEnabled !== false,
      isVisible: service.isVisible !== false,
      bookingTypeConfig: service.bookingTypeConfig || {},
      defaultBookingType: service.defaultBookingType || null
    };
  });
  const serviceMasters = normalizeArray(source.serviceMasters).map((service, index) => ({
    ...service,
    id: String(service.id || service.serviceMasterId || ""),
    serviceMasterId: String(service.id || service.serviceMasterId || ""),
    serviceTitle: service.serviceTitle || service.title || "Service",
    serviceSubtitle: service.serviceSubtitle || service.subtitle || "",
    icons: normalizeArray(service.icons),
    serviceTitleFontSize: normalizeServiceFontSize(service.serviceTitleFontSize, 18),
    serviceTitleFontWeight: normalizeServiceFontWeight(service.serviceTitleFontWeight, 400),
    serviceTitleColor: normalizeServiceTextColor(service.serviceTitleColor),
    serviceSubtitleFontSize: normalizeServiceFontSize(service.serviceSubtitleFontSize, 13),
    serviceSubtitleFontWeight: normalizeServiceFontWeight(service.serviceSubtitleFontWeight, 400),
    serviceSubtitleColor: normalizeServiceTextColor(service.serviceSubtitleColor),
    serviceCategoryGridSize: normalizeServiceCategoryGridSize(service.serviceCategoryGridSize || service.categoryGridSize),
    bookingType: normalizeServiceMasterBookingType(service.bookingType || service.serviceBookingType),
    showEta: Boolean(service.showEta || service.showETA || service.show_eta),
    instantEtaMinutes: numberValue(service.instantEtaMinutes ?? service.instant_eta_minutes ?? service.etaMinutes ?? service.eta_minutes ?? service.metadata?.instantEtaMinutes ?? service.metadata?.etaMinutes, 0),
    servicePosition: numberValue(service.servicePosition ?? service.position, index),
    isActive: service.isActive !== false,
    isEnabled: service.isEnabled !== false,
    isVisible: service.isVisible !== false
  }));
  const categoryExpandTitleValue = (category = {}) => String(
    category.expandTitle
    || category.expand_title
    || category.categoryExpandTitle
    || category.category_expand_title
    || category.config?.categorySettings?.expandTitle
    || category.config?.categorySettings?.expand_title
    || ""
  ).trim();
  const categoryExpandDescriptionValue = (category = {}) => String(
    category.expandDescription
    || category.expand_description
    || category.expandDuration
    || category.expand_duration
    || category.categoryExpandDescription
    || category.category_expand_description
    || category.config?.categorySettings?.expandDescription
    || category.config?.categorySettings?.expand_description
    || category.config?.categorySettings?.expandDuration
    || category.config?.categorySettings?.expand_duration
    || ""
  ).trim();
  const categories = normalizeArray(source.categories).map((category) => {
    const id = String(category.categoryId || category.id || "");
    const serviceName = String(category.serviceName || category.service_name || category.service?.name || "").trim();
    const matchedService = serviceName
      ? services.find((item) => String(item.name || "").trim().toLowerCase() === serviceName.toLowerCase())
      : null;
    const serviceId = String(category.serviceId || category.service_id || category.service?.id || matchedService?.id || "");
    const basePrice = numberValue(category.basePrice ?? category.base_price, 0);
    const sellingPrice = numberValue(category.sellingPrice ?? category.selling_price, basePrice || 0);
    return {
      ...category,
      id,
      categoryId: String(category.categoryId || id),
      serviceId,
      serviceName: serviceName || matchedService?.name || category.serviceName || "",
      parentCategoryId: category.parentCategoryId || category.parent_category_id || "",
      code: category.code || category.categoryCode || "",
      name: String(category.name ?? category.categoryName ?? "").trim(),
      description: category.description || category.categoryDescription || "",
      imageUrl: category.imageUrl || category.categoryImageUrl || "",
      imageUrls: customerCategoryImageUrls(category),
      basePrice,
      additionalCharges: numberValue(category.additionalCharges ?? category.additional_charges, 0),
      discountType: category.discountType || category.discount_type || "none",
      discountValue: numberValue(category.discountValue ?? category.discount_value, 0),
      sellingPrice,
      durationMinutes: numberValue(category.durationMinutes ?? category.duration_minutes ?? category.timeDurationMinutes ?? category.time_duration_minutes, 30),
      locationMode: category.locationMode || category.location_mode || category.config?.categorySettings?.locationMode || "current",
      maxLocationsLimit: numberValue(category.maxLocationsLimit ?? category.max_locations_limit ?? category.config?.categorySettings?.maxLocationsLimit ?? category.config?.categorySettings?.max_locations_limit, 1),
      showInHomePage: category.showInHomePage ?? category.show_in_home_page ?? category.config?.categorySettings?.showInHomePage ?? true,
      homeDisplayMode: category.homeDisplayMode || category.home_display_mode || category.config?.categorySettings?.homeDisplayMode || ((category.showInHomePage ?? category.show_in_home_page ?? category.config?.categorySettings?.showInHomePage) === false ? "categoryPrice" : "category"),
      categoryImageHeight: numberValue(category.categoryImageHeight ?? category.category_image_height ?? category.config?.categorySettings?.categoryImageHeight, 0),
      categoryImageWidth: numberValue(category.categoryImageWidth ?? category.category_image_width ?? category.config?.categorySettings?.categoryImageWidth, 0),
      priceDisplayMode: category.priceDisplayMode || category.price_display_mode || category.config?.categorySettings?.priceDisplayMode || "row",
      priceGridRows: numberValue(category.priceGridRows ?? category.price_grid_rows ?? category.config?.categorySettings?.priceGridRows, 3),
      priceGridColumns: numberValue(category.priceGridColumns ?? category.price_grid_columns ?? category.config?.categorySettings?.priceGridColumns, 3),
      expandPriority: numberValue(category.expandPriority ?? category.expand_priority, 0),
      expandTitle: categoryExpandTitleValue(category),
      expandDuration: categoryExpandDescriptionValue(category),
      expandDescription: categoryExpandDescriptionValue(category),
      ratingAvg: numberValue(category.ratingAvg ?? category.serviceRatingAvg ?? category.averageRating, 0),
      ratingCount: numberValue(category.ratingCount ?? category.serviceRatingCount ?? category.reviewCount, 0),
      clusterIds: normalizeArray(category.clusterIds).length ? normalizeArray(category.clusterIds).map(String) : [category.clusterId].filter(Boolean).map(String),
      storeOperatingHours: normalizeArray(category.storeOperatingHours),
      bookingTypeConfig: category.bookingTypeConfig || {},
      isActive: category.isActive !== false,
      isEnabled: category.isEnabled !== false,
      isVisible: category.isVisible !== false
    };
  });
  const stores = normalizeArray(source.stores).map((store) => ({
    ...store,
    id: String(store.id || ""),
    name: store.name || "Store / Item",
    imageUrl: store.imageUrl || store.primaryImageUrl || "",
    primaryImageUrl: store.primaryImageUrl || store.imageUrl || "",
    images: normalizeArray(store.images),
    operatingHours: store.operatingHours || store.operating_hours || store.workingSchedule || store.weeklySchedule || {},
    serviceIds: normalizeArray(store.serviceIds).map(String),
    serviceCategoryIds: normalizeArray(store.serviceCategoryIds || store.categoryIds).map(String),
    storeCategoryIds: normalizeArray(store.storeCategoryIds).map(String),
    storeKeywordIds: normalizeArray(store.storeKeywordIds).map(String),
    clusterIds: normalizeArray(store.clusterIds).length ? normalizeArray(store.clusterIds).map(String) : [store.clusterId].filter(Boolean).map(String),
    isActive: store.isActive !== false
  }));
  return {
    ...source,
    isFallback: Boolean(source.isFallback),
    clusters: normalizeArray(source.clusters),
    services,
    serviceMasters,
    categories,
    masterCategories: normalizeArray(source.masterCategories).map((category) => ({
      ...category,
      isMasterCategory: true,
      id: String(category.id || category.categoryId || ""),
      serviceMasterId: String(category.serviceMasterId || category.service_master_id || category.config?.categorySettings?.serviceMasterId || ""),
      serviceMasterName: category.serviceMasterName || category.service_master_name || "",
      name: String(category.name ?? category.categoryName ?? "").trim(),
      code: category.code || category.categoryCode || "",
      description: category.description || category.categoryDescription || "",
      imageUrl: category.imageUrl || category.categoryImageUrl || "",
      imageUrls: customerCategoryImageUrls(category),
      note: category.note || "",
      taskListTitle: category.taskListTitle || "Tasks related to category",
      taskList: normalizeArray(category.taskList),
      canDoTitle: category.canDoTitle || "What Assistant can do",
      canDoList: normalizeArray(category.canDoList),
      cantDoTitle: category.cantDoTitle || "What Assistant can't do",
      cantDoList: normalizeArray(category.cantDoList),
      ratingAvg: numberValue(category.ratingAvg ?? category.serviceRatingAvg ?? category.averageRating, 0),
      ratingCount: numberValue(category.ratingCount ?? category.serviceRatingCount ?? category.reviewCount, 0),
      priority: numberValue(category.priority, 0),
      expandPriority: numberValue(category.expandPriority ?? category.expand_priority, 0),
      expandTitle: categoryExpandTitleValue(category),
      expandDuration: categoryExpandDescriptionValue(category),
      expandDescription: categoryExpandDescriptionValue(category),
      sortOrder: numberValue(category.sortOrder ?? category.sort_order, 0),
      isRecommended: Boolean(category.isRecommended ?? category.is_recommended),
      showInHomePage: category.showInHomePage ?? category.show_in_home_page ?? category.config?.categorySettings?.showInHomePage ?? true,
      homeDisplayMode: category.homeDisplayMode || category.home_display_mode || category.config?.categorySettings?.homeDisplayMode || ((category.showInHomePage ?? category.show_in_home_page ?? category.config?.categorySettings?.showInHomePage) === false ? "categoryPrice" : "category"),
      categoryImageHeight: numberValue(category.categoryImageHeight ?? category.category_image_height ?? category.config?.categorySettings?.categoryImageHeight, 0),
      categoryImageWidth: numberValue(category.categoryImageWidth ?? category.category_image_width ?? category.config?.categorySettings?.categoryImageWidth, 0),
      priceDisplayMode: category.priceDisplayMode || category.price_display_mode || category.config?.categorySettings?.priceDisplayMode || "row",
      priceGridRows: numberValue(category.priceGridRows ?? category.price_grid_rows ?? category.config?.categorySettings?.priceGridRows, 3),
      priceGridColumns: numberValue(category.priceGridColumns ?? category.price_grid_columns ?? category.config?.categorySettings?.priceGridColumns, 3),
      isActive: category.isActive !== false,
      isEnabled: category.isEnabled !== false,
      isVisible: category.isVisible !== false
    })),
    stores,
    storeCategories: normalizeArray(source.storeCategories),
    storeKeywords: normalizeArray(source.storeKeywords),
    bookingTypes: normalizeArray(source.bookingTypes),
    priceRules: normalizeArray(source.priceRules),
    categoryPriceRules: normalizeArray(source.categoryPriceRules).map((rule) => ({
      ...rule,
      id: String(rule.id || ""),
      scopeType: String(rule.scopeType || rule.scope_type || "").trim(),
      stateId: rule.stateId != null ? String(rule.stateId) : (rule.state_id != null ? String(rule.state_id) : ""),
      stateName: String(rule.stateName || rule.state_name || "").trim(),
      cityId: rule.cityId != null ? String(rule.cityId) : (rule.city_id != null ? String(rule.city_id) : ""),
      cityName: String(rule.cityName || rule.city_name || "").trim(),
      zoneId: rule.zoneId != null ? String(rule.zoneId) : (rule.zone_id != null ? String(rule.zone_id) : ""),
      zoneName: String(rule.zoneName || rule.zone_name || "").trim(),
      clusterId: rule.clusterId != null ? String(rule.clusterId) : (rule.cluster_id != null ? String(rule.cluster_id) : ""),
      clusterName: String(rule.clusterName || rule.cluster_name || "").trim(),
      categoryId: String(rule.categoryId || rule.category_id || ""),
      serviceId: rule.serviceId != null ? String(rule.serviceId) : (rule.service_id != null ? String(rule.service_id) : ""),
      categoryName: String(rule.categoryName || rule.category_name || "").trim(),
      expandTitle: String(rule.expandTitle || rule.expand_title || "").trim(),
      expandDescription: String(rule.expandDescription || rule.expand_description || rule.expandDuration || rule.expand_duration || "").trim(),
      expandDuration: String(rule.expandDuration || rule.expand_duration || rule.expandDescription || rule.expand_description || "").trim(),
      expandPriority: numberValue(rule.expandPriority ?? rule.expand_priority, 0),
      label: String(rule.label || "").trim(),
      timeDurationMinutes: numberValue(rule.timeDurationMinutes ?? rule.time_duration_minutes ?? rule.durationMinutes ?? rule.duration_minutes, 0),
      basePrice: numberValue(rule.basePrice ?? rule.base_price, 0),
      discountType: rule.discountType || rule.discount_type || "none",
      discountValue: numberValue(rule.discountValue ?? rule.discount_value, 0),
      sellingPrice: numberValue(rule.sellingPrice ?? rule.selling_price, 0),
      waitingChargeAmount: numberValue(rule.waitingChargeAmount ?? rule.waiting_charge_amount, 0),
      waitingChargeTimeMinutes: numberValue(rule.waitingChargeTimeMinutes ?? rule.waiting_charge_time_minutes, 0),
      availableForDuration: booleanValue(rule.availableForDuration ?? rule.available_for_duration ?? rule.metadata?.availableFor?.duration, true),
      availableForExtend: booleanValue(rule.availableForExtend ?? rule.available_for_extend ?? rule.metadata?.availableFor?.extend, false),
      availableForExpand: booleanValue(rule.availableForExpand ?? rule.available_for_expand ?? rule.metadata?.availableFor?.expand, false),
      isEnabled: rule.isEnabled !== false,
      isActive: rule.isActive !== false
    }))
  };
}

function selectedCustomerClusterId() {
  return String(customerLocationCluster(state.selectedLocation || {}).clusterId || "");
}

function customerCatalogUrl(filters = {}) {
  const params = new URLSearchParams();
  const clusterId = filters.clusterId || selectedCustomerClusterId();
  if (clusterId) params.set("clusterId", clusterId);
  if (filters.serviceId) params.set("serviceId", filters.serviceId);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.q) params.set("q", filters.q);
  return `/portal/customer/catalog${params.toString() ? `?${params.toString()}` : ""}`;
}

function customerCatalogCacheKey(url = "") {
  return `${url}${String(url).includes("?") ? "&" : "?"}_catalogVersion=${customerCatalogCacheVersion}`;
}

function normalizeCustomerLoginCategory(category = {}, index = 0) {
  const id = String(category.id || category.categoryId || category.code || category.name || `login-category-${index}`);
  return {
    ...category,
    id,
    name: String(category.name || category.categoryName || category.title || "Category").trim() || "Category",
    imageUrl: String(
      category.imageUrl
      || category.categoryImageUrl
      || category.categoryPicture
      || category.pictureUrl
      || category.image_url
      || ""
    ).trim(),
    priority: numberValue(category.priority, 0),
    sortOrder: numberValue(category.sortOrder ?? category.sort_order, 0)
  };
}

async function loadCustomerLoginCategories({ forceRefresh = false } = {}) {
  if (actor !== "customer") return [];
  const url = "/portal/customer/login-categories";
  try {
    const payload = await portalCachedGet(url, {
      cacheKey: url,
      forceRefresh,
      maxAgeMs: 10 * 60 * 1000
    });
    state.loginCategories = normalizeArray(payload.data).map(normalizeCustomerLoginCategory);
    return state.loginCategories;
  } catch (error) {
    state.loginCategories = normalizeArray(state.loginCategories).map(normalizeCustomerLoginCategory);
    return state.loginCategories;
  }
}

async function loadCustomerCatalog(filters = {}) {
  const clusterId = filters.clusterId || selectedCustomerClusterId();
  const url = customerCatalogUrl({ ...filters, clusterId });
  const payload = await portalCachedGet(url, {
    cacheKey: customerCatalogCacheKey(url),
    forceRefresh: Boolean(filters.forceRefresh),
    maxAgeMs: customerCatalogCacheMaxAgeMs
  });
  state.catalog = normalizeCustomerCatalog(payload.data || fallbackCatalog());
  if (!filters.serviceId && !filters.categoryId) resetCustomerPersonalAssistantCatalog(clusterId);
  rememberCustomerPersonalAssistantCatalog(state.catalog, clusterId);
  await ensureCustomerPersonalAssistantCatalog({ clusterId, skipFetch: !filters.serviceId && !filters.categoryId });
  writePortalSessionCache();
  return state.catalog;
}

function catalogClusterScope(item = {}) {
  const raw = Array.isArray(item.clusterIds)
    ? item.clusterIds
    : Array.isArray(item.cluster_ids)
      ? item.cluster_ids
      : null;
  return {
    hasScope: Array.isArray(raw),
    ids: Array.isArray(raw) ? raw.map(String).filter(Boolean) : []
  };
}

function catalogItemAvailableInCluster(item = {}, clusterId = selectedCustomerClusterId()) {
  if (!clusterId) return true;
  const scope = catalogClusterScope(item);
  if (!scope.hasScope) return true;
  return scope.ids.includes(String(clusterId));
}

function activeCatalog() {
  const fallback = fallbackCatalog();
  const useFallback = Boolean(state.catalog.isFallback) || (!selectedCustomerClusterId() && !state.catalog.services?.length);
  const base = {
    ...state.catalog,
    clusters: state.catalog.clusters?.length ? state.catalog.clusters : (useFallback ? fallback.clusters : []),
    services: state.catalog.services?.length
      ? state.catalog.services.map((service, index) => ({ ...service, icon: customerChipLabel(service.icon || service.name || "Service"), tone: ["tone-yellow", "tone-green", "tone-blue", "tone-peach", "tone-purple"][index % 5] }))
      : (useFallback ? fallback.services : []),
    serviceMasters: state.catalog.serviceMasters?.length ? state.catalog.serviceMasters : [],
    categories: state.catalog.categories?.length ? state.catalog.categories : (useFallback ? fallback.categories : []),
    stores: state.catalog.stores?.length ? state.catalog.stores : (useFallback ? fallback.stores : []),
    storeCategories: state.catalog.storeCategories || [],
    storeKeywords: state.catalog.storeKeywords || [],
    bookingTypes: state.catalog.bookingTypes || [],
    priceRules: state.catalog.priceRules || [],
    categoryPriceRules: state.catalog.categoryPriceRules || []
  };
  const clusterId = selectedCustomerClusterId();
  if (!clusterId) return base;
  const services = base.services.filter((service) => catalogItemAvailableInCluster(service, clusterId));
  const serviceIds = new Set(services.map((service) => String(service.id || "")));
  const categories = base.categories.filter((category) => {
    const serviceId = categoryServiceId(category);
    return (!serviceId || serviceIds.has(serviceId)) && catalogItemAvailableInCluster(category, clusterId);
  });
  const categoryIds = new Set(categories.map((category) => String(category.id || "")));
  const stores = base.stores.filter((store) => {
    if (!catalogItemAvailableInCluster(store, clusterId)) return false;
    const storeServiceIds = Array.isArray(store.serviceIds) ? store.serviceIds.map(String) : [];
    const storeCategoryIds = Array.isArray(store.serviceCategoryIds) ? store.serviceCategoryIds.map(String) : [];
    const linkedToService = !storeServiceIds.length || storeServiceIds.some((id) => serviceIds.has(id));
    const linkedToCategory = !storeCategoryIds.length || storeCategoryIds.some((id) => categoryIds.has(id));
    return linkedToService && linkedToCategory;
  });
  return { ...base, services, categories, stores };
}

function customerServices() {
  return activeCatalog().services;
}

function catalogPersonalAssistantService(catalog = activeCatalog()) {
  return normalizeArray(catalog.services).find(isPersonalAssistantService) || null;
}

function resetCustomerPersonalAssistantCatalog(clusterId = "") {
  state.personalAssistantCatalog = normalizeCustomerCatalog({ clusters: [], services: [], categories: [], stores: [], priceRules: [], categoryPriceRules: [] });
  state.personalAssistantCatalogClusterId = String(clusterId || "");
}

function customerPersonalAssistantCacheCatalog() {
  const clusterId = selectedCustomerClusterId();
  if (clusterId && state.personalAssistantCatalogClusterId && String(state.personalAssistantCatalogClusterId) !== clusterId) {
    return normalizeCustomerCatalog({ clusters: [], services: [], categories: [], stores: [], priceRules: [], categoryPriceRules: [] });
  }
  return state.personalAssistantCatalog;
}

function rememberCustomerPersonalAssistantCatalog(catalog = state.catalog, clusterId = selectedCustomerClusterId()) {
  if (!catalog || catalog.isFallback) return;
  const service = catalogPersonalAssistantService(catalog);
  if (!service?.id) return;
  const categories = normalizeArray(catalog.categories)
    .filter((category) =>
      category?.isActive !== false &&
      category?.isEnabled !== false &&
      category?.isVisible !== false &&
      String(categoryServiceId(category)) === String(service.id)
    );
  const priceRules = normalizeArray(catalog.priceRules)
    .filter((rule) => String(rule.serviceId || "") === String(service.id) && rule.isActive !== false);
  if (!categories.length && !priceRules.length) return;
  state.personalAssistantCatalog = normalizeCustomerCatalog({
    ...catalog,
    services: [service],
    categories,
    priceRules,
    stores: [],
    isFallback: false
  });
  state.personalAssistantCatalogClusterId = String(clusterId || selectedCustomerClusterId() || "");
}

async function ensureCustomerPersonalAssistantCatalog(options = {}) {
  const clusterId = String(options.clusterId || selectedCustomerClusterId() || "");
  if (!clusterId || options.skipFetch) return;
  if (state.personalAssistantCatalogClusterId && String(state.personalAssistantCatalogClusterId) !== clusterId) {
    resetCustomerPersonalAssistantCatalog(clusterId);
  }
  if (state.personalAssistantCatalogClusterId === clusterId && customerHomeDurationOptions().length) return;
  try {
    const url = customerCatalogUrl({ clusterId });
    const payload = await portalCachedGet(url, { cacheKey: url });
    rememberCustomerPersonalAssistantCatalog(normalizeCustomerCatalog(payload.data || {}), clusterId);
  } catch {
    // Keep the current page usable; the PA helper section simply stays hidden if master data cannot load.
  }
}

function requestCustomerPersonalAssistantCatalogRender() {
  const clusterId = selectedCustomerClusterId();
  if (actor !== "customer" || !state.token || !clusterId || customerPersonalAssistantCatalogBusy) return;
  if (customerPersonalAssistantCatalogTriedCluster === clusterId && !customerHomeDurationOptions().length) return;
  customerPersonalAssistantCatalogBusy = true;
  ensureCustomerPersonalAssistantCatalog({ clusterId })
    .then(() => {
      customerPersonalAssistantCatalogTriedCluster = clusterId;
      if (customerHomeDurationOptions().length) render();
    })
    .catch(() => {
      customerPersonalAssistantCatalogTriedCluster = clusterId;
    })
    .finally(() => {
      customerPersonalAssistantCatalogBusy = false;
    });
}

function customerPersonalAssistantService() {
  const active = activeCatalog();
  return (!active.isFallback ? catalogPersonalAssistantService(active) : null)
    || catalogPersonalAssistantService(customerPersonalAssistantCacheCatalog())
    || null;
}

function customerPersonalAssistantCategories() {
  const service = customerPersonalAssistantService();
  if (!service?.id) return [];
  const fromActive = activeCatalog().isFallback ? [] : activeCatalog().categories.filter((category) => String(categoryServiceId(category)) === String(service.id));
  const rows = fromActive.length ? fromActive : customerPersonalAssistantCacheCatalog().categories;
  return rows
    .filter((category) =>
      category?.isActive !== false &&
      category?.isEnabled !== false &&
      category?.isVisible !== false &&
      String(categoryServiceId(category)) === String(service.id)
    )
    .sort((left, right) => Number(left.sortOrder || left.priority || 0) - Number(right.sortOrder || right.priority || 0) || String(left.name || "").localeCompare(String(right.name || "")));
}

function selectedService() {
  return customerServices().find((service) => String(service.id || "") === String(state.selectedServiceId || "")) || customerServices()[0] || null;
}

function serviceCategories(serviceId = "") {
  const targetServiceId = String(serviceId || state.selectedServiceId || selectedService()?.id || "");
  return activeCatalog().categories.filter((category) => categoryServiceId(category) === targetServiceId);
}

function serviceStores(serviceId = state.selectedServiceId, categoryId = "") {
  return activeCatalog().stores.filter((store) => {
    const storeServiceIds = Array.isArray(store.serviceIds) ? store.serviceIds.map(String) : [];
    const storeCategoryIds = Array.isArray(store.serviceCategoryIds) ? store.serviceCategoryIds.map(String) : [];
    const matchesService = !serviceId || storeServiceIds.includes(String(serviceId)) || !storeServiceIds.length;
    const matchesCategory = !categoryId || storeCategoryIds.includes(String(categoryId));
    return matchesService && matchesCategory;
  });
}

function categoryParentId(category = {}) {
  return String(
    category.parentCategoryId ||
    category.parent_category_id ||
    category.parentServiceCategoryId ||
    category.parent_service_category_id ||
    category.serviceCategoryParentId ||
    category.service_category_parent_id ||
    category.parentId ||
    category.parent_id ||
    category.parent?.id ||
    ""
  );
}

function categoryDirectChildren(categoryId = "", serviceId = selectedService()?.id || "") {
  const targetCategoryId = String(categoryId || "");
  if (!targetCategoryId) return [];
  return serviceCategories(serviceId).filter((category) => categoryParentId(category) === targetCategoryId);
}

function serviceRootCategories(serviceId = selectedService()?.id || "") {
  const rows = serviceCategories(serviceId);
  const ids = new Set(rows.map((category) => String(category.id || "")));
  return rows.filter((category) => {
    const parentId = categoryParentId(category);
    return !parentId || !ids.has(parentId);
  });
}

function categoryDescendantIds(categoryId = "", serviceId = selectedService()?.id || "") {
  const rootId = String(categoryId || "");
  if (!rootId) return [];
  const visited = new Set();
  const stack = [rootId];
  while (stack.length) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    categoryDirectChildren(current, serviceId).forEach((child) => stack.push(String(child.id || "")));
  }
  return Array.from(visited);
}

function categoryStores(categoryId = "", serviceId = selectedService()?.id || "") {
  const categoryIds = new Set(categoryDescendantIds(categoryId, serviceId).map(String));
  if (!categoryIds.size) return [];
  return serviceStores(serviceId).filter((store) => {
    const storeCategoryIds = Array.isArray(store.serviceCategoryIds) ? store.serviceCategoryIds.map(String) : [];
    return storeCategoryIds.some((id) => categoryIds.has(id));
  });
}

function categoryHasDrilldown(category = {}, serviceId = selectedService()?.id || "") {
  const categoryId = String(category.id || "");
  return Boolean(categoryId && (
    categoryDirectChildren(categoryId, serviceId).length ||
    categoryStores(categoryId, serviceId).length ||
    normalizeArray(category.storeOperatingHours).length
  ));
}

function selectedCategory() {
  const categoryId = String(state.selectedCategoryId || "");
  if (!categoryId) return null;
  return activeCatalog().categories.find((category) => String(category.id || "") === categoryId) || null;
}

function money(value) {
  return `₹${Number(value || 0).toFixed(0)}`;
}

function customerDurationText(minutes = 0) {
  const value = Math.max(0, Number(minutes || 0));
  if (value >= 60) {
    const hours = Math.floor(value / 60);
    const remainingMinutes = Math.round(value % 60);
    if (!remainingMinutes) return `${hours} hr${hours === 1 ? "" : "s"}`;
    return `${hours}.${String(remainingMinutes).padStart(2, "0")} hrs`;
  }
  return `${Math.round(value)} min`;
}

function parseBookingCancelDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function customerBookingCancelCountdown(booking = {}) {
  const eligibility = booking.customerCancelEligibility || {};
  const openAt = parseBookingCancelDate(eligibility.cancelOpensAt);
  const autoAt = parseBookingCancelDate(eligibility.autoCancelAt);
  if (!openAt && !autoAt) return { text: "Cancel window unavailable", tone: "green", available: false, deadline: null };

  const now = Date.now();
  if (autoAt && now >= autoAt.getTime()) {
    return { text: "Cancel window closed", tone: "red", available: false, deadline: autoAt, phase: "closed" };
  }

  if (openAt && now < openAt.getTime()) {
    const diffMs = openAt.getTime() - now;
    const totalSeconds = Math.max(0, Math.ceil(Math.abs(diffMs) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const parts = [];
    if (hours) parts.push(`${hours} hr${hours === 1 ? "" : "s"}`);
    if (mins || !parts.length) parts.push(`${mins} min${mins === 1 ? "" : "s"}`);
    if (!hours && !mins) parts.push(`${seconds} sec${seconds === 1 ? "" : "s"}`);
    return {
      text: `${parts.join(" ")} to cancel enable`,
      tone: minutes <= 5 ? "red" : minutes <= 15 ? "yellow" : "green",
      available: false,
      deadline: openAt,
      phase: "opening"
    };
  }

  if (autoAt) {
    const diffMs = autoAt.getTime() - now;
    const totalSeconds = Math.max(0, Math.ceil(Math.abs(diffMs) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const parts = [];
    if (hours) parts.push(`${hours} hr${hours === 1 ? "" : "s"}`);
    if (mins || !parts.length) parts.push(`${mins} min${mins === 1 ? "" : "s"}`);
    if (!hours && !mins) parts.push(`${seconds} sec${seconds === 1 ? "" : "s"}`);
    return {
      text: `${parts.join(" ")} left to cancel`,
      tone: minutes <= 5 ? "red" : minutes <= 15 ? "yellow" : "green",
      available: true,
      deadline: autoAt,
      phase: "active"
    };
  }

  return { text: "You can cancel this task.", tone: "green", available: true, deadline: null, phase: "active" };
}

function customerCancelSectionHtml(booking = {}) {
  const bookingId = booking?.id || booking?.bookingId || "";
  const eligibility = booking.customerCancelEligibility || {};
  const reasonCode = String(eligibility.reasonCode || "");
  if (!bookingId) return "";

  const status = String(booking.status || booking.statusCode || booking.status_code || "").toLowerCase();
  if (["cancelled", "completed", "success", "rejected"].includes(status)) return "";
  const assignmentStatus = String(booking.assignmentStatus || booking.assignment_status || booking.metadata?.assignmentStatus || "").toLowerCase();
  const assistantAssigned = Boolean(booking.assignmentId || booking.acceptedAssignmentId || booking.accepted_assignment_id || booking.assistantId || booking.assistant?.id)
    || ["assigned", "accepted", "in_progress", "working", "approval_pending", "completed"].includes(assignmentStatus);
  if (assistantAssigned) return "";

  const hasBackendEligibility = Object.keys(eligibility).length > 0;
  const backendCanCancel = hasBackendEligibility ? Boolean(eligibility.canCancel) : true;
  const openAt = parseBookingCancelDate(eligibility.cancelOpensAt);
  const autoCancelAt = parseBookingCancelDate(eligibility.autoCancelAt);
  const isNotCancellable = reasonCode === "not_cancellable" || reasonCode === "assistant_delay_auto_cancel_closed";
  const canCancel = backendCanCancel && !isNotCancellable;
  if (!canCancel) return "";

  return `<section class="customer-cancel-section customer-track-cancel-section">
    <span hidden data-customer-cancel-countdown ${openAt ? `data-customer-cancel-open="${escapeHtml(openAt.toISOString())}"` : ""} ${autoCancelAt ? `data-customer-cancel-auto="${escapeHtml(autoCancelAt.toISOString())}"` : ""} data-customer-cancel-available="1"></span>
    <button class="danger-btn customer-cancel-btn" type="button" data-cancel-booking="${escapeHtml(bookingId)}">Cancel Task</button>
  </section>`;
}

function homeStartingPriceLabel(value) {
  return `Starting @ â‚¹ ${Number(value || 0).toFixed(0)}`;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function cartTotals() {
  customerRepriceStoreCartItems();
  const lines = state.cart.map((item) => {
    const selling = numberValue(item.price, 0);
    const base = Math.max(numberValue(item.basePrice, 0), selling + numberValue(item.saveAmount, 0), selling);
    return { base, selling };
  });
  const itemTotal = lines.reduce((sum, line) => sum + line.base, 0);
  const toPay = lines.reduce((sum, line) => sum + line.selling, 0);
  const discount = Math.max(0, itemTotal - toPay);
  const duration = state.cart.reduce((sum, item) => sum + Number(item.cartDurationMinutes ?? item.durationMinutes ?? 30), 0);
  return {
    itemTotal,
    totalAmount: itemTotal,
    discount,
    discountAmount: discount,
    fees: 0,
    toPay,
    amountToPay: toPay,
    duration
  };
}

function customerServiceById(serviceId = "") {
  return activeCatalog().services.find((service) => String(service.id || "") === String(serviceId || ""))
    || fallbackCatalog().services.find((service) => String(service.id || "") === String(serviceId || ""))
    || null;
}

function customerCartServiceId() {
  return String(state.cart[0]?.serviceId || "");
}

function customerCartServiceIds() {
  return [...new Set(state.cart.map((item) => String(item.serviceId || "")).filter(Boolean))];
}

function customerCategoryById(categoryId = "") {
  const id = String(categoryId || "");
  if (!id) return null;
  return activeCatalog().categories.find((category) => String(category.id || "") === id)
    || customerPersonalAssistantCategories().find((category) => String(category.id || "") === id)
    || null;
}

function customerBookingTypeMasters() {
  return normalizeArray(activeCatalog().bookingTypes || state.catalog.bookingTypes)
    .filter((item) => item && item.isActive !== false);
}

function customerBookingTypeMasterDefault(mode = "instant") {
  const normalized = mode === "schedule" ? "schedule" : "instant";
  const rows = customerBookingTypeMasters().filter((item) => item.bookingType === normalized);
  return rows.find((item) => item.isDefault) || rows[0] || null;
}

function customerBookingTypeSourceConfig(mode = "instant", fallback = {}) {
  const normalized = mode === "schedule" ? "schedule" : "instant";
  const source = fallback?.bookingType === normalized ? fallback : customerBookingTypeMasterDefault(normalized) || fallback || {};
  return {
    id: source.id || null,
    bookingType: normalized,
    instantMode: "manual",
    waitWindowMinutes: 0,
    waitWindowNote: "",
    maxAdvanceDays: Number(source.maxAdvanceDays ?? source.config?.maxAdvanceDays ?? 1),
    allowedDays: source.allowedDays || source.config?.allowedDays || [],
    timeCategories: source.timeCategories || source.config?.timeCategories || [],
    timeSlots: source.timeSlots || source.config?.timeSlots || []
  };
}

function customerNonEmptyArray(primary, fallback = []) {
  return Array.isArray(primary) && primary.length ? primary : Array.isArray(fallback) ? fallback : [];
}

function customerBookingTypeSlug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "time";
}

function customerTimePeriod(time = "") {
  const minutes = customerTimeMinutes(time);
  if (minutes == null) return "time";
  if (minutes < 5 * 60) return "mid_night";
  if (minutes < 8 * 60) return "early_morning";
  if (minutes < 12 * 60) return "morning";
  if (minutes < 17 * 60) return "afternoon";
  if (minutes < 21 * 60) return "evening";
  return "night";
}

function customerTimePeriodName(period = "") {
  return ({
    early_morning: "Early Morning",
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    night: "Night",
    late_night: "Late Night",
    mid_night: "Late Night"
  }[period] || "Time");
}

function customerNormalizeTimeCategories(categories = [], fallbackTimes = []) {
  const rows = normalizeArray(categories)
    .map((category, index) => {
      const name = String(category?.name || "").trim();
      const timeSlots = [...new Set(normalizeArray(category?.timeSlots || category?.slots))]
        .filter((time) => customerTimeMinutes(time) != null)
        .sort((left, right) => customerTimeMinutes(left) - customerTimeMinutes(right));
      const displayName = name || customerTimePeriodName(customerTimePeriod(timeSlots[0] || ""));
      const id = customerBookingTypeSlug(displayName) || customerTimePeriod(timeSlots[0] || "") || `time_${index + 1}`;
      return {
        id,
        sourceId: category?.id || null,
        name: displayName,
        sortOrder: Math.max(1, Math.round(Number(category?.sortOrder || index + 1))),
        isActive: category?.isActive !== false,
        timeSlots
      };
    })
    .filter((category) => category.name && category.timeSlots.length)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  if (rows.length) return rows;
  const grouped = new Map();
  for (const time of [...new Set(normalizeArray(fallbackTimes))]
    .filter((item) => customerTimeMinutes(item) != null)
    .sort((left, right) => customerTimeMinutes(left) - customerTimeMinutes(right))) {
    const period = customerTimePeriod(time);
    if (!grouped.has(period)) {
      grouped.set(period, { id: period, name: customerTimePeriodName(period), sortOrder: grouped.size + 1, isActive: true, timeSlots: [] });
    }
    grouped.get(period).timeSlots.push(time);
  }
  return [...grouped.values()];
}

function customerActiveTimeCategories(categories = [], fallbackTimes = []) {
  return customerNormalizeTimeCategories(categories, fallbackTimes).filter((category) => category.isActive);
}

function customerBookingConfigActive(config = {}) {
  return config?.isActive !== false && config?.active !== false && config?.isEnabled !== false;
}

function customerBookingConfigMode(config = {}, fallback = "both") {
  const rawValue = config?.mode || config?.bookingType || config?.type || config?.booking_type || fallback;
  const rawMode = String(rawValue || "").toLowerCase();
  if (!rawMode) return "";
  return ["instant", "schedule", "both"].includes(rawMode) ? rawMode : (fallback ? "both" : "");
}

function customerBookingConfigAssignMode(config = {}, fallback = "manual") {
  const rawMode = String(config?.instantMode || config?.assignType || config?.assignmentMode || config?.bookingAssistant || fallback || "manual").toLowerCase();
  if (["automate", "auto", "automatic"].includes(rawMode)) return "automate";
  if (rawMode === "manual") return "manual";
  return fallback === "automate" ? "automate" : "manual";
}

function customerApplyBookingConfig(base = {}, config = {}, service = {}) {
  const defaults = service?.defaultBookingType || {};
  const scheduleFallback = customerBookingTypeSourceConfig("schedule", defaults);
  const mode = customerBookingConfigMode(config, base.mode || "both");
  const timeSlots = customerNonEmptyArray(config.timeSlots, scheduleFallback.timeSlots);
  const timeCategories = customerActiveTimeCategories(customerNonEmptyArray(config.timeCategories, scheduleFallback.timeCategories), timeSlots);
  return {
    ...base,
    mode,
    allowsInstant: mode === "instant" || mode === "both",
    allowsSchedule: mode === "schedule" || mode === "both",
    instantMode: customerBookingConfigAssignMode(config, base.instantMode || "manual"),
    waitWindowMinutes: 0,
    waitWindowNote: "",
    maxAdvanceDays: Number(config.maxAdvanceDays ?? base.maxAdvanceDays ?? scheduleFallback.maxAdvanceDays ?? 1),
    allowedDays: customerNonEmptyArray(config.allowedDays, base.allowedDays || scheduleFallback.allowedDays),
    timeCategories,
    timeSlots
  };
}

function customerServiceBookingType(serviceId = "") {
  const service = customerServiceById(serviceId);
  const serviceConfig = service?.bookingTypeConfig || {};
  const defaults = service?.defaultBookingType || {};
  const configuredMode = customerBookingConfigActive(serviceConfig) ? customerBookingConfigMode(serviceConfig, defaults.bookingType || defaults.mode || "both") : "";
  const mode = ["instant", "schedule", "both"].includes(configuredMode) ? configuredMode : "both";
  const scheduleSource = customerBookingTypeSourceConfig("schedule", defaults);
  const timeSlots = customerNonEmptyArray(serviceConfig.timeSlots, scheduleSource.timeSlots);
  return {
    serviceId,
    serviceName: service?.name || "Service",
    mode,
    allowsInstant: mode === "instant" || mode === "both",
    allowsSchedule: mode === "schedule" || mode === "both",
    instantMode: customerBookingConfigAssignMode(serviceConfig, "manual"),
    waitWindowMinutes: 0,
    waitWindowNote: "",
    maxAdvanceDays: Number(serviceConfig.maxAdvanceDays ?? scheduleSource.maxAdvanceDays ?? 1),
    allowedDays: customerNonEmptyArray(serviceConfig.allowedDays, scheduleSource.allowedDays),
    timeCategories: customerActiveTimeCategories(customerNonEmptyArray(serviceConfig.timeCategories, scheduleSource.timeCategories), timeSlots),
    timeSlots
  };
}

function customerBookingTypeForCartItem(item = {}) {
  const itemMode = normalizeServiceMasterBookingType(item.bookingType || item.serviceBookingType || item.bookingTypeMode || item.metadata?.bookingType);
  const serviceId = String(item.serviceId || state.selectedServiceId || selectedService()?.id || "");
  const service = customerServiceById(serviceId);
  const base = itemMode && itemMode !== "both"
    ? {
        ...customerServiceBookingType(serviceId),
        mode: itemMode,
        allowsInstant: itemMode === "instant",
        allowsSchedule: itemMode === "schedule"
      }
    : customerServiceBookingType(serviceId);
  const category = customerCategoryById(item.sourceCategoryId || item.categoryId);
  const categoryConfig = category?.bookingTypeConfig || {};
  if (categoryConfig && customerBookingConfigActive(categoryConfig) && customerBookingConfigMode(categoryConfig, "")) {
    return {
      ...customerApplyBookingConfig(base, categoryConfig, service || {}),
      categoryId: category?.id || "",
      categoryName: category?.name || item.categoryName || ""
    };
  }
  return { ...base, categoryId: category?.id || "", categoryName: category?.name || item.categoryName || "" };
}

function customerCartBookingTypePlan() {
  const rows = state.cart.length
    ? state.cart.map(customerBookingTypeForCartItem)
    : (customerCartServiceIds().length ? customerCartServiceIds() : [state.selectedServiceId || selectedService()?.id].filter(Boolean)).map(customerServiceBookingType);
  const services = rows.filter((item) => item.serviceId);
  const instantServices = services.filter((item) => item.allowsInstant);
  const scheduleServices = services.filter((item) => item.allowsSchedule);
  const scheduleConfig = scheduleServices[0] || services.find((item) => item.timeSlots?.length || item.timeCategories?.length) || services[0] || null;
  const instantSlaAvailable = customerInstantSlaAvailable();
  return {
    services,
    instantServices,
    scheduleServices,
    hasInstant: instantServices.length > 0 && instantSlaAvailable,
    hasInstantByConfig: instantServices.length > 0,
    instantSlaAvailable,
    hasSchedule: scheduleServices.length > 0,
    isMixed: instantServices.length > 0 && scheduleServices.length > 0 && services.some((item) => item.mode !== "both"),
    scheduleConfig
  };
}

function customerEffectiveBookingType(requestedMode = state.bookingType) {
  const plan = customerCartBookingTypePlan();
  if (requestedMode === "schedule" && plan.scheduleConfig) {
    const schedule = plan.scheduleConfig;
    const decision = customerAvailabilityDecisionIsCurrent() ? state.customerAvailabilityDecision : null;
    const decisionConfig = decision?.config || {};
    const decisionScheduleConfig = decision?.scheduleConfig || {};
    const decisionSlots = customerNonEmptyArray(
      decision?.scheduleTimeSlots,
      customerNonEmptyArray(decisionConfig.timeSlots, customerNonEmptyArray(decisionScheduleConfig.timeSlots, schedule.timeSlots || []))
    );
    const decisionCategories = customerNonEmptyArray(
      decisionConfig.timeCategories,
      customerNonEmptyArray(decisionScheduleConfig.timeCategories, schedule.timeCategories || [])
    );
    return {
      mode: "schedule",
      instantMode: decision?.instantMode || schedule.instantMode || "manual",
      waitWindowMinutes: 0,
      waitWindowNote: "",
      maxAdvanceDays: Number(decisionConfig.maxAdvanceDays ?? decisionScheduleConfig.maxAdvanceDays ?? schedule.maxAdvanceDays ?? 1),
      allowedDays: decisionConfig.allowedDays || decisionScheduleConfig.allowedDays || schedule.allowedDays || [],
      timeCategories: customerActiveTimeCategories(decisionCategories, decisionSlots),
      timeSlots: decisionSlots
    };
  }
  const instant = plan.instantServices[0] || plan.services[0] || {};
  return {
    mode: "instant",
    instantMode: instant.instantMode || "manual",
    waitWindowMinutes: 0,
    waitWindowNote: "",
    maxAdvanceDays: 0,
    allowedDays: [],
    timeCategories: [],
    timeSlots: []
  };
}

function ensureCustomerBookingTypeAllowed() {
  if (!state.cart.length) return;
  const plan = customerCartBookingTypePlan();
  if (state.bookingType === "schedule" && plan.hasSchedule) {
    ensureCustomerScheduleSelection(customerEffectiveBookingType("schedule"));
  } else if (state.bookingType === "instant" && plan.hasInstant) {
    state.customerScheduleSheetOpen = false;
  } else if (plan.hasInstant) {
    state.bookingType = "instant";
    state.customerScheduleSheetOpen = false;
  } else if (plan.hasSchedule) {
    state.bookingType = "schedule";
    ensureCustomerScheduleSelection(customerEffectiveBookingType("schedule"));
  } else {
    state.bookingType = "instant";
    state.customerScheduleSheetOpen = false;
  }
  state.selectedPayment = "cash";
  state.customerPaymentSheetOpen = false;
  state.customerPaymentBusy = false;
  state.customerRazorpayPayment = null;
}

function customerBookingTypeLabel(mode = "") {
  if (mode === "both") return "Instant / Schedule";
  return mode === "schedule" ? "Schedule" : "Instant";
}

function customerAssignmentLabel(mode = "") {
  return mode === "automate" ? "Auto" : "Manual";
}

function customerBookingTypeSummaryHtml() {
  const plan = customerCartBookingTypePlan();
  if (!state.cart.length || !plan.services.length) return "";
  const seen = new Set();
  const chips = plan.services
    .filter((service) => {
      const key = `${service.serviceId}:${service.mode}:${service.categoryId || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((service) => `<span class="customer-booking-type-chip ${escapeHtml(service.mode || "instant")}"><b>${escapeHtml(service.categoryName || service.serviceName)}</b>${escapeHtml(customerBookingTypeLabel(service.mode))} Â· ${escapeHtml(customerAssignmentLabel(service.instantMode))}</span>`)
    .join("");
  const helper = plan.isMixed ? `<p class="customer-booking-helper">Selected items have different booking types. Choose the available option for this booking.</p>` : "";
  return `<div class="customer-booking-type-summary">${chips}${helper}</div>`;
}

function customerBookingTypeSelectorHtml() {
  if (!state.cart.length) return `<p class="muted">Add a service to continue.</p>`;
  return "";
}

function customerLocalDateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function customerUtcDateValue(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function customerUtcNowMinutes(date = new Date()) {
  return (date.getUTCHours() * 60) + date.getUTCMinutes();
}

function customerLocalNowMinutes(date = new Date()) {
  return (date.getHours() * 60) + date.getMinutes();
}

function customerScheduleDateTime(dateValue = "", time = "") {
  const [year, month, day] = String(dateValue || "").split("-").map(Number);
  const parsed = customerTimeMinutes(time);
  if (!year || !month || !day || parsed == null) return null;
  const hour = Math.floor(parsed / 60);
  const minute = parsed % 60;
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function customerScheduleDates(config = customerEffectiveBookingType("schedule")) {
  const decision = customerAvailabilityDecisionIsCurrent() ? state.customerAvailabilityDecision : null;
  const decisionDates = normalizeArray(decision?.scheduleDates)
    .map((date, index) => {
      const value = date.value || date.date || "";
      if (!value) return null;
      const parsed = new Date(`${value}T00:00:00`);
      const day = date.day || (Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase() : "");
      return {
        value,
        label: date.label || (index === 0 ? "Today" : index === 1 ? "Tomorrow" : String(parsed.getDate()).padStart(2, "0")),
        day
      };
    })
    .filter(Boolean);
  if (decisionDates.length) return decisionDates;

  const maxAdvanceDays = Math.max(0, Number(config.maxAdvanceDays || 0));
  const allowed = new Set((config.allowedDays || []).map((item) => String(item).toLowerCase()));
  const rows = [];
  for (let offset = 0; offset <= maxAdvanceDays; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const token = offset === 0 ? "today" : offset === 1 ? "tomorrow" : `next_${offset}`;
    if (allowed.size && !allowed.has(token) && !allowed.has(String(offset)) && !allowed.has(weekday)) continue;
    rows.push({
      value: customerLocalDateValue(date),
      label: offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : String(date.getDate()).padStart(2, "0"),
      day: date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()
    });
  }
  return rows;
}

function customerScheduleTimes(config = {}) {
  const configuredTimes = normalizeArray(config.timeSlots);
  const categoryTimes = normalizeArray(config.timeCategories).flatMap((category) => normalizeArray(category.timeSlots));
  return [...new Set([...configuredTimes, ...categoryTimes])]
    .filter((time) => customerTimeMinutes(time) != null)
    .sort((left, right) => customerTimeMinutes(left) - customerTimeMinutes(right));
}

function customerScheduleDateIsToday(dateValue = "") {
  const value = String(dateValue || "");
  return value === customerTodayDateValue();
}

function customerScheduleTimeDisabled(dateValue = "", time = "") {
  if (!customerScheduleServiceOpen()) return true;
  const slotMinutes = customerTimeMinutes(time);
  if (slotMinutes == null) return true;
  if (decisionScheduleChecked()) {
    const slots = Array.isArray(state.customerAvailabilityDecision?.scheduleAvailableSlots) ? state.customerAvailabilityDecision.scheduleAvailableSlots : [];
    const slot = slots.find((item) => String(item.date || "") === String(dateValue || "") && String(item.time || "") === String(time || ""));
    return !slot || Number(slot.availableAssistants || 0) <= 0;
  }
  const capacity = customerScheduleSlotCapacity(dateValue, time);
  return capacity === 0;
}

function customerScheduleSlotCapacity(dateValue = "", time = "") {
  if (state.customerAvailabilityDecisionContext !== customerAvailabilityDecisionContext()) return null;
  const slots = Array.isArray(state.customerAvailabilityDecision?.scheduleAvailableSlots) ? state.customerAvailabilityDecision.scheduleAvailableSlots : [];
  const slot = slots.find((item) => item.date === dateValue && item.time === time);
  return slot ? Number(slot.availableAssistants || 0) : null;
}

function customerAvailableScheduleTimes(config = {}, dateValue = state.selectedScheduleDate) {
  return customerScheduleTimes(config).filter((time) => !customerScheduleTimeDisabled(dateValue, time));
}

function customerScheduleCategoryEnabledTimes(category = {}, dateValue = state.selectedScheduleDate, config = customerEffectiveBookingType("schedule")) {
  return customerCategoryTimes(category, config).filter((time) => !customerScheduleTimeDisabled(dateValue, time));
}

function customerScheduleCategoryDisabled(category = {}, dateValue = state.selectedScheduleDate, config = customerEffectiveBookingType("schedule")) {
  return !customerScheduleCategoryEnabledTimes(category, dateValue, config).length;
}

function customerScheduleDateDisabled(config = {}, dateValue = "") {
  if (!customerScheduleServiceOpen()) return true;
  const configured = customerScheduleDates(config).some((date) => String(date.value || "") === String(dateValue || ""));
  if (!configured) return true;
  if (!decisionScheduleChecked()) return false;
  const slots = Array.isArray(state.customerAvailabilityDecision?.scheduleAvailableSlots) ? state.customerAvailabilityDecision.scheduleAvailableSlots : [];
  return !slots.some((slot) => String(slot.date || "") === String(dateValue || "") && Number(slot.availableAssistants || 0) > 0);
}

function customerScheduleSelectionIsValid(config = customerEffectiveBookingType("schedule")) {
  const times = customerScheduleTimes(config);
  return Boolean(
    customerScheduleServiceOpen() &&
    state.selectedScheduleDate
    && state.selectedScheduleTime
    && times.includes(state.selectedScheduleTime)
    && !customerScheduleTimeDisabled(state.selectedScheduleDate, state.selectedScheduleTime)
  );
}

function customerFormatTime(time = "") {
  const minutes = customerTimeMinutes(time);
  if (minutes == null) return String(time || "");
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${String(displayHour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
}

function customerPeriodOrder(category = {}) {
  const order = { early_morning: 1, morning: 2, afternoon: 3, evening: 4, night: 5, late_night: 6, mid_night: 6 };
  const token = [category.id, customerBookingTypeSlug(category.name || ""), customerTimePeriod((category.timeSlots || [])[0] || "")]
    .find((item) => order[item] != null);
  return order[token] || 99;
}

function customerSortedTimeCategories(categories = []) {
  return [...categories].sort((left, right) => {
    const leftTime = (left.timeSlots || [])[0] || "99:99";
    const rightTime = (right.timeSlots || [])[0] || "99:99";
    return customerPeriodOrder(left) - customerPeriodOrder(right) || leftTime.localeCompare(rightTime) || String(left.name || "").localeCompare(String(right.name || ""));
  });
}

function customerAvailableTimeCategoriesForDate(config = {}, dateValue = state.selectedScheduleDate) {
  const times = customerScheduleTimes(config);
  return customerSortedTimeCategories(customerActiveTimeCategories(config.timeCategories || [], times))
    .filter((category) => customerScheduleCategoryEnabledTimes(category, dateValue, config).length > 0);
}

function customerConfiguredTimeCategories(config = {}) {
  const times = customerScheduleTimes(config);
  return customerSortedTimeCategories(customerActiveTimeCategories(config.timeCategories || [], times));
}

function customerTodayDateValue() {
  return customerLocalDateValue(new Date());
}

function customerCategoryTimes(category = {}, config = customerEffectiveBookingType("schedule")) {
  const allTimes = customerScheduleTimes(config);
  return normalizeArray(category?.timeSlots)
    .filter((time) => allTimes.includes(time))
    .sort((left, right) => customerTimeMinutes(left) - customerTimeMinutes(right));
}

function customerDefaultScheduleCategory(config = customerEffectiveBookingType("schedule"), dateValue = state.selectedScheduleDate) {
  const categories = customerAvailableTimeCategoriesForDate(config, dateValue);
  if (!categories.length) return null;
  return customerFirstCategoryForDate(config, dateValue) || null;
}

function customerResolvedScheduleCategory(config = customerEffectiveBookingType("schedule"), dateValue = state.selectedScheduleDate) {
  const categories = customerConfiguredTimeCategories(config);
  const available = customerAvailableTimeCategoriesForDate(config, dateValue);
  const selected = available.find((category) => category.id === state.selectedSchedulePeriod);
  if (selected) return selected;
  return customerFirstCategoryForDate(config, dateValue) || available[0] || null;
}

function customerDefaultScheduleTime(category = {}, dateValue = state.selectedScheduleDate, config = customerEffectiveBookingType("schedule")) {
  const times = customerCategoryTimes(category, config);
  if (!times.length) return "";
  if (dateValue === customerTodayDateValue()) {
    return times.find((time) => !customerScheduleTimeDisabled(dateValue, time)) || "";
  }
  return times.find((time) => !customerScheduleTimeDisabled(dateValue, time)) || "";
}

function customerFirstEnabledTimeForCategory(category = {}, dateValue = state.selectedScheduleDate, config = customerEffectiveBookingType("schedule")) {
  return customerScheduleCategoryEnabledTimes(category, dateValue, config)[0] || "";
}

function customerFirstCategoryForDate(config = customerEffectiveBookingType("schedule"), dateValue = state.selectedScheduleDate) {
  const categories = customerAvailableTimeCategoriesForDate(config, dateValue);
  return categories[0] || null;
}

function selectCustomerScheduleDate(dateValue = "", config = customerEffectiveBookingType("schedule")) {
  state.selectedScheduleDate = dateValue;
  ensureCustomerScheduleSelection(config);
}

function selectCustomerScheduleDateFromChip(dateValue = "", config = customerEffectiveBookingType("schedule")) {
  state.selectedScheduleDate = dateValue;
  const category = customerFirstCategoryForDate(config, dateValue) || customerDefaultScheduleCategory(config, dateValue);
  state.selectedSchedulePeriod = category?.id || "";
  state.selectedScheduleTime = category ? customerDefaultScheduleTime(category, dateValue, config) || "" : "";
}

function selectCustomerSchedulePeriodFromChip(periodId = "", config = customerEffectiveBookingType("schedule")) {
  const categories = customerAvailableTimeCategoriesForDate(config, state.selectedScheduleDate);
  const category = categories.find((item) => item.id === periodId) || categories[0] || null;
  state.selectedSchedulePeriod = category?.id || "";
  state.selectedScheduleTime = category ? customerDefaultScheduleTime(category, state.selectedScheduleDate, config) || "" : "";
}

function selectCustomerScheduleDateAndRefreshChildren(dateValue = "", config = customerEffectiveBookingType("schedule")) {
  state.selectedScheduleDate = dateValue;
  const category = customerFirstCategoryForDate(config, dateValue) || customerDefaultScheduleCategory(config, dateValue);
  state.selectedSchedulePeriod = category?.id || "";
  state.selectedScheduleTime = category ? customerDefaultScheduleTime(category, dateValue, config) || "" : "";
}

function ensureCustomerScheduleSelection(config = customerEffectiveBookingType("schedule")) {
  if (config.mode !== "schedule") return;
  const dates = customerScheduleDates(config);
  if (!dates.some((date) => date.value === state.selectedScheduleDate)) {
    state.selectedScheduleDate = dates[0]?.value || "";
  }
  const availableCategories = customerAvailableTimeCategoriesForDate(config, state.selectedScheduleDate);
  const selectedCategory = availableCategories.find((category) => category.id === state.selectedSchedulePeriod);
  if (!selectedCategory) {
    const defaultCategory = customerFirstCategoryForDate(config, state.selectedScheduleDate) || availableCategories[0] || null;
    state.selectedSchedulePeriod = defaultCategory?.id || "";
  }
  const category = availableCategories.find((item) => item.id === state.selectedSchedulePeriod) || availableCategories[0] || null;
  const enabledTimes = category ? customerScheduleCategoryEnabledTimes(category, state.selectedScheduleDate, config) : [];
  if (!enabledTimes.length) {
    state.selectedScheduleTime = "";
  } else if (!enabledTimes.includes(state.selectedScheduleTime)) {
    state.selectedScheduleTime = enabledTimes[0] || "";
  }
}

function customerSchedulePickerHtml(config = customerEffectiveBookingType("schedule")) {
  ensureCustomerScheduleSelection(config);
  const dates = customerScheduleDates(config);
  const times = customerScheduleTimes(config);
  const categories = customerConfiguredTimeCategories(config);
  const availableCategories = customerAvailableTimeCategoriesForDate(config, state.selectedScheduleDate);
  const activeCategory = customerResolvedScheduleCategory(config, state.selectedScheduleDate) || null;
  const periodTimes = activeCategory ? customerCategoryTimes(activeCategory, config) : [];
  if (!dates.length || !times.length) return `<div class="customer-f7-sheet-empty">Schedule slots are not configured for this booking type.</div>`;
  return `<div class="booking-schedule-card customer-schedule-page-picker">
    <div class="booking-schedule-block">
      <h3>Select Date</h3>
      <div class="booking-date-chip-grid">
      ${dates.map((date) => {
          const disabled = customerScheduleDateDisabled(config, date.value);
          return `<button class="booking-date-chip ${state.selectedScheduleDate === date.value ? "selected" : ""} ${disabled ? "disabled" : ""}" data-action="booking-master-select-schedule-date" data-date="${escapeHtml(date.value)}" type="button" ${disabled ? "disabled" : ""} aria-disabled="${disabled ? "true" : "false"}"><span>${escapeHtml(date.label)}</span>${date.label === "Today" || date.label === "Tomorrow" ? "" : `<small>${escapeHtml(date.day)}</small>`}</button>`;
        }).join("") || `<div class="empty-state">No schedule dates configured.</div>`}
      </div>
    </div>
    <div class="booking-schedule-block">
      <h3>Start Time</h3>
      <div class="booking-period-tabs">
        ${categories.map((category) => {
          const disabled = customerScheduleCategoryDisabled(category, state.selectedScheduleDate, config);
          return `<button class="${state.selectedSchedulePeriod === category.id ? "selected" : ""} ${disabled ? "disabled" : ""}" data-action="booking-master-select-schedule-period" data-period="${escapeHtml(category.id)}" type="button" ${disabled ? "disabled" : ""} aria-disabled="${disabled ? "true" : "false"}">${escapeHtml(category.name)}</button>`;
        }).join("") || `<div class="empty-state">No time categories configured.</div>`}
      </div>
      <div class="booking-time-chip-grid">
        ${periodTimes.map((time) => {
          const disabled = customerScheduleTimeDisabled(state.selectedScheduleDate, time);
          const capacity = customerScheduleSlotCapacity(state.selectedScheduleDate, time);
          const capacityLabel = capacity != null ? capacity : 0;
          return `<button class="booking-time-chip ${state.selectedScheduleTime === time ? "selected" : ""} ${disabled ? "disabled" : ""}" data-action="booking-master-select-schedule-time" data-time="${escapeHtml(time)}" type="button" ${disabled ? "disabled" : ""} aria-disabled="${disabled ? "true" : "false"}"><span>${escapeHtml(customerFormatTime(time))}</span><small>OA ${escapeHtml(capacityLabel)}</small></button>`;
        }).join("") || `<div class="empty-state">No ${escapeHtml(activeCategory?.name || "time")} slots configured.</div>`}
      </div>
    </div>
  </div>`;
}

function decisionScheduleChecked() {
  return Boolean(
    state.customerAvailabilityDecision &&
    state.customerAvailabilityDecisionContext === customerAvailabilityDecisionContext() &&
    state.customerAvailabilityDecision.scheduleAvailabilityChecked
  );
}

function customerScheduleAvailabilityMessageHtml() {
  return "";
}

function customerCartLocationClusterIds() {
  return [...new Set(customerCartLocationStopsForPayload().map((stop) => String(stop.clusterId || "")).filter(Boolean))];
}

function customerAvailabilityUsesHomeCategoryContext() {
  return Boolean(
    state.customerView === "homeSchedule"
    || state.customerHomeScheduleSheetCategoryId
    || state.customerHomeDurationSheetOpen
    || state.customerHomeDurationSheetCategoryId
    || state.customerHomeCategorySheetOpen
    || (!state.cart.length && state.customerHomeCategorySheetId)
  );
}

function customerAvailabilityLocationClusterIds() {
  if (customerAvailabilityUsesHomeCategoryContext()) {
    const clusterId = String(state.selectedLocation?.clusterId || "");
    return clusterId ? [clusterId] : [];
  }
  return customerCartLocationClusterIds();
}

function invalidateCustomerAvailabilityDecision() {
  customerAvailabilityRequestId += 1;
  state.customerAvailabilityDecision = null;
  state.customerAvailabilityDecisionContext = null;
  state.customerAvailabilityLoading = false;
  state.customerAvailabilityError = "";
}

function customerAvailabilityCategoryId() {
  const homeCategoryId = state.customerHomeScheduleSheetCategoryId || state.customerHomeDurationSheetCategoryId || state.customerHomeCategorySheetId || "";
  const useHomeCategory = state.customerView === "homeSchedule"
    || state.customerHomeDurationSheetOpen
    || state.customerHomeDurationSheetCategoryId
    || state.customerHomeCategorySheetOpen
    || (!state.cart.length && homeCategoryId);
  if (useHomeCategory && homeCategoryId) return homeCategoryId;
  const first = state.cart[0] || {};
  return first.sourceCategoryId || first.categoryId || state.selectedCategoryId || null;
}

function customerAvailabilityServiceId() {
  const homeCategoryId = state.customerHomeScheduleSheetCategoryId || state.customerHomeDurationSheetCategoryId || state.customerHomeCategorySheetId || "";
  const useHomeCategory = state.customerView === "homeSchedule"
    || state.customerHomeDurationSheetOpen
    || state.customerHomeDurationSheetCategoryId
    || state.customerHomeCategorySheetOpen
    || (!state.cart.length && homeCategoryId);
  if (useHomeCategory && homeCategoryId) {
    const category = customerHomeCategoryById(homeCategoryId) || customerCategoryById(homeCategoryId) || {};
    return categoryServiceId(category) || customerPersonalAssistantService()?.id || state.selectedServiceId || selectedService()?.id || "";
  }
  return customerCartServiceId() || customerCartServiceIds()[0] || selectedService()?.id || state.selectedServiceId || "";
}

function customerAvailabilityDurationMinutes() {
  if (state.customerView === "homeSchedule") {
    const selectedDuration = customerHomeScheduleSelectedDuration();
    if (selectedDuration) return Math.max(1, Math.round(Number(selectedDuration.durationMinutes || selectedDuration.timeDurationMinutes || 30)));
  }
  if (state.customerHomeDurationSheetOpen || state.customerHomeDurationSheetCategoryId || (state.customerHomeCategorySheetId && !state.cart.length)) {
    const selectedDuration = customerHomeDurationSheetSelectedOption();
    if (selectedDuration) return Math.max(1, Math.round(Number(selectedDuration.durationMinutes || selectedDuration.timeDurationMinutes || 30)));
  }
  return Math.max(1, Math.round(Number(cartTotals().duration || 30)));
}

function customerAvailabilityDecisionContext() {
  const selectedLocation = state.selectedLocation || {};
  const duration = customerAvailabilityDurationMinutes();
  const serviceId = customerAvailabilityServiceId();
  const categoryId = customerAvailabilityCategoryId() || "";
  const locationClusters = customerAvailabilityLocationClusterIds().sort();
  const cartSignature = state.cart
    .map((item, index) => `${index}:${item.itemType || "item"}:${item.serviceId || ""}:${item.categoryId || ""}:${item.storeId || ""}`)
    .sort()
    .join("|") || `home:${state.customerHomeScheduleSheetCategoryId || state.customerHomeDurationSheetCategoryId || state.customerHomeCategorySheetId || ""}:${state.selectedHomeScheduleDurationId || ""}:${state.selectedHomeDurationId || ""}`;

  return `${String(selectedLocation.clusterId || "")}|${String(locationClusters.join(","))}|${String(serviceId || "")}|${String(categoryId || "")}|${duration}|${cartSignature}`;
}

function customerAvailabilityDecisionIsCurrent() {
  return Boolean(
    state.customerAvailabilityDecision
    && state.customerAvailabilityDecisionContext === customerAvailabilityDecisionContext()
  );
}

function customerInstantSlaAvailable() {
  if (!customerAvailabilityDecisionIsCurrent()) return false;
  const decision = state.customerAvailabilityDecision || {};
  if (decision.instantAllowed === false || decision.instantAvailable === false) return false;
  const estimate = Number(
    decision.instantEstimatedAssignMinutes
    ?? decision.assistantAvailableInMinutes
    ?? decision.finalAssistantAvailableInMinutes
  );
  const limit = Number(
    decision.instantWaitLimitMinutes
    ?? decision.availabilityControls?.instantEtaMinutes
    ?? decision.resolvedBookingEngineRule?.instantEtaMinutes
  );
  if (Number.isFinite(estimate) && Number.isFinite(limit) && limit > 0) {
    return estimate <= limit;
  }
  return true;
}

function customerInstantAvailabilityChecking() {
  return Boolean(state.customerAvailabilityLoading);
}

function customerInstantAvailableForCurrentContext() {
  return customerAvailabilityServiceOpen() && customerInstantSlaAvailable();
}

function customerCategoryAllowsInstant(category = {}) {
  const bookingType = customerBookingTypeForCartItem({
    categoryId: category?.id || "",
    sourceCategoryId: category?.id || "",
    serviceId: categoryServiceId(category)
  });
  return Boolean(bookingType?.allowsInstant);
}

function customerAvailabilityServiceOpen() {
  if (!customerAvailabilityDecisionIsCurrent()) return true;
  const decision = state.customerAvailabilityDecision || {};
  return decision.availabilityControls?.instantServiceOpen !== false
    && decision.availabilityControls?.serviceOpen !== false
    && decision.unavailableReason !== "service_closed";
}

function customerScheduleServiceOpen() {
  if (!customerAvailabilityDecisionIsCurrent()) return true;
  const decision = state.customerAvailabilityDecision || {};
  return decision.availabilityControls?.scheduleServiceOpen !== false
    && decision.unavailableReason !== "service_closed";
}

async function refreshCustomerAvailabilityDecision() {
  const selectedLocation = state.selectedLocation || {};
  const serviceId = customerAvailabilityServiceId();
  const categoryId = customerAvailabilityCategoryId();
  const durationMinutes = customerAvailabilityDurationMinutes();
  const homeScheduleReady = state.customerView === "homeSchedule" && Boolean(categoryId) && Boolean(state.selectedHomeScheduleDurationId);
  const homeDurationReady = Boolean(state.customerHomeDurationSheetCategoryId || (state.customerHomeDurationSheetOpen && categoryId));
  const homeCategoryReady = Boolean(categoryId && (state.customerHomeCategorySheetOpen || (!state.cart.length && state.customerHomeCategorySheetId)));
  if ((!state.cart.length && !homeScheduleReady && !homeDurationReady && !homeCategoryReady) || !selectedLocation.clusterId || (!serviceId && !categoryId)) {
    invalidateCustomerAvailabilityDecision();
    return null;
  }
  const context = customerAvailabilityDecisionContext();
  if (!state.customerAvailabilityLoading && state.customerAvailabilityDecision && state.customerAvailabilityDecisionContext === context) {
    return state.customerAvailabilityDecision;
  }
  const requestId = ++customerAvailabilityRequestId;
  state.customerAvailabilityDecisionContext = context;
  state.customerAvailabilityDecision = null;
  state.customerAvailabilityLoading = true;
  state.customerAvailabilityError = "";
  try {
    const instantConfig = customerEffectiveBookingType("instant");
    const payload = await api("/portal/customer/bookings/availability", {
      method: "POST",
      body: JSON.stringify({
        clusterId: selectedLocation.clusterId,
        locationClusterIds: customerAvailabilityLocationClusterIds(),
        serviceId: isUuid(serviceId) ? serviceId : null,
        categoryId: isUuid(categoryId) ? categoryId : null,
        durationMinutes,
        waitWindowMinutes: 0,
        latitude: selectedLocation.latitude ?? null,
        longitude: selectedLocation.longitude ?? null
      })
    });
    if (requestId !== customerAvailabilityRequestId) return state.customerAvailabilityDecision;
    state.customerAvailabilityDecision = payload.data || null;
    state.customerAvailabilityDecisionContext = context;
    return state.customerAvailabilityDecision;
  } catch (error) {
    if (requestId !== customerAvailabilityRequestId) return state.customerAvailabilityDecision;
    state.customerAvailabilityDecision = null;
    state.customerAvailabilityDecisionContext = context;
    state.customerAvailabilityError = error.message || "Unable to check assistant availability.";
    return null;
  } finally {
    if (requestId === customerAvailabilityRequestId) {
      state.customerAvailabilityLoading = false;
    }
  }
}

customerScheduleSummaryHtml = function customerScheduleSummaryHtmlOverride(config = customerEffectiveBookingType("schedule")) {
  ensureCustomerScheduleSelection(config);
  const dates = customerScheduleDates(config);
  const selectedDate = dates.find((date) => date.value === state.selectedScheduleDate);
  const valid = customerScheduleSelectionIsValid(config);
  const dateLabel = selectedDate ? `${selectedDate.label} ${selectedDate.day}` : "Choose day";
  const timeLabel = state.selectedScheduleTime ? customerFormatTime(state.selectedScheduleTime) : "Choose time";
  return `<button class="customer-schedule-summary-card ${valid ? "ready" : ""}" data-disabled-customer-slot-control type="button">
    <span>${customerIcon("calendar")}</span>
    <div>
      <small>${valid ? "Scheduled slot" : "Schedule required"}</small>
      <b>${escapeHtml(valid ? `${dateLabel} Â· ${timeLabel}` : "Choose day and time slot")}</b>
    </div>
    <strong>${valid ? "Change" : "Choose"}</strong>
  </button>`;
};

customerScheduleBottomSheetHtml = function customerScheduleBottomSheetHtmlOverride() {
  return "";
}

function customerPaymentLabel(method = state.selectedPayment) {
  return ({ razorpay: "Online", upi: "UPI", cash: "Cash", card: "Card" }[String(method || "").toLowerCase()] || "Online");
};

function customerPaymentMethodSheetOptionHtml({ value = "", title = "", subtitle = "", icon = "wallet", disabled = false } = {}) {
  const selected = String(state.selectedPayment || "cash").toLowerCase() === String(value || "").toLowerCase();
  return `<button class="customer-payment-mode-option ${selected ? "selected" : ""}" type="button" data-select-review-payment-mode="${escapeHtml(value)}" ${disabled ? "disabled aria-disabled=\"true\"" : ""}>
    <span class="customer-payment-mode-option-icon">${customerIcon(icon)}</span>
    <span class="customer-payment-mode-option-copy">
      <b>${escapeHtml(title)}</b>
      ${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ""}
    </span>
    <span class="customer-payment-mode-radio" aria-hidden="true"></span>
  </button>`;
}

function bookingPaymentAmount(task = {}) {
  const paymentDetails = task.paymentDetails && typeof task.paymentDetails === "object" ? task.paymentDetails : {};
  const metadata = task.metadata || {};
  const raw = task.estimatedAmountPaise
    || task.bookingAmountPaise
    || metadata.paymentAmountPaise
    || metadata.bookingAmountPaise
    || paymentDetails.amountPaise
    || 0;
  const rupees = raw ? Number(raw) / 100 : Number(paymentDetails.amount || metadata.amount || 0);
  return Math.max(0, Number.isFinite(rupees) ? rupees : 0);
}

function upiPaymentUri(amount = 0, note = "") {
  const params = new URLSearchParams({
    pa: zigoPaymentUpiId,
    pn: zigoPaymentPayeeName,
    cu: "INR"
  });
  const numericAmount = Math.max(0, Number(amount || 0));
  if (numericAmount > 0) params.set("am", numericAmount.toFixed(2));
  if (note) params.set("tn", note.slice(0, 80));
  return `upi://pay?${params.toString()}`;
}

function upiQrImageUrl(amount = 0, note = "") {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(upiPaymentUri(amount, note))}`;
}

function assistantPaymentQrCardHtml(task = {}, amount = bookingPaymentAmount(task)) {
  const note = `${customerVisibleBookingId(task)} payment`;
  const qrUrl = upiQrImageUrl(amount, note);
  const upiUri = upiPaymentUri(amount, note);
  return `<div class="assistant-payment-qr-card">
    <img src="${escapeHtml(qrUrl)}" alt="UPI payment QR">
    <div>
      <b>${escapeHtml(money(amount))}</b>
      <span>UPI ID: ${escapeHtml(zigoPaymentUpiId)}</span>
    </div>
    <a class="soft-btn" href="${escapeHtml(upiUri)}">Open UPI</a>
    <button class="primary-btn" data-share-payment-qr data-booking-id="${escapeHtml(task.bookingId || "")}" data-assignment-id="${escapeHtml(task.assignmentId || "")}" data-payment-amount="${escapeHtml(amount)}" data-payment-qr="${escapeHtml(qrUrl)}" data-payment-uri="${escapeHtml(upiUri)}" type="button">Share QR in Chat</button>
  </div>`;
}

customerBottomBookingTabsHtml = function customerBottomBookingTabsHtmlOverride(plan = customerCartBookingTypePlan()) {
  return "";
};

customerBottomScheduleSlotHtml = function customerBottomScheduleSlotHtmlOverride(config = customerEffectiveBookingType("schedule")) {
  return "";
};

customerCartConfirmBarHtml = function customerCartConfirmBarHtmlOverride(totals = cartTotals(), activeBookingType = customerEffectiveBookingType(state.bookingType), confirmLabel = "Pay & Continue") {
  const discount = Number(totals.discountAmount || totals.discount || 0);
  const amount = Number(totals.toPay || 0);
  const total = Number(totals.totalAmount || amount);
  return `<div class="customer-cart-bar cart-confirm-bar">
    <div class="customer-pay-main">
      <div class="customer-pay-meta">
        <span class="customer-pay-mode">${customerIcon("spark")}<b>${escapeHtml(customerBookingTypeLabel(activeBookingType.mode || "instant"))}</b></span>
        <span class="customer-payment-select static">Cash payment</span>
      </div>
      <div class="customer-pay-amount">
        <b><span>â‚¹</span>${escapeHtml(amount.toFixed(0))}</b>
        ${discount > 0 ? `<del>${escapeHtml(money(total))}</del><em>Save ${escapeHtml(money(discount))}</em>` : ""}
      </div>
      <button class="primary-btn customer-pay-submit" type="button" data-confirm-booking ${state.cart.length ? "" : "disabled"}><span>Confirm</span>${customerIcon("chevronRight")}</button>
    </div>
  </div>`;
};

function customerPaymentSheetHtml() {
  if (!state.customerPaymentSheetOpen) return "";
  return `<div class="customer-payment-mode-backdrop" data-review-payment-sheet-backdrop>
    <section class="customer-payment-mode-sheet" role="dialog" aria-modal="true" aria-label="Select Payment Method">
      <button class="customer-payment-mode-handle" type="button" data-close-review-payment-sheet aria-label="Close payment method"></button>
      <h2>Select Payment Method</h2>
      <div class="customer-payment-mode-list">
        ${customerPaymentMethodSheetOptionHtml({ value: "wallet", title: "Zigo Wallet", subtitle: "₹0.00 (ADD MONEY)", icon: "wallet", disabled: true })}
        ${customerPaymentMethodSheetOptionHtml({ value: "cash", title: "Cash", icon: "receipt" })}
        ${customerPaymentMethodSheetOptionHtml({ value: "razorpay", title: state.customerPaymentBusy ? "Opening payment..." : "Online Payment", subtitle: "Cards, UPI, wallet and netbanking", icon: "business", disabled: state.customerPaymentBusy })}
      </div>
    </section>
  </div>`;
}

function customerScheduleSummaryHtml(config = customerEffectiveBookingType("schedule")) {
  ensureCustomerScheduleSelection(config);
  const dates = customerScheduleDates(config);
  const selectedDate = dates.find((date) => date.value === state.selectedScheduleDate);
  const valid = customerScheduleSelectionIsValid(config);
  const dateLabel = selectedDate ? `${selectedDate.label} ${selectedDate.day}` : "Choose day";
  const timeLabel = state.selectedScheduleTime ? customerFormatTime(state.selectedScheduleTime) : "Choose time";
  return `<button class="customer-bottom-schedule-slot ${valid ? "ready" : ""}" data-f7-open-schedule type="button">
    ${customerIcon("calendar")}<span>${escapeHtml(valid ? `${dateLabel} - ${timeLabel}` : "Choose schedule slot")}</span>
  </button>`;
}

function customerScheduleBottomSheetHtml() {
  return "";
}

function customerBottomBookingTabsHtml(plan = customerCartBookingTypePlan()) {
  if (!state.cart.length || (!plan.hasInstant && !plan.hasSchedule)) return "";
  const tabs = [];
  if (plan.hasInstant) tabs.push(`<button class="${state.bookingType === "instant" ? "selected" : ""}" data-customer-booking-type="instant" type="button">${customerIcon("spark")}<span>Instant</span></button>`);
  if (plan.hasSchedule) tabs.push(`<button class="${state.bookingType === "schedule" ? "selected" : ""}" data-customer-booking-type="schedule" type="button">${customerIcon("calendar")}<span>Schedule</span></button>`);
  return `<div class="customer-pay-tabs" role="tablist" aria-label="Booking type">${tabs.join("")}</div>`;
}

function customerBottomScheduleSlotHtml(config = customerEffectiveBookingType("schedule")) {
  if (state.bookingType !== "schedule") return "";
  return customerScheduleSummaryHtml(config);
}

function customerCartConfirmBarHtml(totals = cartTotals(), activeBookingType = customerEffectiveBookingType(state.bookingType), confirmLabel = "Pay & Continue") {
  const plan = customerCartBookingTypePlan();
  const discount = Number(totals.discountAmount || totals.discount || 0);
  const amount = Number(totals.toPay || 0);
  const total = Number(totals.totalAmount || amount);
  return `<div class="customer-cart-bar cart-confirm-bar">
    ${customerBottomBookingTabsHtml(plan)}
    ${customerBottomScheduleSlotHtml(activeBookingType)}
    <div class="customer-pay-main">
      <div class="customer-pay-meta">
        <span class="customer-pay-mode">${activeBookingType.mode === "schedule" ? customerIcon("calendar") : customerIcon("spark")}<b>${escapeHtml(customerBookingTypeLabel(activeBookingType.mode || "instant"))}</b></span>
        <span class="customer-payment-select static">Cash payment</span>
      </div>
      <div class="customer-pay-amount">
        <b><span>Ã¢â€šÂ¹</span>${escapeHtml(amount.toFixed(0))}</b>
        ${discount > 0 ? `<del>${escapeHtml(money(total))}</del><em>Save ${escapeHtml(money(discount))}</em>` : ""}
      </div>
      <button class="primary-btn customer-pay-submit" type="button" data-confirm-booking ${state.cart.length ? "" : "disabled"}><span>Confirm</span>${customerIcon("chevronRight")}</button>
    </div>
  </div>`;
}

customerScheduleSummaryHtml = function customerScheduleSummaryHtmlFinal(config = customerEffectiveBookingType("schedule")) {
  ensureCustomerScheduleSelection(config);
  const dates = customerScheduleDates(config);
  const selectedDate = dates.find((date) => date.value === state.selectedScheduleDate);
  const valid = customerScheduleSelectionIsValid(config);
  const dateLabel = selectedDate ? `${selectedDate.label} ${selectedDate.day}` : "Choose day";
  const timeLabel = state.selectedScheduleTime ? customerFormatTime(state.selectedScheduleTime) : "Choose time";
  return `<button class="customer-bottom-schedule-slot ${valid ? "ready" : ""}" data-f7-open-schedule type="button">
    ${customerIcon("calendar")}<span>${escapeHtml(valid ? `${dateLabel} - ${timeLabel}` : "Choose schedule slot")}</span>
  </button>`;
};

customerScheduleBottomSheetHtml = function customerScheduleBottomSheetHtmlFinal() {
  return "";
};

customerBottomBookingTabsHtml = function customerBottomBookingTabsHtmlFinal(plan = customerCartBookingTypePlan()) {
  if (!state.cart.length || (!plan.hasInstant && !plan.hasSchedule)) return "";
  const tabs = [];
  if (plan.hasInstant) tabs.push(`<button class="${state.bookingType === "instant" ? "selected" : ""}" data-customer-booking-type="instant" type="button">${customerIcon("spark")}<span>Instant</span></button>`);
  if (plan.hasSchedule) tabs.push(`<button class="${state.bookingType === "schedule" ? "selected" : ""}" data-customer-booking-type="schedule" type="button">${customerIcon("calendar")}<span>Schedule</span></button>`);
  return `<div class="customer-pay-tabs ${tabs.length === 1 ? "single" : ""}" role="tablist" aria-label="Booking type">${tabs.join("")}</div>`;
};

customerBottomScheduleSlotHtml = function customerBottomScheduleSlotHtmlFinal(config = customerEffectiveBookingType("schedule")) {
  if (state.bookingType !== "schedule") return "";
  return customerScheduleSummaryHtml(config);
};

customerCartConfirmBarHtml = function customerCartConfirmBarHtmlFinal(totals = cartTotals(), activeBookingType = customerEffectiveBookingType(state.bookingType), confirmLabel = "Pay & Continue") {
  const discount = Number(totals.discountAmount || totals.discount || 0);
  const amount = Number(totals.toPay || 0);
  const total = Number(totals.totalAmount || amount);
  const selectedPayment = String(state.selectedPayment || "cash").toLowerCase() === "razorpay" ? "razorpay" : "cash";
  return `<div class="customer-cart-bar cart-confirm-bar">
    <div class="customer-pay-main">
      <div class="customer-pay-left">
        <button class="customer-payment-mode-field" type="button" data-open-review-payment-sheet aria-label="Change payment mode">
          <span>${escapeHtml(customerPaymentLabel(selectedPayment))} payment</span>
          ${customerIcon("chevronDown")}
        </button>
        <div class="customer-pay-amount">
          <b><span>₹</span>${escapeHtml(amount.toFixed(0))}</b>
          ${discount > 0 ? `<del>${escapeHtml(money(total))}</del><em>Save ${escapeHtml(money(discount))}</em>` : ""}
        </div>
      </div>
      <button class="primary-btn customer-pay-submit" type="button" data-confirm-booking ${state.cart.length ? "" : "disabled"}><span>Confirm</span>${customerIcon("chevronRight")}</button>
    </div>
  </div>`;
};

function customerCartBookingTypeCardHtml() {
  const plan = customerCartBookingTypePlan();
  if (!state.cart.length || (!plan.hasInstant && !plan.hasSchedule)) return "";
  const active = customerEffectiveBookingType(state.bookingType);
  const labels = [...new Set(plan.services
    .map((service) => `${service.categoryName || service.serviceName}: ${customerBookingTypeLabel(service.mode)} - ${customerAssignmentLabel(service.instantMode)}`)
    .filter(Boolean))];
  return `<section class="content-section compact-section customer-cart-booking-type-section">
    <div class="customer-cart-section-head">
      <h2>Booking Type</h2>
      <span>${escapeHtml(customerAssignmentLabel(active.instantMode))}</span>
    </div>
    ${customerBottomBookingTabsHtml(plan)}
    ${labels.length ? `<p>${escapeHtml(labels.join(" | "))}</p>` : ""}
    ${state.bookingType === "schedule" ? customerScheduleSummaryHtml(customerEffectiveBookingType("schedule")) : ""}
  </section>`;
}

function customerServiceLocationRule(serviceId = "") {
  const service = customerServiceById(serviceId) || selectedService() || {};
  const limit = Math.max(1, Math.round(numberValue(service.maxLocationsLimit, 1)));
  const locationMode = limit > 1 || service.locationMode === "multi" ? "multi" : "current";
  return {
    serviceId: String(service.id || service.serviceId || serviceId || ""),
    serviceName: service.name || service.serviceName || "Service",
    locationMode,
    maxLocationsLimit: locationMode === "multi" ? limit : 1
  };
}

function customerCategoryLocationRule(itemOrCategory = {}) {
  const source = itemOrCategory || {};
  const categoryId = String(source.categoryId || source.id || state.selectedCategoryId || "");
  const category = customerHomeCategoryById(categoryId) || customerCategoryById(categoryId) || {};
  const rawMode = String(
    source.locationMode
    || source.location_mode
    || source.bookingLocationMode
    || category.locationMode
    || category.location_mode
    || category.config?.categorySettings?.locationMode
    || ""
  ).toLowerCase();
  const rawLimit = numberValue(
    source.maxLocationsLimit
    ?? source.max_locations_limit
    ?? source.maxLocations
    ?? source.max_locations
    ?? source.allowedLocations
    ?? source.allowed_locations
    ?? category.maxLocationsLimit
    ?? category.max_locations_limit
    ?? category.config?.categorySettings?.maxLocationsLimit
    ?? category.config?.categorySettings?.max_locations_limit,
    1
  );
  const isMulti = rawMode === "multi" || rawMode.includes("multiple") || rawLimit > 1;
  const limit = isMulti ? Math.max(2, Math.round(rawLimit || 2)) : 1;
  return {
    categoryId: String(category.id || category.categoryId || categoryId || ""),
    categoryName: source.categoryName || source.name || category.name || "Category",
    locationMode: isMulti ? "multi" : "current",
    maxLocationsLimit: limit
  };
}

function customerCartLocationRequirement() {
  const categoryItems = state.cart.filter((item) => item?.categoryId);
  const categoryRules = categoryItems.length
    ? categoryItems.map(customerCategoryLocationRule)
    : [customerCategoryLocationRule(selectedCategory() || {})];
  const validRules = categoryRules.filter((rule) => rule.categoryId || rule.categoryName);
  const rules = validRules.length ? validRules : [customerServiceLocationRule(state.selectedServiceId || selectedService()?.id || "")];
  const maxLocations = Math.max(1, ...rules.map((rule) => Math.max(1, Number(rule.maxLocationsLimit || 1))));
  return {
    mode: maxLocations > 1 ? "multi" : "current",
    maxLocations,
    serviceRules: rules,
    categoryRules: rules
  };
}

function customerNormalizeCartLocationStop(location = {}, index = 0, isPrimary = false) {
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const serviceability = location.serviceability || {};
  const cluster = serviceability.cluster || location.cluster || {};
  return {
    addressId: location.savedAddressId || location.addressId || location.id || null,
    label: location.label || location.name || location.title || (isPrimary ? "Start point" : `Stop ${index + 1}`),
    address: location.address || location.addressText || location.label || "",
    metadata: location.metadata || null,
    landmark: location.landmark || location.additionalDetail || location.metadata?.landmark || location.metadata?.additionalDetail || "",
    personName: location.personName || location.nameOnAddress || location.metadata?.personName || location.metadata?.nameOnAddress || "",
    contactNumber: location.contactNumber || location.mobile || location.phone || location.metadata?.contactNumber || location.metadata?.mobile || "",
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    clusterId: cluster.clusterId || location.clusterId || "",
    clusterName: cluster.name || location.clusterName || "",
    cityName: cluster.cityName || location.cityName || "",
    zoneName: cluster.zoneName || location.zoneName || "",
    source: location.source || (location.savedAddressId || location.addressId ? "saved" : "manual"),
    serviceability: location.serviceability || null,
    sequence: index + 1,
    isPrimary
  };
}

function customerCartLocationKey(stop = {}) {
  if (stop.addressId) return `address:${stop.addressId}`;
  const latitude = Number(stop.latitude);
  const longitude = Number(stop.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) return `pin:${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  return `address:${String(stop.address || "").trim().toLowerCase()}`;
}

function customerPrimaryCartLocationStop() {
  if (state.customerRoutePrimaryCleared && !state.customerRoutePrimaryStop) return null;
  const source = state.customerRoutePrimaryStop || state.selectedLocation;
  if (!source) return null;
  const stop = customerNormalizeCartLocationStop(source, 0, true);
  return stop.address && stop.clusterId ? stop : null;
}

function syncCustomerCartLocationStops() {
  const requirement = customerCartLocationRequirement();
  const primary = customerPrimaryCartLocationStop();
  const seen = new Set(primary ? [customerCartLocationKey(primary)] : []);
  const maxExtraStops = Math.max(0, requirement.maxLocations - (primary ? 1 : 0));
  state.customerLocationStops = normalizeArray(state.customerLocationStops)
    .map((stop, index) => customerNormalizeCartLocationStop(stop, index + 1, false))
    .filter((stop) => stop.address && stop.clusterId && stop.latitude !== null && stop.longitude !== null)
    .filter((stop) => {
      const key = customerCartLocationKey(stop);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxExtraStops);
}

function customerCartLocationStopsForPayload() {
  syncCustomerCartLocationStops();
  const primary = customerPrimaryCartLocationStop();
  const stops = primary ? [primary, ...state.customerLocationStops] : [...state.customerLocationStops];
  return stops.map((stop, index) => ({
    ...stop,
    sequence: index + 1,
    isPrimary: index === 0
  }));
}

function customerCartLocationLabel(index, total) {
  if (index === 0) return "Start point";
  if (total > 1 && index === total - 1) return "End point";
  return `Stop ${index}`;
}

function customerCartLocationCard(stop = {}, index = 0, total = 1) {
  const removable = index > 0;
  return `<article class="customer-route-stop">
    <span>${escapeHtml(index + 1)}</span>
    <div>
      <strong>${escapeHtml(customerCartRouteTitle(stop, customerCartLocationLabel(index, total)))}</strong>
      <small>${escapeHtml(locationShortAddress(stop))}</small>
      ${stop.clusterName ? `<em>${escapeHtml(stop.clusterName)}</em>` : ""}
    </div>
    ${removable ? `<button data-remove-customer-cart-location-stop="${escapeHtml(index)}" type="button" aria-label="Remove stop">${customerIcon("trash")}</button>` : ""}
  </article>`;
}

function customerCartRouteTitle(stop = {}, fallback = "Location") {
  return customerDisplayLocationLabel(stop) || stop.label || stop.name || stop.title || fallback;
}

function customerCartRouteMobile(stop = {}) {
  const raw = stop.contactNumber || stop.mobile || stop.phone || stop.metadata?.contactNumber || "";
  const mobile = customerDisplayMobile10(raw);
  return mobile || "";
}

function customerCartRouteCoordinates(stop = {}) {
  const latitude = Number(stop.latitude);
  const longitude = Number(stop.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "";
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function customerLocationUuid(value = "") {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function customerLocationValidationSource(source = "") {
  const normalized = String(source || "").trim().toLowerCase();
  return new Set(["current", "map", "search", "reverse", "manual", "coordinates", "saved"]).has(normalized)
    ? normalized
    : "map";
}

function customerCartRouteDetailAddress(stop = {}) {
  const landmark = String(stop.landmark || stop.additionalDetail || stop.metadata?.landmark || stop.metadata?.additionalDetail || "").trim();
  const address = locationShortAddress(stop);
  const coordinates = customerCartRouteCoordinates(stop);
  return [landmark, address, coordinates].filter(Boolean).join(", ");
}

function customerCartRouteSummaryHtml(stops = [], canAdd = false, maxLocations = 1, mode = "current") {
  const start = stops[0] || {};
  const end = stops[stops.length - 1] || start;
  const stopCount = Math.max(0, stops.length - 1);
  const startTitle = customerCartRouteTitle(start, "Start point");
  const isMulti = mode === "multi" && maxLocations > 1;
  const showAddStops = Boolean(isMulti && canAdd && stops.length < Number(maxLocations || 1));
  if (!isMulti || stops.length <= 1) {
    return `<div class="customer-route-summary-card current-only single-location">
      <span class="customer-route-dot start" aria-hidden="true"></span>
      <span class="customer-route-summary-copy start">
        <b>${escapeHtml(startTitle)}</b>
        <small>${escapeHtml(locationShortAddress(start))}</small>
      </span>
      <span></span>
      ${showAddStops ? `<button class="customer-route-add-stop" data-open-cart-stop-picker type="button">Add Stops</button>` : ""}
    </div>`;
  }
  const endTitle = stopCount ? customerCartRouteTitle(end, "End point") : "Add stop";
  const middleStopCount = Math.max(0, stops.length - 2);
  return `<div class="customer-route-summary-card ${stopCount ? "has-stops" : ""}">
    <span class="customer-route-dot start" aria-hidden="true"></span>
    <span class="customer-route-summary-copy start">
      <b>${escapeHtml(startTitle)}</b>
      <small>${escapeHtml(locationShortAddress(start))}</small>
    </span>
    <span class="customer-route-connector ${middleStopCount ? "" : "no-stops"}" aria-hidden="true"><i></i>${middleStopCount ? `<b>${escapeHtml(middleStopCount)} Stop${middleStopCount === 1 ? "" : "s"}</b>` : ""}<i></i></span>
    <span class="customer-route-dot end" aria-hidden="true"></span>
    <span class="customer-route-summary-copy end">
      <b>${escapeHtml(endTitle)}</b>
      <small>${escapeHtml(stopCount ? locationShortAddress(end) : `${Math.max(0, maxLocations - stops.length)} stops available`)}</small>
    </span>
    ${stopCount ? `<button class="customer-route-expand" data-toggle-cart-route-details type="button" aria-expanded="${state.customerCartRouteExpanded ? "true" : "false"}" aria-label="${state.customerCartRouteExpanded ? "Hide route details" : "Show route details"}">${customerIcon(state.customerCartRouteExpanded ? "chevronUp" : "chevronDown")}</button>` : `<span></span>`}
    ${showAddStops ? `<button class="customer-route-add-stop" data-open-cart-stop-picker type="button">Add Stops</button>` : ""}
  </div>`;
}

function customerCartRouteDetailsHtml(stops = []) {
  if (!stops.length) return "";
  return `<div class="customer-route-detail-list">
    ${stops.map((stop, index) => {
      const isStart = index === 0;
      const isEnd = index === stops.length - 1;
      const mobile = customerCartRouteMobile(stop);
      const personName = String(stop.personName || stop.metadata?.personName || "").trim();
      const titleExtra = [personName, mobile].filter(Boolean).join(personName && mobile ? " | " : "");
      return `<article class="customer-route-detail-row ${isStart ? "start" : isEnd ? "end" : "middle"}" data-route-stop-index="${escapeHtml(index)}" data-edit-customer-cart-location-stop="${escapeHtml(index)}" role="button" tabindex="0" aria-label="Change route location">
        <span class="customer-route-detail-marker">${isStart || isEnd ? "" : escapeHtml(index)}</span>
        <span class="customer-route-detail-copy">
          <b>${escapeHtml(customerCartRouteTitle(stop, customerCartLocationLabel(index, stops.length)))}${titleExtra ? ` <em>${escapeHtml(titleExtra)}</em>` : ""}</b>
          <small>${escapeHtml(customerCartRouteDetailAddress(stop))}</small>
        </span>
        <button data-open-customer-cart-route-delete="${escapeHtml(index)}" type="button" aria-label="Remove stop">${customerIcon("trash")}</button>
      </article>`;
    }).join("")}
  </div>`;
}

function customerCartSavedLocationButtons(canAdd = true) {
  const addresses = normalizeArray(state.customerAddresses)
    .map((address, index) => ({ address, index }))
    .filter((item) => Number.isFinite(Number(item.address.latitude)) && Number.isFinite(Number(item.address.longitude)));
  if (!addresses.length || !canAdd) return "";
  return `<div class="customer-saved-stop-strip">
    ${addresses.slice(0, 8).map((item) => `<button data-add-customer-saved-stop="${escapeHtml(item.index)}" type="button">
      <b>${escapeHtml(item.address.label || "Saved")}</b>
      <small>${escapeHtml(locationShortAddress(item.address))}</small>
    </button>`).join("")}
  </div>`;
}

function customerCartLocationResultsHtml(canAdd = true) {
  if (!canAdd) return "";
  const results = normalizeArray(state.customerCartLocationResults);
  if (!results.length && !state.customerCartLocationBusy && !state.customerCartLocationMessage) return "";
  return `<div class="customer-cart-location-results">
    ${state.customerCartLocationBusy ? `<p>Searching locations...</p>` : ""}
    ${!state.customerCartLocationBusy && state.customerCartLocationMessage ? `<p>${escapeHtml(state.customerCartLocationMessage)}</p>` : ""}
    ${results.map((result, index) => `<button data-add-customer-cart-location-result="${escapeHtml(index)}" type="button">
      <b>${escapeHtml(result.label || result.name || "Location")}</b>
      <small>${escapeHtml(locationShortAddress(result))}</small>
    </button>`).join("")}
  </div>`;
}

function customerCartLocationsHtml() {
  const requirement = customerCartLocationRequirement();
  const stops = customerCartLocationStopsForPayload();
  const canAdd = requirement.mode === "multi" && stops.length < requirement.maxLocations;
  const selectedServiceNames = requirement.serviceRules.map((rule) => rule.categoryName || rule.serviceName).filter(Boolean).join(", ") || "selected category";
  const ruleText = requirement.maxLocations > 1
    ? `${requirement.maxLocations} locations allowed for ${selectedServiceNames}.`
    : `Current location only for ${selectedServiceNames}.`;
  const expanded = state.customerCartRouteExpanded && stops.length > 0;
  return `<div class="customer-cart-locations ${expanded ? "is-expanded" : ""}">
    <div class="customer-route-head">
      <div>
        <h2>Locations</h2>
        <p>${escapeHtml(ruleText)}</p>
      </div>
      ${requirement.maxLocations > 1 ? `<span>${escapeHtml(stops.length)} / ${escapeHtml(requirement.maxLocations)}</span>` : ""}
    </div>
    ${stops.length ? `<div class="customer-route-boundary">${customerCartRouteSummaryHtml(stops, canAdd, requirement.maxLocations, requirement.mode)}${expanded ? customerCartRouteDetailsHtml(stops) : ""}</div>` : `<div class="muted customer-route-empty">Pick a serviceable start point before booking.<button class="customer-route-add-stop" data-open-cart-stop-picker type="button">Choose location</button></div>`}
    ${requirement.mode === "multi" && !canAdd ? `<div class="customer-route-limit">${customerIcon("info")} Maximum locations added for this category.</div>` : ""}
    ${customerCartRouteDeletePopupHtml()}
  </div>`;
}

function customerCartRouteDeletePopupHtml() {
  const index = Number(state.customerCartRouteDeleteIndex);
  const stops = customerCartLocationStopsForPayload();
  const stop = Number.isInteger(index) && index >= 0 && index < stops.length ? stops[index] : null;
  if (!stop) return "";
  return `<div class="assistant-confirm-backdrop customer-route-delete-backdrop" role="dialog" aria-modal="true" data-customer-route-delete-backdrop>
    <section class="assistant-confirm-card customer-route-delete-card" role="document">
      <button class="customer-modal-close" type="button" data-close-customer-route-delete aria-label="Close">${customerIcon("x")}</button>
      <h3>Delete location?</h3>
      <div class="customer-saved-location-delete-preview">
        <span class="customer-saved-location-icon">${customerIcon("map")}</span>
        <span>
          <b>${escapeHtml(customerCartRouteTitle(stop, "Location"))}</b>
          <em>${escapeHtml(locationShortAddress(stop))}</em>
        </span>
      </div>
      <p>This location will be removed from this booking route only.</p>
      <div class="customer-saved-location-delete-actions">
        <button class="soft-btn" type="button" data-close-customer-route-delete>Cancel</button>
        <button class="danger-btn" type="button" data-confirm-customer-route-delete>${customerIcon("trash")} Delete</button>
      </div>
    </section>
  </div>`;
}

function focusCustomerCartLocationInput() {
  const input = root.querySelector("[data-customer-cart-location-search]");
  if (!(input instanceof HTMLInputElement)) return;
  input.focus();
  const end = input.value.length;
  input.setSelectionRange(end, end);
}

async function validateCustomerCartLocation(candidate = {}) {
  const latitude = Number(candidate.latitude);
  const longitude = Number(candidate.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Selected location has invalid coordinates.");
  const addressId = customerLocationUuid(candidate.savedAddressId || candidate.addressId || candidate.id || "");
  const serviceability = await api("/portal/customer/locations/validate", {
    method: "POST",
    body: JSON.stringify({
      address: candidate.address || candidate.addressText || candidate.label || "Picked location",
      latitude,
      longitude,
      addressId,
      source: customerLocationValidationSource(candidate.source || "search")
    })
  });
  const cluster = serviceability.data?.cluster || {};
  return customerNormalizeCartLocationStop({
    ...candidate,
    address: candidate.address || candidate.addressText || candidate.label || "Picked location",
    latitude,
    longitude,
    addressId: candidate.savedAddressId || candidate.addressId || null,
    clusterId: cluster.clusterId || candidate.clusterId || "",
    clusterName: cluster.name || candidate.clusterName || "",
    cityName: cluster.cityName || candidate.cityName || "",
    zoneName: cluster.zoneName || candidate.zoneName || "",
    serviceability: serviceability.data
  });
}

async function addCustomerCartLocationStop(candidate = {}) {
  const requirement = customerCartLocationRequirement();
  const stops = customerCartLocationStopsForPayload();
  if (stops.length >= requirement.maxLocations) throw new Error(`Maximum ${requirement.maxLocations} locations allowed for this service.`);
  const stop = await validateCustomerCartLocation(candidate);
  if (!stop.clusterId) throw new Error("This location is not in an active working cluster.");
  const primary = customerPrimaryCartLocationStop();
  if (primary?.clusterId && stop.clusterId !== primary.clusterId) {
    throw new Error("All booking locations must be in the same active cluster.");
  }
  const duplicate = stops.some((item) => customerCartLocationKey(item) === customerCartLocationKey(stop));
  if (duplicate) throw new Error("This location is already added to this booking.");
  state.customerRoutePrimaryCleared = false;
  state.customerLocationStops.push(stop);
  state.customerCartLocationQuery = "";
  state.customerCartLocationResults = [];
  state.customerCartLocationMessage = "";
  state.customerCartLocationBusy = false;
  showCustomerCartNotice(`${stop.label || "Location"} added to route.`);
}

async function putCustomerCartLocationStop(candidate = {}) {
  const editIndex = Number(state.customerCartRouteEditIndex);
  if (Number.isInteger(editIndex) && editIndex >= 0) {
    return replaceCustomerCartLocationStop(editIndex, candidate);
  }
  return addCustomerCartLocationStop(candidate);
}

async function replaceCustomerCartLocationStop(index, candidate = {}) {
  const stops = customerCartLocationStopsForPayload();
  const replaceIndex = Number(index);
  if (!Number.isInteger(replaceIndex) || replaceIndex < 0 || replaceIndex >= stops.length) {
    throw new Error("Choose a valid route location to change.");
  }
  const stop = await validateCustomerCartLocation(candidate);
  if (!stop.clusterId) throw new Error("This location is not in an active working cluster.");
  const remainingStops = stops.filter((_, itemIndex) => itemIndex !== replaceIndex);
  const clusterSource = remainingStops.find((item) => item.clusterId);
  if (clusterSource?.clusterId && stop.clusterId !== clusterSource.clusterId) {
    throw new Error("All booking locations must be in the same active cluster.");
  }
  const duplicate = remainingStops.some((item) => customerCartLocationKey(item) === customerCartLocationKey(stop));
  if (duplicate) throw new Error("This location is already added to this booking.");
  const nextStops = [...stops];
  nextStops[replaceIndex] = stop;
  setCustomerCartRouteOrder(nextStops);
  state.customerCartRouteEditIndex = -1;
  state.customerCartLocationQuery = "";
  state.customerCartLocationResults = [];
  state.customerCartLocationMessage = "";
  state.customerCartLocationBusy = false;
  showCustomerCartNotice(`${stop.label || "Location"} updated in route.`);
  return stop;
}

function scheduleCustomerCartLocationAutocomplete(query) {
  const text = String(query || "").trim();
  state.customerCartLocationQuery = query;
  if (customerCartLocationSearchTimer) clearTimeout(customerCartLocationSearchTimer);
  if (text.length < 3) {
    state.customerCartLocationResults = [];
    state.customerCartLocationBusy = false;
    state.customerCartLocationMessage = text ? "Enter at least 3 characters to search stops." : "";
    render();
    focusCustomerCartLocationInput();
    return;
  }
  const requestId = ++customerCartLocationSearchRequestId;
  state.customerCartLocationBusy = true;
  state.customerCartLocationMessage = "Searching locations...";
  customerCartLocationSearchTimer = setTimeout(async () => {
    try {
      const url = `/portal/customer/locations/search?q=${encodeURIComponent(text)}`;
      const results = await portalCachedGet(url, { cacheKey: url });
      if (requestId !== customerCartLocationSearchRequestId) return;
      state.customerCartLocationResults = results.data || [];
      state.customerCartLocationMessage = state.customerCartLocationResults.length ? "Choose one stop location." : "No matching locations found.";
    } catch (error) {
      if (requestId !== customerCartLocationSearchRequestId) return;
      state.customerCartLocationResults = [];
      state.customerCartLocationMessage = error.message || "Unable to search location.";
    } finally {
      if (requestId === customerCartLocationSearchRequestId) {
        state.customerCartLocationBusy = false;
        render();
        focusCustomerCartLocationInput();
      }
    }
  }, 260);
}

async function clearCustomerCart() {
  if (actor === "customer" && state.token) {
    try {
      const payload = await api("/portal/customer/cart", { method: "DELETE" });
      applyCustomerCartPayload(payload.data, [], "");
    } catch (error) {
      if (Number(error.status) === 401) {
        clearPortalSession();
        render();
        return;
      }
      throw error;
    }
  }
  revokeCustomerCartUploadUrls(state.cartUploads);
  state.cart = [];
  state.customerCartNote = "";
  state.cartUploads = [];
  state.cartUploadPreviewIndex = -1;
  state.cartUploadDeleteIndex = -1;
  state.customerCartDeleteIndex = -1;
  state.customerCartVoiceOpen = false;
  state.customerCartVoiceListening = false;
  state.customerCartVoiceTranscript = "";
  state.customerLocationStops = [];
  state.customerRoutePrimaryStop = null;
  state.customerRoutePrimaryCleared = false;
  state.customerCartRouteEditIndex = -1;
  state.customerCartRouteDeleteIndex = -1;
  state.customerCartLocationQuery = "";
  state.customerCartLocationResults = [];
  state.customerCartLocationBusy = false;
  state.customerCartLocationMessage = "";
  state.selectedScheduleDate = "";
  state.selectedScheduleTime = "";
  state.selectedSchedulePeriod = "";
  state.customerScheduleSheetOpen = false;
  state.customerPaymentSheetOpen = false;
  syncCustomerCartResourceCache([], "");
  writePortalSessionCache();
}

function revokeCustomerCartUploadUrls(files = []) {
  for (const file of files || []) {
    if (file?.previewUrl && String(file.previewUrl).startsWith("blob:")) {
      try {
        URL.revokeObjectURL(file.previewUrl);
      } catch (error) {
        /* noop */
      }
    }
  }
}

function customerCartUploadEntryFromFile(file, index = 0) {
  const name = String(file?.name || `Upload ${index + 1}`);
  const previewUrl = file ? URL.createObjectURL(file) : "";
  return {
    id: `${name}-${Number(file?.size || 0)}-${Number(file?.lastModified || Date.now())}-${index}-${Date.now()}`,
    file,
    name,
    type: String(file?.type || "application/octet-stream"),
    size: Number(file?.size || 0),
    previewUrl
  };
}

function formatFileSize(size = 0) {
  const value = Number(size || 0);
  if (!Number.isFinite(value) || value <= 0) return "Unknown size";
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

function customerCartCanAddService(serviceId = "") {
  const currentServiceId = customerCartServiceId();
  return !state.cart.length || !currentServiceId || !serviceId || String(currentServiceId) === String(serviceId);
}

function customerCartCategoryIndex(categoryId = "") {
  return state.cart.findIndex((item) => String(item.categoryId || "") === String(categoryId || "") && !item.storeId);
}

function customerCartDirectCategoryCountForService(serviceId = "") {
  return state.cart.filter((item) =>
    !item.storeId &&
    (item.itemType === "category" || (!item.itemType && item.categoryId && item.priceType !== "time")) &&
    (!serviceId || String(item.serviceId || "") === String(serviceId))
  ).length;
}

function customerDirectCategoryLimitStatus(serviceId = "") {
  const rule = customerCategoryGroupRule(serviceId);
  if (!rule) return { limited: false, limit: Infinity, count: customerCartDirectCategoryCountForService(serviceId), reached: false };
  const maxCategoriesAllowed = customerCategoryGroupPricing(rule).maxCategoriesAllowed;
  const count = customerCartDirectCategoryCountForService(serviceId);
  if (maxCategoriesAllowed === "all") return { limited: false, limit: Infinity, count, reached: false };
  const limit = Math.max(1, Number(maxCategoriesAllowed || 1));
  return { limited: true, limit, count, reached: count >= limit };
}

function customerCategoryLimitMessage(status = {}, serviceName = "this service") {
  return `Category limit is exceed, only ${status.limit} ${status.limit === 1 ? "category is" : "categories are"} allowed for ${serviceName}`;
}

function customerCartStoreIndex(storeId = "") {
  return state.cart.findIndex((item) => String(item.storeId || "") === String(storeId || ""));
}

function customerRepriceStoreCartItems() {
  const categoryStorePositions = new Map();
  state.cart = state.cart.map((item) => {
    if (!item.storeId) return item;
    const categoryId = String(item.categoryId || "");
    const position = (categoryStorePositions.get(categoryId) || 0) + 1;
    categoryStorePositions.set(categoryId, position);
    const store = customerStoreById(item.storeId);
    const category = customerCategoryById(categoryId) || storeCategory(store || {}) || {};
    const pricing = customerStorePricingForPosition(store || item, category, position);
    if (pricing.error || Number(pricing.selling || 0) <= 0) return { ...item, storeNumber: position };
    return {
      ...item,
      price: pricing.selling || item.price || 0,
      durationMinutes: pricing.durationMinutes || item.durationMinutes || categoryDurationMinutes(category || {}),
      cartDurationMinutes: pricing.cartDurationMinutes ?? pricing.durationMinutes ?? item.cartDurationMinutes ?? item.durationMinutes ?? categoryDurationMinutes(category || {}),
      basePrice: pricing.base || item.basePrice || 0,
      saveAmount: Math.max(0, numberValue(pricing.base, 0) - numberValue(pricing.selling, 0)),
      complexityMultiplier: pricing.complexityMultiplier || 0,
      complexityDurationMinutes: pricing.complexityDurationMinutes || 0,
      storeNumber: position
    };
  });
}

function customerRemoveActionButton(type, id, label = "Remove") {
  const attr = type === "store" ? "data-remove-cart-store" : "data-remove-cart-category";
  return `<button class="mini-add-btn remove-action" type="button" ${attr}="${escapeHtml(id || "")}">${customerIcon("trash")} ${escapeHtml(label)}</button>`;
}

function customerRequestCartReplace(pending = {}) {
  const currentService = customerServiceById(customerCartServiceId())?.name || state.cart[0]?.serviceName || "current service";
  const nextService = customerServiceById(pending.serviceId)?.name || pending.serviceName || "selected service";
  state.customerCartReplace = { ...pending, currentService, nextService };
  render();
}

function resetCustomerEmptyCartDetails() {
  if (state.cart.length) return;
  revokeCustomerCartUploadUrls(state.cartUploads);
  state.cartUploads = [];
  state.cartUploadPreviewIndex = -1;
  state.cartUploadDeleteIndex = -1;
  state.customerCartDeleteIndex = -1;
  state.customerCartVoiceOpen = false;
  state.customerCartVoiceListening = false;
  state.customerCartVoiceTranscript = "";
  state.customerLocationStops = [];
  state.customerRoutePrimaryStop = null;
  state.customerRoutePrimaryCleared = false;
  state.customerCartRouteEditIndex = -1;
  state.customerCartRouteDeleteIndex = -1;
  state.customerCartLocationQuery = "";
  state.customerCartLocationResults = [];
  state.customerCartLocationBusy = false;
  state.customerCartLocationMessage = "";
  state.selectedScheduleDate = "";
  state.selectedScheduleTime = "";
  state.selectedSchedulePeriod = "";
  state.customerScheduleSheetOpen = false;
  state.customerPaymentSheetOpen = false;
}

function customerCartReplaceModal() {
  const pending = state.customerCartReplace;
  if (!pending) return "";
  return `<div class="assistant-confirm-backdrop customer-cart-replace-backdrop" role="dialog" aria-modal="true">
    <div class="assistant-confirm-card customer-cart-replace-card">
      <small>Review Booking</small>
      <h2>Replace selected service?</h2>
      <p>You can review multiple categories or stores from one service only. Your current booking has <b>${escapeHtml(pending.currentService)}</b>. Replace it with <b>${escapeHtml(pending.nextService)}</b>.</p>
      <div class="assistant-confirm-actions">
        <button class="soft-btn" data-cancel-cart-replace type="button">No</button>
        <button class="primary-btn" data-confirm-cart-replace type="button">Replace</button>
      </div>
    </div>
  </div>`;
}

async function customerCompletePendingCartReplace() {
  const pending = state.customerCartReplace;
  if (!pending) return;
  state.customerCartReplace = null;
  await clearCustomerCart();
  if (pending.type === "store") {
    await addStoreToCart(pending.storeId, pending.categoryId || "");
    return;
  }
  if (pending.type === "category") await addCategoryToCart(pending.categoryId);
}

function customerStoreById(storeId = "") {
  return activeCatalog().stores.find((item) => String(item.id || "") === String(storeId || "")) || null;
}

function customerStoreHoursText(store = {}, category = {}) {
  const raw = store.workingDays || store.workingHours || store.operatingHours || store.storeOperatingHours || category.storeOperatingHours;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  const weeklyText = customerStoreScheduleSummary(raw);
  if (weeklyText) return weeklyText;
  const rows = normalizeArray(raw);
  if (!rows.length) return store.timing || store.timings || "Timing not configured";
  return rows.map((row) => {
    if (typeof row === "string") return row;
    const day = row.day || row.days || row.weekDay || row.weekday || "Open";
    const start = row.startTime || row.openTime || row.from || "";
    const end = row.endTime || row.closeTime || row.to || "";
    return `${day}${start || end ? `: ${[start, end].filter(Boolean).join(" - ")}` : ""}`;
  }).filter(Boolean).join(", ");
}

function customerTimeMinutes(value) {
  const raw = String(value || "").trim().replace(/\s+/g, " ");
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = String(match[3] || "").toUpperCase();
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0 || minutes > 59) return null;
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "AM") hours = hours === 12 ? 0 : hours;
    if (meridiem === "PM") hours = hours === 12 ? 12 : hours + 12;
  } else if (hours < 0 || hours > 23) {
    return null;
  }
  return (hours * 60) + minutes;
}

function customerScheduleForDay(schedule = {}, day = "") {
  if (!schedule || typeof schedule !== "object") return [];
  const value = schedule[day] || schedule[day.charAt(0).toUpperCase() + day.slice(1)] || null;
  const rows = Array.isArray(value) ? value : value ? [value] : [];
  return rows.filter((row) => row && typeof row === "object");
}

function customerStoreScheduleSummary(schedule = {}) {
  if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) return "";
  const activeDays = customerWeekDays.filter((day) => customerScheduleForDay(schedule, day).some((row) => row.enabled));
  if (!activeDays.length) return "";
  const first = customerScheduleForDay(schedule, activeDays[0]).find((row) => row.enabled) || {};
  const sameTime = activeDays.every((day) => {
    const row = customerScheduleForDay(schedule, day).find((item) => item.enabled) || {};
    return String(row.openTime || row.startTime || "") === String(first.openTime || first.startTime || "")
      && String(row.closeTime || row.endTime || "") === String(first.closeTime || first.endTime || "");
  });
  const open = first.openTime || first.startTime || "";
  const close = first.closeTime || first.endTime || "";
  const timeText = open || close ? `${open || "--:--"}-${close || "--:--"}` : "";
  if (activeDays.length === 7 && sameTime) return `All days${timeText ? ` ${timeText}` : ""}`;
  return `${activeDays.length} working day${activeDays.length === 1 ? "" : "s"}${sameTime && timeText ? ` ${timeText}` : ""}`;
}

function customerStoreScheduleIsOpenNow(schedule = {}, now = new Date()) {
  if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) return null;
  const day = customerWeekDays[(now.getDay() + 6) % 7];
  const slots = customerScheduleForDay(schedule, day).filter((row) => row.enabled);
  if (!slots.length) return false;
  const current = (now.getHours() * 60) + now.getMinutes();
  return slots.some((slot) => {
    const open = customerTimeMinutes(slot.openTime || slot.startTime || slot.from);
    const close = customerTimeMinutes(slot.closeTime || slot.endTime || slot.to);
    if (open == null && close == null) return true;
    if (open == null || close == null) return false;
    if (open === close) return true;
    if (open < close) return current >= open && current <= close;
    return current >= open || current <= close;
  });
}

function customerStoreDetailModal() {
  const store = customerStoreById(state.customerStoreDetailId);
  if (!store) return "";
  const category = storeCategory(store) || {};
  const service = customerServices().find((item) => String(item.id || "") === categoryServiceId(category));
  const labels = storeMetaLabels(store);
  const online = customerStoreIsOnline(store);
  const pricing = customerStorePricingForPosition(store, category, customerCartStorePosition(store.id, category?.id || ""));
  const phone = String(store.contact || store.phone || store.mobile || store.mobileNumber || "").trim();
  const whatsapp = String(store.whatsapp || store.whatsappNumber || phone || "").replace(/[^\d+]/g, "");
  const lat = store.latitude || store.lat;
  const lng = store.longitude || store.lng;
  const mapQuery = lat && lng ? `${lat},${lng}` : (store.address || store.name || "");
  const mapUrl = mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}` : "";
  return `<div class="assistant-confirm-backdrop customer-store-detail-backdrop" role="dialog" aria-modal="true">
    <section class="assistant-confirm-card customer-store-detail-card">
      <button class="customer-modal-close" data-close-store-detail type="button" aria-label="Close">${customerIcon("x")}</button>
      <div class="customer-store-detail-image">
        ${store.primaryImageUrl ? `<img src="${escapeHtml(assetUrl(store.primaryImageUrl))}" alt="${escapeHtml(store.name || "Store")}">` : `<span>${escapeHtml(customerChipLabel(store.name || "Store", ""))}</span>`}
        <i class="${online ? "online" : "offline"}"></i>
      </div>
      <div class="customer-store-detail-title">
        <small class="store-detail-status ${online ? "online" : "offline"}">${online ? "Online" : "Offline"}</small>
        <h3>${escapeHtml(store.name || "Store / Item")}</h3>
        <p>${escapeHtml([service?.name, category?.name].filter(Boolean).join(" / ") || "Store / Item")}</p>
        ${labels.length ? `<div class="store-category-capsules detail">${labels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div>` : ""}
        ${customerStorePriceHtml(pricing)}
      </div>
      <div class="customer-store-detail-actions">
        ${phone ? `<a href="tel:${escapeHtml(phone)}">${customerIcon("call")} Call</a>` : ""}
        ${mapUrl ? `<a href="${escapeHtml(mapUrl)}" target="_blank" rel="noreferrer">${customerIcon("map")} Map</a>` : ""}
        ${whatsapp ? `<a href="https://wa.me/${escapeHtml(whatsapp.replace(/^\+/, ""))}" target="_blank" rel="noreferrer">${customerIcon("whatsapp")} WhatsApp</a>` : ""}
      </div>
      <div class="customer-store-detail-grid">
        <span><small>Address</small><b>${escapeHtml(store.address || "Address not configured")}</b></span>
        <span><small>Contact</small><b>${escapeHtml(phone || "Not configured")}</b></span>
        <span><small>Working days/timing</small><b>${escapeHtml(customerStoreHoursText(store, category))}</b></span>
      </div>
    </section>
  </div>`;
}

async function saveFavorites() {
  state.favorites = normalizeFavorites(state.favorites);
  if (actor !== "customer" || !state.token) return state.favorites;
  const payload = await api("/portal/customer/favorites", {
    method: "PUT",
    body: JSON.stringify(state.favorites)
  });
  state.favorites = normalizeFavorites(payload.data || state.favorites);
  return state.favorites;
}

function isFavorite(type, id) {
  return (state.favorites?.[type] || []).map(String).includes(String(id || ""));
}

async function toggleFavorite(type, id) {
  if (!["services", "categories", "stores"].includes(type) || !id) return;
  const previous = normalizeFavorites(state.favorites);
  const list = new Set((state.favorites[type] || []).map(String));
  const value = String(id);
  const adding = !list.has(value);
  if (adding) list.add(value);
  else list.delete(value);
  state.favorites[type] = Array.from(list);
  render();
  try {
    await saveFavorites();
    notify(adding ? "Added to favourites." : "Removed from favourites.");
  } catch (error) {
    state.favorites = previous;
    notify(error.message || "Unable to update favourites.");
    render();
  }
}

function favoriteButton(type, id) {
  const active = isFavorite(type, id);
  return `<button class="favorite-toggle ${active ? "active" : ""}" data-toggle-favorite data-favorite-type="${escapeHtml(type)}" data-favorite-id="${escapeHtml(id || "")}" type="button" aria-label="${active ? "Remove favourite" : "Add favourite"}">${customerIcon("heart")}</button>`;
}

function withoutFavoriteButton(html) {
  return String(html || "").replace(/<button class="favorite-toggle[\s\S]*?<\/button>/, "");
}

function customerIcon(name, className = "") {
  const icons = {
    search: `<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path>`,
    history: `<path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v5h5"></path><path d="M12 7v5l3 2"></path>`,
    mic: `<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><path d="M12 19v3"></path>`,
    map: `<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle>`,
    business: `<rect x="3" y="7" width="18" height="14" rx="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M3 13h18"></path><path d="M12 12v3"></path>`,
    wallet: `<path d="M19 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6"></path><path d="M16 13h.01"></path>`,
    gift: `<path d="M20 12v10H4V12"></path><path d="M2 7h20v5H2z"></path><path d="M12 22V7"></path><path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7Z"></path><path d="M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7Z"></path>`,
    user: `<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>`,
    home: `<path d="m3 11 9-8 9 8"></path><path d="M5 10v10h14V10"></path><path d="M9 20v-6h6v6"></path>`,
    tasks: `<path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="m3 6 .8.8L5.5 5"></path><path d="m3 12 .8.8 1.7-1.8"></path><path d="m3 18 .8.8 1.7-1.8"></path>`,
    cart: `<path d="M6 6h15l-1.5 8h-13L5 3H2"></path><circle cx="8" cy="20" r="1.5"></circle><circle cx="18" cy="20" r="1.5"></circle>`,
    calendar: `<path d="M8 2v4"></path><path d="M16 2v4"></path><path d="M3 10h18"></path><rect x="3" y="4" width="18" height="18" rx="2"></rect>`,
    clock: `<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>`,
    shield: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"></path><path d="m9 12 2 2 4-5"></path>`,
    bell: `<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path>`,
    chevron: `<path d="m9 18 6-6-6-6"></path>`,
    chevronRight: `<path d="m9 18 6-6-6-6"></path>`,
    chevronDown: `<path d="m6 9 6 6 6-6"></path>`,
    chevronUp: `<path d="m6 15 6-6 6 6"></path>`,
    receipt: `<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"></path><path d="M8 7h8"></path><path d="M8 11h8"></path><path d="M8 15h5"></path>`,
    paperclip: `<path d="m21.4 11.6-8.8 8.8a6 6 0 0 1-8.5-8.5l9.5-9.5a4 4 0 1 1 5.7 5.7l-9.5 9.5a2 2 0 0 1-2.8-2.8l8.8-8.8"></path>`,
    package: `<path d="m7.5 4.3 9 5.2"></path><path d="M21 8.5 12 14 3 8.5"></path><path d="M12 22V14"></path><path d="M3 8.5v7L12 22l9-6.5v-7L12 2 3 8.5Z"></path>`,
    store: `<path d="M4 10h16l-1-6H5l-1 6Z"></path><path d="M5 10v10h14V10"></path><path d="M9 20v-6h6v6"></path>`,
    trash: `<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path>`,
    edit: `<path d="M17.2 3.8a2.1 2.1 0 0 1 3 3L8 19l-4 1 1-4 12.2-12.2Z"></path><path d="m15 6 3 3"></path>`,
    heart: `<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"></path>`,
    percent: `<path d="M19 5 5 19"></path><circle cx="7" cy="7" r="2"></circle><circle cx="17" cy="17" r="2"></circle>`,
    help: `<circle cx="12" cy="12" r="10"></circle><path d="M9.1 9a3 3 0 1 1 5.8 1c-.6 1.1-1.9 1.5-2.5 2.4-.3.4-.4.8-.4 1.6"></path><path d="M12 17h.01"></path>`,
    users: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.9"></path><path d="M16 3.1a4 4 0 0 1 0 7.8"></path>`,
    settings: `<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"></path><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"></path>`,
    call: `<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.4 2.1L8 9.6a16 16 0 0 0 6.4 6.4l1.3-1.3a2 2 0 0 1 2.1-.4c.8.3 1.6.5 2.5.6A2 2 0 0 1 22 16.9Z"></path>`,
    whatsapp: `<path d="M20.5 11.7a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.4-4.9a8.4 8.4 0 1 1 16.1-3.9Z"></path><path d="M8.8 8.5c.2-.5.4-.5.7-.5h.5c.2 0 .4.1.5.4l.7 1.7c.1.3.1.5-.1.7l-.5.6c-.1.1-.2.3-.1.5.4.8 1.1 1.5 2 1.9.2.1.4.1.5-.1l.7-.8c.2-.2.4-.2.7-.1l1.8.8c.3.1.4.3.4.5 0 .5-.3 1.4-.9 1.7-.5.3-1.5.4-3.1-.3-2.6-1.1-4.3-3.7-4.4-3.9-.1-.1-1-1.4-1-2.6 0-1.3.6-2 .9-2.2Z"></path>`,
    plus: `<path d="M12 5v14"></path><path d="M5 12h14"></path>`,
    minus: `<path d="M5 12h14"></path>`,
    back: `<path d="m15 18-6-6 6-6"></path>`,
    x: `<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>`,
    check: `<path d="m5 12 4 4L19 6"></path>`,
    info: `<circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path>`,
    spark: `<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"></path>`
  };
  return `<svg class="customer-lucide ${escapeHtml(className)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.package}</svg>`;
}

function categoryServiceId(category = {}) {
  const direct = String(category.serviceId || category.service_id || category.service?.id || "");
  if (direct) return direct;
  const serviceName = String(category.serviceName || category.service_name || category.service?.name || "").trim().toLowerCase();
  if (!serviceName) return "";
  const rows = [
    ...normalizeArray(state.catalog?.services),
    ...normalizeArray(state.personalAssistantCatalog?.services),
    ...fallbackCatalog().services
  ];
  const service = rows.find((item) => String(item.name || item.serviceName || "").trim().toLowerCase() === serviceName);
  return String(service?.id || service?.serviceId || "");
}

function isPersonalAssistantService(service = {}) {
  const text = `${service.name || ""} ${service.code || ""} ${service.slug || ""} ${service.id || ""}`.toLowerCase();
  return (text.includes("personal") && /assist|assistant|assistance/.test(text)) || text.includes("personal-assistant") || text.includes("personal_assistant");
}

function customerPriceRules() {
  const rows = [
    ...normalizeArray(activeCatalog().priceRules || state.catalog.priceRules),
    ...normalizeArray(customerPersonalAssistantCacheCatalog().priceRules)
  ];
  const seen = new Set();
  return rows.filter((rule) => {
    const key = String(rule.id || `${rule.priceType || ""}:${rule.serviceId || ""}:${rule.categoryId || ""}:${rule.storeId || ""}:${rule.scopeType || ""}:${rule.clusterId || ""}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function customerCategoryPriceRules() {
  const rows = [
    ...normalizeArray(activeCatalog().categoryPriceRules || state.catalog.categoryPriceRules),
    ...normalizeArray(customerPersonalAssistantCacheCatalog().categoryPriceRules)
  ];
  const seen = new Set();
  return rows.filter((rule) => {
    const key = String(rule.id || `${rule.scopeType || ""}:${rule.categoryId || ""}:${rule.timeDurationMinutes || ""}:${rule.sellingPrice || ""}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeCustomerCatalogCategoryPricing(catalog = {}) {
  const normalized = normalizeCustomerCatalog(catalog || {});
  const mergeById = (currentRows = [], incomingRows = [], fallbackKey) => {
    const map = new Map();
    [...normalizeArray(currentRows), ...normalizeArray(incomingRows)].forEach((row) => {
      const key = String(row.id || fallbackKey(row));
      if (!key) return;
      map.set(key, row);
    });
    return [...map.values()];
  };
  state.catalog = {
    ...state.catalog,
    categories: mergeById(state.catalog.categories, normalized.categories, (item) => `category:${item.categoryId || item.name || ""}`),
    masterCategories: mergeById(state.catalog.masterCategories, normalized.masterCategories, (item) => `master:${item.categoryId || item.name || ""}`),
    categoryPriceRules: mergeById(
      state.catalog.categoryPriceRules,
      normalized.categoryPriceRules,
      (item) => `${item.scopeType || "all"}:${item.clusterId || ""}:${item.categoryId || ""}:${item.timeDurationMinutes || ""}:${item.sellingPrice || ""}`
    )
  };
  rememberCustomerPersonalAssistantCatalog(state.catalog, selectedCustomerClusterId());
  writePortalSessionCache();
  return state.catalog;
}

async function refreshCustomerCategoryDurationData(categoryId = "") {
  const targetCategoryId = String(categoryId || "").trim();
  const clusterId = selectedCustomerClusterId();
  if (!targetCategoryId || !clusterId) return customerHomeCategoryPriceDurationOptions(targetCategoryId, { availableFor: "duration" });
  const url = customerCatalogUrl({ clusterId, categoryId: targetCategoryId });
  const payload = await portalCachedGet(url, {
    cacheKey: customerCatalogCacheKey(url),
    forceRefresh: true,
    maxAgeMs: 0
  });
  mergeCustomerCatalogCategoryPricing(payload.data || {});
  return customerHomeCategoryPriceDurationOptions(targetCategoryId, { availableFor: "duration" });
}

function customerPriceScopeRank(rule = {}) {
  return ({ all: 1, state: 2, city: 3, zone: 4, cluster: 5 }[rule.scopeType || "all"] || 1);
}

function customerRuleMatchesCurrentCluster(rule = {}) {
  const clusterId = selectedCustomerClusterId();
  return rule.scopeType !== "cluster" || !clusterId || String(rule.clusterId || "") === String(clusterId);
}

function customerCategoryGroupPricing(ruleOrMetadata = {}) {
  const source = ruleOrMetadata.metadata?.categoryGroupPricing || ruleOrMetadata.categoryGroupPricing || {};
  const slabs = normalizeArray(source.slabs);
  return {
    enabled: Boolean(source.enabled),
    maxCategoriesAllowed: source.maxCategoriesAllowed === "all" || source.maxCategoriesAllowed === undefined ? "all" : Math.max(1, Number(source.maxCategoriesAllowed || 1)),
    slabs: slabs
      .map((slab) => {
        const waitingCharge = customerTrackWaitingChargeFromSource(slab.waitingCharge || slab.allottedTime || slab)
          || { enabled: false, amount: 0, chargePerMinutes: 0 };
        return {
          categoryId: String(slab.categoryId || ""),
          categoryName: String(slab.categoryName || ""),
          basePrice: numberValue(slab.basePrice, 0),
          discountType: ["percent", "flat", "none"].includes(slab.discountType) ? slab.discountType : "none",
          discountValue: numberValue(slab.discountValue, 0),
          sellingPrice: numberValue(slab.sellingPrice ?? slab.basePrice, 0),
          durationMinutes: numberValue(slab.durationMinutes || slab.allottedTime?.durationMinutes, 0),
          allottedTime: {
            enabled: Boolean(slab.allottedTime?.enabled),
            durationMinutes: numberValue(slab.allottedTime?.durationMinutes, 0)
          },
          waitingCharge
        };
      })
      .filter((slab) => slab.categoryId)
  };
}

function customerCategoryGroupRule(serviceId = selectedService()?.id || "") {
  if (!serviceId) return null;
  const categoryIds = new Set(serviceCategories(serviceId).map((category) => String(category.id || "")));
  const pricedSlabCount = (rule) => customerCategoryGroupPricing(rule).slabs
    .filter((slab) => (!categoryIds.size || categoryIds.has(String(slab.categoryId))) && numberValue(slab.sellingPrice, 0) > 0)
    .length;
  return customerPriceRules()
    .filter((rule) =>
      rule.isActive !== false &&
      rule.priceType === "task" &&
      String(rule.serviceId || "") === String(serviceId) &&
      customerCategoryGroupPricing(rule).enabled &&
      customerRuleMatchesCurrentCluster(rule)
    )
    .slice()
    .sort((a, b) => pricedSlabCount(b) - pricedSlabCount(a) || customerPriceScopeRank(b) - customerPriceScopeRank(a))
    [0] || null;
}

function customerUsesCategoryOnlyTaskMode(serviceId = selectedService()?.id || "") {
  const service = customerServiceById(serviceId);
  return Boolean(customerCategoryGroupRule(serviceId)) || isPersonalAssistantService(service || {});
}

function customerCategoryGroupSlab(categoryId = "", serviceId = selectedService()?.id || "") {
  const rule = customerCategoryGroupRule(serviceId);
  return customerCategoryGroupPricing(rule || {}).slabs.find((slab) => String(slab.categoryId || "") === String(categoryId || "")) || null;
}

function customerMatchingPriceRules(priceType = "task", categoryId = "", serviceId = selectedService()?.id || "", storeId = "", includeStoreSpecific = false) {
  return customerPriceRules().filter((rule) => {
    if (rule.isActive === false || rule.priceType !== priceType) return false;
    if (serviceId && String(rule.serviceId || "") !== String(serviceId)) return false;
    if (categoryId && String(rule.categoryId || "") !== String(categoryId)) return false;
    if (!includeStoreSpecific && rule.storeId) return false;
    if (includeStoreSpecific && storeId && rule.storeId && String(rule.storeId) !== String(storeId)) return false;
    return customerRuleMatchesCurrentCluster(rule);
  });
}

function customerBestPriceRule(priceType = "task", categoryId = "", serviceId = selectedService()?.id || "", storeId = "", includeStoreSpecific = false) {
  return customerMatchingPriceRules(priceType, categoryId, serviceId, storeId, includeStoreSpecific)
    .slice()
    .sort((a, b) =>
      customerPriceScopeRank(b) - customerPriceScopeRank(a) ||
      (storeId ? (String(b.storeId || "") === String(storeId) ? 1 : 0) - (String(a.storeId || "") === String(storeId) ? 1 : 0) : 0) ||
      (b.storeId ? 1 : 0) - (a.storeId ? 1 : 0)
    )[0] || null;
}

function customerNormalizeTimeSlabs(slabs = []) {
  return normalizeArray(slabs)
    .filter((slab) => slab?.isActive !== false && slab?.is_active !== false && slab?.active !== false)
    .map((slab) => {
      const durationMinutes = Math.max(1, Math.round(Number(slab.durationMinutes || slab.duration_minutes || 0)));
      const basePrice = numberValue(slab.basePrice ?? slab.price ?? slab.sellingPrice, 0);
      const sellingPrice = numberValue(slab.sellingPrice ?? slab.price ?? basePrice, basePrice);
      return {
        label: String(slab.label || "").trim() || `${durationMinutes} min`,
        durationMinutes,
        basePrice,
        sellingPrice,
        price: sellingPrice,
        discountType: slab.discountType || "none",
        discountValue: numberValue(slab.discountValue, 0)
      };
    })
    .filter((slab) => slab.durationMinutes > 0)
    .sort((a, b) => a.durationMinutes - b.durationMinutes);
}

function customerTimeSlotItems(serviceId = selectedService()?.id || "") {
  if (!serviceId) return [];
  return customerMatchingPriceRules("time", "", serviceId)
    .flatMap((rule) => {
      const category = activeCatalog().categories.find((item) => String(item.id || "") === String(rule.categoryId || ""));
      return customerNormalizeTimeSlabs(rule.timeSlabs).map((slab) => ({
        id: `time:${rule.id}:${rule.categoryId || "service"}:${slab.durationMinutes}`,
        serviceId,
        categoryId: rule.categoryId || "",
        ruleId: rule.id,
        name: slab.label,
        categoryName: rule.categoryName || category?.name || "Time service",
        basePrice: slab.basePrice,
        sellingPrice: slab.sellingPrice,
        durationMinutes: slab.durationMinutes,
        priceType: "time",
        timeSlab: slab
      }));
    })
    .sort((a, b) => Number(a.durationMinutes || 0) - Number(b.durationMinutes || 0));
}

function customerPersonalAssistantTimeSlotItems(serviceId = customerPersonalAssistantService()?.id || "") {
  if (!serviceId) return [];
  const strictTimeSlots = customerTimeSlotItems(serviceId);
  if (strictTimeSlots.length) return strictTimeSlots;
  return customerPriceRules()
    .filter((rule) =>
      rule.isActive !== false &&
      String(rule.serviceId || "") === String(serviceId) &&
      customerRuleMatchesCurrentCluster(rule)
    )
    .flatMap((rule) => {
      const category = activeCatalog().categories.find((item) => String(item.id || "") === String(rule.categoryId || ""))
        || customerPersonalAssistantCacheCatalog().categories.find((item) => String(item.id || "") === String(rule.categoryId || ""));
      return customerNormalizeTimeSlabs(rule.timeSlabs || rule.metadata?.timeSlabs).map((slab) => ({
        id: `time:${rule.id}:${rule.categoryId || "service"}:${slab.durationMinutes}`,
        serviceId,
        categoryId: rule.categoryId || "",
        ruleId: rule.id,
        name: slab.label,
        categoryName: rule.categoryName || category?.name || "Personal Assistant",
        basePrice: slab.basePrice,
        sellingPrice: slab.sellingPrice,
        durationMinutes: slab.durationMinutes,
        priceType: "time",
        timeSlab: slab
      }));
    })
    .sort((a, b) => Number(a.durationMinutes || 0) - Number(b.durationMinutes || 0));
}

function customerPersonalAssistantGroupSlabItems(serviceId = customerPersonalAssistantService()?.id || "") {
  if (!serviceId) return [];
  return customerPriceRules()
    .filter((rule) =>
      rule.isActive !== false &&
      String(rule.serviceId || "") === String(serviceId) &&
      customerCategoryGroupPricing(rule).enabled &&
      customerRuleMatchesCurrentCluster(rule)
    )
    .flatMap((rule) => customerCategoryGroupPricing(rule).slabs.map((slab) => ({
      id: slab.categoryId || `pa-slab:${rule.id}:${slab.categoryName || slab.durationMinutes}`,
      categoryId: slab.categoryId || "",
      ruleId: rule.id,
      serviceId,
      name: slab.categoryName || personalAssistantDurationLabel(slab),
      categoryName: slab.categoryName || "Personal Assistant",
      basePrice: slab.basePrice,
      sellingPrice: slab.sellingPrice,
      durationMinutes: slab.durationMinutes || slab.allottedTime?.durationMinutes || 30,
      priceType: rule.priceType || "task"
    })))
    .filter((item) => item.id && (item.name || item.durationMinutes))
    .sort((a, b) => Number(a.durationMinutes || 0) - Number(b.durationMinutes || 0) || String(a.name || "").localeCompare(String(b.name || "")));
}

function customerUsesTimeSlotMode(serviceId = selectedService()?.id || "") {
  return customerTimeSlotItems(serviceId).length > 0;
}

function customerRuleDurationMinutes(rule = {}, fallback = 30) {
  const metadata = rule.metadata || {};
  const allotted = metadata.allottedTime || rule.allottedTime || {};
  const timeSlabs = normalizeArray(rule.timeSlabs);
  return numberValue(
    allotted.durationMinutes ||
    metadata.durationMinutes ||
    rule.durationMinutes ||
    rule.timeDurationMinutes ||
    rule.time_duration_minutes ||
    timeSlabs[0]?.durationMinutes,
    fallback
  );
}

function customerCategoryPricing(category = {}) {
  const serviceId = categoryServiceId(category);
  const categoryId = String(category.id || category.categoryId || "");
  const groupSlab = customerCategoryGroupSlab(categoryId, serviceId);
  if (groupSlab && (numberValue(groupSlab.sellingPrice, 0) > 0 || numberValue(groupSlab.basePrice, 0) > 0)) {
    const base = numberValue(groupSlab.basePrice, 0);
    const selling = numberValue(groupSlab.sellingPrice, base);
    return {
      base,
      selling,
      durationMinutes: numberValue(groupSlab.durationMinutes || groupSlab.allottedTime?.durationMinutes, category.durationMinutes || 30),
      allottedTime: groupSlab.allottedTime || { enabled: false, durationMinutes: 0 },
      waitingCharge: groupSlab.waitingCharge || { enabled: false, amount: 0, chargePerMinutes: 0 }
    };
  }
  const priceRule = customerBestPriceRule("task", categoryId, serviceId) || customerBestPriceRule("time", categoryId, serviceId);
  const base = numberValue(priceRule?.basePrice ?? category.basePrice ?? category.base_price, 0);
  const selling = numberValue(priceRule?.sellingPrice ?? category.sellingPrice ?? category.selling_price, base || 0) + (priceRule ? 0 : numberValue(category.additionalCharges || 0));
  const defaultPrice = activeCatalog().isFallback ? 99 : 0;
  return {
    base,
    selling: selling > 0 ? selling : numberValue(category.sellingPrice ?? category.basePrice, defaultPrice),
    durationMinutes: customerRuleDurationMinutes(priceRule || {}, numberValue(category.durationMinutes || category.duration_minutes, 30)),
    allottedTime: priceRule?.metadata?.allottedTime || priceRule?.allottedTime || { enabled: false, durationMinutes: 0 },
    waitingCharge: customerTrackWaitingChargeFromSource(priceRule?.metadata?.allottedTime || priceRule?.allottedTime || priceRule?.metadata || priceRule || {})
  };
}

function customerStorePricing(store = {}, category = null) {
  const categoryRow = category || storeCategory(store) || {};
  const storeRule = customerBestPriceRule("task", categoryRow.id || categoryRow.categoryId || "", categoryServiceId(categoryRow), store.id, true);
  if (storeRule?.storeId) {
    const base = numberValue(storeRule.basePrice, 0);
    return {
      base,
      selling: numberValue(storeRule.sellingPrice, base),
      durationMinutes: customerRuleDurationMinutes(storeRule, categoryDurationMinutes(categoryRow || {})),
      allottedTime: storeRule.metadata?.allottedTime || storeRule.allottedTime || { enabled: false, durationMinutes: 0 },
      waitingCharge: customerTrackWaitingChargeFromSource(storeRule.metadata?.allottedTime || storeRule.allottedTime || storeRule.metadata || storeRule || {})
    };
  }
  return customerCategoryPricing(categoryRow || {});
}

function customerNormalizeComplexitySlabs(slabs = []) {
  return normalizeArray(slabs)
    .map((slab) => ({
      storeNumber: Math.max(0, Number(slab.storeNumber || slab.store_number || 0)),
      multiplier: Math.max(0, Number(slab.multiplier || slab.complexityMultiplier || 0)),
      durationMinutes: Math.max(0, Number(slab.durationMinutes || slab.duration_minutes || 0))
    }))
    .filter((slab) => slab.storeNumber >= 1 && slab.multiplier > 0);
}

function customerStorePricingRule(store = {}, category = null) {
  const categoryRow = category || storeCategory(store) || {};
  const categoryId = String(categoryRow.id || categoryRow.categoryId || "");
  const serviceId = categoryServiceId(categoryRow);
  return customerBestPriceRule("task", categoryId, serviceId, store.id, true)
    || customerBestPriceRule("task", categoryId, serviceId, "", false)
    || null;
}

function customerCartStoreCountForCategory(categoryId = "") {
  return state.cart.filter((item) => item.storeId && String(item.categoryId || "") === String(categoryId || "")).length;
}

function customerCartStoreCountForService(serviceId = "") {
  return state.cart.filter((item) => item.storeId && String(item.serviceId || "") === String(serviceId || "")).length;
}

function customerCartStorePosition(storeId = "", categoryId = "") {
  const stores = state.cart.filter((item) => item.storeId && String(item.categoryId || "") === String(categoryId || ""));
  const index = stores.findIndex((item) => String(item.storeId || "") === String(storeId || ""));
  return index >= 0 ? index + 1 : customerCartStoreCountForCategory(categoryId) + 1;
}

function customerComplexitySlabForStoreNumber(rule = {}, storeNumber = 1) {
  if (!rule || storeNumber <= 1) return null;
  const additionalStoreNumber = Math.max(1, Number(storeNumber || 1) - 1);
  let cursor = 1;
  return customerNormalizeComplexitySlabs(rule.complexitySlabs || rule.metadata?.complexitySlabs)
    .find((slab) => {
      const start = cursor;
      const end = cursor + slab.storeNumber - 1;
      cursor = end + 1;
      return additionalStoreNumber >= start && additionalStoreNumber <= end;
    }) || null;
}

function customerStorePricingForPosition(store = {}, category = null, storeNumber = 1) {
  const basePricing = customerStorePricing(store, category);
  const rule = customerStorePricingRule(store, category);
  const slab = customerComplexitySlabForStoreNumber(rule, storeNumber);
  if (!slab) {
    return storeNumber > 1
      ? {
          ...basePricing,
          selling: 0,
          storeNumber,
          complexityMultiplier: 0,
          error: `No complexity slab found for additional store ${storeNumber - 1}.`
        }
      : { ...basePricing, storeNumber, complexityMultiplier: 0, cartDurationMinutes: basePricing.durationMinutes, complexityDurationMinutes: 0 };
  }
  const complexityBase = rule?.complexityBase === "base" ? "base" : "selling";
  const sourceAmount = numberValue(complexityBase === "base" ? basePricing.base : basePricing.selling, basePricing.selling);
  const selling = Math.max(0, Math.round(sourceAmount * slab.multiplier));
  const complexityDurationMinutes = Math.max(0, Number(slab.durationMinutes || 0));
  return {
    ...basePricing,
    selling,
    durationMinutes: complexityDurationMinutes,
    cartDurationMinutes: complexityDurationMinutes,
    complexityDurationMinutes,
    storeNumber,
    complexityMultiplier: slab.multiplier,
    complexityBase
  };
}

function categoryPrice(category = {}) {
  return customerCategoryPricing(category).selling;
}

function categoryDurationMinutes(category = {}, fallback = 30) {
  return numberValue(customerCategoryPricing(category).durationMinutes || category.durationMinutes || category.duration_minutes || category.timeDurationMinutes || category.time_duration_minutes, fallback);
}

function customerCategoryMaxStoresLimit(category = {}, serviceId = selectedService()?.id || "") {
  const categoryId = String(category.id || category.categoryId || "");
  const directRule = customerBestPriceRule("task", categoryId, serviceId) || customerBestPriceRule("time", categoryId, serviceId);
  const groupRule = customerCategoryGroupRule(serviceId);
  return Math.max(0, Number(directRule?.maxStoresPerCategory || groupRule?.maxStoresPerCategory || category.maxStoresPerCategory || 0));
}

function customerServiceMaxStoresLimit(category = {}, serviceId = selectedService()?.id || "", storeId = "") {
  const categoryId = String(category.id || category.categoryId || "");
  const directRule = customerBestPriceRule("task", categoryId, serviceId, storeId, true)
    || customerBestPriceRule("task", categoryId, serviceId)
    || customerBestPriceRule("time", categoryId, serviceId);
  const groupRule = customerCategoryGroupRule(serviceId);
  return Math.max(0, Number(directRule?.maxStoresTotal || groupRule?.maxStoresTotal || category.maxStoresTotal || 0));
}

function customerCategoryNoStoreNote(category = {}, serviceId = selectedService()?.id || "") {
  const hasChildCategories = categoryDirectChildren(category.id, serviceId).length > 0;
  const hasStores = categoryStores(category.id, serviceId).length > 0;
  if (hasChildCategories || hasStores) return "";
  const limit = customerCategoryMaxStoresLimit(category, serviceId);
  return limit > 0 ? `<span class="category-limit-note">${customerIcon("info")} Max. ${escapeHtml(limit)} stores allowed to add in cart</span>` : "";
}

function customerLimitInfoStrip(limit = 0) {
  const count = Math.max(0, Number(limit || 0));
  return count > 0 ? `<div class="category-limit-note category-limit-strip">${customerIcon("info")} Max. ${escapeHtml(count)} stores allowed to add in cart</div>` : "";
}

function customerCategoryListLimitStrip(categories = [], serviceId = selectedService()?.id || "") {
  const limits = categories
    .filter((category) => !categoryHasDrilldown(category, serviceId))
    .map((category) => customerCategoryMaxStoresLimit(category, serviceId))
    .filter((limit) => Number(limit) > 0);
  return limits.length ? customerLimitInfoStrip(Math.max(...limits)) : "";
}

function customerStoreListLimitStrip(category = {}, serviceId = selectedService()?.id || "") {
  return customerLimitInfoStrip(customerCategoryMaxStoresLimit(category, serviceId));
}

function serviceStartingPrice(service = {}) {
  const catalog = activeCatalog();
  const categories = catalog.categories.filter((category) => categoryServiceId(category) === String(service.id || ""));
  const categoryIds = new Set(categories.map((category) => String(category.id || "")));
  const timePrices = customerTimeSlotItems(service.id || "").map((slot) => numberValue(slot.sellingPrice || slot.price, 0));
  const storePrices = catalog.stores
    .filter((store) => {
      const ids = Array.isArray(store.serviceCategoryIds) ? store.serviceCategoryIds.map(String) : [];
      return ids.some((id) => categoryIds.has(id));
    })
    .map(storePrice);
  const prices = [...timePrices, ...categories.map(categoryPrice), ...storePrices, Number(service.sellingPrice || service.basePrice || 0)]
    .filter((price) => Number.isFinite(price) && price > 0);
  return prices.length ? Math.min(...prices) : Number(service.sellingPrice || service.basePrice || 99);
}

function customerServiceOnlyCategory(service = {}) {
  const serviceId = String(service.id || "");
  const serviceLevelRule = (priceType) => customerPriceRules()
    .filter((rule) =>
      rule.isActive !== false &&
      rule.priceType === priceType &&
      String(rule.serviceId || "") === serviceId &&
      !rule.categoryId &&
      !rule.storeId &&
      customerRuleMatchesCurrentCluster(rule)
    )
    .slice()
    .sort((a, b) => customerPriceScopeRank(b) - customerPriceScopeRank(a))[0] || null;
  const rule = serviceLevelRule("task") || serviceLevelRule("time");
  const selling = numberValue(rule?.sellingPrice ?? service.sellingPrice ?? service.selling_price, serviceStartingPrice(service));
  const base = numberValue(rule?.basePrice ?? service.basePrice ?? service.base_price, selling);
  return {
    id: `${serviceId}-item`,
    serviceId,
    name: service.name || "Service",
    sellingPrice: selling,
    basePrice: base || selling,
    durationMinutes: customerRuleDurationMinutes(rule || {}, numberValue(service.durationMinutes || service.duration_minutes, 30))
  };
}

function storeCategory(store = {}) {
  const ids = Array.isArray(store.serviceCategoryIds) ? store.serviceCategoryIds.map(String) : [];
  return activeCatalog().categories.find((category) => ids.includes(String(category.id))) || null;
}

function storeCategoryInScope(store = {}, categoryId = "", serviceId = selectedService()?.id || "") {
  const scopeIds = new Set(categoryDescendantIds(categoryId, serviceId).map(String));
  const storeIds = Array.isArray(store.serviceCategoryIds) ? store.serviceCategoryIds.map(String) : [];
  return activeCatalog().categories.find((category) => scopeIds.has(String(category.id || "")) && storeIds.includes(String(category.id || "")))
    || storeCategory(store);
}

function storePrice(store = {}) {
  const category = storeCategory(store);
  return customerStorePricing(store, category).selling;
}

function storeMetaLabels(store = {}) {
  const catalog = activeCatalog();
  const categoryIds = new Set(normalizeArray(store.storeCategoryIds).map(String));
  return normalizeArray(catalog.storeCategories)
    .filter((item) => categoryIds.has(String(item.id || "")))
    .map((item) => item.name)
    .filter(Boolean)
    .slice(0, 4);
}

function customerStoreIsOnline(store = {}) {
  if (store.isActive === false) return false;
  const schedule = store.operatingHours || store.operating_hours || store.workingSchedule || store.weeklySchedule || store.storeOperatingHours;
  const scheduleOpen = customerStoreScheduleIsOpenNow(schedule);
  if (scheduleOpen !== null) return scheduleOpen;
  const raw = store.isOnline ?? store.online ?? store.isOpen ?? store.open ?? store.operationalStatus ?? store.status ?? store.isActive;
  if (typeof raw === "boolean") return raw;
  const text = String(raw ?? "").trim().toLowerCase();
  if (!text) return store.isActive !== false;
  return !["offline", "closed", "inactive", "deactive", "deactivated", "disabled"].includes(text);
}

function customerStorePriceHtml(pricing = {}) {
  if (pricing.error) {
    return `<div class="store-price-line"><b>Price required</b></div>`;
  }
  const base = numberValue(pricing.base, 0);
  const selling = numberValue(pricing.selling, base);
  const save = Math.max(0, base - selling);
  const displayMinutes = pricing.cartDurationMinutes ?? pricing.displayDurationMinutes ?? pricing.durationMinutes ?? 30;
  return `<div class="store-price-line">
    ${base > selling && base > 0 ? `<del>${money(base)}</del>` : ""}
    <b>${money(selling)}</b>
    <span>/ ${escapeHtml(customerDurationText(displayMinutes))}</span>
    ${save > 0 ? `<em>Save ${money(save)}</em>` : ""}
  </div>`;
}

function serviceCards() {
  return customerServices().map((service, index) => `<article class="service-card-wrap">
    ${favoriteButton("services", service.id)}
    <button class="service-card ${service.tone || ["tone-yellow", "tone-green", "tone-blue", "tone-peach", "tone-purple"][index % 5]}" data-service-id="${escapeHtml(service.id)}" type="button">
      <div class="service-visual">${service.imageUrl ? `<img src="${escapeHtml(assetUrl(service.imageUrl))}" alt="${escapeHtml(service.name)}">` : escapeHtml(customerChipLabel(service.icon || service.name || "Service", ""))}</div>
      <span>${escapeHtml(service.name)}</span>
      <small>from ${money(serviceStartingPrice(service))}</small>
    </button>
  </article>`).join("");
}

function customerServiceRank(service = {}) {
  const name = String(service.name || "").toLowerCase();
  if (/buy|bring|food|medicine|shopping/.test(name)) return 1;
  if (/forgot/.test(name)) return 2;
  if (/return|pickup|exchange/.test(name)) return 3;
  if (/queue|appointment|standing/.test(name)) return 4;
  if (/health|medical|hospital|care/.test(name)) return 5;
  if (/personal/.test(name) && /assist/.test(name)) return 6;
  if (/nearby|near me/.test(name)) return 7;
  return 50;
}

function customerHomeSortedServices() {
  return [...customerServices()].sort((left, right) =>
    customerServiceRank(left) - customerServiceRank(right) ||
    String(left.name || "").localeCompare(String(right.name || ""))
  );
}

function categoryCatalogCard(category = {}, service = selectedService()) {
  const serviceId = service?.id || categoryServiceId(category);
  const hasDrilldown = categoryHasDrilldown(category, serviceId);
  const price = categoryPrice(category);
  const canAddDirect = !hasDrilldown;
  const isInCart = customerCartCategoryIndex(category.id) >= 0;
  const categoryLimit = canAddDirect ? customerDirectCategoryLimitStatus(serviceId) : { reached: false };
  const categoryLimitReached = canAddDirect && !isInCart && categoryLimit.reached;
  const disabled = category.isActive === false || category.isEnabled === false || category.isVisible === false || (canAddDirect && price <= 0) || categoryLimitReached;
  const disabledLabel = categoryLimitReached ? `Max ${categoryLimit.limit}` : canAddDirect ? "Price required" : "No stores";
  return `<article class="customer-product-card catalog-grid-card ${hasDrilldown ? "has-drilldown" : ""}" data-customer-category-card="${escapeHtml(category.id || "")}" ${hasDrilldown ? `data-open-category-stores="${escapeHtml(category.id)}" role="button" tabindex="0"` : ""}>
    ${favoriteButton("categories", category.id)}
    <div class="product-image">${customerHomeTileVisual(category, "Item")}</div>
    <div>
      <h3>${escapeHtml(category.name)}</h3>
      <p>${escapeHtml((customerServices().find((item) => String(item.id || "") === categoryServiceId(category)) || service)?.name || "Service")}</p>
      <b>${price > 0 ? money(price) : "Price required"}</b>
      <small>${categoryDurationMinutes(category)} min</small>
    </div>
    ${isInCart
      ? customerRemoveActionButton("category", category.id)
      : hasDrilldown
      ? ""
      : canAddDirect && !disabled
        ? `<button class="mini-add-btn" type="button" data-add-category="${escapeHtml(category.id)}">+ ADD</button>`
        : `<button class="mini-add-btn secondary-action" type="button" disabled>${escapeHtml(disabledLabel)}</button>`}
  </article>`;
}

function categoryGridCards(rows = serviceRootCategories(), allowFallback = true) {
  const service = selectedService();
  if (!service) return `<p class="muted">No service selected.</p>`;
  if (!rows.length && !allowFallback) return `<p class="muted">No favourite categories yet.</p>`;
  const list = rows.length ? rows : [{ id: `${service.id}-item`, serviceId: service.id, name: service.name, sellingPrice: 99, durationMinutes: 30 }];
  return `<div class="customer-catalog-grid">${list.map((category) => categoryCatalogCard(category, service)).join("")}</div>`;
}

function storeCatalogCard(store = {}, categoryOverride = null) {
  const category = categoryOverride || storeCategory(store);
  const isInCart = customerCartStoreIndex(store.id) >= 0;
  const cartItem = isInCart ? state.cart[customerCartStoreIndex(store.id)] : null;
  const serviceId = categoryServiceId(category || {}) || selectedService()?.id || "";
  const categoryStoreCount = customerCartStoreCountForCategory(category?.id || "");
  const serviceStoreCount = customerCartStoreCountForService(serviceId);
  const maxStores = customerCategoryMaxStoresLimit(category || {}, serviceId);
  const maxTotalStores = customerServiceMaxStoresLimit(category || {}, serviceId, store.id);
  const limitExceeded = !isInCart && (
    (maxStores > 0 && categoryStoreCount >= maxStores)
    || (maxTotalStores > 0 && serviceStoreCount >= maxTotalStores)
  );
  const storeNumber = customerCartStorePosition(store.id, category?.id || "");
  const pricing = cartItem
    ? { ...customerStorePricingForPosition(store, category, storeNumber), selling: cartItem.price, durationMinutes: cartItem.durationMinutes, cartDurationMinutes: cartItem.cartDurationMinutes }
    : customerStorePricingForPosition(store, category, storeNumber);
  const displayPricing = limitExceeded && pricing.error ? customerStorePricing(store, category) : pricing;
  const priceInvalid = !limitExceeded && (Boolean(pricing.error) || Number(pricing.selling || 0) <= 0);
  const labels = storeMetaLabels(store);
  const online = customerStoreIsOnline(store);
  const categoryLine = category?.name || store.description || "Store / Item";
  const imageHtml = store.primaryImageUrl ? `<img src="${escapeHtml(assetUrl(store.primaryImageUrl))}" alt="${escapeHtml(store.name)}">` : escapeHtml(customerChipLabel(store.name || "Store", ""));
  return `<article class="customer-store-card catalog-grid-card ${online ? "" : "store-offline"}" data-customer-store-card="${escapeHtml(store.id || "")}" data-customer-store-category="${escapeHtml(category?.id || "")}">
    <button class="store-info-button" data-open-store-detail="${escapeHtml(store.id || "")}" type="button" aria-label="View store details">${customerIcon("info")}</button>
    ${favoriteButton("stores", store.id)}
    <button class="product-image store-image store-image-action" data-open-store-detail="${escapeHtml(store.id || "")}" type="button">
      ${imageHtml}
      <span class="store-live-dot ${online ? "online" : "offline"}" title="${online ? "Online" : "Offline"}"></span>
    </button>
    <div>
      <h4>${escapeHtml(store.name || "Store / Item")}</h4>
      <p>${escapeHtml(categoryLine)}</p>
      ${labels.length ? `<div class="store-category-capsules">${labels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div>` : ""}
      ${customerStorePriceHtml(displayPricing)}
    </div>
    ${isInCart
      ? customerRemoveActionButton("store", store.id)
      : online && !priceInvalid
        ? `<button class="mini-add-btn" type="button" data-add-store="${escapeHtml(store.id)}" data-store-category="${escapeHtml(category?.id || "")}">+ ADD</button>`
        : `<button class="mini-add-btn secondary-action" type="button" disabled>${online ? "Price required" : "Offline"}</button>`}
  </article>`;
}

function storeGridCards(rows = serviceStores(), emptyMessage = "No stores/items mapped for this service yet.", categoryContext = null) {
  const stores = rows.length ? rows : [];
  if (!stores.length) return `<p class="muted">${escapeHtml(emptyMessage)}</p>`;
  return `<div class="customer-catalog-grid">${stores.map((store) => storeCatalogCard(store, categoryContext ? storeCategoryInScope(store, categoryContext.id, categoryServiceId(categoryContext)) : null)).join("")}</div>`;
}

function customerStorePageCategorySelector(category = {}, service = selectedService()) {
  const image = customerHomeTileVisual(category, "Category");
  return `<div class="customer-store-category-selector">
    <button class="customer-store-category-image" data-open-category-sheet type="button">${image}</button>
    <button class="customer-store-category-name" data-open-category-sheet type="button">
      <span>${escapeHtml(category.name || service?.name || "Category")}</span>
      <i aria-hidden="true"></i>
    </button>
    ${favoriteButton("categories", category.id)}
  </div>`;
}

function customerCategorySwitchSheet() {
  if (!state.customerCategorySheetOpen || state.customerCatalogTab !== "stores") return "";
  const service = selectedService();
  if (!service) return "";
  const selectedId = String(state.selectedCategoryId || "");
  const seen = new Set();
  const categories = [...serviceRootCategories(service.id), ...serviceCategories(service.id)]
    .filter((category) => {
      const id = String(category.id || "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  return `<div class="customer-category-sheet-backdrop" data-category-sheet-backdrop role="presentation">
    <section class="customer-category-sheet" role="dialog" aria-modal="true" aria-label="Choose category">
      <div class="sheet-handle"></div>
      <header>
        <div><small>${escapeHtml(service.name || "Service")}</small><h3>Choose Category</h3></div>
        <button data-close-category-sheet type="button" aria-label="Close">${customerIcon("x")}</button>
      </header>
      <div class="customer-category-sheet-list">
        ${categories.map((category) => {
          const active = String(category.id || "") === selectedId;
          const image = customerHomeTileVisual(category, "CA");
          return `<button class="${active ? "active" : ""}" data-select-store-category="${escapeHtml(category.id || "")}" type="button">
            <b>${image}</b>
            <span>${escapeHtml(category.name || "Category")}</span>
            <small>${escapeHtml(categoryStores(category.id, service.id).length)} stores</small>
          </button>`;
        }).join("") || `<p class="muted">No categories mapped for this service.</p>`}
      </div>
    </section>
  </div>`;
}

function customerTimeSlotGrid(serviceId = selectedService()?.id || "") {
  const slots = customerTimeSlotItems(serviceId);
  if (!slots.length) return "";
  return `<section class="customer-service-category-block customer-time-slot-block">
    <div class="customer-inline-section-head">
      <small>Durations</small>
      <h3>Select one time slot</h3>
    </div>
    <div class="zigo-pa-category-grid">${slots.map((slot, index) => personalAssistantCategoryCard(slot, index)).join("")}</div>
  </section>`;
}

function customerServiceCategoryBlock(category = {}, service = selectedService()) {
  const serviceId = service?.id || categoryServiceId(category);
  const children = categoryDirectChildren(category.id, serviceId);
  const stores = categoryStores(category.id, serviceId);
  return `<section class="customer-service-category-block">
    ${categoryCatalogCard(category, service)}
    ${children.length ? `<div class="customer-inline-section-head sub"><small>Sub categories</small><h3>${escapeHtml(category.name || "Category")}</h3></div>${categoryGridCards(children, false)}` : ""}
    ${stores.length ? `<div class="customer-inline-section-head sub"><small>Stores / Items</small><h3>${escapeHtml(category.name || "Category")}</h3></div>${storeGridCards(stores, "No stores/items mapped for this category yet.", category)}` : ""}
  </section>`;
}

function customerServiceCatalogList(serviceId = selectedService()?.id || "") {
  const service = customerServiceById(serviceId) || selectedService();
  if (!service) return `<p class="muted">No service selected.</p>`;
  if (customerUsesTimeSlotMode(serviceId)) return customerTimeSlotGrid(serviceId);
  const roots = serviceRootCategories(serviceId);
  const rows = roots.length ? roots : serviceCategories(serviceId);
  if (!rows.length) return categoryGridCards(rows);
  return `${customerCategoryListLimitStrip(rows, serviceId)}${categoryGridCards(rows, false)}`;
}

function customerServiceHasCatalogChoices(serviceId = selectedService()?.id || "") {
  return Boolean(
    customerUsesTimeSlotMode(serviceId) ||
    serviceRootCategories(serviceId).length ||
    serviceCategories(serviceId).length
  );
}

function customerSingleDirectCategoryForService(serviceId = selectedService()?.id || "") {
  if (!serviceId) return null;
  const timeSlots = customerTimeSlotItems(serviceId);
  if (timeSlots.length === 1) return timeSlots[0];
  if (timeSlots.length > 1) return null;
  const roots = serviceRootCategories(serviceId);
  const rows = roots.length ? roots : serviceCategories(serviceId);
  if (rows.length !== 1) return null;
  const category = rows[0];
  return categoryHasDrilldown(category, serviceId) ? null : category;
}

function favoriteServiceGrid() {
  const rows = customerServices().filter((service) => isFavorite("services", service.id));
  if (!rows.length) return `<p class="muted">No favourite services yet.</p>`;
  return `<div class="customer-catalog-grid">${rows.map((service, index) => `<article class="service-card-wrap">
    ${favoriteButton("services", service.id)}
    <button class="service-card ${service.tone || ["tone-yellow", "tone-green", "tone-blue", "tone-peach", "tone-purple"][index % 5]}" data-service-id="${escapeHtml(service.id)}" type="button">
      <div class="service-visual">${service.imageUrl ? `<img src="${escapeHtml(assetUrl(service.imageUrl))}" alt="${escapeHtml(service.name)}">` : escapeHtml(customerChipLabel(service.icon || service.name || "Service", ""))}</div>
      <span>${escapeHtml(service.name)}</span>
      <small>from ${money(serviceStartingPrice(service))}</small>
    </button>
  </article>`).join("")}</div>`;
}

function favoriteCatalogContent() {
  const service = selectedService();
  const serviceId = service?.id || "";
  const categories = serviceCategories(serviceId);
  const favoriteStores = serviceStores(serviceId).filter((store) => isFavorite("stores", store.id));
  if (state.selectedCategoryId) {
    const category = categories.find((item) => String(item.id || "") === String(state.selectedCategoryId || ""));
    const childCategories = categoryDirectChildren(category?.id || "", serviceId).filter((item) => isFavorite("categories", item.id));
    const stores = favoriteStores.filter((store) => categoryStores(category?.id || "", serviceId).some((item) => String(item.id || "") === String(store.id || "")));
    const hasRows = childCategories.length || stores.length;
    return `<div class="customer-category-subhead">
      <button type="button" data-customer-catalog-tab="fav">${customerIcon("back")} Fav Categories</button>
      <div>
        <small>Favourite Stores / Categories</small>
        <h2>${escapeHtml(category?.name || "Category")}</h2>
        <p>${escapeHtml(hasRows ? `${childCategories.length} categories / ${stores.length} stores/items` : "No favourite categories or stores in this category")}</p>
      </div>
    </div>
    ${childCategories.length ? `<h3 class="customer-catalog-heading">Fav Categories</h3>${categoryGridCards(childCategories, false)}` : ""}
    ${stores.length ? `<h3 class="customer-catalog-heading">Fav Stores</h3>${storeGridCards(stores, "No favourite stores/items in this category yet.", category)}` : ""}
    ${hasRows ? "" : `<p class="muted">No favourite categories or stores in this category yet.</p>`}`;
  }
  const categoryRows = categories.filter((category) => {
    if (isFavorite("categories", category.id)) return true;
    return favoriteStores.some((store) => categoryStores(category.id, serviceId).some((item) => String(item.id || "") === String(store.id || "")));
  });
  if (!categoryRows.length) return `<p class="muted">No favourite categories yet.</p>`;
  return `<div class="favorite-panel">
    <div class="customer-catalog-grid favorite-catalog-grid">${categoryRows.map((category) => `<article class="customer-product-card catalog-grid-card has-drilldown" data-open-favorite-category="${escapeHtml(category.id)}" role="button" tabindex="0">
      ${favoriteButton("categories", category.id)}
      <div class="product-image">${customerHomeTileVisual(category, "Item")}</div>
      <div>
        <h3>${escapeHtml(category.name)}</h3>
        <p>${escapeHtml(service?.name || "Service")}</p>
        <b>${categoryPrice(category) > 0 ? money(categoryPrice(category)) : "Price required"}</b>
        <small>${categoryStores(category.id, serviceId).filter((store) => isFavorite("stores", store.id)).length} fav stores/items</small>
      </div>
      <button class="mini-add-btn secondary-action" type="button" data-open-favorite-category="${escapeHtml(category.id)}">View fav stores</button>
    </article>`).join("")}</div>
  </div>`;
}

function categoryStoresContent() {
  const service = selectedService();
  const category = selectedCategory();
  if (!service || !category) return categoryGridCards(serviceCategories(service?.id || ""));
  const stores = categoryStores(category.id, service.id);
  return `${customerStorePageCategorySelector(category, service)}
  <h3 class="customer-store-page-heading">Stores</h3>
  ${storeGridCards(stores, "No stores/items mapped for this category yet.", category)}`;
}

function customerCatalogContent() {
  const service = selectedService();
  const serviceId = service?.id || "";
  if (state.customerCatalogTab === "stores") return categoryStoresContent();
  if (state.customerCatalogTab === "fav") return favoriteCatalogContent();
  return customerServiceCatalogList(serviceId);
}

function cartRows() {
  if (!state.cart.length) {
    return `<div class="customer-empty-cart">
      <div class="customer-empty-cart-icon">${customerIcon("package")}</div>
      <h3>No booking selected</h3>
      <p>Choose a category and duration to review your booking.</p>
    </div>`;
  }
  const bookingType = customerEffectiveBookingType(state.bookingType);
  const bookingTypeMode = bookingType.mode || state.bookingType || "instant";
  const bookingTypeLabel = customerBookingTypeLabel(bookingTypeMode);
  const bookingTypeIcon = bookingTypeMode === "schedule" ? "calendar" : "spark";
  return state.cart.map((item) => {
    const selling = numberValue(item.price ?? item.sellingPrice, 0);
    const base = Math.max(numberValue(item.basePrice, 0), selling + numberValue(item.saveAmount, 0), selling);
    const discount = Math.max(0, base - selling);
    return `<div class="cart-row">
      <div class="cart-thumb">${item.imageUrl || item.categoryImageUrl ? `<img src="${escapeHtml(assetUrl(item.imageUrl || item.categoryImageUrl))}" alt="">` : escapeHtml(customerChipLabel(item.name || "", ""))}</div>
      <div>
        <b>${escapeHtml(item.name)}</b>
        <p class="cart-booking-type-line">${customerIcon(bookingTypeIcon)}<span>${escapeHtml(bookingTypeLabel)}</span></p>
        <span>${escapeHtml(customerDurationText(item.cartDurationMinutes ?? item.durationMinutes))}</span>
      </div>
      <div class="cart-price-stack">
        <strong>${money(selling)}</strong>
        ${base > selling ? `<del>${money(base)}</del>` : ""}
        ${discount > 0 ? `<em>Save ${money(discount)}</em>` : ""}
      </div>
    </div>`;
  }).join("");
}

function customerCartNoteHtml() {
  if (!state.cart.length) return "";
  return `<section class="content-section compact-section customer-cart-note-section">
    <div class="customer-cart-note-card">
      <button class="customer-cart-note-voice-btn" type="button" data-open-cart-note-voice aria-label="Voice note">${customerIcon("mic")}</button>
      <label class="customer-cart-note-label" for="customerCartNoteInput">Notepad</label>
      <textarea id="customerCartNoteInput" class="customer-cart-note-input" data-cart-note-input rows="4" placeholder="Add special requirement, instructions or anything the assistant should know...">${escapeHtml(state.customerCartNote || "")}</textarea>
    </div>
  </section>`;
}

function customerCartVoiceModalHtml() {
  if (!state.customerCartVoiceOpen) return "";
  const supported = Boolean(customerCartSpeechRecognitionCtor());
  return `<div class="assistant-confirm-backdrop customer-cart-voice-backdrop" role="dialog" aria-modal="true" data-cart-voice-backdrop>
    <section class="assistant-confirm-card customer-cart-voice-card" role="document">
      <button class="customer-modal-close" type="button" data-close-cart-note-voice aria-label="Close">${customerIcon("x")}</button>
      <small>Voice note</small>
      <h2>Tap to record</h2>
      <p class="customer-cart-voice-help">${supported ? "Tap once to start recording, tap again to stop and add text." : "Voice input is not supported in this browser."}</p>
      ${state.customerCartVoiceStatus ? `<div class="customer-cart-voice-status">${escapeHtml(state.customerCartVoiceStatus)}</div>` : ""}
      <button class="customer-cart-voice-mic${state.customerCartVoiceListening ? " listening" : ""}" type="button" data-cart-note-voice-toggle ${supported ? "" : "disabled"} aria-label="${state.customerCartVoiceListening ? "Stop recording" : "Start recording"}">
        ${customerIcon("mic")}
        <span>${state.customerCartVoiceListening ? "Recording..." : "Record"}</span>
      </button>
      <div class="customer-cart-voice-live">
        <span>Captured text</span>
        <b>${escapeHtml(state.customerCartVoiceTranscript || "Nothing yet")}</b>
      </div>
      <div class="assistant-confirm-actions">
        <button class="soft-btn" type="button" data-close-cart-note-voice>Cancel</button>
        <button class="primary-btn" type="button" data-cart-voice-apply>Use text</button>
      </div>
    </section>
  </div>`;
}

function customerCartDeleteModalHtml() {
  const index = Number(state.customerCartDeleteIndex);
  const item = Number.isInteger(index) && index >= 0 && index < state.cart.length ? state.cart[index] : null;
  if (!item) return "";
  return `<div class="assistant-confirm-backdrop customer-cart-delete-backdrop" role="dialog" aria-modal="true" data-cart-delete-backdrop>
    <section class="assistant-confirm-card customer-cart-delete-card" role="document">
      <button class="customer-modal-close" type="button" data-close-cart-delete aria-label="Close">${customerIcon("x")}</button>
      <small>Delete item</small>
      <h2>Remove from review?</h2>
      <div class="customer-cart-delete-preview">
        <div class="customer-cart-delete-thumb">${escapeHtml(customerChipLabel(item.name || "", ""))}</div>
        <div class="customer-cart-delete-text">
          <b>${escapeHtml(item.name || "Selected item")}</b>
          <span>${escapeHtml([item.serviceName, item.categoryName, item.storeName].filter(Boolean).join(" / ") || "Selected item")}</span>
        </div>
      </div>
      <p class="customer-cart-delete-note">This item will be removed from your booking review.</p>
      <div class="assistant-confirm-actions">
        <button class="soft-btn" type="button" data-close-cart-delete>Cancel</button>
        <button class="danger-btn" type="button" data-confirm-cart-delete>Delete</button>
      </div>
    </section>
  </div>`;
}

function cartUploadPreviewHtml() {
  const files = Array.isArray(state.cartUploads) ? state.cartUploads : [];
  if (!files.length) return `<p class="muted upload-hint">No uploads attached.</p>`;
  return `<div class="cart-upload-preview">
    ${files.map((file, index) => {
      const type = String(file.type || file.file?.type || "");
      const isImage = type.startsWith("image/");
      const isVideo = type.startsWith("video/");
      const url = String(file.previewUrl || "");
      return `<div class="cart-upload-chip" data-cart-upload-item="${escapeHtml(index)}">
        <button class="cart-upload-chip-main" type="button" data-open-cart-upload-preview="${escapeHtml(index)}">
          ${isImage ? `<img src="${escapeHtml(assetUrl(url))}" alt="${escapeHtml(file.name || `Upload ${index + 1}`)}">` : isVideo ? `<video src="${escapeHtml(assetUrl(url))}" muted playsinline></video>` : `<span>${escapeHtml(String(file.name || "FILE").split(".").pop()?.slice(0, 4).toUpperCase() || "FILE")}</span>`}
          <b>${escapeHtml(file.name || `Upload ${index + 1}`)}</b>
        </button>
        <button class="cart-upload-chip-delete" type="button" aria-label="Delete upload" data-delete-cart-upload="${escapeHtml(index)}">${customerIcon("trash")}</button>
      </div>`;
    }).join("")}
  </div>`;
}

function customerCartUploadPopupHtml() {
  const files = Array.isArray(state.cartUploads) ? state.cartUploads : [];
  const previewIndex = Number(state.cartUploadPreviewIndex);
  const deleteIndex = Number(state.cartUploadDeleteIndex);
  const preview = Number.isInteger(previewIndex) && previewIndex >= 0 && previewIndex < files.length ? files[previewIndex] : null;
  const pendingDelete = Number.isInteger(deleteIndex) && deleteIndex >= 0 && deleteIndex < files.length ? files[deleteIndex] : null;
  if (!preview && !pendingDelete) return "";
  const active = preview || pendingDelete;
  const activeIndex = preview ? previewIndex : deleteIndex;
  const type = String(active.type || active.file?.type || "");
  const isImage = type.startsWith("image/");
  const isVideo = type.startsWith("video/");
  const url = String(active.previewUrl || "");
  const body = preview
    ? `<div class="customer-cart-upload-preview-body">
        ${isImage ? `<img src="${escapeHtml(assetUrl(url))}" alt="${escapeHtml(active.name || "Upload preview")}">` : isVideo ? `<video src="${escapeHtml(assetUrl(url))}" controls playsinline></video>` : `<div class="customer-cart-upload-preview-file">${customerIcon("package")}<b>${escapeHtml((active.name || "FILE").split(".").pop()?.slice(0, 5).toUpperCase() || "FILE")}</b></div>`}
        <div class="customer-cart-upload-preview-meta">
          <b>${escapeHtml(active.name || `Upload ${activeIndex + 1}`)}</b>
          <span>${escapeHtml(active.type || "Unknown type")} â€¢ ${escapeHtml(formatFileSize(active.size || 0))}</span>
        </div>
      </div>`
    : `<div class="customer-cart-upload-preview-body">
        ${isImage ? `<img src="${escapeHtml(assetUrl(url))}" alt="${escapeHtml(active.name || "Upload preview")}">` : isVideo ? `<video src="${escapeHtml(assetUrl(url))}" muted playsinline controls></video>` : `<div class="customer-cart-upload-preview-file delete">${customerIcon("package")}<b>${escapeHtml((active.name || "FILE").split(".").pop()?.slice(0, 5).toUpperCase() || "FILE")}</b></div>`}
        <div class="customer-cart-upload-preview-meta">
          <span>This file will be removed from the booking upload list.</span>
        </div>
      </div>`;
  const actions = preview
    ? `<div class="assistant-confirm-actions">
        <button class="soft-btn" data-close-cart-upload-preview type="button">Close</button>
        <button class="danger-btn" data-open-cart-upload-delete="${escapeHtml(activeIndex)}" type="button">Delete</button>
      </div>`
    : `<div class="assistant-confirm-actions">
        <button class="soft-btn" data-close-cart-upload-delete type="button">Cancel</button>
        <button class="danger-btn" data-confirm-cart-upload-delete type="button">Delete</button>
      </div>`;
  const backdropClass = preview ? "customer-cart-upload-backdrop preview" : "customer-cart-upload-backdrop delete";
  const cardClass = preview ? "assistant-confirm-card customer-cart-upload-card customer-cart-upload-preview-card" : "assistant-confirm-card customer-cart-upload-card customer-cart-upload-delete-card";
  return `<div class="assistant-confirm-backdrop ${backdropClass}" role="dialog" aria-modal="true" ${preview ? "data-cart-upload-preview-backdrop" : "data-cart-upload-delete-backdrop"}>
    <section class="${cardClass}" role="document">
      <button class="customer-modal-close" type="button" ${preview ? "data-close-cart-upload-preview" : "data-close-cart-upload-delete"} aria-label="Close">${customerIcon("x")}</button>
      <small>${preview ? "Preview" : "Delete upload?"}</small>
      <h2>${preview ? "Attachment" : "Confirm deletion"}</h2>
      ${body}
      ${actions}
    </section>
  </div>`;
}

function bottomCartBar() {
  const totals = cartTotals();
  const ongoingBookings = customerHomeOngoingBookings();
  if (state.customerView === "home" && ongoingBookings.length) {
    return `<div class="customer-cart-bar customer-ongoing-task-bar">
      <div class="customer-ongoing-task-slider">
        ${ongoingBookings.map((booking) => {
          const items = customerTrackBookingItems(booking || {});
          const first = items[0] || {};
          const typeInfo = customerTrackBookingTypeInfo(booking);
          const image = String(first.categoryImageUrl || first.category?.imageUrl || first.category?.categoryImageUrl || first.imageUrl || booking.metadata?.categoryImageUrl || booking.categoryDetails?.imageUrl || "").trim();
          const categoryName = first.categoryName || first.name || customerBookingServiceSummary(booking);
          const durationMinutes = Number(booking.durationMinutes || first.durationMinutes || booking.metadata?.durationMinutes || 0) || customerTrackBaseDurationMinutes(booking, items);
          const duration = customerTrackDurationUnitText(durationMinutes);
          return `<button class="customer-ongoing-task-card" type="button" data-track-booking="${escapeHtml(booking.id || "")}">
            <span class="customer-ongoing-task-icon">${image ? `<img src="${escapeHtml(assetUrl(image))}" alt="">` : customerIcon("spark")}</span>
            <span class="customer-ongoing-task-copy">
              <small>${customerTrackIcon(typeInfo.icon)}${escapeHtml(typeInfo.label)}</small>
              <b><span>${escapeHtml(categoryName)}</span><em>${customerTrackIcon("watch")}${escapeHtml(duration)}</em></b>
            </span>
            ${customerTrackTotalTimeHtml(booking, items)}
          </button>`;
        }).join("")}
      </div>
      ${ongoingBookings.length > 1 ? `<div class="customer-ongoing-task-dots" aria-label="Ongoing bookings">${ongoingBookings.map((_, index) => `<button class="${index === 0 ? "active" : ""}" type="button" data-ongoing-task-dot="${index}" aria-label="Show booking ${index + 1}" aria-current="${index === 0 ? "true" : "false"}"></button>`).join("")}</div>` : ""}
    </div>`;
  }
  if (state.customerView === "home") return "";
  if (!state.cart.length || state.customerView === "cart") return "";
  return `<div class="customer-cart-bar ${state.customerView === "home" ? "with-bottom-nav" : ""}">
    <button type="button" data-view="cart"><b>${state.cart.length} Selected</b><span>${escapeHtml(customerDurationText(totals.duration))}</span></button>
    <div><small>To Pay</small><b>${money(totals.toPay)}</b></div>
    <button class="primary-btn" type="button" data-view="cart">Review</button>
  </div>`;
}

function customerCartNoticeHtml() {
  const notice = state.customerCartNotice;
  if (!notice?.message || state.customerView === "cart") return "";
  return `<div class="customer-cart-notice ${state.customerView === "home" ? "with-bottom-nav" : ""} ${escapeHtml(notice.tone || "info")}">${escapeHtml(notice.message)}</div>`;
}

function showCustomerCartNotice(message, tone = "info") {
  if (customerCartNoticeTimer) clearTimeout(customerCartNoticeTimer);
  state.customerCartNotice = message ? { message, tone } : null;
  customerCartNoticeTimer = setTimeout(() => {
    state.customerCartNotice = null;
    refreshCustomerCartNoticeOnly();
  }, 2800);
}

function htmlFirstElement(html = "") {
  const template = document.createElement("template");
  template.innerHTML = String(html || "").trim();
  return template.content.firstElementChild;
}

function refreshCustomerCartNoticeOnly() {
  const current = document.querySelector(".portal-customer .customer-cart-notice");
  const html = customerCartNoticeHtml();
  if (current) {
    if (html) current.replaceWith(htmlFirstElement(html));
    else current.remove();
    return;
  }
  if (!html) return;
  const cartBar = document.querySelector(".portal-customer .customer-cart-bar");
  if (cartBar) {
    cartBar.insertAdjacentElement("beforebegin", htmlFirstElement(html));
    return;
  }
  const app = document.querySelector(".portal-customer .mobile-app");
  if (app) app.appendChild(htmlFirstElement(html));
}

function refreshCustomerCartBarOnly() {
  const current = document.querySelector(".portal-customer .customer-cart-bar");
  const html = bottomCartBar();
  if (current) {
    if (html) current.replaceWith(htmlFirstElement(html));
    else current.remove();
    return;
  }
  if (!html) return;
  const app = document.querySelector(".portal-customer .mobile-app");
  if (!app) return;
  const nav = Array.from(app.children).find((child) => child.matches?.(".bottom-nav, .zigo-native-bottom-nav"));
  if (nav) nav.insertAdjacentElement("beforebegin", htmlFirstElement(html));
  else app.appendChild(htmlFirstElement(html));
}

function replaceCustomerCardControls(currentCard, freshCard) {
  if (!currentCard || !freshCard) return;
  currentCard.className = freshCard.className;
  const currentAction = currentCard.querySelector("[data-add-category], [data-remove-cart-category], [data-add-store], [data-remove-cart-store], .mini-add-btn.secondary-action");
  const freshAction = freshCard.querySelector("[data-add-category], [data-remove-cart-category], [data-add-store], [data-remove-cart-store], .mini-add-btn.secondary-action");
  if (currentAction && freshAction) currentAction.replaceWith(freshAction);
  else if (!currentAction && freshAction) currentCard.appendChild(freshAction);
  else if (currentAction && !freshAction) currentAction.remove();

  const currentPrice = currentCard.querySelector(".store-price-line");
  const freshPrice = freshCard.querySelector(".store-price-line");
  if (currentPrice && freshPrice) currentPrice.replaceWith(freshPrice);
}

function refreshCustomerVisibleCartControls() {
  document.querySelectorAll(".portal-customer [data-customer-home-category-card]").forEach((card) => {
    const categoryId = card.getAttribute("data-customer-home-category-card") || "";
    const category = activeCatalog().categories.find((item) => String(item.id || "") === categoryId)
      || customerPersonalAssistantCategories().find((item) => String(item.id || "") === categoryId);
    if (!category) return;
    const service = customerServiceById(categoryServiceId(category)) || {};
    const index = Number(card.getAttribute("data-home-category-index") || 0);
    const freshCard = htmlFirstElement(customerHomeCategoryTile(category, service, index));
    if (freshCard) card.replaceWith(freshCard);
  });
  document.querySelectorAll(".portal-customer [data-customer-category-card]").forEach((card) => {
    const categoryId = card.getAttribute("data-customer-category-card") || "";
    const category = activeCatalog().categories.find((item) => String(item.id || "") === categoryId)
      || customerPersonalAssistantCategories().find((item) => String(item.id || "") === categoryId);
    if (!category) return;
    const service = customerServiceById(categoryServiceId(category)) || selectedService();
    replaceCustomerCardControls(card, htmlFirstElement(categoryCatalogCard(category, service)));
  });
  document.querySelectorAll(".portal-customer [data-customer-store-card]").forEach((card) => {
    const storeId = card.getAttribute("data-customer-store-card") || "";
    const categoryId = card.getAttribute("data-customer-store-category") || "";
    const store = customerStoreById(storeId);
    if (!store) return;
    const category = activeCatalog().categories.find((item) => String(item.id || "") === categoryId) || storeCategory(store);
    replaceCustomerCardControls(card, htmlFirstElement(storeCatalogCard(store, category)));
  });
}

function refreshCustomerCartUiOnly() {
  customerRepriceStoreCartItems();
  refreshCustomerVisibleCartControls();
  refreshCustomerCartBarOnly();
  refreshCustomerCartNoticeOnly();
}

function refreshCustomerCartConfirmBarOnly() {
  const current = document.querySelector(".portal-customer .cart-confirm-bar");
  if (!current || state.customerView !== "cart") return;
  const totals = cartTotals();
  const activeBookingType = customerEffectiveBookingType(state.bookingType);
  const confirmLabel = state.bookingType === "schedule" ? "Schedule & Confirm" : "Confirm Booking";
  current.replaceWith(htmlFirstElement(customerCartConfirmBarHtml(totals, activeBookingType, confirmLabel)));
  refreshCustomerPaymentSheetOnly();
}

function refreshCustomerPaymentSheetOnly() {
  document.querySelectorAll(".portal-customer .customer-payment-mode-backdrop").forEach((sheet) => sheet.remove());
  if (state.customerView !== "cart" || !state.customerPaymentSheetOpen) return;
  root.insertAdjacentHTML("beforeend", customerPaymentSheetHtml());
}

function refreshCustomerBookingTypeSectionOnly() {
  const current = document.querySelector(".portal-customer .customer-cart-booking-type-section");
  if (!current || state.customerView !== "cart") return;
  const html = customerCartBookingTypeCardHtml();
  if (html) current.replaceWith(htmlFirstElement(html));
  else current.remove();
  refreshCustomerCartConfirmBarOnly();
  removeCustomerRippleArtifacts();
}

async function openCustomerSchedulePage() {
  invalidateCustomerAvailabilityDecision();
  state.bookingType = "schedule";
  state.customerView = "schedule";
  state.customerScheduleSheetOpen = false;
  state.selectedScheduleDate = customerTodayDateValue();
  state.selectedSchedulePeriod = "";
  state.selectedScheduleTime = "";
  ensureCustomerScheduleSelection(customerEffectiveBookingType("schedule"));
  render();
  await refreshCustomerAvailabilityDecision();
  ensureCustomerScheduleSelection(customerEffectiveBookingType("schedule"));
  render();
}

async function refreshCustomerScheduleAvailabilityForSelection(config = customerEffectiveBookingType("schedule")) {
  try {
    await refreshCustomerAvailabilityDecision();
  } catch (error) {
    // Keep UI stable; message surfaces are already shown from state.customerAvailabilityError.
  }
  ensureCustomerScheduleSelection(config);
}

function refreshCustomerSchedulePageCategory(config = customerEffectiveBookingType("schedule")) {
  const categories = customerConfiguredTimeCategories(config);
  const category = categories.find((item) => item.id === state.selectedSchedulePeriod) || categories[0] || null;
  state.selectedSchedulePeriod = category?.id || "";
  const times = customerCategoryTimes(category, config);
  const enabledTimes = times.filter((time) => !customerScheduleTimeDisabled(state.selectedScheduleDate, time));
  if (!enabledTimes.includes(state.selectedScheduleTime)) {
    state.selectedScheduleTime = enabledTimes[0] || "";
  }
}

function refreshCustomerSchedulePickerUi(config = customerEffectiveBookingType("schedule")) {
  const pickerHost = root.querySelector(".customer-schedule-page-body");
  const confirmButton = root.querySelector("[data-action='booking-master-confirm-schedule-booking']");
  if (!pickerHost) return;

  const dateScroller = pickerHost.querySelector(".booking-date-chip-grid");
  const periodScroller = pickerHost.querySelector(".booking-period-tabs");
  const dateScrollLeft = dateScroller ? dateScroller.scrollLeft : 0;
  const periodScrollLeft = periodScroller ? periodScroller.scrollLeft : 0;

  const newHtml = customerSchedulePickerHtml(config) || `<div class="empty-state">No schedule slots configured.</div>`;
  pickerHost.innerHTML = newHtml;

  const updatedDateScroller = pickerHost.querySelector(".booking-date-chip-grid");
  const updatedPeriodScroller = pickerHost.querySelector(".booking-period-tabs");
  if (updatedDateScroller) updatedDateScroller.scrollLeft = dateScrollLeft;
  if (updatedPeriodScroller) updatedPeriodScroller.scrollLeft = periodScrollLeft;

  if (confirmButton) {
    confirmButton.disabled = !customerScheduleSelectionIsValid(config);
  }
}

async function handleCustomerScheduleAdminAction(action = "", button = null, event = null) {
  if (actor !== "customer" || !button) return false;
  if (!button.closest?.(".customer-schedule-screen")) return false;
  const consume = () => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
  };

  if (action === "booking-master-select-schedule-date") {
    consume();
    const config = customerEffectiveBookingType("schedule");
    const date = button.dataset.date || "";
    if (button.disabled || button.classList.contains("disabled") || customerScheduleDateDisabled(config, date)) {
      notify("This date has no available schedule slots.");
      return true;
    }
    if (date) {
      selectCustomerScheduleDateFromChip(date, config);
    } else {
      state.selectedScheduleDate = date;
      ensureCustomerScheduleSelection(config);
    }
    await refreshCustomerScheduleAvailabilityForSelection(config);
    refreshCustomerSchedulePickerUi(config);
    return true;
  }

  if (action === "booking-master-select-schedule-period") {
    consume();
    if (button.disabled || button.classList.contains("disabled")) {
      notify("This time category has no configured slots.");
      return true;
    }
    const config = customerEffectiveBookingType("schedule");
    selectCustomerSchedulePeriodFromChip(button.dataset.period || "morning", config);
    await refreshCustomerScheduleAvailabilityForSelection(customerEffectiveBookingType("schedule"));
    refreshCustomerSchedulePickerUi(config);
    return true;
  }

  if (action === "booking-master-select-schedule-time") {
    consume();
    if (!state.selectedScheduleDate) return true;
    if (!customerScheduleServiceOpen()) {
      notify("Service is currently stopped.");
      return true;
    }
    if (button.disabled || button.classList.contains("disabled")) {
      notify("This time slot is not available.");
      return true;
    }
    state.selectedScheduleTime = button.dataset.time || "";
    const config = customerEffectiveBookingType("schedule");
    ensureCustomerScheduleSelection(config);
    state.customerScheduleSheetOpen = false;
    state.customerView = "cart";
    render();
    return true;
  }

  if (action === "booking-master-confirm-schedule-booking") {
    consume();
    if (!customerScheduleServiceOpen()) {
      notify("Service is currently stopped.");
      return true;
    }
    const config = customerEffectiveBookingType("schedule");
    ensureCustomerScheduleSelection(config);
    if (!customerScheduleSelectionIsValid(config)) {
      notify("Select a schedule date, time category and time slot.");
      refreshCustomerSchedulePickerUi(config);
      return true;
    }
    state.customerScheduleSheetOpen = false;
    state.customerView = "cart";
    render();
    return true;
  }

  return false;
}

function attachCustomerSchedulePageActionListeners(rootElement = root) {
  if (!rootElement) return;
  const scheduleScreen = rootElement.querySelector(".customer-schedule-screen");
  if (!scheduleScreen) return;
  if (scheduleScreen.dataset.customerScheduleActionListener === "1") return;
  scheduleScreen.dataset.customerScheduleActionListener = "1";
  const selector = "[data-action='booking-master-select-schedule-date'], [data-action='booking-master-select-schedule-period'], [data-action='booking-master-select-schedule-time'], [data-action='booking-master-confirm-schedule-booking']";

  const getActionButton = (target) => {
    if (!(target instanceof Element)) return null;
    return target.closest?.(selector) || null;
  };

  const resolveActionButton = (event) => {
    let button = getActionButton(event?.target);
    if (button) return button;
    const composed = typeof event?.composedPath === "function" ? event.composedPath() : [];
    const composedMatch = composed.find((node) => node instanceof Element && getActionButton(node)) || null;
    if (composedMatch) return getActionButton(composedMatch);
    if (typeof event?.clientX === "number" && typeof event?.clientY === "number" && typeof document.elementsFromPoint === "function") {
      const hit = document.elementsFromPoint(event.clientX, event.clientY) || [];
      const hitMatch = hit.find((node) => node instanceof Element && getActionButton(node)) || null;
      if (hitMatch) return getActionButton(hitMatch);
    }
    return null;
  };

  const executeScheduleAction = async (button, event) => {
    const handled = await handleCustomerScheduleAdminAction(button?.dataset?.action || "", button, event);
    if (handled) {
      event?.preventDefault?.();
      event?.stopImmediatePropagation?.();
      event?.stopPropagation?.();
    }
    return !!handled;
  };

  const activePointers = new Map();
  const MIN_MOVE_TO_SCROLL = 10;
  let lastScheduleActionTs = 0;

  const isScheduleTap = (event) => {
    const entry = activePointers.get(event.pointerId);
    if (!entry) return true;
    const moveX = Math.abs((event.clientX || 0) - entry.x);
    const moveY = Math.abs((event.clientY || 0) - entry.y);
    return moveX <= MIN_MOVE_TO_SCROLL && moveY <= MIN_MOVE_TO_SCROLL;
  };

  const dispatchScheduleAction = async (event) => {
    const now = performance.now();
    if (now - lastScheduleActionTs < 320) return false;
    const button = resolveActionButton(event);
    if (!button || !button.closest(".customer-schedule-screen")) return false;
    if (typeof event?.pointerId === "number" && !isScheduleTap(event)) return false;
    const handled = await executeScheduleAction(button, event);
    if (handled) {
      lastScheduleActionTs = now;
    }
    return handled;
  };

  const onPointerDown = (event) => {
    if (!(event.target instanceof Element)) return;
    if (!resolveActionButton(event)) return;
    activePointers.set(event.pointerId, { x: event.clientX || 0, y: event.clientY || 0 });
  };

  const onPointerUp = async (event) => {
    if (!(event.target instanceof Element)) return;
    const hadPointer = activePointers.delete(event.pointerId);
    if (!hadPointer) return;
    await dispatchScheduleAction(event);
  };

  const onPointerCancel = (event) => {
    activePointers.delete(event.pointerId);
  };

  const onClick = async (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.pointerType) return;
    await dispatchScheduleAction(event);
  };

  scheduleScreen.addEventListener("pointerdown", onPointerDown, { passive: true });
  scheduleScreen.addEventListener("pointerup", onPointerUp, { passive: false });
  scheduleScreen.addEventListener("pointercancel", onPointerCancel, { passive: true });
  scheduleScreen.addEventListener("click", onClick, { passive: false });
}

if (typeof window !== "undefined") {
  const invokeCustomerScheduleAction = async (button, event) => {
    const action = button?.dataset?.action || "";
    if (!action) {
      return true;
    }
    const handled = await handleCustomerScheduleAdminAction(action, button, event);
    if (event && handled) {
      event.preventDefault();
    }
    return Boolean(handled);
  };
  window.zigoCustomerScheduleAction = invokeCustomerScheduleAction;
  window.zigoCustomerScheduleSelect = invokeCustomerScheduleAction;
}

function bottomNav(active = state.customerView) {
  if (state.customerView !== "home" || active !== "home") return "";
  return `<nav class="bottom-nav toolbar zigo-native-bottom-nav">
    <button class="nav-item tab-link ${active === "home" ? "active" : ""}" data-view="home" type="button"><b>${customerIcon("home")}</b><span>Home</span></button>
    <button class="nav-item tab-link ${active === "service" ? "active" : ""}" data-view="home" type="button"><b>${customerIcon("tasks")}</b><span>Services</span></button>
    <button class="nav-item tab-link ${active === "cart" ? "active" : ""}" data-view="cart" type="button"><b>${customerIcon("package")}</b><span>Review</span></button>
    <button class="nav-item tab-link ${active === "bookings" || active === "track" ? "active" : ""}" data-view="bookings" type="button"><b>${customerIcon("calendar")}</b><span>Bookings</span></button>
    <button class="nav-item tab-link ${active === "account" ? "active" : ""}" data-view="account" type="button"><b>${customerIcon("user")}</b><span>Account</span></button>
  </nav>`;
}

function locationShortAddress(location = {}) {
  const address = String(location.address || location.addressText || "").trim();
  if (!address) return "Pick your service location";
  return address.length > 76 ? `${address.slice(0, 76)}...` : address;
}

function customerLocationCluster(location = state.locationPicked || state.selectedLocation || {}) {
  const serviceability = state.locationServiceability || location.serviceability || {};
  const cluster = serviceability.cluster || location.cluster || {};
  return {
    clusterId: cluster.clusterId || location.clusterId || "",
    name: cluster.name || location.clusterName || "",
    cityName: cluster.cityName || location.cityName || "",
    zoneName: cluster.zoneName || location.zoneName || ""
  };
}

function customerLocationTitle(location = state.selectedLocation || {}) {
  return customerDisplayLocationLabel(location) || customerLocationCluster(location).name || "Home";
}

function customerCustomerId() {
  return String(state.customerId || state.user?.customerId || state.user?.id || state.user?.userId || "").trim();
}

function customerDisplayLocationLabel(location = {}) {
  const rawLabel = String(location.label || location.name || location.title || "").trim();
  const address = String(location.address || location.addressText || "").trim();
  if (["previous used", "current location"].includes(rawLabel.toLowerCase()) && address) {
    return address.split(",")[0]?.trim() || rawLabel;
  }
  return rawLabel || "Home";
}

function customerDisplayMobile10(value = "") {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function customerLocationsSamePoint(left = {}, right = {}) {
  const leftLat = Number(left?.latitude);
  const leftLng = Number(left?.longitude);
  const rightLat = Number(right?.latitude);
  const rightLng = Number(right?.longitude);
  if (!Number.isFinite(leftLat) || !Number.isFinite(leftLng) || !Number.isFinite(rightLat) || !Number.isFinite(rightLng)) return false;
  return Math.abs(leftLat - rightLat) < 0.00001 && Math.abs(leftLng - rightLng) < 0.00001;
}

function customerNormalizePersistedLocation(location = {}) {
  if (!location || typeof location !== "object") return null;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  return {
    ...location,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    label: customerDisplayLocationLabel(location),
    address: location.address || location.addressText || "",
    clusterId: location.clusterId || location.cluster?.clusterId || location.serviceability?.cluster?.clusterId || "",
    clusterName: location.clusterName || location.cluster?.name || location.serviceability?.cluster?.name || "",
    cityName: location.cityName || location.cluster?.cityName || location.serviceability?.cluster?.cityName || "",
    zoneName: location.zoneName || location.cluster?.zoneName || location.serviceability?.cluster?.zoneName || "",
    source: location.source || "saved"
  };
}

async function customerLoadPreviousUsedLocations({ forceRefresh = false } = {}) {
  if (!state.token || !customerCustomerId()) return [];
  const url = "/portal/customer/previous-used-locations";
  const payload = await api(url).catch(() => ({ data: [] }));
  const locations = normalizeArray(payload?.data)
    .map((location) => customerNormalizePersistedLocation(location))
    .filter(Boolean);
  state.customerRecentLocations = locations;
  return locations;
}

function customerLocationCoordinatesMatch(left = {}, right = {}) {
  const leftLat = Number(left.latitude);
  const leftLng = Number(left.longitude);
  const rightLat = Number(right.latitude);
  const rightLng = Number(right.longitude);
  if (![leftLat, leftLng, rightLat, rightLng].every(Number.isFinite)) return false;
  return Math.abs(leftLat - rightLat) <= 0.00001 && Math.abs(leftLng - rightLng) <= 0.00001;
}

function customerFindDuplicateLocation(location = {}) {
  const normalized = customerNormalizePersistedLocation(location);
  if (!normalized) return null;
  const saved = normalizeArray(state.customerAddresses)
    .map((item) => customerNormalizePersistedLocation(item))
    .find((item) => item && customerLocationCoordinatesMatch(item, normalized));
  if (saved) return { type: "saved", location: saved };
  const recent = normalizeArray(state.customerRecentLocations)
    .map((item) => customerNormalizePersistedLocation(item))
    .find((item) => item && customerLocationCoordinatesMatch(item, normalized));
  if (recent) return { type: "recent", location: recent };
  return null;
}

function assertCustomerLocationNotAlreadySaved(location = {}) {
  if (customerFindDuplicateLocation(location)) {
    throw new Error("Location already used.");
  }
}

function customerLocationAddressId(location = {}) {
  return String(location?.savedAddressId || location?.addressId || location?.id || "").trim();
}

function customerSafeViewName(view = "", fallback = "home") {
  const normalized = String(view || "").trim();
  const allowed = new Set(["home", "account", "bookings", "savedLocations", "search", "cart"]);
  return allowed.has(normalized) ? normalized : fallback;
}

function customerReturnTargetFor(view = "", fallback = "home") {
  return customerSafeViewName(state.customerReturnTargets?.[view], fallback);
}

function customerSetReturnTarget(view = "", target = "") {
  const safeView = customerSafeViewName(view, "");
  const safeTarget = customerSafeViewName(target, "");
  if (!safeView || !safeTarget || safeView === safeTarget) return;
  state.customerReturnTargets = {
    ...(state.customerReturnTargets || {}),
    [safeView]: safeTarget
  };
}

function customerSavedLocationActivityTime(location = {}) {
  const metadata = location?.metadata || {};
  const value = location.lastUsedAt
    || location.last_used_at
    || metadata.lastUsedAt
    || metadata.last_used_at
    || location.updatedAt
    || location.updated_at
    || location.createdAt
    || location.created_at
    || 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function customerSortedSavedLocations(addresses = state.customerAddresses || []) {
  return normalizeArray(addresses).slice().sort((a, b) => {
    const aDefault = Boolean(a?.isDefault);
    const bDefault = Boolean(b?.isDefault);
    if (aDefault !== bDefault) return aDefault ? -1 : 1;
    return customerSavedLocationActivityTime(b) - customerSavedLocationActivityTime(a);
  });
}

function customerSavedLocationDeleteTarget() {
  const id = String(state.customerSavedLocationDeleteId || "");
  if (!id) return null;
  return normalizeArray(state.customerAddresses).find((address) => customerLocationAddressId(address) === id) || null;
}

function customerCurrentLocationAddressId() {
  return customerLocationAddressId(state.locationPicked || state.selectedLocation || {});
}

function customerSaveAsStoredLabel(location = {}) {
  const raw = String(location?.label || location?.addressLabel || "").trim();
  return raw === "Shop" ? "Work" : raw;
}

function customerFindSavedLabelOwner(label = "", excludeAddressId = customerCurrentLocationAddressId()) {
  const normalizedLabel = String(label || "").trim().toLowerCase();
  if (!normalizedLabel) return null;
  return normalizeArray(state.customerAddresses).find((address) => {
    if (excludeAddressId && customerLocationAddressId(address) === excludeAddressId) return false;
    return customerSaveAsStoredLabel(address).toLowerCase() === normalizedLabel;
  }) || null;
}

function customerSaveAsLabelHasBlockingOwner(label = "") {
  const owner = customerFindSavedLabelOwner(label);
  if (!owner) return false;
  const picked = state.locationPicked || state.selectedLocation || {};
  if (customerLocationsSamePoint(owner, picked)) return false;
  return true;
}

function customerSaveAsLabelMessage(label = "") {
  const normalizedLabel = String(label || "").trim();
  if (!normalizedLabel) return "";
  return customerSaveAsLabelHasBlockingOwner(normalizedLabel) ? `${normalizedLabel} is already saved.` : "";
}

async function customerSavePreviousUsedLocation(location = {}) {
  const normalized = customerNormalizePersistedLocation(location);
  if (!state.token || !customerCustomerId() || !normalized) return null;
  if (normalized.savedAddressId || normalized.addressId || normalized.source === "saved") return null;
  if (!Number.isFinite(Number(normalized.latitude)) || !Number.isFinite(Number(normalized.longitude))) return null;
  assertCustomerLocationNotAlreadySaved(normalized);
  const created = await api("/portal/customer/previous-used-locations", {
    method: "POST",
    body: JSON.stringify({
      address: normalized.address || normalized.label || "Picked location",
      latitude: Number(normalized.latitude),
      longitude: Number(normalized.longitude),
      source: normalized.source || "map"
    })
  }).catch(() => null);
  clearPortalResourceCache("/portal/customer/previous-used-locations");
  if (created?.data?.addressId) await customerLoadPreviousUsedLocations({ forceRefresh: true });
  return created?.data || null;
}

async function customerSetDefaultLocationAddress(addressId = "") {
  const id = String(addressId || "").trim();
  if (!state.token || !customerCustomerId() || !id) return null;
  return api(`/portal/customer/addresses/${encodeURIComponent(id)}/default`, { method: "POST" }).catch(() => null);
}

function customerRememberLocation(location = {}, { setPreferred = true, rememberRecent = true } = {}) {
  const normalized = customerNormalizePersistedLocation(location);
  if (!normalized) return null;
  if (rememberRecent) {
    state.customerRecentLocations = [normalized, ...normalizeArray(state.customerRecentLocations)].slice(0, 25);
  }
  return normalized;
}

function customerHydratePreferredLocation({ addresses = [], recentLocations = null, defaultLocation = null, sessionLocation = null } = {}) {
  const persistedRecent = Array.isArray(recentLocations)
    ? normalizeArray(recentLocations).map((location) => customerNormalizePersistedLocation(location)).filter(Boolean)
    : [];
  const savedAddresses = normalizeArray(addresses).map((address) => customerNormalizePersistedLocation(address)).filter(Boolean);
  const hiddenDefault = customerNormalizePersistedLocation(defaultLocation || null);
  const selected = savedAddresses.find((address) => address.isDefault)
    || persistedRecent.find((location) => location.isDefault)
    || (hiddenDefault?.isDefault ? hiddenDefault : null)
    || null;
  state.customerRecentLocations = persistedRecent;
  if (selected) {
    state.selectedLocation = selected;
    state.locationPicked = selected;
    state.locationServiceability = selected.serviceability || null;
    return selected;
  }
  return null;
}

async function customerSaveHiddenDefaultLocation(location = {}) {
  const normalized = customerNormalizePersistedLocation(location);
  if (!state.token || !customerCustomerId() || !normalized) return null;
  if (!Number.isFinite(Number(normalized.latitude)) || !Number.isFinite(Number(normalized.longitude))) return null;
  const payload = await api("/portal/customer/default-location", {
    method: "POST",
    body: JSON.stringify({
      address: normalized.address || normalized.label || "Picked location",
      latitude: Number(normalized.latitude),
      longitude: Number(normalized.longitude),
      landmark: normalized.landmark || normalized.metadata?.landmark || "",
      personName: normalized.personName || normalized.metadata?.personName || state.user?.displayName || "",
      contactNumber: customerDisplayMobile10(normalized.contactNumber || normalized.metadata?.contactNumber || state.user?.phone || ""),
      source: normalized.source || "search"
    })
  });
  clearPortalResourceCache("/portal/customer/addresses");
  clearPortalResourceCache("/portal/customer/default-location");
  return payload?.data || null;
}

function customerLocationHeader() {
  const location = state.selectedLocation || {};
  return `<button class="customer-location-strip" data-change-customer-location type="button">
    <span class="location-pin">L</span>
    <span><b>${escapeHtml(customerLocationTitle(location))}</b><small>${escapeHtml(locationShortAddress(location))}</small></span>
    <strong>Change</strong>
  </button>`;
}

function customerFirstName() {
  return String(state.user?.displayName || "").trim().split(/\s+/)[0] || "there";
}

function customerGreetingLabel() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function customerHomeActiveBooking() {
  const bookings = customerHomeOngoingBookings();
  if (!bookings.length) return "";
  return `<section class="zigo-home-active-booking" aria-label="Ongoing bookings">
    <div class="zigo-home-active-booking-slider">
      ${bookings.map((booking) => {
        const status = customerTrackStatus(booking);
        const statusLabel = customerTrackStatusLabel(status);
        const summary = customerBookingServiceSummary(booking);
        const timestamp = bookingListTimestamp(booking);
        const items = customerTrackBookingItems(booking || {});
        return `<button type="button" data-track-booking="${escapeHtml(booking.id || "")}">
          <span>${customerIcon("spark")}</span>
          <div>
            <small>${escapeHtml(statusLabel)}</small>
            <b>${escapeHtml(summary)}</b>
            <em>${escapeHtml(`${timestamp.day}, ${timestamp.time}`)}</em>
          </div>
          ${customerTrackTotalTimeHtml(booking, items)}
          <strong>Track ${customerIcon("chevron")}</strong>
        </button>`;
      }).join("")}
    </div>
  </section>`;
}

function customerHomeOngoingBookings() {
  const finalStatuses = new Set(["completed", "success", "done", "cancelled", "canceled", "failed", "rejected", "expired"]);
  return normalizeArray(state.bookings)
    .filter((item) => !finalStatuses.has(String(item.statusCode || item.status || item.assignmentStatus || item.metadata?.status || "").toLowerCase()))
    .sort((a, b) => {
      const rank = (booking) => {
        const status = String(customerTrackStatus(booking) || "").toLowerCase();
        if (["working", "in_progress", "on_the_way"].includes(status)) return 0;
        if (["assigned", "accepted"].includes(status)) return 1;
        if (["upcoming", "scheduled", "schedule"].includes(status)) return 2;
        return 3;
      };
      const rankDiff = rank(a) - rank(b);
      if (rankDiff) return rankDiff;
      return new Date(b.bookingStartAt || b.scheduledAt || b.createdAt || 0).getTime() - new Date(a.bookingStartAt || a.scheduledAt || a.createdAt || 0).getTime();
    });
}

function customerHomeOverview() {
  const totals = cartTotals();
  const activeBookings = normalizeArray(state.bookings).filter((item) => !["completed", "cancelled"].includes(customerBookingStatusBucket(item))).length;
  const cluster = customerLocationCluster(state.selectedLocation || {});
  return `<section class="zigo-home-overview" aria-label="Customer summary">
    <button type="button" data-view="cart">
      ${customerIcon("package")}
      <span><b>${state.cart.length || 0}</b><small>${state.cart.length === 1 ? "Selected item" : "Selected items"}</small></span>
      <em>${escapeHtml(money(totals.toPay))}</em>
    </button>
    <button type="button" data-view="bookings">
      ${customerIcon("clock")}
      <span><b>${activeBookings || 0}</b><small>Open tasks</small></span>
      <em>View</em>
    </button>
    <button type="button" data-change-customer-location>
      ${customerIcon("shield")}
      <span><b>${escapeHtml(cluster.name || "Nearby")}</b><small>${escapeHtml(cluster.cityName || "Service area")}</small></span>
      <em>Change</em>
    </button>
  </section>`;
}

function customerHomeHeader() {
  const location = state.selectedLocation || {};
  const title = customerLocationTitle(location);
  const address = locationShortAddress(location);
  return `<section class="zigo-commerce-hero zigo-native-hero">
    <div class="zigo-native-topbar">
      <button class="zigo-native-location" data-change-customer-location type="button">
        <span>${customerIcon("map")}</span>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(address)}</small>
        <em>${customerIcon("chevronDown")}</em>
      </button>
      <div class="zigo-hero-actions">
        <button type="button" data-view="account" aria-label="Account">${customerIcon("user")}</button>
      </div>
    </div>
  </section>`;
}

function customerHomeSearchSuggestions() {
  const suggestions = customerHomeCategories().slice(0, 4);
  if (!suggestions.length) return "";
  return `<div class="zigo-search-suggestions">
    ${suggestions.map((category) => `<button type="button" data-open-home-category-detail="${escapeHtml(category.id || "")}">${escapeHtml(category.name || "Category")}</button>`).join("")}
  </div>`;
}

function customerHomeSearch() {
  return `<div class="zigo-home-search-sticky">
    <button class="zigo-commerce-search zigo-home-search-trigger" data-open-customer-search type="button" aria-label="Search service or item">
      ${customerIcon("search")}
      <div class="zigo-home-search-fake-input" data-customer-home-search aria-hidden="true"></div>
      <div class="zigo-search-placeholder-flip" aria-hidden="true">
        <span>I need help with</span>
        <strong data-customer-home-search-placeholder></strong>
      </div>
      <i aria-hidden="true">${customerIcon("mic")}</i>
    </button>
  </div>`;
}

function customerSearchPlaceholderItems() {
  const names = customerHomeCategories()
    .map((category) => String(category.name || "").trim())
    .filter(Boolean);
  const unique = Array.from(new Set(names));
  return unique.length ? unique : customerSearchPlaceholders;
}

function startCustomerSearchPlaceholderRotation() {
  clearInterval(customerSearchPlaceholderTimer);
  const input = root.querySelector("[data-customer-home-search]");
  const placeholder = root.querySelector("[data-customer-home-search-placeholder]");
  const placeholderWrap = placeholder?.closest(".zigo-search-placeholder-flip");
  if (!input || !placeholder || !placeholderWrap) return;
  const items = customerSearchPlaceholderItems();
  let index = 0;
  const setPlaceholder = () => {
    if (!document.body.contains(input) || !document.body.contains(placeholder)) {
      clearInterval(customerSearchPlaceholderTimer);
      customerSearchPlaceholderTimer = null;
      return;
    }
    placeholder.textContent = items[index % items.length];
    placeholderWrap.classList.remove("is-flipping");
    void placeholderWrap.offsetWidth;
    placeholderWrap.classList.add("is-flipping");
    index += 1;
  };
  setPlaceholder();
  customerSearchPlaceholderTimer = setInterval(setPlaceholder, 2200);
}

function customerSearchRows() {
  const query = String(state.customerSearchQuery || "").trim().toLowerCase();
  const rows = customerHomeCategories();
  const filtered = query
    ? rows.filter((category) => customerCategorySearchHaystack(category).includes(query))
    : rows;
  return filtered.slice(0, 50);
}

function customerSearchTokenText(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(customerSearchTokenText).filter(Boolean).join(" ");
  if (typeof value === "object") return Object.values(value).map(customerSearchTokenText).filter(Boolean).join(" ");
  return String(value);
}

function customerCategorySearchPriceRuleTokens(rule = {}) {
  const duration = numberValue(rule.timeDurationMinutes ?? rule.durationMinutes, 0);
  const basePrice = numberValue(rule.basePrice, 0);
  const sellingPrice = numberValue(rule.sellingPrice, 0);
  const discountValue = numberValue(rule.discountValue, 0);
  return [
    rule.label,
    rule.categoryName,
    rule.serviceName,
    rule.scopeType,
    rule.stateName,
    rule.cityName,
    rule.zoneName,
    rule.clusterName,
    duration ? `${duration} min ${duration} mins ${personalAssistantDurationLabel({ durationMinutes: duration })}` : "",
    basePrice ? `base price ${basePrice} ${money(basePrice)}` : "",
    sellingPrice ? `selling price ${sellingPrice} ${money(sellingPrice)}` : "",
    rule.discountType,
    discountValue ? `discount ${discountValue}` : "",
    rule.expandTitle,
    rule.expandDescription,
    rule.expandDuration
  ];
}

function customerCategorySearchHaystack(category = {}) {
  const categoryId = String(category.id || category.categoryId || "");
  const categoryName = String(category.name || category.categoryName || "").trim().toLowerCase();
  const matchingRules = normalizeArray(activeCatalog().categoryPriceRules || state.catalog.categoryPriceRules)
    .filter((rule) => {
      const ruleCategoryId = String(rule.categoryId || "");
      const ruleCategoryName = String(rule.categoryName || "").trim().toLowerCase();
      return (categoryId && ruleCategoryId === categoryId) || (categoryName && ruleCategoryName === categoryName);
    });
  const tokens = [
    category.name,
    category.categoryName,
    category.code,
    category.categoryCode,
    category.description,
    category.categoryDescription,
    category.note,
    category.taskListTitle,
    category.taskList,
    category.canDoTitle,
    category.canDoList,
    category.cantDoTitle,
    category.cantDoList,
    category.expandTitle,
    category.expandDescription,
    category.expandDuration,
    category.label,
    category.serviceName,
    category.stateName,
    category.cityName,
    category.zoneName,
    category.clusterName,
    category.basePrice ? `base price ${category.basePrice} ${money(category.basePrice)}` : "",
    category.sellingPrice ? `selling price ${category.sellingPrice} ${money(category.sellingPrice)}` : "",
    category.durationMinutes ? `${category.durationMinutes} min ${category.durationMinutes} mins ${personalAssistantDurationLabel({ durationMinutes: category.durationMinutes })}` : "",
    category.discountType,
    category.discountValue ? `discount ${category.discountValue}` : "",
    ...matchingRules.flatMap(customerCategorySearchPriceRuleTokens)
  ];
  return tokens.map(customerSearchTokenText).join(" ").replace(/\s+/g, " ").toLowerCase();
}

function customerSearchPageHtml() {
  const query = String(state.customerSearchQuery || "");
  const rows = customerSearchRows();
  return `<section class="mobile-app customer-flow-screen customer-search-screen">
    <header class="customer-search-header">
      <button class="customer-search-back" data-customer-search-back type="button" aria-label="Back">${customerIcon("back")}</button>
      <div class="zigo-commerce-search customer-search-input-wrap">
        <input data-customer-search-page-input value="${escapeHtml(query)}" placeholder="I need help with..." aria-label="Search categories" autocomplete="off">
        ${query ? `<button data-customer-search-clear type="button" aria-label="Clear search">${customerIcon("x")}</button>` : ""}
      </div>
    </header>
    <main class="customer-search-results">
      ${rows.length
        ? rows.map((category) => `<button class="customer-search-result-card" data-open-home-category-detail="${escapeHtml(category.id || "")}" type="button">
          <span class="customer-search-result-image">${customerHomeTileVisual(category, "CA")}</span>
          <span>
            <b>${escapeHtml(category.name || "Category")}</b>
          </span>
        </button>`).join("")
        : `<div class="customer-search-empty">
          <b>No result found</b>
          <p>Try searching another category or requirement.</p>
        </div>`}
    </main>
  </section>`;
}

function renderCustomerSearch() {
  root.innerHTML = customerSearchPageHtml();
  const input = root.querySelector("[data-customer-search-page-input]");
  requestAnimationFrame(() => {
    input?.focus?.({ preventScroll: true });
    input?.setSelectionRange?.(input.value.length, input.value.length);
  });
}

function customerCategoryImageUrls(item = {}) {
  return [...new Set([
    item.imageUrl,
    item.categoryImageUrl,
    item.category_image_url,
    item.primaryImageUrl,
    ...(normalizeArray(item.imageUrls || item.image_urls || item.categoryImageUrls || item.category_image_urls || item.config?.categorySettings?.imageUrls))
  ].map((url) => String(url || "").trim()).filter(Boolean))];
}

function customerHomeTileVisual(item = {}, fallback = "Z", options = {}) {
  const images = customerCategoryImageUrls(item);
  if (images.length > 1 && options.slider === true) {
    const sliderImages = [...images, images[0]];
    return `<div class="zigo-home-category-image-slider" data-category-image-count="${escapeHtml(images.length)}">${sliderImages.map((image) => `<img src="${escapeHtml(assetUrl(image))}" alt="${escapeHtml(item.name || "Item")}">`).join("")}</div>`;
  }
  const image = images[0] || item.iconUrl || "";
  if (image) return `<img src="${escapeHtml(assetUrl(image))}" alt="${escapeHtml(item.name || "Item")}">`;
  const label = customerChipLabel(item.icon || item.name || fallback, "");
  return `<span>${escapeHtml(label)}</span>`;
}

function resetCustomerHomeCategorySliderElement(slider) {
  if (!slider) return;
  slider.classList.remove("is-active");
  slider.style.transition = "none";
  slider.style.transform = "translateX(0)";
  void slider.offsetHeight;
  slider.style.transition = "";
}

function stopCustomerHomeCategoryImageSequence() {
  if (customerHomeCategoryImageSliderTimer) {
    clearTimeout(customerHomeCategoryImageSliderTimer);
    customerHomeCategoryImageSliderTimer = null;
  }
  root.querySelectorAll?.(".zigo-home-category-image-slider").forEach(resetCustomerHomeCategorySliderElement);
}

function startCustomerHomeCategoryImageSequence() {
  stopCustomerHomeCategoryImageSequence();
  requestAnimationFrame(() => {
    if (state.customerView && state.customerView !== "home") return;
    const sliders = [...root.querySelectorAll(".zigo-home-category-image-slider")]
      .filter((slider) => Number(slider.dataset.categoryImageCount || 0) > 1);
    if (!sliders.length) return;
    let sliderIndex = 0;
    let imageIndex = 0;
    const stepDelay = 1500;
    const nextCategoryDelay = 450;
    const step = () => {
      if (state.customerView && state.customerView !== "home") {
        stopCustomerHomeCategoryImageSequence();
        return;
      }
      const slider = sliders[sliderIndex];
      if (!slider?.isConnected) {
        startCustomerHomeCategoryImageSequence();
        return;
      }
      sliders.forEach((item, index) => {
        if (index !== sliderIndex) resetCustomerHomeCategorySliderElement(item);
      });
      slider.classList.add("is-active");
      slider.style.transform = `translateX(${-100 * imageIndex}%)`;
      const count = Number(slider.dataset.categoryImageCount || 0);
      if (imageIndex < count) {
        imageIndex += 1;
        customerHomeCategoryImageSliderTimer = setTimeout(step, stepDelay);
        return;
      }
      customerHomeCategoryImageSliderTimer = setTimeout(() => {
        resetCustomerHomeCategorySliderElement(slider);
        sliderIndex = (sliderIndex + 1) % sliders.length;
        imageIndex = 0;
        customerHomeCategoryImageSliderTimer = setTimeout(step, nextCategoryDelay);
      }, stepDelay);
    };
    step();
  });
}

function customerCategoryRatingBadgeHtml(category = {}) {
  const count = Number(category.ratingCount ?? category.serviceRatingCount ?? 0);
  const rawRating = Number(category.ratingAvg ?? category.serviceRatingAvg ?? category.averageRating ?? 0);
  if (!Number.isFinite(rawRating) || rawRating <= 0 || count <= 0) return "";
  const rating = Math.max(0, Math.min(5, Math.round(rawRating * 10) / 10));
  const tone = rating >= 4 ? "green" : rating >= 3 ? "yellow" : "red";
  return `<span class="zigo-home-category-rating ${escapeHtml(tone)}" aria-label="${escapeHtml(rating)} category rating">
    ${customerTrackIcon("star")}<b>${escapeHtml(rating.toFixed(rating % 1 ? 1 : 0))}</b>
  </span>`;
}

function customerHomeCategoryHasExpandDurations(category = {}) {
  const categoryId = String(category.id || category.categoryId || "").trim();
  if (!categoryId) return false;
  return customerCategoryPriceRules().some((rule) =>
    rule.isActive !== false &&
    String(rule.categoryId || "") === categoryId &&
    customerRuleMatchesCurrentCluster(rule) &&
    customerCategoryPriceRuleAvailableFor(rule, "expand") &&
    Math.round(numberValue(rule.timeDurationMinutes ?? rule.durationMinutes, 0)) > 0
  );
}

function customerCategoryHomeDisplayMode(category = {}) {
  const raw = String(
    category.homeDisplayMode
    || category.home_display_mode
    || category.config?.categorySettings?.homeDisplayMode
    || ""
  ).trim().toLowerCase();
  if (["categoryprice", "category_price", "price", "showprice", "show_price", "duration", "durations"].includes(raw)) return "categoryPrice";
  if (["category", "showcategory", "show_category", "show category"].includes(raw)) return "category";
  return category?.showInHomePage === false ? "categoryPrice" : "category";
}

function customerHomeCategories(options = {}) {
  const includeHiddenHome = options.includeHiddenHome === true;
  const catalog = activeCatalog();
  const masterRows = normalizeArray(catalog.masterCategories);
  const serviceIds = new Set(customerServices().map((service) => String(service.id || "")));
  const rows = (masterRows.length ? masterRows : catalog.categories)
    .filter((category) => {
      const serviceId = categoryServiceId(category);
      return category?.isActive !== false
        && category?.isEnabled !== false
        && category?.isVisible !== false
        && (includeHiddenHome || customerCategoryHomeDisplayMode(category) === "category")
        && (!serviceId || serviceIds.has(String(serviceId)));
    })
    .sort((left, right) =>
      Number(left.priority ?? left.sortOrder ?? 0) - Number(right.priority ?? right.sortOrder ?? 0)
      || String(left.name || "").localeCompare(String(right.name || ""))
    );
  const ids = new Set(rows.map((category) => String(category.id || "")));
  const roots = rows.filter((category) => {
    const parentId = categoryParentId(category);
    return !parentId || !ids.has(parentId);
  });
  return roots.length ? roots : rows;
}

function customerHomeServiceMasters() {
  return normalizeArray(activeCatalog().serviceMasters)
    .filter((service) => service?.isActive !== false && service?.isEnabled !== false && service?.isVisible !== false)
    .sort((left, right) =>
      numberValue(left.servicePosition ?? left.priority ?? left.position, 9999) - numberValue(right.servicePosition ?? right.priority ?? right.position, 9999)
      || String(left.serviceTitle || "").localeCompare(String(right.serviceTitle || ""))
    );
}

function customerHomeServiceMasterPriority(serviceMasterId = "") {
  const id = String(serviceMasterId || "");
  const service = customerHomeServiceMasters().find((item) => String(item.id || item.serviceMasterId || "") === id);
  return Number(service?.servicePosition ?? service?.priority ?? service?.position ?? 9999);
}

function customerHomeCategoriesForServiceMaster(serviceMasterId = "", categories = customerHomeCategories()) {
  const id = String(serviceMasterId || "");
  return normalizeArray(categories).filter((category) => String(category.serviceMasterId || "") === id);
}

function customerHomeServiceMasterIconHtml(icon = {}) {
  const value = String(icon.icon || "").trim();
  if (!value) return "";
  const size = Math.max(8, Math.min(96, Number(icon.size || 18)));
  const isImage = /^\/?uploads\/|^https?:\/\/|^data:image\//i.test(value);
  return isImage
    ? `<img class="zigo-home-service-master-icon image" src="${escapeHtml(assetUrl(value))}" alt="" style="width:${escapeHtml(size)}px;height:${escapeHtml(size)}px;">`
    : `<span class="zigo-home-service-master-icon text" style="font-size:${escapeHtml(size)}px;">${escapeHtml(value)}</span>`;
}

function customerHomeServiceMasterIconTarget(icon = {}) {
  const target = String(icon.target || icon.for || icon.appliesTo || "serviceTitle").trim().toLowerCase();
  if (["servicesubtitle", "subtitle", "sub-title", "sub title", "service subtitle"].includes(target)) return "serviceSubtitle";
  return "serviceTitle";
}

function customerHomeServiceMasterTitleLeftOffset(service = {}) {
  const leftIcons = normalizeArray(service.icons)
    .filter((icon) => customerHomeServiceMasterIconTarget(icon) === "serviceTitle" && icon.position !== "right");
  if (!leftIcons.length) return 0;
  const iconWidth = leftIcons.reduce((sum, icon) => sum + Math.max(8, Math.min(96, Number(icon.size || 18))), 0);
  return iconWidth + (leftIcons.length * 6);
}

function customerHomeServiceMasterLineHtml(service = {}, target = "serviceTitle", text = "") {
  const icons = normalizeArray(service.icons).filter((icon) => customerHomeServiceMasterIconTarget(icon) === target);
  const left = icons.filter((icon) => icon.position !== "right").map(customerHomeServiceMasterIconHtml).join("");
  const right = icons.filter((icon) => icon.position === "right").map(customerHomeServiceMasterIconHtml).join("");
  const isSubtitle = target === "serviceSubtitle";
  const fontSize = normalizeServiceFontSize(isSubtitle ? service.serviceSubtitleFontSize : service.serviceTitleFontSize, isSubtitle ? 13 : 18);
  const hasInlineMarkup = serviceTextHasInlineMarkup(text);
  const fontWeight = hasInlineMarkup
    ? 400
    : normalizeServiceFontWeight(isSubtitle ? service.serviceSubtitleFontWeight : service.serviceTitleFontWeight, 400);
  const color = normalizeServiceTextColor(isSubtitle ? service.serviceSubtitleColor : service.serviceTitleColor);
  const style = `font-size:${escapeHtml(fontSize)}px;font-weight:${escapeHtml(fontWeight)};${color ? `color:${escapeHtml(color)};` : ""}`;
  return `<span class="zigo-home-service-master-line">${left}<span class="zigo-home-service-master-text" style="${style}">${safeServiceInlineHtml(text || "")}</span>${right}</span>`;
}

function customerHomeServiceSubtitleText(service = {}) {
  return String(service.serviceSubtitle || "").trim();
}

function customerHomeServiceEtaText(service = {}) {
  if (!service.showEta || normalizeServiceMasterBookingType(service.bookingType) !== "instant") return "";
  const minutes = Number(
    service.instantEtaMinutes
    ?? service.instant_eta_minutes
    ?? service.etaMinutes
    ?? service.eta_minutes
    ?? service.bookingTypeConfig?.instantEtaMinutes
    ?? service.bookingTypeConfig?.etaMinutes
    ?? service.metadata?.instantEtaMinutes
    ?? service.metadata?.etaMinutes
  );
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 10;
  if (safeMinutes < 60) return `${safeMinutes} min`;
  const hours = safeMinutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hrs`;
}

function customerHomeServiceEtaStyle(service = {}) {
  const fontSize = normalizeServiceFontSize(service.serviceSubtitleFontSize, 13);
  const color = normalizeServiceTextColor(service.serviceSubtitleColor);
  return `font-size:${escapeHtml(fontSize)}px;font-weight:700;${color ? `color:${escapeHtml(color)};` : ""}`;
}

function customerHomeServiceSubtitleHtml(service = {}) {
  const subtitle = customerHomeServiceSubtitleText(service);
  const eta = customerHomeServiceEtaText(service);
  if (!subtitle && !eta) return "";
  return `<p>${subtitle ? customerHomeServiceMasterLineHtml(service, "serviceSubtitle", subtitle) : ""}${eta ? `<span class="zigo-home-service-eta" style="${customerHomeServiceEtaStyle(service)}">${escapeHtml(eta)}</span>` : ""}</p>`;
}

function customerHomeServiceMasterSection(service = {}, categories = [], indexOffset = 0) {
  const title = service.serviceTitle || "Service";
  const gridColumns = serviceCategoryGridColumns(service);
  const titleLeftOffset = customerHomeServiceMasterTitleLeftOffset(service);
  return `<section class="zigo-category-section zigo-home-categories-section zigo-home-service-master-section">
    <div class="zigo-section-head zigo-home-section-title zigo-home-service-master-head" style="--service-title-left-offset:${escapeHtml(titleLeftOffset)}px;">
      <div>
        <h2>${customerHomeServiceMasterLineHtml(service, "serviceTitle", title)}</h2>
        ${customerHomeServiceSubtitleHtml(service)}
      </div>
    </div>
    <div class="zigo-home-category-grid" style="--service-category-grid-columns:${escapeHtml(gridColumns)};">${categories.map((category, index) => customerHomeCategoryTile(category, customerServiceById(categoryServiceId(category)) || {}, index + indexOffset)).join("")}</div>
  </section>`;
}

function customerHomeCategoryTile(category = {}, service = {}, index = 0) {
  const serviceId = service?.id || categoryServiceId(category);
  const resolvedService = service?.id ? service : customerServiceById(serviceId) || {};
  const categoryName = String(category.name || "").trim();
  const imageHeight = Math.max(0, Math.min(600, Math.round(numberValue(category.categoryImageHeight, 0))));
  const imageWidth = Math.max(0, Math.min(600, Math.round(numberValue(category.categoryImageWidth, 0))));
  const hasCustomImageSize = Boolean(imageHeight || imageWidth);
  const effectiveImageHeight = imageHeight || imageWidth;
  const effectiveImageWidth = imageWidth || imageHeight;
  const sizeStyle = imageHeight || imageWidth
    ? ` style="--category-image-width:${escapeHtml(effectiveImageWidth)}px;--category-image-height:${escapeHtml(effectiveImageHeight)}px;"`
    : "";
  return `<article class="zigo-home-category-card-wrap" data-customer-home-category-card="${escapeHtml(category.id || "")}" data-home-category-index="${index}">
    <button class="zigo-home-category-card zigo-category-tone-${index % 6}${hasCustomImageSize ? " has-custom-category-image-size" : ""}" data-open-home-category-detail="${escapeHtml(category.id || "")}" type="button" aria-label="${escapeHtml(category.name || "Category")}"${sizeStyle}>
      <div class="zigo-home-category-image">${customerHomeTileVisual(category, resolvedService.icon || resolvedService.name || "Category", { slider: true })}${customerCategoryRatingBadgeHtml(category)}</div>
    </button>
    ${categoryName ? `<b class="zigo-home-category-name">${escapeHtml(categoryName)}</b>` : ""}
  </article>`;
}

function customerHomeCategoryById(categoryId = "") {
  const id = String(categoryId || "");
  if (!id) return null;
  return customerHomeCategories({ includeHiddenHome: true }).find((category) => String(category.id || "") === id) || null;
}

function customerHomeGuidanceList(items = [], icon = "&#9733;", tone = "do") {
  const rows = normalizeArray(items).map((item) => String(item || "").trim()).filter(Boolean);
  if (!rows.length) return `<p class="customer-home-category-empty">No details added yet.</p>`;
  return `<ul class="customer-home-category-guidance-list ${escapeHtml(tone)}">
    ${rows.map((item) => `<li><span>${icon}</span><p>${escapeHtml(item)}</p></li>`).join("")}
  </ul>`;
}

function customerHomeCategorySheetBodyHtml(selected = {}) {
  const note = String(selected.note || selected.description || "").trim();
  return `<section>
    <h3>${escapeHtml(selected.taskListTitle || "Tasks related to category")}</h3>
    ${customerHomeGuidanceList(selected.taskList, "&#9733;", "task")}
  </section>
  <section>
    <h3>${escapeHtml(selected.canDoTitle || "What Assistant can do")}</h3>
    ${customerHomeGuidanceList(selected.canDoList, "&#10003;", "do")}
  </section>
  <section>
    <h3>${escapeHtml(selected.cantDoTitle || "What Assistant can't do")}</h3>
    ${customerHomeGuidanceList(selected.cantDoList, "&#10005;", "dont")}
  </section>
  ${note ? `<div class="customer-home-category-note"><span>${customerIcon("info")}</span><p>${escapeHtml(note)}</p></div>` : ""}`;
}

function customerHomeCategorySheetActionsHtml(selected = {}) {
  const instantChecking = customerInstantAvailabilityChecking();
  const instantAvailable = customerInstantAvailableForCurrentContext();
  const allowsInstant = customerCategoryAllowsInstant(selected);
  const instantButton = allowsInstant
    ? `<button class="instant ${instantChecking ? "checking" : ""}" data-home-category-booking-mode="instant" data-category-id="${escapeHtml(selected.id || "")}" type="button" ${instantChecking || !instantAvailable ? "disabled aria-disabled=\"true\"" : ""}>${instantChecking ? `<span class="customer-inline-spinner" aria-hidden="true"></span>` : customerIcon("spark")}<span>${instantChecking ? "Checking" : "Instant"}</span></button>`
    : "";
  return `<footer class="customer-home-category-actions ${instantButton ? "" : "schedule-only"}">
    ${instantButton}
    <button class="schedule" data-home-category-booking-mode="schedule" data-category-id="${escapeHtml(selected.id || "")}" type="button">${customerIcon("calendar")}<span>Schedule</span></button>
  </footer>`;
}

function customerHomeCategorySheetValidatedContentHtml(selected = {}, categories = customerHomeCategories()) {
  return `<div class="customer-home-category-strip">
    ${categories.map((category) => {
      const active = String(category.id || "") === String(selected.id || "");
      return `<button class="${active ? "active" : ""}" data-select-home-category-detail="${escapeHtml(category.id || "")}" type="button" aria-selected="${active ? "true" : "false"}">
        <span>${customerHomeTileVisual(category, "Category")}</span>
        <b>${escapeHtml(category.name || "Category")}</b>
      </button>`;
    }).join("")}
  </div>
  <div class="customer-home-category-sheet-body">${customerHomeCategorySheetBodyHtml(selected)}</div>
  ${customerHomeCategorySheetActionsHtml(selected)}`;
}

function customerCenterHomeCategorySheetSelection() {
  const strip = document.querySelector(".portal-customer .customer-home-category-strip");
  const active = strip?.querySelector("[data-select-home-category-detail].active");
  if (!strip || !active) return;
  const stripRect = strip.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  const edgePadding = 8;
  let nextScrollLeft = strip.scrollLeft;
  if (activeRect.left < stripRect.left + edgePadding) {
    nextScrollLeft -= (stripRect.left + edgePadding) - activeRect.left;
  } else if (activeRect.right > stripRect.right - edgePadding) {
    nextScrollLeft += activeRect.right - (stripRect.right - edgePadding);
  }
  if (Math.abs(nextScrollLeft - strip.scrollLeft) > 1) {
    strip.scrollTo({ left: Math.max(0, nextScrollLeft), behavior: "smooth" });
  }
}

function refreshCustomerHomeCategorySheetUi() {
  const selected = customerHomeCategoryById(state.customerHomeCategorySheetId) || customerHomeCategories()[0];
  const sheet = document.querySelector(".portal-customer .customer-home-category-sheet");
  const content = sheet?.querySelector("[data-home-category-validated-content]");
  if (!selected || !sheet) return false;
  const strip = sheet.querySelector(".customer-home-category-strip");
  const scrollLeft = strip ? strip.scrollLeft : 0;
  if (content) content.innerHTML = customerHomeCategorySheetValidatedContentHtml(selected);
  requestAnimationFrame(() => {
    const nextStrip = sheet.querySelector(".customer-home-category-strip");
    if (nextStrip) nextStrip.scrollLeft = scrollLeft;
    customerCenterHomeCategorySheetSelection();
  });
  return true;
}

function closeCustomerHomeCategorySheetInPlace() {
  state.customerHomeCategorySheetOpen = false;
  state.customerHomeCategorySheetExpanded = false;
  state.customerHomeDurationSheetOpen = false;
  state.customerHomeDurationSheetCategoryId = "";
  state.customerHomeScheduleSheetOpen = false;
  state.customerHomeScheduleSheetCategoryId = "";
  customerHomeCategorySheetDrag = null;
  document.querySelector(".portal-customer .customer-home-duration-sheet-backdrop")?.remove();
  document.querySelector(".portal-customer .customer-home-schedule-sheet-backdrop")?.remove();
  const backdrop = document.querySelector(".portal-customer .customer-home-category-sheet-backdrop");
  if (!backdrop) return false;
  backdrop.remove();
  return true;
}

function customerHomeCategoryDetailSheet() {
  if (!state.customerHomeCategorySheetOpen) return "";
  const categories = customerHomeCategories();
  if (!categories.length) return "";
  const selected = customerHomeCategoryById(state.customerHomeCategorySheetId) || categories[0];
  return `<div class="customer-home-category-sheet-backdrop" data-home-category-sheet-backdrop role="presentation">
    <section class="customer-home-category-sheet ${state.customerHomeCategorySheetExpanded ? "expanded" : ""}" role="dialog" aria-modal="true" aria-label="Category details">
      <span class="customer-home-category-sheet-handle" data-home-category-sheet-drag aria-hidden="true"></span>
      <header>
        <div class="customer-home-category-title-row" data-home-category-sheet-drag>
          <button class="customer-home-category-back" data-home-category-sheet-collapse type="button" aria-label="Back">${customerIcon("back")}</button>
          <h2>What is included?</h2>
        </div>
        <button data-close-home-category-sheet type="button" aria-label="Close">${customerIcon("x")}</button>
      </header>
      <div data-home-category-validated-content>
        ${customerHomeCategorySheetValidatedContentHtml(selected, categories)}
      </div>
    </section>
  </div>`;
}

function customerHomeDurationSheetOptions() {
  const rows = customerHomeCategoryPriceDurationOptions();
  return rows.filter((item) => item?.id);
}

function customerHomeDurationSheetSelectedOption(rows = customerHomeDurationSheetOptions()) {
  return rows.find((item) => String(item.id || "") === String(state.selectedHomeDurationId || "")) || rows[0] || null;
}

function refreshCustomerHomeDurationSheetSelection() {
  const sheet = document.querySelector(".portal-customer .customer-home-duration-sheet");
  if (!sheet) return false;
  const rows = customerHomeDurationSheetOptions();
  const selected = customerHomeDurationSheetSelectedOption(rows);
  const checking = customerInstantAvailabilityChecking();
  const instantAvailable = customerInstantAvailableForCurrentContext();
  sheet.querySelectorAll("[data-select-home-duration]").forEach((button) => {
    const active = String(button.dataset.selectHomeDuration || "") === String(selected?.id || "");
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  const confirm = sheet.querySelector("[data-confirm-home-duration]");
  if (confirm) {
    confirm.disabled = !selected || checking || !instantAvailable;
    confirm.classList.toggle("checking", checking);
    const selectedPrice = selected ? Number(categoryPrice(selected) || selected.sellingPrice || selected.price || 0) : 0;
    const priceNode = confirm.querySelector("span");
    const labelNode = confirm.querySelector("b");
    const iconNode = confirm.querySelector("[data-home-duration-confirm-icon]");
    if (priceNode) priceNode.textContent = selectedPrice > 0 && !checking ? money(selectedPrice) : "";
    if (labelNode) labelNode.textContent = checking ? "Checking" : instantAvailable ? "Continue" : "Instant unavailable";
    if (iconNode) iconNode.innerHTML = checking ? `<span class="customer-inline-spinner" aria-hidden="true"></span>` : customerIcon("chevron");
  }
  return true;
}

function customerHomeDurationSheetArrivalLabel() {
  const decision = state.customerAvailabilityDecision || {};
  const rawMinutes = Number(
    decision.assistantAvailableInMinutes
    ?? decision.finalAssistantAvailableInMinutes
    ?? 0
  );
  if (!Number.isFinite(rawMinutes) || rawMinutes <= 0) return "Arrives in 10 mins";
  const minutes = Math.max(1, Math.ceil(rawMinutes));
  if (minutes < 60) return `Arrives in ${minutes} min`;
  const hours = minutes / 60;
  return `Arrives in ${Number.isInteger(hours) ? hours : hours.toFixed(1)} hrs`;
}

function customerHomeDurationSheetCard(item = {}, index = 0, selectedId = "") {
  const price = Number(categoryPrice(item) || item.sellingPrice || item.price || 0);
  const duration = categoryDurationMinutes(item, Number(item.durationMinutes || 30));
  const label = String(item.label || item.name || "").trim() || personalAssistantDurationLabel({ ...item, durationMinutes: duration });
  const oldPrice = Number(item.basePrice ?? item.base_price ?? item.compareAtPrice ?? item.originalPrice ?? item.mrp ?? 0);
  const displayOldPrice = oldPrice > price ? oldPrice : 0;
  const active = String(item.id || "") === String(selectedId || "");
  return `<button class="customer-home-duration-option ${active ? "active" : ""}" data-select-home-duration="${escapeHtml(item.id || "")}" type="button" aria-pressed="${active ? "true" : "false"}">
    <strong>${escapeHtml(label)}</strong>
    <span>${price > 0 ? escapeHtml(money(price)) : "Price required"}${displayOldPrice ? ` <del>${escapeHtml(money(displayOldPrice))}</del>` : ""}</span>
  </button>`;
}

function customerHomeDurationSheet() {
  if (!state.customerHomeDurationSheetOpen) return "";
  const rows = customerHomeDurationSheetOptions();
  const selected = customerHomeDurationSheetSelectedOption(rows);
  const selectedPrice = selected ? Number(categoryPrice(selected) || selected.sellingPrice || selected.price || 0) : 0;
  const checking = customerInstantAvailabilityChecking();
  const instantAvailable = customerInstantAvailableForCurrentContext();
  return `<div class="customer-home-duration-sheet-backdrop" data-home-duration-sheet-backdrop role="presentation">
    <section class="customer-home-duration-sheet" role="dialog" aria-modal="true" aria-label="Select duration">
      <span class="customer-home-duration-sheet-handle" aria-hidden="true"></span>
      <header>
        <h2>${customerIcon("spark")} <span>${escapeHtml(customerHomeDurationSheetArrivalLabel())}</span></h2>
        <button data-close-home-duration-sheet type="button" aria-label="Close">${customerIcon("x")}</button>
      </header>
      <div class="customer-home-duration-copy">
        <h3>Select duration</h3>
      </div>
      <div class="customer-home-duration-grid">
        ${rows.length ? rows.map((item, index) => customerHomeDurationSheetCard(item, index, selected?.id || "")).join("") : `<p class="customer-home-category-empty">No duration price is configured for this category.</p>`}
      </div>
      <footer class="customer-home-duration-paybar">
        <button class="customer-home-duration-confirm ${checking ? "checking" : ""}" data-confirm-home-duration type="button" ${selected && !checking && instantAvailable ? "" : "disabled"}>
          <span>${selectedPrice > 0 && !checking ? escapeHtml(money(selectedPrice)) : ""}</span>
          <b>${checking ? "Checking" : instantAvailable ? "Continue" : "Instant unavailable"}</b>
          <em data-home-duration-confirm-icon>${checking ? `<span class="customer-inline-spinner" aria-hidden="true"></span>` : customerIcon("chevron")}</em>
        </button>
      </footer>
    </section>
  </div>`;
}

function personalAssistantDurationLabel(category = {}) {
  const minutes = categoryDurationMinutes(category, 30);
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (hours === 1) return "1 hr";
  return Number.isInteger(hours) ? `${hours} hrs` : `${Number(hours.toFixed(1))} hrs`;
}

function customerCategoryPriceRuleAvailableFor(rule = {}, usage = "duration") {
  if (usage === "expand") return booleanValue(rule.availableForExpand, false) || booleanValue(rule.availableForExtend, false);
  if (usage === "extend") return booleanValue(rule.availableForExtend, false);
  return booleanValue(rule.availableForDuration, true);
}

function customerHomeCategoryPriceDurationOptions(categoryId = state.customerHomeDurationSheetCategoryId || state.customerHomeCategorySheetId || "", options = {}) {
  const targetCategoryId = String(categoryId || "");
  if (!targetCategoryId) return [];
  const availableFor = options.availableFor || "duration";
  const category = customerHomeCategoryById(targetCategoryId)
    || activeCatalog().categories.find((item) => String(item.id || "") === targetCategoryId)
    || {};
  const service = customerPersonalAssistantService() || customerServices().find((item) => String(item.id || "") === String(categoryServiceId(category))) || selectedService() || {};
  const seen = new Set();
  return customerCategoryPriceRules()
    .filter((rule) =>
      rule.isActive !== false &&
      rule.isEnabled !== false &&
      String(rule.categoryId || "") === targetCategoryId &&
      customerRuleMatchesCurrentCluster(rule) &&
      customerCategoryPriceRuleAvailableFor(rule, availableFor)
    )
    .slice()
    .sort((left, right) =>
      customerPriceScopeRank(right) - customerPriceScopeRank(left) ||
      numberValue(left.timeDurationMinutes, 0) - numberValue(right.timeDurationMinutes, 0)
    )
    .filter((rule) => {
      const duration = Math.max(0, Math.round(numberValue(rule.timeDurationMinutes ?? rule.durationMinutes, 0)));
      const key = `${duration}:${String(rule.label || "").trim().toLowerCase() || "duration"}`;
      if (!duration || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((rule, index) => {
      const durationMinutes = Math.max(1, Math.round(numberValue(rule.timeDurationMinutes ?? rule.durationMinutes, 0)));
      const basePrice = numberValue(rule.basePrice, 0);
      const sellingPrice = numberValue(rule.sellingPrice, basePrice);
      const waitingCharge = customerTrackWaitingChargeFromSource({
        waitingChargeAmount: rule.waitingChargeAmount,
        waitingChargeMinutes: rule.waitingChargeTimeMinutes
      }) || { enabled: false, amount: 0, chargePerMinutes: 0 };
      return {
        id: `category-price:${rule.id || targetCategoryId}:${durationMinutes}:${index}`,
        categoryPriceRuleId: rule.id || "",
        categoryId: targetCategoryId,
        categoryName: category.name || rule.categoryName || "Category",
        expandTitle: rule.expandTitle || category.expandTitle || "",
        expandDescription: rule.expandDescription || category.expandDescription || "",
        expandDuration: rule.expandDuration || category.expandDuration || category.expandDescription || "",
        expandPriority: numberValue(rule.expandPriority ?? category.expandPriority ?? category.priority ?? category.sortOrder, 0),
        serviceId: service.id || rule.serviceId || "",
        serviceName: service.name || rule.serviceName || "Personal Assistant",
        name: category.name || rule.categoryName || "Category",
        label: rule.label || personalAssistantDurationLabel({ durationMinutes }),
        durationMinutes,
        basePrice,
        sellingPrice,
        price: sellingPrice,
        discountType: rule.discountType || "none",
        discountValue: numberValue(rule.discountValue, 0),
        allottedTime: { enabled: true, durationMinutes },
        waitingCharge,
        availableForDuration: booleanValue(rule.availableForDuration, true),
        availableForExtend: booleanValue(rule.availableForExtend, false),
        source: "category-price"
      };
    })
    .sort((left, right) => numberValue(left.durationMinutes, 0) - numberValue(right.durationMinutes, 0));
}

function customerHomeExpandedDurationOptions(categories = customerHomeCategories()) {
  const rows = normalizeArray(categories)
    .filter((category) => customerCategoryHomeDisplayMode(category) === "categoryPrice")
    .flatMap((category) => customerHomeCategoryPriceDurationOptions(category.id || category.categoryId || "", { availableFor: "expand" })
      .map((item) => {
        const serviceMasterId = String(category.serviceMasterId || category.service_master_id || category.config?.categorySettings?.serviceMasterId || "");
        const serviceMaster = customerHomeServiceMasters().find((service) => String(service.id || service.serviceMasterId || "") === serviceMasterId) || {};
        return {
          ...item,
          serviceMasterId,
          serviceMasterName: category.serviceMasterName || category.service_master_name || serviceMaster.serviceTitle || "",
          serviceMasterSubtitle: serviceMaster.serviceSubtitle || "",
          serviceMasterIcons: normalizeArray(serviceMaster.icons),
          serviceMasterTitleFontSize: serviceMaster.serviceTitleFontSize,
          serviceMasterTitleFontWeight: serviceMaster.serviceTitleFontWeight,
          serviceMasterTitleColor: serviceMaster.serviceTitleColor,
          serviceMasterSubtitleFontSize: serviceMaster.serviceSubtitleFontSize,
          serviceMasterSubtitleFontWeight: serviceMaster.serviceSubtitleFontWeight,
          serviceMasterSubtitleColor: serviceMaster.serviceSubtitleColor,
          serviceMasterBookingType: normalizeServiceMasterBookingType(serviceMaster.bookingType),
          serviceMasterShowEta: Boolean(serviceMaster.showEta),
          serviceMasterInstantEtaMinutes: numberValue(serviceMaster.instantEtaMinutes ?? serviceMaster.instant_eta_minutes ?? serviceMaster.etaMinutes ?? serviceMaster.eta_minutes ?? serviceMaster.metadata?.instantEtaMinutes ?? serviceMaster.metadata?.etaMinutes, 0),
          servicePriority: customerHomeServiceMasterPriority(serviceMasterId),
          priceDisplayMode: category.priceDisplayMode === "grid" ? "grid" : "row",
          priceGridRows: Math.max(1, Math.round(numberValue(category.priceGridRows, 3))),
          priceGridColumns: Math.max(1, Math.round(numberValue(category.priceGridColumns, 3))),
        expandPriority: numberValue(category.expandPriority ?? category.priority ?? category.sortOrder, 0),
        expandTitle: item.expandTitle || category.expandTitle || "",
        expandDuration: item.expandDuration || item.expandDescription || category.expandDuration || category.expandDescription || "",
        expandDescription: item.expandDescription || item.expandDuration || category.expandDescription || category.expandDuration || "",
        categoryName: item.expandTitle || category.expandTitle || item.categoryName || "",
        name: item.expandTitle || category.expandTitle || item.name || ""
        };
      }));
  const seen = new Set();
  return rows
    .filter((item) => {
      const key = `${item.categoryId || ""}:${item.categoryPriceRuleId || item.id || ""}:${item.durationMinutes || ""}`;
      if (!item.categoryId || !item.durationMinutes || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) =>
      numberValue(left.servicePriority, 9999) - numberValue(right.servicePriority, 9999)
      || numberValue(left.expandPriority, 0) - numberValue(right.expandPriority, 0)
      || numberValue(left.durationMinutes, 0) - numberValue(right.durationMinutes, 0)
      || String(left.categoryName || "").localeCompare(String(right.categoryName || ""))
    );
}

function customerHomeExpandedDurationCard(item = {}) {
  const price = Number(item.sellingPrice ?? item.price ?? 0);
  const oldPrice = Number(item.basePrice ?? item.compareAtPrice ?? item.originalPrice ?? 0);
  const displayOldPrice = oldPrice > price ? oldPrice : 0;
  const save = Math.max(0, displayOldPrice - price);
  const active = String(item.id || "") === String(state.selectedHomeDurationId || "");
  return `<button class="customer-home-expand-duration-card ${active ? "active" : ""}" data-home-expand-duration="${escapeHtml(item.id || "")}" data-category-id="${escapeHtml(item.categoryId || "")}" type="button" aria-pressed="${active ? "true" : "false"}">
    <strong>${escapeHtml(item.label || personalAssistantDurationLabel(item))}</strong>
    <span class="customer-home-expand-duration-price-stack">
      ${save > 0 ? `<em>Save ${escapeHtml(money(save))}</em>` : ""}
      <span class="customer-home-expand-duration-price-line">
        <b>${price > 0 ? escapeHtml(money(price)) : "Price required"}</b>
        ${displayOldPrice ? `<del>${escapeHtml(money(displayOldPrice))}</del>` : ""}
      </span>
    </span>
  </button>`;
}

function customerHomeExpandedDurationOptionById(id = "") {
  const targetId = String(id || "");
  if (!targetId) return null;
  return customerHomeExpandedDurationOptions(customerHomeCategories({ includeHiddenHome: true }))
    .find((item) => String(item.id || "") === targetId) || null;
}

function customerHomeDurationBookingType(item = {}) {
  if (item.serviceMasterBookingType) return normalizeServiceMasterBookingType(item.serviceMasterBookingType);
  const serviceMasterId = String(item.serviceMasterId || "");
  const service = customerHomeServiceMasters().find((row) => String(row.id || row.serviceMasterId || "") === serviceMasterId) || {};
  return normalizeServiceMasterBookingType(service.bookingType);
}

function customerHomeExpandCopyForDurationRows(rows = [], categories = customerHomeCategories()) {
  const categoryIds = normalizeArray(rows).map((row) => String(row.categoryId || "").trim()).filter(Boolean);
  const categoryNames = normalizeArray(rows).map((row) => String(row.categoryName || row.name || "").trim().toLowerCase()).filter(Boolean);
  const catalog = activeCatalog();
  const candidates = [
    ...normalizeArray(categories),
    ...normalizeArray(catalog.masterCategories),
    ...normalizeArray(catalog.categories)
  ];
  const categoryTitle = (category = {}) => String(category.expandTitle || category.config?.categorySettings?.expandTitle || "").trim();
  const categoryDescription = (category = {}) => String(category.expandDescription || category.expandDuration || category.config?.categorySettings?.expandDescription || category.config?.categorySettings?.expandDuration || "").trim();
  const matchedCategory = candidates.find((category) =>
    categoryIds.includes(String(category.id || category.categoryId || "").trim()) && categoryTitle(category)
  )
    || candidates.find((category) =>
      categoryNames.includes(String(category.name || category.categoryName || "").trim().toLowerCase()) && categoryTitle(category)
    )
    || candidates.find((category) => categoryTitle(category));
  const matchedRow = normalizeArray(rows).find((row) => String(row.expandTitle || row.expandDescription || row.expandDuration || "").trim()) || {};
  return {
    title: String(categoryTitle(matchedCategory) || matchedRow.expandTitle || "").trim(),
    description: String(categoryDescription(matchedCategory) || matchedRow.expandDescription || matchedRow.expandDuration || "").trim()
  };
}

function customerHomeExpandedDurationsSection(categories = customerHomeCategories()) {
  const rows = customerHomeExpandedDurationOptions(categories);
  if (!rows.length) return "";
  const copy = customerHomeExpandCopyForDurationRows(rows, categories);
  const displayMode = rows.find((row) => row.priceDisplayMode === "grid") ? "grid" : "row";
  const gridColumns = Math.max(1, Math.min(10, Math.round(numberValue(rows.find((row) => row.priceDisplayMode === "grid")?.priceGridColumns, 3))));
  return `<section class="zigo-home-duration-service-section" aria-label="${escapeHtml(copy.title || "Select duration")}">
    ${copy.title || copy.description ? `<div class="customer-home-expand-duration-head">
      ${copy.title ? `<h3>${escapeHtml(copy.title)}</h3>` : ""}
      ${copy.description ? `<p>${escapeHtml(copy.description)}</p>` : ""}
    </div>` : ""}
    <div class="customer-home-expand-durations">
      <div class="customer-home-expand-duration-row ${displayMode === "grid" ? "grid" : ""}" style="${displayMode === "grid" ? `--duration-grid-columns:${escapeHtml(gridColumns)};` : ""}">
        ${rows.map(customerHomeExpandedDurationCard).join("")}
      </div>
    </div>
  </section>`;
}

function customerHomeExpandedDurationGroups(categories = customerHomeCategories({ includeHiddenHome: true })) {
  const rows = customerHomeExpandedDurationOptions(categories);
  if (!rows.length) return [];
  const groups = new Map();
  rows.forEach((row) => {
    const key = String(row.serviceMasterId || row.serviceMasterName || "ungrouped");
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        service: {
          id: row.serviceMasterId || "",
          serviceTitle: row.serviceMasterName || row.expandTitle || "Service",
          serviceSubtitle: row.serviceMasterSubtitle || "",
          icons: normalizeArray(row.serviceMasterIcons),
          serviceTitleFontSize: row.serviceMasterTitleFontSize,
          serviceTitleFontWeight: row.serviceMasterTitleFontWeight,
          serviceTitleColor: row.serviceMasterTitleColor,
          serviceSubtitleFontSize: row.serviceMasterSubtitleFontSize,
          serviceSubtitleFontWeight: row.serviceMasterSubtitleFontWeight,
          serviceSubtitleColor: row.serviceMasterSubtitleColor,
          bookingType: normalizeServiceMasterBookingType(row.serviceMasterBookingType),
          showEta: Boolean(row.serviceMasterShowEta),
          instantEtaMinutes: numberValue(row.serviceMasterInstantEtaMinutes, 0),
          servicePosition: row.servicePriority
        },
        rows: []
      });
    }
    groups.get(key).rows.push(row);
  });
  return [...groups.values()]
    .sort((left, right) =>
      numberValue(left.service?.servicePosition, 9999) - numberValue(right.service?.servicePosition, 9999)
      || String(left.service?.serviceTitle || "").localeCompare(String(right.service?.serviceTitle || ""))
    );
}

function customerHomeExpandedDurationServiceSection(group = {}) {
  const service = group.service || {};
  const groupRows = normalizeArray(group.rows);
  if (!groupRows.length) return "";
  const displayMode = groupRows.find((row) => row.priceDisplayMode === "grid") ? "grid" : "row";
  const gridColumns = Math.max(1, Math.min(10, Math.round(numberValue(groupRows.find((row) => row.priceDisplayMode === "grid")?.priceGridColumns, 3))));
  const titleLeftOffset = customerHomeServiceMasterTitleLeftOffset(service);
  return `<section class="zigo-home-duration-service-section zigo-home-service-master-section" aria-label="${escapeHtml(service.serviceTitle || "Select duration")}">
    <div class="zigo-section-head zigo-home-section-title zigo-home-service-master-head customer-home-expand-duration-head" style="--service-title-left-offset:${escapeHtml(titleLeftOffset)}px;">
      <div>
        <h2>${customerHomeServiceMasterLineHtml(service, "serviceTitle", service.serviceTitle || "Service")}</h2>
        ${customerHomeServiceSubtitleHtml(service)}
      </div>
    </div>
    <div class="customer-home-expand-durations">
      <div class="customer-home-expand-duration-row ${displayMode === "grid" ? "grid" : ""}" style="${displayMode === "grid" ? `--duration-grid-columns:${escapeHtml(gridColumns)};` : ""}">
        ${groupRows.map(customerHomeExpandedDurationCard).join("")}
      </div>
    </div>
  </section>`;
}

function customerHomeExpandedDurationsByServiceSections(categories = customerHomeCategories({ includeHiddenHome: true })) {
  return customerHomeExpandedDurationGroups(categories)
    .map(customerHomeExpandedDurationServiceSection)
    .filter(Boolean)
    .join("");
}

function customerHomeTrustSection() {
  const badges = [
    { label: "Verified", icon: "shield" },
    { label: "Trained", icon: "tasks" },
    { label: "Trusted", icon: "heart" },
    { label: "Reliable", icon: "clock" }
  ];
  return `<section class="customer-home-trust-section" aria-label="Trusted Personal Assistant">
    <div class="customer-home-trust-lines">
      <h2><span>Delegate.</span><strong>Relax. <em>Live.</em></strong></h2>
    </div>
    <div class="customer-home-trust-brand">
      <img src="${assetUrl("/assets/zigo-logo-new.png")}" alt="ZIGO">
      <h3>Your Trusted Personal Assistant</h3>
    </div>
    <div class="customer-home-trust-badges">
      ${badges.map((badge) => `<span>${customerIcon(badge.icon)}<b>${escapeHtml(badge.label)}</b></span>`).join("")}
    </div>
  </section>`;
}

function customerHomeAppStatementSection() {
  return `<section class="customer-home-app-statement" aria-label="India first on-demand personal assistance app">
    <h2><span>India's first</span><strong>on-demand personal</strong><strong>assistance app <img class="customer-home-app-heart" src="${assetUrl("/assets/zigo-heart-3d.svg")}" alt=""></strong></h2>
    <img src="${assetUrl("/assets/zigo-logo-new.png")}" alt="ZIGO">
  </section>`;
}

function customerHomeScheduleConfig() {
  const decision = customerAvailabilityDecisionIsCurrent() ? state.customerAvailabilityDecision : null;
  const scheduleSource = decision?.scheduleConfig || decision?.config || customerBookingTypeSourceConfig("schedule");
  return {
    mode: "schedule",
    maxAdvanceDays: Number(scheduleSource.maxAdvanceDays || 2),
    allowedDays: Array.isArray(scheduleSource.allowedDays) ? scheduleSource.allowedDays : [],
    timeSlots: Array.isArray(scheduleSource.timeSlots) ? scheduleSource.timeSlots : [],
    timeCategories: Array.isArray(scheduleSource.timeCategories) ? scheduleSource.timeCategories : []
  };
}

function customerHomeScheduleDateLabel(date = new Date(), offset = 0) {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  if (offset < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function customerHomeScheduleDates(config = customerHomeScheduleConfig()) {
  const totalDays = Math.max(1, Math.round(Number(config.maxAdvanceDays || 1)));
  const allowed = new Set(normalizeArray(config.allowedDays).map((item) => String(item).toLowerCase()));
  const rows = [];
  for (let offset = 0; offset < totalDays; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const token = offset === 0 ? "today" : offset === 1 ? "tomorrow" : `next_${offset}`;
    if (allowed.size && !allowed.has(token) && !allowed.has(String(offset)) && !allowed.has(weekday)) continue;
    rows.push({
      value: customerLocalDateValue(date),
      label: customerHomeScheduleDateLabel(date, offset),
      day: date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()
    });
  }
  return rows.length ? rows : [{ value: customerLocalDateValue(new Date()), label: "Today", day: new Date().toLocaleDateString("en-US", { weekday: "short" }).toUpperCase() }];
}

function customerHomeScheduleDurations() {
  const categoryId = state.customerHomeScheduleSheetCategoryId || state.customerHomeCategorySheetId || "";
  return customerHomeCategoryPriceDurationOptions(categoryId, { availableFor: "duration" });
}

function customerHomeScheduleSelectedDuration(rows = customerHomeScheduleDurations()) {
  return rows.find((item) => String(item.id || "") === String(state.selectedHomeScheduleDurationId || "")) || null;
}

function customerHomeScheduleAvailableTimeSet(dateValue = state.selectedHomeScheduleDate) {
  if (!customerAvailabilityDecisionIsCurrent()) {
    return state.customerView === "homeSchedule" && state.selectedHomeScheduleDurationId ? new Set() : null;
  }
  const slots = normalizeArray(state.customerAvailabilityDecision?.scheduleAvailableSlots)
    .filter((slot) => String(slot?.date || "") === String(dateValue || ""))
    .filter((slot) => Number(slot?.availableAssistants || 0) > 0)
    .map((slot) => String(slot?.time || ""))
    .filter(Boolean);
  return new Set(slots);
}

function customerHomeScheduleRenderableTimeSet(dateValue = state.selectedHomeScheduleDate) {
  if (!customerAvailabilityDecisionIsCurrent()) return null;
  const slots = normalizeArray(state.customerAvailabilityDecision?.scheduleAvailableSlots)
    .filter((slot) => String(slot?.date || "") === String(dateValue || ""))
    .map((slot) => String(slot?.time || ""))
    .filter(Boolean);
  return new Set(slots);
}

function customerHomeScheduleRenderableTimes(category = {}, dateValue = state.selectedHomeScheduleDate, config = customerHomeScheduleConfig()) {
  const times = customerCategoryTimes(category, config);
  const renderable = customerHomeScheduleRenderableTimeSet(dateValue);
  return renderable ? times.filter((time) => renderable.has(String(time || ""))) : times;
}

function customerHomeScheduleSlotCapacity(dateValue = state.selectedHomeScheduleDate, time = "") {
  if (!customerAvailabilityDecisionIsCurrent()) return null;
  const slot = normalizeArray(state.customerAvailabilityDecision?.scheduleAvailableSlots)
    .find((item) => String(item?.date || "") === String(dateValue || "") && String(item?.time || "") === String(time || ""));
  return slot ? Number(slot.availableAssistants || 0) : 0;
}

function customerHomeScheduleDateDisabled(dateValue = "") {
  const available = customerHomeScheduleAvailableTimeSet(dateValue);
  return available ? available.size === 0 : false;
}

function customerHomeScheduleCategories(config = customerHomeScheduleConfig()) {
  return customerConfiguredTimeCategories(config).filter((category) => customerCategoryTimes(category, config).length);
}

function customerHomeScheduleCategoryDisabled(category = {}, dateValue = state.selectedHomeScheduleDate, config = customerHomeScheduleConfig()) {
  const renderableTimes = customerHomeScheduleRenderableTimes(category, dateValue, config);
  if (!renderableTimes.length) return true;
  const available = customerHomeScheduleAvailableTimeSet(dateValue);
  if (!available) return false;
  return !renderableTimes.some((time) => available.has(time));
}

function customerHomeScheduleTimeDisabled(dateValue = "", time = "") {
  if (!customerAvailabilityDecisionIsCurrent()) {
    const available = customerHomeScheduleAvailableTimeSet(dateValue);
    return available ? !available.has(String(time || "")) : false;
  }
  return customerHomeScheduleSlotCapacity(dateValue, time) <= 0;
}

function ensureCustomerHomeScheduleSelection() {
  const config = customerHomeScheduleConfig();
  const dates = customerHomeScheduleDates(config);
  const availableDates = dates.filter((date) => !customerHomeScheduleDateDisabled(date.value || ""));
  if (!dates.some((date) => String(date.value || "") === String(state.selectedHomeScheduleDate || "")) || customerHomeScheduleDateDisabled(state.selectedHomeScheduleDate)) {
    state.selectedHomeScheduleDate = availableDates[0]?.value || "";
    state.selectedHomeScheduleTime = "";
  }
  const durations = customerHomeScheduleDurations();
  if (!durations.some((item) => String(item.id || "") === String(state.selectedHomeScheduleDurationId || ""))) {
    state.selectedHomeScheduleDurationId = "";
    state.selectedHomeScheduleTime = "";
  }
  const categories = customerHomeScheduleCategories(config);
  const selectableCategories = categories.filter((category) => !customerHomeScheduleCategoryDisabled(category, state.selectedHomeScheduleDate, config));
  const renderableCategories = categories.filter((category) => customerHomeScheduleRenderableTimes(category, state.selectedHomeScheduleDate, config).length);
  if (!categories.some((category) => String(category.id || "") === String(state.selectedHomeSchedulePeriod || ""))) {
    state.selectedHomeSchedulePeriod = selectableCategories[0]?.id || renderableCategories[0]?.id || categories[0]?.id || "";
  } else if (customerHomeScheduleCategoryDisabled(categories.find((category) => String(category.id || "") === String(state.selectedHomeSchedulePeriod || "")) || {}, state.selectedHomeScheduleDate, config) && selectableCategories.length) {
    state.selectedHomeSchedulePeriod = selectableCategories[0]?.id || "";
  } else if (!customerHomeScheduleRenderableTimes(categories.find((category) => String(category.id || "") === String(state.selectedHomeSchedulePeriod || "")) || {}, state.selectedHomeScheduleDate, config).length && renderableCategories.length) {
    state.selectedHomeSchedulePeriod = renderableCategories[0]?.id || "";
  }
  if (state.selectedHomeScheduleTime) {
    const activeCategory = categories.find((category) => String(category.id || "") === String(state.selectedHomeSchedulePeriod || "")) || categories[0] || null;
    const times = activeCategory ? customerHomeScheduleRenderableTimes(activeCategory, state.selectedHomeScheduleDate, config) : [];
    if (!times.includes(state.selectedHomeScheduleTime) || customerHomeScheduleTimeDisabled(state.selectedHomeScheduleDate, state.selectedHomeScheduleTime)) {
      state.selectedHomeScheduleTime = "";
    }
  }
}

function customerHomeScheduleDateCard(date = {}) {
  const disabled = customerHomeScheduleDateDisabled(date.value || "");
  const selected = !disabled && String(date.value || "") === String(state.selectedHomeScheduleDate || "");
  const label = date.label || date.day || "Day";
  return `<button class="customer-home-schedule-date ${selected ? "active" : ""} ${disabled ? "disabled" : ""}" data-select-home-schedule-date="${escapeHtml(date.value || "")}" type="button" ${disabled ? "disabled" : ""} aria-disabled="${disabled ? "true" : "false"}" aria-pressed="${selected ? "true" : "false"}">${escapeHtml(label)}</button>`;
}

function customerHomeScheduleDurationCard(item = {}) {
  const selected = String(item.id || "") === String(state.selectedHomeScheduleDurationId || "");
  const price = numberValue(item.sellingPrice ?? item.price, 0);
  const oldPrice = numberValue(item.basePrice, 0);
  const label = String(item.label || "").trim() || personalAssistantDurationLabel(item);
  return `<button class="customer-home-schedule-duration ${selected ? "active" : ""}" data-select-home-schedule-duration="${escapeHtml(item.id || "")}" type="button" aria-pressed="${selected ? "true" : "false"}">
    <strong>${escapeHtml(label)}</strong>
    <span>${price > 0 ? escapeHtml(money(price)) : "Price required"}${oldPrice > price ? ` <del>${escapeHtml(money(oldPrice))}</del>` : ""}</span>
  </button>`;
}

function customerHomeScheduleTimeButtonHtml(time = "", categoryId = "") {
  const disabled = customerHomeScheduleTimeDisabled(state.selectedHomeScheduleDate, time);
  const active = String(state.selectedHomeScheduleTime || "") === String(time || "");
  return `<button class="${active ? "active" : ""} ${disabled ? "disabled" : ""}" data-select-home-schedule-time="${escapeHtml(time)}" data-home-schedule-time-period="${escapeHtml(categoryId)}" type="button" ${disabled ? "disabled" : ""} aria-disabled="${disabled ? "true" : "false"}" aria-pressed="${active ? "true" : "false"}">${escapeHtml(customerFormatTime(time))}</button>`;
}

function customerHomeSchedulePeriodSectionHtml(category = {}, config = customerHomeScheduleConfig()) {
  const times = customerHomeScheduleRenderableTimes(category, state.selectedHomeScheduleDate, config);
  if (!times.length) return "";
  return `<section class="customer-home-schedule-time-section" data-home-schedule-period-section="${escapeHtml(category.id || "")}">
    <h4>${escapeHtml(category.name || "Time")}</h4>
    <div class="customer-home-schedule-time-grid">
      ${times.map((time) => customerHomeScheduleTimeButtonHtml(time, category.id || "")).join("")}
    </div>
  </section>`;
}

function customerHomeScheduleTimeSection(config = customerHomeScheduleConfig()) {
  const selectedDuration = customerHomeScheduleSelectedDuration();
  if (!selectedDuration) return "";
  const categories = customerHomeScheduleCategories(config);
  const renderableCategories = categories.filter((category) => customerHomeScheduleRenderableTimes(category, state.selectedHomeScheduleDate, config).length);
  const displayCategories = renderableCategories.length ? renderableCategories : categories;
  const activeCategory = displayCategories.find((category) => String(category.id || "") === String(state.selectedHomeSchedulePeriod || "")) || displayCategories[0] || null;
  if (!activeCategory) return `<section class="customer-home-schedule-panel"><h3>Select Start Time</h3><p class="customer-home-category-empty">No time slots configured.</p></section>`;
  return `<section class="customer-home-schedule-panel customer-home-schedule-time-panel">
    <div class="customer-home-schedule-time-sticky">
      <h3>Select Start Time</h3>
      <div class="customer-home-schedule-period-tabs">
        ${displayCategories.map((category) => {
          const active = String(category.id || "") === String(activeCategory.id || "");
          const disabled = customerHomeScheduleCategoryDisabled(category, state.selectedHomeScheduleDate, config);
          return `<button class="${active ? "active" : ""} ${disabled ? "disabled" : ""}" data-select-home-schedule-period="${escapeHtml(category.id || "")}" type="button" ${disabled ? "disabled" : ""} aria-disabled="${disabled ? "true" : "false"}">${escapeHtml(category.name || "Time")}</button>`;
        }).join("")}
      </div>
    </div>
    <div class="customer-home-schedule-time-sections" data-home-schedule-time-grid>
      ${displayCategories.map((category) => customerHomeSchedulePeriodSectionHtml(category, config)).join("") || `<p class="customer-home-category-empty">No available start time for this day.</p>`}
    </div>
  </section>`;
}

function customerHomeScheduleBodyHtml() {
  ensureCustomerHomeScheduleSelection();
  const config = customerHomeScheduleConfig();
  const dates = customerHomeScheduleDates(config);
  const durations = customerHomeScheduleDurations();
  return `<div class="customer-home-schedule-scroll">
    <section class="customer-home-schedule-panel">
      <h3>Select Date</h3>
      <div class="customer-home-schedule-date-row">${dates.map(customerHomeScheduleDateCard).join("")}</div>
    </section>
    <section class="customer-home-schedule-panel">
      <h3>Select Duration</h3>
      <div class="customer-home-schedule-duration-row">
        ${durations.length ? durations.map(customerHomeScheduleDurationCard).join("") : `<p class="customer-home-category-empty">No duration price is configured for this category.</p>`}
      </div>
    </section>
    ${customerHomeScheduleTimeSection(config)}
  </div>`;
}

function customerHomeScheduleFooterHtml() {
  const selectedDuration = customerHomeScheduleSelectedDuration();
  const selectedPrice = selectedDuration ? numberValue(selectedDuration.sellingPrice ?? selectedDuration.price, 0) : 0;
  const canContinue = Boolean(selectedDuration && state.selectedHomeScheduleDate && state.selectedHomeScheduleTime);
  return `<footer class="customer-home-schedule-footer">
    <button data-confirm-home-schedule type="button" ${canContinue ? "" : "disabled"}>
      <span>${selectedPrice > 0 ? escapeHtml(money(selectedPrice)) : ""}</span>
      <b>Continue</b>
      ${customerIcon("chevron")}
    </button>
  </footer>`;
}

function refreshCustomerHomeSchedulePageUi({ replaceTimePanel = true, scrollToTime = false, scrollToPeriod = false } = {}) {
  const page = document.querySelector(".portal-customer .customer-home-schedule-page");
  if (!page) return false;
  ensureCustomerHomeScheduleSelection();
  page.querySelectorAll("[data-select-home-schedule-date]").forEach((button) => {
    const dateValue = button.dataset.selectHomeScheduleDate || "";
    const disabled = customerHomeScheduleDateDisabled(dateValue);
    const active = !disabled && String(dateValue) === String(state.selectedHomeScheduleDate || "");
    button.classList.toggle("active", active);
    button.classList.toggle("disabled", disabled);
    button.disabled = disabled;
    button.setAttribute("aria-disabled", disabled ? "true" : "false");
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  page.querySelectorAll("[data-select-home-schedule-duration]").forEach((button) => {
    const active = String(button.dataset.selectHomeScheduleDuration || "") === String(state.selectedHomeScheduleDurationId || "");
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  page.querySelectorAll("[data-select-home-schedule-period]").forEach((button) => {
    const active = String(button.dataset.selectHomeSchedulePeriod || "") === String(state.selectedHomeSchedulePeriod || "");
    const category = customerHomeScheduleCategories(customerHomeScheduleConfig())
      .find((item) => String(item.id || "") === String(button.dataset.selectHomeSchedulePeriod || ""));
    const disabled = category ? customerHomeScheduleCategoryDisabled(category, state.selectedHomeScheduleDate, customerHomeScheduleConfig()) : false;
    button.classList.toggle("active", active);
    button.classList.toggle("disabled", disabled);
    button.disabled = disabled;
    button.setAttribute("aria-disabled", disabled ? "true" : "false");
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  if (replaceTimePanel) {
    const scroll = page.querySelector(".customer-home-schedule-scroll");
    const currentTimePanel = scroll?.querySelector(".customer-home-schedule-time-panel");
    const nextTimePanel = customerHomeScheduleTimeSection(customerHomeScheduleConfig());
    if (currentTimePanel && nextTimePanel) currentTimePanel.outerHTML = nextTimePanel;
    else if (currentTimePanel) currentTimePanel.remove();
    else if (scroll && nextTimePanel) scroll.insertAdjacentHTML("beforeend", nextTimePanel);
  } else {
    page.querySelectorAll("[data-select-home-schedule-time]").forEach((button) => {
      const active = String(button.dataset.selectHomeScheduleTime || "") === String(state.selectedHomeScheduleTime || "");
      const disabled = customerHomeScheduleTimeDisabled(state.selectedHomeScheduleDate, button.dataset.selectHomeScheduleTime || "");
      button.classList.toggle("active", active);
      button.classList.toggle("disabled", disabled);
      button.disabled = disabled;
      button.setAttribute("aria-disabled", disabled ? "true" : "false");
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }
  const footer = page.querySelector(".customer-home-schedule-footer");
  if (footer) footer.outerHTML = customerHomeScheduleFooterHtml();
  if (scrollToPeriod) {
    requestAnimationFrame(() => {
      const period = state.selectedHomeSchedulePeriod || "";
      const target = Array.from(page.querySelectorAll("[data-home-schedule-period-section]"))
        .find((section) => String(section.dataset.homeSchedulePeriodSection || "") === String(period));
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  } else if (scrollToTime) {
    requestAnimationFrame(() => page.querySelector("[data-home-schedule-time-grid]")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }
  return true;
}

function personalAssistantCategoryCard(category = {}, index = 0) {
  const price = categoryPrice(category);
  const isInCart = customerCartCategoryIndex(category.id || "") >= 0;
  const oldPrice = Number(
    category.compareAtPrice
    || category.compare_at_price
    || category.mrp
    || category.mrpPrice
    || category.mrp_price
    || category.originalPrice
    || category.original_price
    || category.basePrice
    || category.base_price
    || 0
  );
  const displayOldPrice = oldPrice > price ? oldPrice : price + (index === 0 ? 100 : 200);
  const saving = Math.max(0, displayOldPrice - price);
  return `<article class="zigo-pa-time-card zigo-pa-time-card-${index % 4}">
    <button class="zigo-pa-time-main ${isInCart ? "remove-action-tile" : ""}" ${isInCart ? `data-remove-cart-category="${escapeHtml(category.id || "")}"` : `data-add-category="${escapeHtml(category.id || "")}"`} type="button">
      <strong>${escapeHtml(personalAssistantDurationLabel(category))}</strong>
      <span><b>â‚¹${Number(price || 0).toFixed(0)}</b> <del>â‚¹${Number(displayOldPrice || 0).toFixed(0)}</del></span>
      ${saving ? `<small>Save â‚¹${Number(saving).toFixed(0)}</small>` : ""}
      <em>${isInCart ? `${customerIcon("trash")} Remove` : "Schedule"}</em>
    </button>
  </article>`;
}

function customerHomeStoreStrip(service = {}) {
  const stores = serviceStores(service.id || "").slice(0, 4);
  if (!stores.length) return "";
  return `<div class="zigo-store-strip">
    ${stores.map((store) => {
      const category = storeCategory(store);
      const isInCart = customerCartStoreIndex(store.id || "") >= 0;
      const storeVisual = store.primaryImageUrl
        ? `<img src="${escapeHtml(assetUrl(store.primaryImageUrl))}" alt="${escapeHtml(store.name || "Store")}">`
        : escapeHtml(customerChipLabel(store.name || "S", ""));
      return `<button class="zigo-store-chip ${isInCart ? "remove-action-tile" : ""}" ${isInCart ? `data-remove-cart-store="${escapeHtml(store.id || "")}"` : `data-add-store="${escapeHtml(store.id || "")}" data-store-category="${escapeHtml(category?.id || "")}"`} type="button">
        <span>${storeVisual}</span>
        <b>${isInCart ? `${customerIcon("trash")} Remove` : escapeHtml(store.name || "Store")}</b>
      </button>`;
    }).join("")}
  </div>`;
}

function customerHomeServiceCard(service = {}, index = 0) {
  const price = serviceStartingPrice(service);
  const meta = price > 0 ? `from ${money(price)}` : (service.description || "Explore");
  return `<article class="zigo-service-card-wrap">
    <button class="zigo-service-card zigo-service-tone-${index % 6}" data-service-id="${escapeHtml(service.id || "")}" type="button">
      <div class="zigo-service-image">${customerHomeTileVisual(service, service.icon || service.name)}</div>
      <b>${escapeHtml(service.name || "Service")}</b>
      <small>${escapeHtml(meta)}</small>
    </button>
  </article>`;
}

function customerHomeNearbyBanner(service = null) {
  if (!service) return "";
  return `<section class="zigo-nearby-banner">
    <button data-service-id="${escapeHtml(service.id || "")}" type="button">
      <div class="zigo-nearby-image">${customerHomeTileVisual(service, "FN")}</div>
      <div>
        <span>Nearby</span>
        <h2>${escapeHtml(service.name || "Find Nearby Me")}</h2>
        <p>${escapeHtml(service.description || "Find nearby services, stores, pharmacies, hospitals & more all around you.")}</p>
      </div>
      <strong>${customerIcon("chevron")}</strong>
    </button>
  </section>`;
}

function customerHomeDurationOptions() {
  const service = customerPersonalAssistantService();
  if (!service) return [];
  const categories = customerPersonalAssistantCategories()
    .map((category) => ({ ...category, serviceId: service.id, serviceName: service.name }));
  if (categories.length) return categories;
  const groupSlabs = customerPersonalAssistantGroupSlabItems(service.id)
    .map((slot) => ({ ...slot, serviceId: service.id, serviceName: service.name }));
  if (groupSlabs.length) return groupSlabs;
  return customerPersonalAssistantTimeSlotItems(service.id)
    .map((slot) => ({
      ...slot,
      serviceId: service.id,
      serviceName: service.name,
      name: slot.categoryName || slot.name || personalAssistantDurationLabel(slot),
      categoryName: slot.categoryName || slot.name || "Personal Assistant"
    }));
}

function customerHomeDurationCard(item = {}, index = 0) {
  const resolvedPrice = categoryPrice(item);
  const price = numberValue(resolvedPrice > 0 ? resolvedPrice : (item.sellingPrice ?? item.price), 0);
  const duration = categoryDurationMinutes(item, numberValue(item.durationMinutes, 30));
  const title = String(item.name || item.categoryName || personalAssistantDurationLabel({ ...item, durationMinutes: duration }) || "Personal Assistant").trim();
  const oldPrice = numberValue(item.basePrice ?? item.base_price ?? item.compareAtPrice ?? item.originalPrice, 0);
  const save = Math.max(0, oldPrice - price);
  const isInCart = customerCartCategoryIndex(item.id || "") >= 0;
  return `<article class="zigo-home-duration-card zigo-duration-tone-${index % 4} ${index === 1 ? "most-popular" : ""}">
    ${index === 1 ? `<span class="popular-badge">Most Popular</span>` : ""}
    <button class="${isInCart ? "remove-action-tile" : ""}" ${isInCart ? `data-remove-cart-category="${escapeHtml(item.id || "")}"` : `data-add-category="${escapeHtml(item.id || "")}"`} type="button">
      <small>${customerIcon("calendar")} ${escapeHtml(personalAssistantDurationLabel({ ...item, durationMinutes: duration }))}</small>
      <span class="zigo-pa-category-title">${escapeHtml(title)}</span>
      ${price > 0 ? `<span class="zigo-pa-category-price">${escapeHtml(money(price))}</span>` : ""}
      ${oldPrice > price ? `<del>${escapeHtml(money(oldPrice))}</del>` : ""}
      ${save > 0 ? `<em>Save ${escapeHtml(money(save))}</em>` : ""}
      <b>${isInCart ? "Remove" : "Book"}</b>
    </button>
  </article>`;
}

function customerPersonalAssistantSlotsSection(options = {}) {
  const rows = customerHomeDurationOptions();
  if (!rows.length) {
    requestCustomerPersonalAssistantCatalogRender();
    return `<section class="zigo-home-duration-section ${escapeHtml(options.className || "")}">
      <div class="zigo-pa-section-head">
        <small>Assistant</small>
        <h2>Book a personal assistant</h2>
        <p>Choose a time block for flexible errands.</p>
      </div>
      <p class="zigo-pa-empty">Loading Personal Assistant options...</p>
    </section>`;
  }
  const cards = rows.map(customerHomeDurationCard).filter(Boolean).join("");
  if (!cards) return "";
  return `<section class="zigo-home-duration-section ${escapeHtml(options.className || "")}">
    <div class="zigo-pa-section-head">
      <small>Assistant</small>
      <h2>Book a personal assistant</h2>
      <p>Choose a time block for flexible errands.</p>
    </div>
    <div class="zigo-home-duration-grid">${cards}</div>
  </section>`;
}

function customerHomeDurationGrid() {
  return customerPersonalAssistantSlotsSection();
}

function customerHomeStoreCard(store = {}, index = 0) {
  const category = storeCategory(store);
  const service = customerServices().find((item) => String(item.id || "") === categoryServiceId(category || {}));
  const image = store.primaryImageUrl || store.imageUrl || "";
  const isInCart = customerCartStoreIndex(store.id || "") >= 0;
  return `<article class="zigo-native-store-card">
    <button class="zigo-native-store-main ${isInCart ? "remove-action-tile" : ""}" ${isInCart ? `data-remove-cart-store="${escapeHtml(store.id || "")}"` : `data-add-store="${escapeHtml(store.id || "")}" data-store-category="${escapeHtml(category?.id || "")}"`} type="button">
      <div class="zigo-native-store-image zigo-category-tone-${index % 6}">${image ? `<img src="${escapeHtml(assetUrl(image))}" alt="${escapeHtml(store.name || "Store")}">` : customerIcon("store")}</div>
      <div>
        <b>${escapeHtml(store.name || "Store / Item")}</b>
        <span>${escapeHtml([service?.name, category?.name].filter(Boolean).join(" / ") || store.address || "Available nearby")}</span>
        <small>${money(storePrice(store))} - ${categoryDurationMinutes(category || {})} min</small>
      </div>
      <strong>${isInCart ? customerIcon("trash") : "ADD"}</strong>
    </button>
  </article>`;
}

function customerHomeQuickActions(services = []) {
  const quickRows = [
    { label: "Medicine Delivery", icon: "package", service: services.find((item) => /medicine|hospital|care/i.test(item.name || "")) || services[0] },
    { label: "Collect Documents", icon: "tasks", service: services.find((item) => /pickup|return|exchange/i.test(item.name || "")) || services[1] || services[0] },
    { label: "Groceries Shopping", icon: "cart", service: services.find((item) => /buy|bring/i.test(item.name || "")) || services[2] || services[0] },
    { label: "Queue Help", icon: "calendar", service: services.find((item) => /queue|appointment/i.test(item.name || "")) || services[3] || services[0] }
  ].filter((item) => item.service);
  return `<div class="zigo-quick-grid">
    ${quickRows.map((item) => `<button type="button" data-service-id="${escapeHtml(item.service.id || "")}">
      ${customerIcon(item.icon)}
      <span>${escapeHtml(item.label)}</span>
    </button>`).join("")}
  </div>`;
}

function customerHomeSections() {
  const categories = customerHomeCategories();
  const durationCategories = customerHomeCategories({ includeHiddenHome: true });
  const hasDurations = customerHomeExpandedDurationOptions(durationCategories).length > 0;
  if (!categories.length && !hasDurations) {
    const cluster = customerLocationCluster(state.selectedLocation || {});
    return `<section class="zigo-category-section zigo-cluster-empty">
      <div class="zigo-section-head"><h2>No categories available</h2></div>
      <p>Categories are not mapped for ${escapeHtml(cluster.name || "this cluster")} yet. Please change location or contact ZIGO support.</p>
      <button type="button" data-change-customer-location>Change Location</button>
    </section>`;
  }
  const serviceMasters = customerHomeServiceMasters();
  const durationGroups = customerHomeExpandedDurationGroups(durationCategories);
  if (serviceMasters.length || durationGroups.length) {
    const categoryIdsInService = new Set();
    const renderedDurationKeys = new Set();
    const sections = [];
    serviceMasters.forEach((service, sectionIndex) => {
      const serviceId = String(service.id || service.serviceMasterId || "");
      const categoryRows = customerHomeCategoriesForServiceMaster(serviceId, categories);
      categoryRows.forEach((category) => categoryIdsInService.add(String(category.id || "")));
      if (categoryRows.length) {
        sections.push(customerHomeServiceMasterSection(service, categoryRows, sectionIndex * 20));
      }
      durationGroups
        .filter((group) => String(group.service?.id || "") === serviceId)
        .forEach((group) => {
          renderedDurationKeys.add(String(group.key || ""));
          sections.push(customerHomeExpandedDurationServiceSection(group));
        });
    });
    const ungrouped = categories.filter((category) => !categoryIdsInService.has(String(category.id || "")));
    if (ungrouped.length) {
      sections.push(customerHomeServiceMasterSection({ serviceTitle: "Trusted Assistant", serviceSubtitle: "who do it all", icons: [] }, ungrouped, categoryIdsInService.size + 20));
    }
    durationGroups
      .filter((group) => !renderedDurationKeys.has(String(group.key || "")))
      .forEach((group) => sections.push(customerHomeExpandedDurationServiceSection(group)));
    return `${sections.filter(Boolean).join("")}
    ${customerHomeTrustSection()}
    ${customerHomeAppStatementSection()}`;
  }
  return `${categories.length ? `<section class="zigo-category-section zigo-home-categories-section">
    <div class="zigo-section-head zigo-home-section-title">
      <div><h2><strong>Trusted Assistant</strong> <span>who do it all</span></h2></div>
    </div>
    <div class="zigo-home-category-grid">${categories.map((category, index) => customerHomeCategoryTile(category, customerServiceById(categoryServiceId(category)) || {}, index)).join("")}</div>
  </section>` : ""}
  ${customerHomeExpandedDurationsByServiceSections(durationCategories)}
  ${customerHomeTrustSection()}
  ${customerHomeAppStatementSection()}`;
}

function customerSavedAddressList() {
  const addresses = Array.isArray(state.customerAddresses) ? state.customerAddresses : [];
  if (!addresses.length) return `<p class="muted location-empty">No saved addresses yet.</p>`;
  return `<div class="saved-address-list">
    ${addresses.map((address, index) => `<button class="saved-address-card" data-use-saved-address="${index}" type="button">
      <span class="saved-address-icon">H</span>
      <span>
        <b>${escapeHtml(address.label || "Saved")}</b>
        <small>${escapeHtml(address.metadata?.personName || state.user?.displayName || "")}</small>
        <em>${escapeHtml(locationShortAddress(address))}</em>
      </span>
      <strong>&gt;</strong>
    </button>`).join("")}
  </div>`;
}

function customerRecentLocationList() {
  const locations = Array.isArray(state.customerRecentLocations) ? state.customerRecentLocations : [];
  if (!locations.length) return "";
  return `<div class="saved-address-section recent-address-section">
    <header><h2>Recent Locations</h2><button type="button" data-location-step="manual">Use manual</button></header>
    <div class="saved-address-list">
      ${locations.map((location, index) => `<button class="saved-address-card" data-use-recent-location="${index}" type="button">
        <span class="saved-address-icon">R</span>
        <span>
          <b>${escapeHtml(location.label || "Recent")}</b>
          <small>${escapeHtml(location.metadata?.personName || state.user?.displayName || "")}</small>
          <em>${escapeHtml(locationShortAddress(location))}</em>
        </span>
        <strong>&gt;</strong>
      </button>`).join("")}
    </div>
  </div>`;
}

function suppressCustomerLocationPickerForReview(ms = 900) {
  customerLocationPickerSuppressUntil = Date.now() + Number(ms || 0);
  state.customerLocationPickerSheetOpen = false;
  state.customerLocationPickerClosing = true;
  state.customerLocationPickerPurpose = "";
}

function isCustomerLocationPickerSuppressed() {
  return Date.now() < Number(customerLocationPickerSuppressUntil || 0);
}

function customerHomeLocationPickerSheet() {
  if (state.customerView === "cart" && customerCartStopPickerClosedAfterPick) {
    state.customerLocationPickerSheetOpen = false;
    state.customerLocationPickerClosing = false;
    state.customerLocationPickerPurpose = "";
    return "";
  }
  if (isCustomerLocationPickerSuppressed()) {
    state.customerLocationPickerSheetOpen = false;
    state.customerLocationPickerClosing = false;
    return "";
  }
  if (!state.customerLocationPickerSheetOpen || !["home", "cart"].includes(state.customerView)) return "";
  const savedAddresses = Array.isArray(state.customerAddresses) ? state.customerAddresses : [];
  const recentLocations = Array.isArray(state.customerRecentLocations) ? state.customerRecentLocations : [];
  const searchText = String(state.locationSearchQuery || "").trim();
  const searching = Boolean(searchText);
  const currentLocation = state.currentDeviceLocation || {};
  const hasCurrentLocation = state.customerLocationPermissionGranted && Number.isFinite(Number(currentLocation.latitude)) && Number.isFinite(Number(currentLocation.longitude));
  const currentLocationActionLabel = "Change";
  const locationCardTitle = customerDisplayLocationLabel(currentLocation) || "Current location";
  const locationCardAddress = locationShortAddress(currentLocation);
  return `<div class="customer-location-picker-overlay ${state.customerLocationPickerClosing ? "is-closing" : ""}" data-location-picker-overlay>
    <div class="customer-location-picker-scrim" aria-hidden="true"></div>
    <div class="customer-location-picker-panel">
      <button class="customer-location-picker-close" data-close-location-picker type="button" aria-label="Close">${customerIcon("x")}</button>
      <section class="customer-location-picker-sheet ${searching ? "is-searching" : "is-listing"}" role="dialog" aria-modal="true" aria-label="Select your location">
      ${hasCurrentLocation ? `<div class="customer-location-permission-card current">
        <span class="customer-location-disabled-icon">${customerIcon("map")}</span>
        <div><b>${escapeHtml(locationCardTitle)}</b><small>${escapeHtml(locationCardAddress)}</small></div>
        <button type="button" data-change-current-location>${currentLocationActionLabel}</button>
      </div>` : `<div class="customer-location-permission-card">
        <span class="customer-location-disabled-icon">${customerIcon("map")}</span>
        <div><b>Device location not enabled</b><small>Enable for a better service experience</small></div>
        <button type="button" data-use-current-location ${state.locationBusy ? "disabled" : ""}>${state.locationBusy ? "Enabling..." : "Enable"}</button>
      </div>`}
      <p class="customer-location-inline-message ${state.locationMessage ? "visible" : ""}" data-location-inline-message>${escapeHtml(state.locationMessage || "")}</p>
      <div class="customer-location-search-sticky ${searching ? "active" : ""}">
        <div class="customer-location-picker-head">
          <h2>Select your location</h2>
        </div>
        <form class="customer-location-search-entry" data-location-search-form>
          <span>${customerIcon("search")}</span>
          <input name="q" value="${escapeHtml(state.locationSearchQuery)}" placeholder="Search for area, street name..." autocomplete="off" data-location-search-input>
          ${searching ? `<button class="customer-location-search-clear" data-clear-location-search type="button" aria-label="Clear search">${customerIcon("x")}</button>` : ""}
        </form>
      </div>
      <div data-location-picker-body>${searching ? customerHomeLocationSearchResults() : customerHomeLocationPickerListHtml(savedAddresses, recentLocations)}</div>
      </section>
    </div>
  </div>`;
}

function customerHomeLocationPickerListHtml(savedAddresses = state.customerAddresses || [], recentLocations = state.customerRecentLocations || []) {
  const saved = Array.isArray(savedAddresses) ? savedAddresses : [];
  const recent = Array.isArray(recentLocations) ? recentLocations : [];
  const visibleSaved = saved.slice(0, 5);
  const visibleRecent = recent.slice(0, 5);
  return `${saved.length ? `<section class="customer-location-picker-group">
    <h3>Saved Locations</h3>
    <div class="customer-location-picker-list">
      ${visibleSaved.map((address, index) => `<button class="customer-location-picker-card" data-use-saved-address="${index}" type="button">
        <span class="customer-location-picker-icon saved-icon">${customerSavedLocationIcon(address.label || "")}</span>
        <span>
          <b>${escapeHtml(address.label || "Saved")}</b>
          <em>${escapeHtml(locationShortAddress(address))}</em>
          ${address.metadata?.contactNumber ? `<small>Phone number: <strong>${escapeHtml(address.metadata.contactNumber)}</strong></small>` : ""}
        </span>
        <strong>&gt;</strong>
      </button>`).join("")}
    </div>
    ${saved.length > 5 ? `<div class="customer-location-picker-list-footer"><button class="customer-location-view-all" data-open-saved-locations type="button">View all</button></div>` : ""}
  </section>` : ""}
  ${recent.length ? `<section class="customer-location-picker-group">
    <h3>Recent Locations</h3>
    <div class="customer-location-picker-list">
      ${visibleRecent.map((location, index) => `<button class="customer-location-picker-card" data-use-recent-location="${index}" type="button">
        <span class="customer-location-picker-icon recent">${customerIcon("history")}</span>
        <span>
          <b>${escapeHtml(location.label || "Recent")}</b>
          <em>${escapeHtml(locationShortAddress(location))}</em>
        </span>
        <strong>&gt;</strong>
      </button>`).join("")}
    </div>
  </section>` : ""}
  ${!saved.length && !recent.length ? `<p class="customer-location-picker-empty">No saved or recent locations yet. Search manually or enable current location.</p>` : ""}`;
}

function updateCustomerLocationPickerPermissionUi() {
  const overlay = root.querySelector("[data-location-picker-overlay]");
  const card = overlay?.querySelector(".customer-location-permission-card");
  const button = overlay?.querySelector("[data-use-current-location]");
  const message = overlay?.querySelector("[data-location-inline-message]");
  const currentLocation = state.currentDeviceLocation || {};
  const hasCurrentLocation = state.customerLocationPermissionGranted && Number.isFinite(Number(currentLocation.latitude)) && Number.isFinite(Number(currentLocation.longitude));
  const currentLocationActionLabel = "Change";
  if (card && hasCurrentLocation) {
    card.classList.add("current");
    card.innerHTML = `<span class="customer-location-disabled-icon">${customerIcon("map")}</span>
      <div><b>${escapeHtml(customerDisplayLocationLabel(currentLocation) || "Current location")}</b><small>${escapeHtml(locationShortAddress(currentLocation))}</small></div>
      <button type="button" data-change-current-location>${currentLocationActionLabel}</button>`;
  }
  if (button) {
    button.textContent = state.locationBusy ? "Enabling..." : "Enable";
    button.disabled = Boolean(state.locationBusy);
  }
  if (message) {
    message.textContent = state.locationMessage || "";
    message.classList.toggle("visible", Boolean(state.locationMessage));
  }
  return Boolean(overlay);
}

function updateCustomerHomeLocationPickerSearch({ focusSearch = false } = {}) {
  if (!["home", "cart"].includes(state.customerView) || !state.customerLocationPickerSheetOpen) return false;
  const overlay = root.querySelector("[data-location-picker-overlay]");
  const sheet = overlay?.querySelector(".customer-location-picker-sheet");
  const sticky = overlay?.querySelector(".customer-location-search-sticky");
  const form = overlay?.querySelector("[data-location-search-form]");
  const input = overlay?.querySelector("[data-location-search-input]");
  const body = overlay?.querySelector("[data-location-picker-body]");
  if (!overlay || !sheet || !sticky || !form || !input || !body) return false;
  const searching = Boolean(String(state.locationSearchQuery || "").trim());
  sheet.classList.toggle("is-searching", searching);
  sheet.classList.toggle("is-listing", !searching);
  sticky.classList.toggle("active", searching);
  if (input.value !== state.locationSearchQuery) input.value = state.locationSearchQuery;
  const clearButton = form.querySelector("[data-clear-location-search]");
  if (searching && !clearButton) {
    form.insertAdjacentHTML("beforeend", `<button class="customer-location-search-clear" data-clear-location-search type="button" aria-label="Clear search">${customerIcon("x")}</button>`);
  } else if (!searching && clearButton) {
    clearButton.remove();
  }
  body.innerHTML = searching ? customerHomeLocationSearchResults() : customerHomeLocationPickerListHtml();
  if (focusSearch) setTimeout(focusLocationSearchInput, 0);
  return true;
}

function customerHomeLocationPickerHost() {
  return root.querySelector(".zigo-commerce-home") || root.querySelector(".customer-cart-screen");
}

function syncCustomerHomeLocationPickerSheet({ focusSearch = false } = {}) {
  if (isCustomerLocationPickerSuppressed()) {
    state.customerLocationPickerSheetOpen = false;
    state.customerLocationPickerClosing = false;
    root.querySelector("[data-location-picker-overlay]")?.remove();
    return;
  }
  const host = customerHomeLocationPickerHost();
  if (!host || !["home", "cart"].includes(state.customerView)) {
    render();
    if (focusSearch) setTimeout(focusLocationSearchInput, 80);
    return;
  }
  const existing = host.querySelector("[data-location-picker-overlay]");
  if (!state.customerLocationPickerSheetOpen) {
    if (!existing) return;
    existing.classList.add("is-closing");
    window.setTimeout(() => {
      if (state.customerLocationPickerSheetOpen) return;
      existing.remove();
      state.customerLocationPickerClosing = false;
      state.locationStep = "permission";
    }, 150);
    return;
  }
  state.customerLocationPickerClosing = false;
  const html = customerHomeLocationPickerSheet();
  if (existing) existing.outerHTML = html;
  else host.insertAdjacentHTML("beforeend", html);
  if (focusSearch) setTimeout(focusLocationSearchInput, 80);
}

function openCustomerLocationPickerSheet({ step = null, focusSearch = false } = {}) {
  if (isCustomerLocationPickerSuppressed()) return;
  const canPatch = Boolean(customerHomeLocationPickerHost()) && ["home", "cart"].includes(state.customerView);
  if (!["home", "cart"].includes(state.customerView)) state.customerView = "home";
  state.customerLocationPickerSheetOpen = true;
  state.customerLocationPickerClosing = false;
  if (step) state.locationStep = step;
  if (canPatch) syncCustomerHomeLocationPickerSheet({ focusSearch });
  else {
    render();
    if (focusSearch) setTimeout(focusLocationSearchInput, 80);
  }
  refreshCustomerLocationPermissionState().then(() => {
    if (["home", "cart"].includes(state.customerView) && state.customerLocationPickerSheetOpen) syncCustomerHomeLocationPickerSheet({ focusSearch });
  });
}

function closeCustomerLocationPickerSheet() {
  state.locationMessage = "";
  state.locationBusy = false;
  state.customerLocationPickerSheetOpen = false;
  state.customerLocationPickerClosing = true;
  state.customerLocationPickerPurpose = "";
  state.customerCartRouteEditIndex = -1;
  syncCustomerHomeLocationPickerSheet();
}

function updateCustomerHomeLocationHeaderOnly() {
  const home = root.querySelector(".zigo-commerce-home");
  if (!home) return false;
  const hero = home.querySelector(".zigo-commerce-hero.zigo-native-hero");
  if (!hero) return false;
  hero.outerHTML = customerHomeHeader();
  return true;
}

function transitionCustomerLocationPickerToConfirm() {
  state.customerLocationPickerSheetOpen = false;
  state.customerLocationPickerClosing = true;
  syncCustomerHomeLocationPickerSheet();
  window.setTimeout(() => {
    state.customerLocationPickerClosing = false;
    state.customerView = "location";
    state.locationStep = "confirm";
    renderCustomerLocation();
  }, 155);
}

function startCustomerCartRouteDrag(event) {
  const row = event.target instanceof Element ? event.target.closest(".customer-route-detail-row[data-route-stop-index]") : null;
  if (!row || event.target.closest("button")) return false;
  const routeList = row.closest(".customer-route-detail-list");
  if (!routeList || !row.closest(".customer-cart-locations.is-expanded")) return false;
  const index = Number(row.dataset.routeStopIndex);
  if (!Number.isFinite(index)) return false;
  customerCartRouteDrag = {
    row,
    routeList,
    index,
    startY: event.clientY,
    currentY: event.clientY,
    moved: false
  };
  if (typeof row.setPointerCapture === "function" && event.pointerId !== undefined) {
    try {
      row.setPointerCapture(event.pointerId);
    } catch {
      // Ignore capture failures on older WebViews.
    }
  }
  return true;
}

function moveCustomerCartRouteDrag(event) {
  const drag = customerCartRouteDrag;
  if (!drag?.row) return;
  drag.currentY = event.clientY;
  const deltaY = event.clientY - drag.startY;
  if (!drag.moved && Math.abs(deltaY) < 8) return;
  drag.moved = true;
  drag.row.classList.add("is-reordering");
  drag.row.style.transform = `translateY(${deltaY}px)`;
  event.preventDefault?.();
}

function endCustomerCartRouteDrag(event) {
  const drag = customerCartRouteDrag;
  if (!drag?.row) return;
  const row = drag.row;
  row.classList.remove("is-reordering");
  row.style.transform = "";
  if (typeof row.releasePointerCapture === "function" && event?.pointerId !== undefined) {
    try {
      row.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore capture failures on older WebViews.
    }
  }
  customerCartRouteDrag = null;
  if (!drag.moved) return;
  customerCartRouteSuppressClickUntil = Date.now() + 320;
  const rows = Array.from(drag.routeList.querySelectorAll(".customer-route-detail-row[data-route-stop-index]"));
  const pointerY = Number(event?.clientY ?? drag.currentY);
  let targetIndex = rows.length - 1;
  for (const item of rows) {
    const rect = item.getBoundingClientRect();
    const itemIndex = Number(item.dataset.routeStopIndex);
    if (!Number.isFinite(itemIndex) || itemIndex === drag.index) continue;
    if (pointerY < rect.top + rect.height / 2) {
      targetIndex = itemIndex;
      break;
    }
  }
  if (pointerY > rows[rows.length - 1]?.getBoundingClientRect().bottom) targetIndex = rows.length - 1;
  if (moveCustomerCartRouteStop(drag.index, targetIndex)) refreshCustomerCartLocationSection();
}

function customerLocationPermissionPopupHtml() {
  if (!state.customerLocationPermissionPopupOpen || (state.customerView !== "home" && state.customerView !== "location")) return "";
  return `<div class="customer-location-permission-modal" role="dialog" aria-modal="true" aria-label="Location permission not enabled">
    <div class="customer-location-permission-backdrop" aria-hidden="true"></div>
    <section class="customer-location-permission-dialog">
      <div class="customer-location-permission-hero" aria-hidden="true">
        ${customerIcon("map")}
        <span></span>
      </div>
      <h2>Location permission not enabled</h2>
      <p>Please enable location permission for a better service experience</p>
      <button class="customer-location-permission-action primary" data-location-permission-enable type="button" ${state.locationBusy ? "disabled" : ""}>${state.locationBusy ? "Enabling..." : "Enable device location"}</button>
      <button class="customer-location-permission-action" data-location-permission-manual type="button">Select location manually</button>
    </section>
  </div>`;
}

function customerHomeLocationSearchResults() {
  const mapResults = Array.isArray(state.locationResults) ? state.locationResults : [];
  const hasAny = mapResults.length || state.locationBusy;
  if (!hasAny) return `<div class="customer-location-search-results"><p class="customer-location-picker-empty">No matching locations found.</p></div>`;
  return `<div class="customer-location-search-results">
    <section class="customer-location-search-group">
      <h3>Map Search</h3>
      ${state.locationBusy ? `<p class="customer-location-picker-empty">Searching map locations...</p>` : mapResults.length ? mapResults.map((result, index) => `<button class="customer-location-search-result-card" data-location-result="${index}" type="button">
      <span class="customer-location-result-icon">${customerIcon("map")}</span>
      <span>
        <b>${escapeHtml(result.label || "Location")}</b>
        <em>${escapeHtml(result.address || "")}</em>
      </span>
    </button>`).join("") : `<p class="customer-location-picker-empty">No map locations found.</p>`}
    </section>
  </div>`;
}

function customerSavedLocationIcon(label = "") {
  const text = String(label || "").trim().toLowerCase();
  if (text === "home" || text.includes("home")) return customerIcon("home");
  if (text === "work" || text.includes("work") || text.includes("office") || text.includes("business")) return customerIcon("business");
  return customerIcon("map");
}

function customerHomeLocationStoredSearchCard(location = {}, index = 0, type = "saved") {
  const isRecent = type === "recent";
  const attr = isRecent ? `data-use-recent-location="${escapeHtml(index)}"` : `data-use-saved-address="${escapeHtml(index)}"`;
  const title = location.label || (isRecent ? "Recent" : "Saved");
  return `<button class="customer-location-search-result-card" ${attr} type="button">
    <span class="customer-location-picker-icon ${isRecent ? "recent" : "saved-icon"}">${isRecent ? customerIcon("history") : customerSavedLocationIcon(title)}</span>
    <span>
      <b>${escapeHtml(title)}</b>
      <em>${escapeHtml(locationShortAddress(location))}</em>
      ${location.metadata?.contactNumber ? `<small>Phone number: <strong>${escapeHtml(location.metadata.contactNumber)}</strong></small>` : ""}
    </span>
  </button>`;
}

function customerLocationResults() {
  const results = Array.isArray(state.locationResults) ? state.locationResults : [];
  if (!results.length) return state.locationSearchQuery ? `<p class="muted location-empty">No searched location selected yet.</p>` : "";
  return `<div class="location-result-list">
    ${results.map((result, index) => `<button class="location-result-card" data-location-result="${index}" type="button">
      <b>${escapeHtml(result.label || "Location")}</b>
      <span>${escapeHtml(result.address || "")}</span>
    </button>`).join("")}
  </div>`;
}

function customerLocationPreview({ interactive = false } = {}) {
  const picked = state.locationPicked || state.selectedLocation;
  if (!picked) return `<div class="location-preview empty"><b>Pick a point</b><span>Use current location or search with Ola Maps.</span></div>`;
  const cluster = customerLocationCluster(picked);
  const serviceable = Boolean(cluster.clusterId);
  const calloutTitle = customerDisplayLocationLabel(picked) || picked.label || "Picked location";
  if (interactive) {
    return `<div class="location-preview ${serviceable ? "serviceable" : "not-serviceable"} map-only">
      <div class="customer-location-map-shell">
        <div id="customerLocationMap" class="customer-location-real-map"><div class="location-map-loading">Loading map...</div></div>
        <span class="map-callout">${escapeHtml(calloutTitle)}</span>
        <span class="customer-location-map-pin" aria-hidden="true">${customerIcon("map")}</span>
        <small class="customer-location-map-coords" data-customer-map-coords>${Number(picked.latitude || 0).toFixed(6)}, ${Number(picked.longitude || 0).toFixed(6)}</small>
      </div>
    </div>`;
  }
  return `<div class="location-preview ${serviceable ? "serviceable" : "not-serviceable"}">
    <div class="map-preview ${interactive ? "interactive" : ""}" ${interactive ? "data-location-map-preview" : ""}>
      <div class="map-pan-layer" data-map-pan-layer>
        <div class="map-road one"></div>
        <div class="map-road two"></div>
        <div class="map-road three"></div>
        <div class="map-road four"></div>
        <span class="map-label label-one">Gurugram Rd</span>
        <span class="map-label label-two">Sadar Bazaar</span>
        <span class="map-label label-three">Jain Rd</span>
        <span class="map-label label-four">Gurgaon</span>
      </div>
      <span class="map-callout">${serviceable ? "Your help will arrive here" : "Move pin or change location"}</span>
      <span class="map-pin">P</span>
      <small>${Number(picked.latitude || 0).toFixed(5)}, ${Number(picked.longitude || 0).toFixed(5)}</small>
    </div>
    <div class="location-preview-copy">
      <b>${escapeHtml(picked.label || "Picked location")}</b>
      <p>${escapeHtml(locationShortAddress(picked))}</p>
      <span>${serviceable ? `Active cluster: ${escapeHtml(cluster.name)}` : "Service not available at this location"}</span>
    </div>
  </div>`;
}

function customerLocationHasCoordinates(location) {
  return Number.isFinite(Number(location?.latitude)) && Number.isFinite(Number(location?.longitude));
}

function customerLocationMapCenterLocation() {
  const picked = state.locationPicked || state.selectedLocation;
  if (customerLocationHasCoordinates(picked)) return picked;
  return { latitude: 28.4595, longitude: 77.0266 };
}

function customerLocationMapWorldPoint(latitude, longitude, zoom) {
  const scale = 256 * 2 ** zoom;
  const sinLat = Math.sin((Number(latitude) * Math.PI) / 180);
  return {
    x: ((Number(longitude) + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
  };
}

function customerLocationMapLatLngFromWorld(x, y, zoom) {
  const scale = 256 * 2 ** zoom;
  const longitude = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const latitude = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { latitude, longitude };
}

function customerLocationClusterPolygonCoordinates() {
  const coordinates = state.locationServiceability?.cluster?.polygonCoordinates
    || state.locationPicked?.serviceability?.cluster?.polygonCoordinates
    || state.selectedLocation?.serviceability?.cluster?.polygonCoordinates
    || [];
  if (!Array.isArray(coordinates)) return [];
  return coordinates
    .map((point) => ({ latitude: Number(point.latitude), longitude: Number(point.longitude) }))
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
}

function customerLocationPolygonLabelPoint(polygon) {
  const points = polygon.filter((point, index) => index === 0 || point.latitude !== polygon[0].latitude || point.longitude !== polygon[0].longitude);
  const source = points.length ? points : polygon;
  return source.reduce(
    (sum, point) => ({ latitude: sum.latitude + point.latitude / source.length, longitude: sum.longitude + point.longitude / source.length }),
    { latitude: 0, longitude: 0 }
  );
}

function customerLocationClusterOverlaySvg(topLeft, zoom) {
  const polygon = customerLocationClusterPolygonCoordinates();
  const cluster = customerLocationCluster();
  if (polygon.length < 3 || !cluster.clusterId) return "";
  const points = polygon
    .map((point) => {
      const world = customerLocationMapWorldPoint(point.latitude, point.longitude, zoom);
      return `${(world.x - topLeft.x).toFixed(1)},${(world.y - topLeft.y).toFixed(1)}`;
    })
    .join(" ");
  return `<svg class="customer-simple-map-cluster" aria-label="Working cluster boundary">
    <polygon points="${points}" class="customer-simple-map-cluster-fill"></polygon>
    <polyline points="${points}" class="customer-simple-map-cluster-line"></polyline>
  </svg>`;
}

function renderCustomerLocationSimpleMap() {
  const mapEl = document.querySelector("#customerLocationMap");
  if (!mapEl || !customerLocationSimpleMap) return;
  const { latitude, longitude, zoom } = customerLocationSimpleMap;
  const rect = mapEl.getBoundingClientRect();
  const width = Math.max(320, rect.width || mapEl.clientWidth || 390);
  const height = Math.max(280, rect.height || mapEl.clientHeight || 430);
  const center = customerLocationMapWorldPoint(latitude, longitude, zoom);
  const topLeft = { x: center.x - width / 2, y: center.y - height / 2 };
  const minTileX = Math.floor(topLeft.x / 256) - 1;
  const maxTileX = Math.floor((topLeft.x + width) / 256) + 1;
  const minTileY = Math.floor(topLeft.y / 256) - 1;
  const maxTileY = Math.floor((topLeft.y + height) / 256) + 1;
  const tileMax = 2 ** zoom;
  const tiles = [];
  for (let x = minTileX; x <= maxTileX; x += 1) {
    for (let y = minTileY; y <= maxTileY; y += 1) {
      if (y < 0 || y >= tileMax) continue;
      const wrappedX = ((x % tileMax) + tileMax) % tileMax;
      const left = Math.round(x * 256 - topLeft.x);
      const top = Math.round(y * 256 - topLeft.y);
      const subdomain = ["a", "b", "c"][Math.abs(wrappedX + y) % 3];
      tiles.push(`<img class="customer-simple-map-tile" src="https://${subdomain}.tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png" referrerpolicy="no-referrer" alt="" style="left:${left}px;top:${top}px">`);
    }
  }
  mapEl.innerHTML = `<div class="customer-simple-map-canvas">${tiles.join("")}${customerLocationClusterOverlaySvg(topLeft, zoom)}</div>`;
  const coords = document.querySelector("[data-customer-map-coords]");
  if (coords) coords.textContent = `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
}

function setCustomerLocationSimpleMapCenter(latitude, longitude, zoom = customerLocationSimpleMap?.zoom || 17) {
  customerLocationSimpleMap = {
    ...(customerLocationSimpleMap || {}),
    latitude: Math.max(-85, Math.min(85, Number(latitude))),
    longitude: Math.max(-180, Math.min(180, Number(longitude))),
    zoom: Math.max(3, Math.min(19, Number(zoom) || 17)),
    dragging: false,
    dragMoved: false,
    suppressClickUntil: 0,
    dragStart: null,
    startCenter: null
  };
  renderCustomerLocationSimpleMap();
}

function adjustCustomerLocationMapZoom(delta = 0) {
  const map = resolveCustomerOlaMapObject();
  const currentZoom = Number(map?.getZoom?.() || customerLocationSimpleMap?.zoom || 17);
  const nextZoom = Math.max(3, Math.min(19, currentZoom + Number(delta || 0)));
  if (map?.zoomTo) {
    map.zoomTo(nextZoom, { duration: 120 });
    setTimeout(syncCustomerOlaMapCenter, 140);
    return;
  }
  if (!customerLocationSimpleMap) {
    const center = customerLocationMapCenterLocation();
    setCustomerLocationSimpleMapCenter(center.latitude, center.longitude, nextZoom);
  } else {
    customerLocationSimpleMap.zoom = nextZoom;
    renderCustomerLocationSimpleMap();
  }
  scheduleCustomerLocationSimpleMapPick();
}

async function applyCustomerLocationPinLocation(latitude, longitude) {
  const url = `/portal/customer/locations/reverse?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`;
  const reverse = await portalCachedGet(url, { cacheKey: url })
    .catch(() => ({
      data: {
        label: "Map pin location",
        address: `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`,
        latitude,
        longitude,
        source: "map"
      }
    }));
  await validateAndPickCustomerLocation({
    ...reverse.data,
    latitude,
    longitude,
    source: "map"
  }, {
    rememberRecent: false,
    setPreferred: false
  });
}

function refreshCustomerLocationConfirmDetails() {
  const screen = root.querySelector(".location-confirm-screen");
  if (!screen) return;
  const picked = state.locationPicked || state.selectedLocation;
  const cluster = picked ? customerLocationCluster(picked) : {};
  const serviceability = state.locationServiceability || picked?.serviceability || {};
  const canContinue = Boolean(picked && cluster.clusterId && serviceability.isServiceable !== false);
  const title = customerDisplayLocationLabel(picked || {}) || "Picked location";
  const address = locationShortAddress(picked || {});
  const details = screen.querySelector(".location-confirm-details");
  const form = details?.querySelector("[data-location-continue-form]");
  let message = details?.querySelector(":scope > .location-message.danger");
  if (state.locationMessage && !canContinue) {
    if (!message && form) {
      message = document.createElement("p");
      message.className = "location-message danger";
      details.insertBefore(message, form);
    }
    if (message) message.textContent = state.locationMessage;
  } else {
    message?.remove();
  }
  const titleCard = screen.querySelector(".picked-location-title");
  titleCard?.querySelector("b") && (titleCard.querySelector("b").textContent = title);
  titleCard?.querySelector("small") && (titleCard.querySelector("small").textContent = address);
  const titleIcon = titleCard?.querySelector(":scope > span");
  if (titleIcon) {
    titleIcon.classList.toggle("ok", canContinue);
    titleIcon.classList.toggle("bad", !canContinue);
  }
  const submitButton = screen.querySelector(".confirm-location-btn");
  if (submitButton) {
    submitButton.disabled = !canContinue;
    submitButton.innerHTML = `${state.locationBusy ? "Please wait..." : "Confirm Location"} ${customerIcon("chevron")}`;
  }
  const callout = screen.querySelector(".map-callout");
  if (callout) callout.textContent = title;
  const coords = screen.querySelector("[data-customer-map-coords]");
  if (coords && picked) coords.textContent = `${Number(picked.latitude || 0).toFixed(6)}, ${Number(picked.longitude || 0).toFixed(6)}`;
}

function scheduleCustomerLocationSimpleMapPick() {
  if (!customerLocationSimpleMap) return;
  const { latitude, longitude } = customerLocationSimpleMap;
  const syncKey = `${Number(latitude).toFixed(6)},${Number(longitude).toFixed(6)}`;
  if (syncKey === customerLocationLastMapSyncKey) return;
  customerLocationLastMapSyncKey = syncKey;
  if (customerLocationMapSyncTimer) clearTimeout(customerLocationMapSyncTimer);
  customerLocationMapSyncTimer = setTimeout(async () => {
    try {
      state.locationBusy = true;
      await applyCustomerLocationPinLocation(latitude, longitude);
      state.locationStep = "confirm";
      state.locationBusy = false;
      refreshCustomerLocationConfirmDetails();
    } catch (error) {
      state.locationBusy = false;
      state.locationMessage = error.message || "Unable to verify selected map pin.";
      refreshCustomerLocationConfirmDetails();
    }
  }, 450);
}

function customerOlaMapConfig() {
  const maps = state.portalConfig?.maps || {};
  return {
    olaMapsApiKey: String(maps.olaMapsApiKey || state.portalConfig?.olaMapsApiKey || "").trim(),
    olaMapsStyleUrl: String(maps.olaMapsStyleUrl || state.portalConfig?.olaMapsStyleUrl || "https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json").trim()
  };
}

async function ensureCustomerOlaMapConfig() {
  try {
    const configPayload = await portalCachedGet("/portal/config", {
      cacheKey: "/portal/config",
      maxAgeMs: 0,
      forceRefresh: true
    });
    state.portalConfig = configPayload.data || state.portalConfig || null;
    persistSessionCache();
  } catch (error) {
    // The caller will fall back to the lightweight local map if Ola config is unavailable.
  }
  return customerOlaMapConfig();
}

function loadCustomerOlaMapsSdk() {
  if (window.OlaMaps) return Promise.resolve();
  if (customerOlaMapsScriptPromise) return customerOlaMapsScriptPromise;
  customerOlaMapsScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-ola-maps-sdk]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load Ola Maps.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.unpkg.com/olamaps-web-sdk@latest/dist/olamaps-web-sdk.umd.js";
    script.async = true;
    script.dataset.olaMapsSdk = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Ola Maps Web SDK. Check internet access and CSP settings."));
    document.head.appendChild(script);
  });
  return customerOlaMapsScriptPromise;
}

function cleanCustomerOlaStyleUrl(styleUrl) {
  try {
    const url = new URL(styleUrl);
    url.searchParams.delete("api_key");
    return url.toString();
  } catch (error) {
    return styleUrl;
  }
}

function customerOlaFallbackRasterStyle() {
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: [
          "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
        ],
        tileSize: 256,
        attribution: "OpenStreetMap contributors"
      }
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }]
  };
}

function isCustomerOlaMapAuthOrDomainError(error) {
  const message = String(error?.message || error?.error?.message || error || "");
  const status = String(error?.status || error?.error?.status || "");
  return status === "401" || status === "403" || /401|403|unauthori[sz]ed|forbidden|domain is not allowed|domain.*not allowed|api key/i.test(message);
}

function readCustomerMapLngLat(value) {
  if (!value) return { latitude: NaN, longitude: NaN };
  if (Array.isArray(value)) return { longitude: Number(value[0]), latitude: Number(value[1]) };
  if (typeof value.toArray === "function") {
    const coordinates = value.toArray();
    return { longitude: Number(coordinates?.[0]), latitude: Number(coordinates?.[1]) };
  }
  return {
    longitude: Number(value.lng ?? value.lon ?? value.longitude ?? value._lng ?? value[0]),
    latitude: Number(value.lat ?? value.latitude ?? value._lat ?? value[1])
  };
}

function customerOlaMapObjects() {
  const map = customerOlaLocationMap;
  return [map, map?._map, map?.map, map?.mapInstance, map?.olamap].filter(Boolean);
}

function resolveCustomerOlaMapObject() {
  customerOlaLocationMapResolved = customerOlaMapObjects().find((map) =>
    typeof map?.getCenter === "function" ||
    typeof map?.unproject === "function" ||
    typeof map?.on === "function"
  ) || null;
  return customerOlaLocationMapResolved;
}

function customerOlaScreenCenterLatLng() {
  const mapEl = document.querySelector("#customerLocationMap");
  if (!mapEl) return { latitude: NaN, longitude: NaN };
  const rect = mapEl.getBoundingClientRect();
  const point = [rect.width / 2, rect.height / 2];
  for (const map of customerOlaMapObjects()) {
    const projected = map?.unproject?.(point);
    const location = readCustomerMapLngLat(projected);
    if (Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) return location;
  }
  return { latitude: NaN, longitude: NaN };
}

function readCustomerOlaMapCenter(map = customerOlaLocationMapResolved || resolveCustomerOlaMapObject()) {
  const candidates = [map?.getCenter?.(), map?.transform?.center];
  for (const candidate of candidates) {
    const point = readCustomerMapLngLat(candidate);
    if (Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) return point;
  }
  const screenCenter = customerOlaScreenCenterLatLng();
  if (Number.isFinite(screenCenter.latitude) && Number.isFinite(screenCenter.longitude)) return screenCenter;
  return { latitude: NaN, longitude: NaN };
}

function syncCustomerOlaMapCenter() {
  if (!customerOlaLocationMap) return;
  const center = readCustomerOlaMapCenter();
  if (!Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) return;
  customerLocationSimpleMap = {
    ...(customerLocationSimpleMap || {}),
    latitude: center.latitude,
    longitude: center.longitude,
    zoom: resolveCustomerOlaMapObject()?.getZoom?.() || customerLocationSimpleMap?.zoom || 17
  };
  scheduleCustomerLocationSimpleMapPick();
}

function initializeCustomerLocationRasterFallbackMap(mapEl, center = customerLocationMapCenterLocation()) {
  if (!mapEl) return;
  customerOlaLocationMap?.remove?.();
  customerOlaLocationMap = null;
  customerOlaLocationMapResolved = null;
  customerLocationMapPointers = new Map();
  customerLocationMapPinch = null;
  setCustomerLocationSimpleMapCenter(center.latitude, center.longitude, customerLocationSimpleMap?.zoom || 17);
  customerLocationLastMapSyncKey = `${Number(customerLocationSimpleMap.latitude).toFixed(6)},${Number(customerLocationSimpleMap.longitude).toFixed(6)}`;
  mapEl.onpointerdown = (event) => {
    if (!customerLocationSimpleMap) return;
    event.preventDefault();
    mapEl.setPointerCapture?.(event.pointerId);
    customerLocationMapPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (customerLocationMapPointers.size >= 2) {
      const points = Array.from(customerLocationMapPointers.values()).slice(0, 2);
      customerLocationMapPinch = {
        distance: Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)),
        zoom: customerLocationSimpleMap.zoom
      };
      customerLocationSimpleMap.dragging = false;
      return;
    }
    customerLocationSimpleMap.dragging = true;
    customerLocationSimpleMap.dragMoved = false;
    customerLocationSimpleMap.dragStart = { x: event.clientX, y: event.clientY };
    customerLocationSimpleMap.startCenter = {
      latitude: customerLocationSimpleMap.latitude,
      longitude: customerLocationSimpleMap.longitude
    };
  };
  mapEl.onpointermove = (event) => {
    if (!customerLocationSimpleMap) return;
    if (customerLocationMapPointers.has(event.pointerId)) {
      customerLocationMapPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (customerLocationMapPointers.size >= 2 && customerLocationMapPinch) {
      event.preventDefault();
      const points = Array.from(customerLocationMapPointers.values()).slice(0, 2);
      const distance = Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y));
      const zoomDelta = Math.round(Math.log2(distance / customerLocationMapPinch.distance));
      const nextZoom = Math.max(3, Math.min(19, customerLocationMapPinch.zoom + zoomDelta));
      if (nextZoom !== customerLocationSimpleMap.zoom) {
        customerLocationSimpleMap.zoom = nextZoom;
        renderCustomerLocationSimpleMap();
      }
      return;
    }
    if (!customerLocationSimpleMap.dragging || !customerLocationSimpleMap.dragStart || !customerLocationSimpleMap.startCenter) return;
    event.preventDefault();
    const start = customerLocationMapWorldPoint(customerLocationSimpleMap.startCenter.latitude, customerLocationSimpleMap.startCenter.longitude, customerLocationSimpleMap.zoom);
    const dx = event.clientX - customerLocationSimpleMap.dragStart.x;
    const dy = event.clientY - customerLocationSimpleMap.dragStart.y;
    customerLocationSimpleMap.dragMoved = customerLocationSimpleMap.dragMoved || Math.hypot(dx, dy) > 6;
    customerLocationSimpleMap.dragOffset = { dx, dy, start };
    const canvas = mapEl.querySelector(".customer-simple-map-canvas");
    if (canvas) canvas.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  mapEl.onpointerup = (event) => {
    if (!customerLocationSimpleMap) return;
    mapEl.releasePointerCapture?.(event.pointerId);
    customerLocationMapPointers.delete(event.pointerId);
    if (customerLocationMapPointers.size < 2) customerLocationMapPinch = null;
    if (customerLocationSimpleMap.dragMoved) customerLocationSimpleMap.suppressClickUntil = Date.now() + 300;
    if (customerLocationSimpleMap.dragOffset) {
      const { dx, dy, start } = customerLocationSimpleMap.dragOffset;
      const next = customerLocationMapLatLngFromWorld(start.x - dx, start.y - dy, customerLocationSimpleMap.zoom);
      customerLocationSimpleMap.latitude = Math.max(-85, Math.min(85, next.latitude));
      customerLocationSimpleMap.longitude = Math.max(-180, Math.min(180, next.longitude));
      customerLocationSimpleMap.dragOffset = null;
      renderCustomerLocationSimpleMap();
    }
    customerLocationSimpleMap.dragging = false;
    scheduleCustomerLocationSimpleMapPick();
  };
  mapEl.onpointercancel = (event) => {
    customerLocationMapPointers.delete(event.pointerId);
    customerLocationMapPinch = null;
    if (customerLocationSimpleMap) {
      customerLocationSimpleMap.dragging = false;
      customerLocationSimpleMap.dragOffset = null;
      renderCustomerLocationSimpleMap();
    }
  };
  mapEl.onclick = (event) => {
    if (!customerLocationSimpleMap || customerLocationSimpleMap.dragging || Date.now() < Number(customerLocationSimpleMap.suppressClickUntil || 0)) return;
    const rect = mapEl.getBoundingClientRect();
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    const centerPoint = customerLocationMapWorldPoint(customerLocationSimpleMap.latitude, customerLocationSimpleMap.longitude, customerLocationSimpleMap.zoom);
    const next = customerLocationMapLatLngFromWorld(centerPoint.x + dx, centerPoint.y + dy, customerLocationSimpleMap.zoom);
    setCustomerLocationSimpleMapCenter(next.latitude, next.longitude, customerLocationSimpleMap.zoom);
    scheduleCustomerLocationSimpleMapPick();
  };
  mapEl.onwheel = (event) => {
    event.preventDefault();
    if (!customerLocationSimpleMap) return;
    customerLocationSimpleMap.zoom = Math.max(3, Math.min(19, customerLocationSimpleMap.zoom + (event.deltaY < 0 ? 1 : -1)));
    renderCustomerLocationSimpleMap();
    scheduleCustomerLocationSimpleMapPick();
  };
}

async function initializeCustomerLocationOlaMap() {
  const mapEl = document.querySelector("#customerLocationMap");
  if (!mapEl) return;
  const center = customerLocationMapCenterLocation();
  customerLocationSimpleMap = {
    ...(customerLocationSimpleMap || {}),
    latitude: Number(center.latitude),
    longitude: Number(center.longitude),
    zoom: customerLocationSimpleMap?.zoom || 17
  };
  customerLocationLastMapSyncKey = `${Number(center.latitude).toFixed(6)},${Number(center.longitude).toFixed(6)}`;
  mapEl.innerHTML = `<div class="location-map-loading">Loading Ola Maps...</div>`;
  const { olaMapsApiKey } = await ensureCustomerOlaMapConfig();
  if (!olaMapsApiKey) throw new Error("Ola Maps API key is not configured.");
  await loadCustomerOlaMapsSdk();
  if (!document.body.contains(mapEl)) return;
  mapEl.innerHTML = "";
  const olaMaps = new window.OlaMaps({ apiKey: olaMapsApiKey });
  const initMap = (style) => olaMaps.init({
    style,
    container: "customerLocationMap",
    center: [Number(center.longitude), Number(center.latitude)],
    zoom: customerLocationSimpleMap.zoom
  });
  const bindSync = () => {
    const map = resolveCustomerOlaMapObject();
    ["moveend", "dragend", "zoomend", "idle"].forEach((eventName) => map?.on?.(eventName, syncCustomerOlaMapCenter));
    mapEl.addEventListener("pointerup", () => setTimeout(syncCustomerOlaMapCenter, 120));
    mapEl.addEventListener("touchend", () => setTimeout(syncCustomerOlaMapCenter, 120));
    mapEl.addEventListener("wheel", () => setTimeout(syncCustomerOlaMapCenter, 120));
    syncCustomerOlaMapCenter();
  };
  const bindMapEvents = () => {
    customerOlaLocationMap.on?.("load", () => {
      customerOlaLocationMap?.resize?.();
      bindSync();
    });
    setTimeout(bindSync, 350);
    customerOlaLocationMap.on?.("click", (event) => {
      const { latitude, longitude } = readCustomerMapLngLat(event?.lngLat);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      customerOlaLocationMap?.flyTo?.({ center: [longitude, latitude], zoom: customerLocationSimpleMap.zoom, duration: 160 });
      setTimeout(syncCustomerOlaMapCenter, 180);
    });
  };
  let usedFallback = false;
  customerOlaLocationMap = initMap("/customer-ola-raster-style.json");
  bindMapEvents();
  customerOlaLocationMap.on?.("error", (event) => {
    const error = event?.error || event;
    if (usedFallback || !isCustomerOlaMapAuthOrDomainError(error)) return;
    usedFallback = true;
    customerOlaLocationMap?.remove?.();
    customerOlaLocationMap = null;
    customerOlaLocationMapResolved = null;
    initializeCustomerLocationRasterFallbackMap(mapEl, customerLocationSimpleMap || center);
  });
}

function initializeCustomerLocationSimpleMap() {
  const mapEl = document.querySelector("#customerLocationMap");
  if (!mapEl) return;
  initializeCustomerLocationRasterFallbackMap(mapEl);
  return;
  const center = customerLocationMapCenterLocation();
  setCustomerLocationSimpleMapCenter(center.latitude, center.longitude, customerLocationSimpleMap?.zoom || 17);
  customerLocationLastMapSyncKey = `${Number(customerLocationSimpleMap.latitude).toFixed(6)},${Number(customerLocationSimpleMap.longitude).toFixed(6)}`;
  mapEl.onpointerdown = (event) => {
    if (!customerLocationSimpleMap) return;
    mapEl.setPointerCapture?.(event.pointerId);
    customerLocationSimpleMap.dragging = true;
    customerLocationSimpleMap.dragMoved = false;
    customerLocationSimpleMap.dragStart = { x: event.clientX, y: event.clientY };
    customerLocationSimpleMap.startCenter = {
      latitude: customerLocationSimpleMap.latitude,
      longitude: customerLocationSimpleMap.longitude
    };
  };
  mapEl.onpointermove = (event) => {
    if (!customerLocationSimpleMap?.dragging || !customerLocationSimpleMap.dragStart || !customerLocationSimpleMap.startCenter) return;
    const start = customerLocationMapWorldPoint(customerLocationSimpleMap.startCenter.latitude, customerLocationSimpleMap.startCenter.longitude, customerLocationSimpleMap.zoom);
    const dx = event.clientX - customerLocationSimpleMap.dragStart.x;
    const dy = event.clientY - customerLocationSimpleMap.dragStart.y;
    customerLocationSimpleMap.dragMoved = customerLocationSimpleMap.dragMoved || Math.hypot(dx, dy) > 6;
    const next = customerLocationMapLatLngFromWorld(start.x - dx, start.y - dy, customerLocationSimpleMap.zoom);
    customerLocationSimpleMap.latitude = Math.max(-85, Math.min(85, next.latitude));
    customerLocationSimpleMap.longitude = Math.max(-180, Math.min(180, next.longitude));
    renderCustomerLocationSimpleMap();
  };
  mapEl.onpointerup = (event) => {
    if (!customerLocationSimpleMap) return;
    mapEl.releasePointerCapture?.(event.pointerId);
    if (customerLocationSimpleMap.dragMoved) customerLocationSimpleMap.suppressClickUntil = Date.now() + 300;
    customerLocationSimpleMap.dragging = false;
    scheduleCustomerLocationSimpleMapPick();
  };
  mapEl.onpointercancel = () => {
    if (customerLocationSimpleMap) customerLocationSimpleMap.dragging = false;
  };
  mapEl.onclick = (event) => {
    if (!customerLocationSimpleMap || customerLocationSimpleMap.dragging || Date.now() < Number(customerLocationSimpleMap.suppressClickUntil || 0)) return;
    const rect = mapEl.getBoundingClientRect();
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    const centerPoint = customerLocationMapWorldPoint(customerLocationSimpleMap.latitude, customerLocationSimpleMap.longitude, customerLocationSimpleMap.zoom);
    const next = customerLocationMapLatLngFromWorld(centerPoint.x + dx, centerPoint.y + dy, customerLocationSimpleMap.zoom);
    setCustomerLocationSimpleMapCenter(next.latitude, next.longitude, customerLocationSimpleMap.zoom);
    scheduleCustomerLocationSimpleMapPick();
  };
  mapEl.onwheel = (event) => {
    event.preventDefault();
    if (!customerLocationSimpleMap) return;
    customerLocationSimpleMap.zoom = Math.max(3, Math.min(19, customerLocationSimpleMap.zoom + (event.deltaY < 0 ? 1 : -1)));
    renderCustomerLocationSimpleMap();
    scheduleCustomerLocationSimpleMapPick();
  };
}

function cleanupCustomerLocationMap() {
  if (customerLocationMapSyncTimer) clearTimeout(customerLocationMapSyncTimer);
  customerLocationMapSyncTimer = null;
  customerOlaLocationMap?.remove?.();
  customerOlaLocationMap = null;
  customerOlaLocationMapResolved = null;
  customerLocationSimpleMap = null;
  customerLocationLastMapSyncKey = "";
}

function locationUnavailableHtml() {
  return `<section class="location-unavailable-card">
    <div class="location-unavailable-icon">!</div>
    <h2>Sorry our service is not in your area</h2>
    <p>But we'll try our best to reach you soon.</p>
    <button class="primary-btn" data-location-step="options" type="button">Change Location</button>
  </section>`;
}

function renderLocationPermission() {
  cleanupCustomerLocationMap();
  root.innerHTML = `<section class="mobile-app customer-flow-screen location-permission-screen">
    <div class="location-permission-dialog">
      <h1>To continue, your device will need to use location accuracy</h1>
      <p>The following settings should be on:</p>
      <div class="permission-row">
        <span>L</span>
        <b>Device location</b>
      </div>
      <div class="permission-row">
        <span>A</span>
        <p><b>Location Accuracy</b><small>Provides more accurate location for apps and services.</small></p>
      </div>
      <p class="muted">You can change this at any time in location settings.</p>
      ${state.locationMessage ? `<p class="location-message">${escapeHtml(state.locationMessage)}</p>` : ""}
      <div class="permission-actions">
        <button class="soft-btn" data-location-step="options" type="button">Cancel</button>
        <button class="primary-btn" data-use-current-location type="button" ${state.locationBusy ? "disabled" : ""}>${state.locationBusy ? "Checking..." : "Allow"}</button>
      </div>
    </div>
  </section>`;
}

function renderLocationOptions() {
  cleanupCustomerLocationMap();
  root.innerHTML = `<section class="mobile-app customer-flow-screen location-options-screen">
    <section class="location-options-hero">
      <div class="location-off-illustration"><span></span></div>
      <h1>We're looking for you</h1>
      <p>Your location service is off. Please provide access to your location for smooth service.</p>
      <button class="primary-btn" data-use-current-location type="button" ${state.locationBusy ? "disabled" : ""}>${state.locationBusy ? "Checking..." : "Allow Location"}</button>
      <button class="outline-btn" data-location-step="manual" type="button">Enter location manually</button>
    </section>
    ${state.locationMessage ? `<p class="location-message">${escapeHtml(state.locationMessage)}</p>` : ""}
    <div class="location-or">OR</div>
    <section class="saved-address-section">
      <header><h2>Saved Addresses</h2><button type="button">View all</button></header>
      ${customerSavedAddressList()}
    </section>
    ${customerRecentLocationList()}
    ${bottomNav("home")}
  </section>`;
}

function renderLocationManual() {
  cleanupCustomerLocationMap();
  root.innerHTML = `<section class="mobile-app customer-flow-screen location-manual-screen">
    <header class="location-search-head">
      <button class="round-back" data-location-step="options" type="button">&lt;</button>
      <h1>Search your location</h1>
    </header>
    <div class="location-search-ddl-wrap">
      <form class="location-search-form large" data-location-search-form>
        <span></span>
        <input name="q" value="${escapeHtml(state.locationSearchQuery)}" placeholder="Search location, building, sector" autocomplete="off" data-location-search-input>
        <button class="clear-search-btn" data-clear-location-search type="button">x</button>
        <button class="voice-search-btn" type="submit">${state.locationBusy ? "..." : "Search"}</button>
      </form>
      ${state.locationSearchQuery.trim().length >= 2 ? `<div class="location-ddl-panel">
        ${state.locationMessage ? `<p class="location-message">${escapeHtml(state.locationMessage)}</p>` : ""}
        ${customerLocationResults()}
      </div>` : ""}
    </div>
  </section>`;
}

function customerLocationIsPreviousUsed(location = {}) {
  const label = String(location.label || "").trim().toLowerCase();
  const kind = String(location.metadata?.addressKind || location.addressKind || "").trim().toLowerCase();
  return kind === "previous_used" || label === "previous used";
}

function customerLocationIsCurrentDefault(location = {}) {
  const kind = String(location.metadata?.addressKind || location.addressKind || "").trim().toLowerCase();
  return kind === "current_default";
}

function customerLocationIsSavedAddress(location = {}) {
  return Boolean(location?.addressId || location?.savedAddressId) && !customerLocationIsPreviousUsed(location) && !customerLocationIsCurrentDefault(location);
}

function customerSaveAsStateFromLocation(location = {}) {
  if (!customerLocationIsSavedAddress(location)) {
    return { label: "", customLabel: "", otherOpen: false, isDefault: false };
  }
  const label = String(location.label || "").trim();
  if (label === "Home" || label === "Work" || label === "Shop") {
    return { label: label === "Shop" ? "Work" : label, customLabel: "", otherOpen: false, isDefault: Boolean(location.isDefault) };
  }
  return { label: "Other", customLabel: label && label !== "Saved" ? label : "", otherOpen: false, isDefault: Boolean(location.isDefault) };
}

function hydrateConfirmLocationSaveAsState(location = {}) {
  const saveAs = customerSaveAsStateFromLocation(location);
  state.locationSaveAsLabel = saveAs.label;
  state.locationSaveAsCustomLabel = saveAs.customLabel;
  state.locationSaveAsOtherOpen = saveAs.otherOpen;
  state.locationSaveAsDefault = saveAs.isDefault;
  state.locationSaveAsMessage = "";
}

function confirmLocationSaveAsOptionsHtml() {
  const saveAsLabel = String(state.locationSaveAsLabel || "");
  const customLabel = String(state.locationSaveAsCustomLabel || "");
  const otherActionText = customLabel.trim() ? "Add" : "Close";
  const homeUsedMessage = customerSaveAsLabelMessage("Home");
  const workUsedMessage = customerSaveAsLabelMessage("Work");
  return `<input type="hidden" name="label" value="${escapeHtml(saveAsLabel)}">
    <input type="hidden" name="customLabel" value="${escapeHtml(customLabel)}">
    <button class="save-address-chip ${saveAsLabel === "Home" ? "selected" : ""}" data-confirm-location-save-as="Home" type="button" ${homeUsedMessage ? `disabled aria-disabled="true" title="${escapeHtml(homeUsedMessage)}"` : ""}><span>${customerIcon("home")}</span><span>Home</span></button>
    <button class="save-address-chip ${saveAsLabel === "Work" ? "selected" : ""}" data-confirm-location-save-as="Work" type="button" ${workUsedMessage ? `disabled aria-disabled="true" title="${escapeHtml(workUsedMessage)}"` : ""}><span>${customerIcon("business")}</span><span>Work</span></button>
    ${state.locationSaveAsOtherOpen ? `<span class="save-address-other-field">
      <input data-confirm-location-other-input value="${escapeHtml(customLabel)}" placeholder="Other" autocomplete="off">
      <button data-confirm-location-other-action type="button">${escapeHtml(otherActionText)}</button>
    </span>` : `<button class="save-address-chip ${saveAsLabel === "Other" ? "selected" : ""}" data-confirm-location-save-as="Other" type="button"><span>${customerIcon("heart")}</span><span>${escapeHtml(customLabel || "Other")}</span></button>`}`;
}

function confirmLocationSaveAsMessageHtml() {
  const customLabel = String(state.locationSaveAsCustomLabel || "");
  const otherUsedMessage = state.locationSaveAsLabel === "Other" || state.locationSaveAsOtherOpen ? customerSaveAsLabelMessage(customLabel) : "";
  const saveAsMessage = state.locationSaveAsMessage || otherUsedMessage || "";
  return `<p class="location-message danger save-address-message ${saveAsMessage ? "" : "hidden"}" data-save-address-message>${escapeHtml(saveAsMessage)}</p>`;
}

function refreshConfirmLocationSaveAsOptions({ focusOther = false } = {}) {
  const container = root.querySelector(".location-confirm-screen .save-address-options");
  if (!container) return;
  container.innerHTML = confirmLocationSaveAsOptionsHtml();
  const message = root.querySelector(".location-confirm-screen [data-save-address-message]");
  if (message) {
    const html = confirmLocationSaveAsMessageHtml();
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    message.replaceWith(wrapper.firstElementChild);
  }
  if (focusOther) setTimeout(() => root.querySelector("[data-confirm-location-other-input]")?.focus?.(), 0);
}

function renderLocationConfirm() {
  const picked = state.locationPicked || state.selectedLocation;
  const cluster = picked ? customerLocationCluster(picked) : {};
  const serviceability = state.locationServiceability || picked?.serviceability || {};
  const canContinue = Boolean(picked && cluster.clusterId && serviceability.isServiceable !== false);
  const title = customerDisplayLocationLabel(picked || {}) || "Picked location";
  const address = locationShortAddress(picked || {});
  const defaultName = picked?.metadata?.personName || picked?.personName || state.user?.displayName || "Customer";
  const defaultPhone = picked?.metadata?.contactNumber || picked?.contactNumber || "";
  const defaultPhoneDisplay = customerDisplayMobile10(defaultPhone);
  const landmark = picked?.metadata?.landmark || picked?.metadata?.additionalDetail || picked?.landmark || "";
  root.innerHTML = `<section class="mobile-app customer-flow-screen location-confirm-screen location-map-pick-screen">
    <section class="location-confirm-map">
      ${customerLocationPreview({ interactive: true })}
      <button class="location-map-back-btn" data-confirm-location-back type="button" aria-label="Back">${customerIcon("back")}</button>
      <div class="location-map-zoom-controls" aria-label="Map zoom controls">
        <button data-location-map-zoom="in" type="button" aria-label="Zoom in">${customerIcon("plus")}</button>
        <button data-location-map-zoom="out" type="button" aria-label="Zoom out">${customerIcon("minus")}</button>
      </div>
      <button class="location-current-btn" data-use-current-location data-location-map-current type="button">${customerIcon("map")}<span>Use current location</span></button>
    </section>
    <section class="location-pick-card location-confirm-details">
      ${state.locationMessage && !canContinue ? `<p class="location-message danger">${escapeHtml(state.locationMessage)}</p>` : ""}
      <form class="location-detail-form" data-location-continue-form>
        <div class="picked-location-title">
          <span class="${canContinue ? "ok" : "bad"}">${customerIcon("map")}</span>
          <div><b>${escapeHtml(title)}</b><small>${escapeHtml(address)}</small></div>
          <button data-location-step="manual" type="button">Change</button>
        </div>
        <label class="location-field full">
          <input name="landmark" value="${escapeHtml(landmark)}" placeholder="House / Apartment / Shop (optional)" autocomplete="street-address">
        </label>
        <div class="location-inline-fields">
          <label class="location-field full">
            <input name="personName" value="${escapeHtml(defaultName)}" placeholder="Name" autocomplete="name">
          </label>
          <label class="location-field full">
            <input name="contactNumber" value="${escapeHtml(defaultPhoneDisplay)}" placeholder="Mobile number" inputmode="tel" autocomplete="tel">
          </label>
        </div>
        <label class="save-address-toggle">
          <input name="useMyMobile" type="checkbox">
          <span>Use my mobile number : ${escapeHtml(defaultPhoneDisplay || "")}</span>
        </label>
        <div class="save-as-title">Save as (optional):</div>
        <div class="save-address-options">
          ${confirmLocationSaveAsOptionsHtml()}
        </div>
        ${confirmLocationSaveAsMessageHtml()}
        <div class="confirm-location-sticky-action">
          <button class="confirm-location-btn" type="submit" ${canContinue ? "" : "disabled"}>${state.locationBusy ? "Please wait..." : "Confirm Location"} ${customerIcon("chevron")}</button>
        </div>
      </form>
    </section>
    ${customerLocationPermissionPopupHtml()}
  </section>`;
  setTimeout(initializeCustomerLocationSimpleMap, 0);
}

function renderCustomerLocation() {
  if (state.locationStep === "unavailable") {
    root.innerHTML = `<section class="mobile-app customer-flow-screen location-options-screen">${locationUnavailableHtml()}</section>`;
    return;
  }
  if (state.locationStep === "options") return renderLocationOptions();
  if (state.locationStep === "manual") return renderLocationManual();
  if (state.locationStep === "confirm") return renderLocationConfirm();
  return renderLocationPermission();
}

function renderSplash() {
  root.innerHTML = `<section class="mobile-app splash-screen">
    <div class="splash-card">
      <div class="splash-spinner" aria-hidden="true"></div>
      <p>Loading...</p>
    </div>
  </section>`;
  setTimeout(async () => {
    state.splashDone = true;
    if (state.token) await loadMe({ forceRefresh: true });
    else await loadCustomerLoginCategories();
    render();
  }, 700);
}

function customerLoginTiles() {
  const fallbackTiles = [
    { name: "Personal", className: "tile-dusting" },
    { name: "Family", className: "tile-cleaning" },
    { name: "Home", className: "tile-elder" },
    { name: "Business", className: "tile-errands" },
    { name: "Be There", className: "tile-home-help" },
    { name: "Urgent Help", className: "tile-office-help" }
  ];
  const rows = [
    ...normalizeArray(state.loginCategories),
    ...normalizeArray(state.catalog?.masterCategories),
    ...normalizeArray(activeCatalog().masterCategories),
    ...normalizeArray(state.personalAssistantCatalog?.masterCategories)
  ]
    .map(normalizeCustomerLoginCategory)
    .filter((category) => category && category.isActive !== false && category.isEnabled !== false && category.isVisible !== false)
    .filter((category, index, all) => all.findIndex((item) => String(item.id || item.name || "") === String(category.id || category.name || "")) === index)
    .sort((left, right) => (numberValue(left.priority, 0) - numberValue(right.priority, 0)) || (numberValue(left.sortOrder, 0) - numberValue(right.sortOrder, 0)) || String(left.name).localeCompare(String(right.name)))
    .slice(0, 8);
  return (rows.length ? rows : fallbackTiles).map((category, index) => ({
    label: category.name || category.categoryName || "Category",
    imageUrl: category.imageUrl || category.categoryImageUrl || category.pictureUrl || category.categoryPicture || category.image_url || "",
    className: category.className || ["tile-dusting", "tile-cleaning", "tile-elder", "tile-errands", "tile-home-help", "tile-office-help"][index % 6]
  }));
}

function renderCustomerLogin() {
  const phone = String(state.loginPhone || "").replace(/\D/g, "").slice(-10);
  const serviceTiles = customerLoginTiles();
  if (state.codeSent) {
    const resendRemaining = customerOtpResendRemainingMs();
    const resendWaiting = resendRemaining > 0;
    root.innerHTML = `<section class="mobile-app login-screen customer-login-screen customer-otp-screen">
      <button class="customer-otp-back" data-clear-phone type="button" aria-label="Back">${customerIcon("back")}</button>
      <div class="customer-otp-brand">
        <img class="customer-login-logo" src="${assetUrl("/assets/zigo-logo-new.png")}" alt="ZIGO">
        <h1>Verify OTP</h1>
        <p>Enter the 6 digit code sent to <b>+91 ${escapeHtml(phone)}</b></p>
      </div>
      <form id="customerLoginForm" class="login-panel customer-login-panel customer-otp-panel${state.loginBusy ? " is-busy" : ""}">
        <input type="hidden" name="phone" value="${escapeHtml(phone)}">
        <label class="customer-otp-code-field">
          <input name="code" inputmode="numeric" maxlength="6" pattern="\\d{6}" placeholder="Enter OTP" autocomplete="one-time-code" required>
        </label>
        <button class="primary-btn customer-login-continue" data-login-action="verify" data-otp-verify-button name="action" value="verify" type="submit" disabled>${state.loginBusy ? "Verifying..." : "Verify & Continue"}</button>
        <button class="customer-login-resend${resendWaiting ? " is-counting" : ""}" data-login-action="send" data-otp-resend-button name="action" value="send" type="submit" formnovalidate ${state.loginBusy || resendWaiting ? "disabled" : ""}>${resendWaiting ? `Resend OTP in ${formatCountdownSeconds(resendRemaining / 1000)}` : "Resend OTP"}</button>
      </form>
    </section>`;
    syncCustomerOtpResendTimer();
    setTimeout(() => {
      root.querySelector("[name='code']")?.focus?.();
      syncCustomerOtpVerifyButton();
    }, 0);
    return;
  }
  stopCustomerOtpResendTimer();
  root.innerHTML = `<section class="mobile-app login-screen customer-login-screen">
    <div class="customer-login-gallery" aria-hidden="true">
      <div class="customer-login-gallery-track">
        ${serviceTiles.slice(0, Math.ceil(serviceTiles.length / 2)).map((tile) => `<div class="customer-login-service-card ${escapeHtml(tile.className)}">${tile.imageUrl ? `<img src="${assetUrl(tile.imageUrl)}" alt="">` : ""}<span>${escapeHtml(tile.label)}</span></div>`).join("")}
      </div>
      <div class="customer-login-gallery-track reverse">
        ${serviceTiles.slice(Math.ceil(serviceTiles.length / 2)).map((tile) => `<div class="customer-login-service-card ${escapeHtml(tile.className)}">${tile.imageUrl ? `<img src="${assetUrl(tile.imageUrl)}" alt="">` : ""}<span>${escapeHtml(tile.label)}</span></div>`).join("")}
      </div>
    </div>
    <div class="customer-login-brand">
      <img class="customer-login-logo" src="${assetUrl("/assets/zigo-logo-new.png")}" alt="ZIGO">
      <p>Personal help in 10 minutes</p>
    </div>
    <form id="customerLoginForm" class="login-panel customer-login-panel${state.loginBusy ? " is-busy" : ""}">
      <div class="phone-row customer-login-phone-row">
        <button class="country-code" type="button"><img class="country-flag" src="${assetUrl("/assets/india-flag.svg")}" alt="India"><i>${customerIcon("chevron")}</i></button>
        <label class="phone-field customer-login-phone-field">
          <b>+91</b>
          <input name="phone" inputmode="tel" maxlength="10" pattern="\\d{10}" placeholder="Enter mobile number" value="${escapeHtml(phone)}" autocomplete="tel-national" required>
          ${phone ? `<button class="clear-phone" data-clear-phone type="button" aria-label="Clear phone">${customerIcon("x")}</button>` : ""}
        </label>
      </div>
      <button class="primary-btn proceed-btn customer-login-continue" data-login-action="send" data-login-phone-proceed name="action" value="send" type="submit" ${state.loginBusy || phone.length !== 10 ? "disabled" : ""}>${state.loginBusy ? "Please wait..." : "Proceed"}</button>
      <p class="terms-copy customer-login-terms">By proceeding, I accept the<br><a href="https://zigonow.in/terms-and-conditions.html" target="_blank" rel="noopener noreferrer" data-open-external>Terms of use</a> & <a href="https://zigonow.in/privacy-policy.html" target="_blank" rel="noopener noreferrer" data-open-external>Privacy policy</a></p>
    </form>
  </section>`;
  setTimeout(syncCustomerLoginPhoneButton, 0);
}

function attachCustomerOngoingBookingDots() {
  const slider = root.querySelector(".customer-ongoing-task-slider");
  const dots = Array.from(root.querySelectorAll("[data-ongoing-task-dot]"));
  if (!slider || dots.length <= 1) return;

  const updateDots = () => {
    const cards = Array.from(slider.querySelectorAll(".customer-ongoing-task-card"));
    const sliderRect = slider.getBoundingClientRect();
    const sliderCenter = sliderRect.left + (sliderRect.width / 2);
    const activeIndex = Math.max(0, Math.min(dots.length - 1, cards.reduce((bestIndex, card, index) => {
      const rect = card.getBoundingClientRect();
      const distance = Math.abs((rect.left + (rect.width / 2)) - sliderCenter);
      const bestCard = cards[bestIndex];
      const bestRect = bestCard ? bestCard.getBoundingClientRect() : rect;
      const bestDistance = Math.abs((bestRect.left + (bestRect.width / 2)) - sliderCenter);
      return distance < bestDistance ? index : bestIndex;
    }, 0)));
    dots.forEach((dot, index) => {
      const active = index === activeIndex;
      dot.classList.toggle("active", active);
      dot.setAttribute("aria-current", active ? "true" : "false");
    });
  };

  let scrollFrame = 0;
  slider.addEventListener("scroll", () => {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(updateDots);
  }, { passive: true });

  dots.forEach((dot, index) => {
    dot.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      slider.scrollTo({ left: index * (slider.clientWidth || 1), behavior: "smooth" });
      dots.forEach((item, dotIndex) => {
        const active = dotIndex === index;
        item.classList.toggle("active", active);
        item.setAttribute("aria-current", active ? "true" : "false");
      });
    });
  });

  updateDots();
}

function attachCustomerHomeDurationSlider() {
  const sliders = Array.from(root.querySelectorAll(".customer-home-expand-duration-row"));
  sliders.forEach((slider) => {
    if (slider.dataset.durationSliderBound === "true") return;
    slider.dataset.durationSliderBound = "true";
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let dragging = false;

    const clearDrag = () => {
      pointerId = null;
      startX = 0;
      startY = 0;
      startScrollLeft = 0;
      slider.classList.remove("is-dragging");
      if (dragging) {
        slider.dataset.dragging = "true";
        window.setTimeout(() => {
          if (slider.dataset.dragging === "true") slider.dataset.dragging = "";
        }, 120);
      }
      dragging = false;
    };

    slider.addEventListener("pointerdown", (event) => {
      if (event.button != null && event.button !== 0) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startScrollLeft = slider.scrollLeft;
      dragging = false;
      slider.dataset.dragging = "";
      slider.setPointerCapture?.(event.pointerId);
    }, { passive: true });

    slider.addEventListener("pointermove", (event) => {
      if (pointerId !== event.pointerId) return;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (!dragging && Math.abs(deltaX) > 5 && Math.abs(deltaX) > Math.abs(deltaY)) {
        dragging = true;
        slider.classList.add("is-dragging");
      }
      if (!dragging) return;
      event.preventDefault();
      slider.scrollLeft = startScrollLeft - deltaX;
    }, { passive: false });

    slider.addEventListener("pointerup", clearDrag);
    slider.addEventListener("pointercancel", clearDrag);
    slider.addEventListener("lostpointercapture", clearDrag);

    slider.addEventListener("wheel", (event) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      slider.scrollLeft += event.deltaX;
    }, { passive: false });

    slider.addEventListener("touchstart", (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;
      pointerId = "touch";
      startX = touch.clientX;
      startY = touch.clientY;
      startScrollLeft = slider.scrollLeft;
      dragging = false;
      slider.dataset.dragging = "";
    }, { passive: true });

    slider.addEventListener("touchmove", (event) => {
      if (pointerId !== "touch") return;
      const touch = event.touches?.[0];
      if (!touch) return;
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      if (!dragging && Math.abs(deltaX) > 5 && Math.abs(deltaX) > Math.abs(deltaY)) {
        dragging = true;
        slider.classList.add("is-dragging");
      }
      if (!dragging) return;
      event.preventDefault();
      slider.scrollLeft = startScrollLeft - deltaX;
    }, { passive: false });

    slider.addEventListener("touchend", clearDrag, { passive: true });
    slider.addEventListener("touchcancel", clearDrag, { passive: true });
  });
}

function focusCustomerHomeDurationCard(card) {
  const slider = card?.closest?.(".customer-home-expand-duration-row");
  if (!slider || !card) return;
  const sliderRect = slider.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const isCroppedLeft = cardRect.left < sliderRect.left + 4;
  const isCroppedRight = cardRect.right > sliderRect.right - 4;
  if (!isCroppedLeft && !isCroppedRight) return;
  const targetLeft = slider.scrollLeft + (cardRect.left - sliderRect.left);
  slider.scrollTo({
    left: Math.max(0, Math.min(targetLeft, slider.scrollWidth - slider.clientWidth)),
    behavior: "smooth"
  });
}

function renderCustomerHome() {
  root.innerHTML = `<section class="mobile-app home-screen customer-flow-screen zigo-commerce-home">
    ${customerHomeHeader()}
    ${customerHomeSearch()}
    <section class="zigo-home-body">
      ${customerHomeSections()}
    </section>
    ${customerCartNoticeHtml()}
    ${bottomCartBar()}
    ${customerHomeLocationPickerSheet()}
    ${customerLocationPermissionPopupHtml()}
  </section>`;
  startCustomerSearchPlaceholderRotation();
  attachCustomerOngoingBookingDots();
  attachCustomerHomeDurationSlider();
  startCustomerHomeCategoryImageSequence();
}

function renderCustomerHomeSchedulePage() {
  ensureCustomerHomeScheduleSelection();
  root.innerHTML = `<section class="mobile-app home-screen customer-flow-screen customer-home-schedule-page">
    <header class="customer-home-schedule-page-header">
      <button data-close-home-schedule-sheet type="button" aria-label="Back">${customerIcon("back")}</button>
      <h1>Schedule</h1>
    </header>
    <section class="customer-home-schedule-page-copy">
      <p>Choose your visit date, duration and start time.</p>
    </section>
    ${customerHomeScheduleBodyHtml()}
    ${customerHomeScheduleFooterHtml()}
  </section>`;
  attachCustomerHomeScheduleTimeScrollSpy();
}

function attachCustomerHomeScheduleTimeScrollSpy() {
  const page = root.querySelector(".customer-home-schedule-page");
  const scroll = page?.querySelector(".customer-home-schedule-scroll");
  if (!page || !scroll) return;
  let frame = 0;
  const updateActivePeriod = () => {
    frame = 0;
    const tabs = page.querySelector(".customer-home-schedule-period-tabs");
    const anchorY = (tabs?.getBoundingClientRect().bottom || page.getBoundingClientRect().top) + 10;
    const sections = Array.from(page.querySelectorAll("[data-home-schedule-period-section]"));
    const visible = sections.find((section) => {
      const rect = section.getBoundingClientRect();
      return rect.top <= anchorY && rect.bottom >= anchorY;
    }) || sections.find((section) => section.getBoundingClientRect().top >= anchorY) || sections[0];
    const period = visible?.dataset?.homeSchedulePeriodSection || "";
    if (!period || period === state.selectedHomeSchedulePeriod) return;
    const tab = Array.from(page.querySelectorAll("[data-select-home-schedule-period]"))
      .find((button) => String(button.dataset.selectHomeSchedulePeriod || "") === String(period));
    if (tab?.disabled || tab?.classList.contains("disabled")) return;
    state.selectedHomeSchedulePeriod = period;
    page.querySelectorAll("[data-select-home-schedule-period]").forEach((button) => {
      const active = String(button.dataset.selectHomeSchedulePeriod || "") === period;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  };
  scroll.addEventListener("scroll", () => {
    if (!frame) frame = requestAnimationFrame(updateActivePeriod);
  }, { passive: true });
}

function renderServiceDetail() {
  const service = selectedService();
  const activeTab = state.customerCatalogTab === "fav" ? "fav" : "categories";
  const isStorePage = state.customerCatalogTab === "stores";
  const selectedCategoryName = String(selectedCategory()?.name || service?.name || "service");
  root.innerHTML = `<section class="mobile-app home-screen customer-flow-screen customer-service-screen">
    <header class="customer-page-header customer-category-header ${isStorePage ? "customer-store-page-header" : ""}">
      <button class="customer-back-icon" type="button" ${isStorePage ? `data-customer-catalog-tab="categories"` : `data-view="home"`} aria-label="Back">${customerIcon("back")}</button>
      <div>
        ${isStorePage ? "" : `<small>Categories</small>`}
        <h1>${escapeHtml(service?.name || "Service")}</h1>
      </div>
    </header>
    ${isStorePage
      ? `<div class="customer-top-search customer-store-search">${customerIcon("search")}<input placeholder="Search &quot;${escapeHtml(selectedCategoryName.toLowerCase())}&quot;"><button type="button" aria-label="Voice search">${customerIcon("mic")}</button></div>`
      : `<div class="customer-top-search"><input placeholder="Search ${escapeHtml(service?.name || "service")} categories"><button type="button">Filter</button></div>`}
    <section class="content-section ${isStorePage ? "customer-store-page-section" : ""}">
      ${isStorePage ? "" : `<div class="portal-tabs">
        <button class="${activeTab === "categories" ? "active" : ""}" data-customer-catalog-tab="categories" type="button">Categories</button>
        <button class="catalog-fav-tab ${activeTab === "fav" ? "active" : ""}" data-customer-catalog-tab="fav" type="button">${customerIcon("heart")} Favorites</button>
      </div>`}
      <div class="customer-product-list">${customerCatalogContent()}</div>
      ${customerPersonalAssistantSlotsSection({ className: "customer-pa-service-section" })}
    </section>
    ${customerCartNoticeHtml()}
    ${bottomCartBar()}
    ${bottomNav("service")}
  </section>`;
}

function renderCart() {
  if (customerCartStopPickerClosedAfterPick) {
    state.customerLocationPickerSheetOpen = false;
    state.customerLocationPickerClosing = false;
    state.customerLocationPickerPurpose = "";
  }
  ensureCustomerBookingTypeAllowed();
  if (!state.cart.length) {
    root.innerHTML = `<section class="mobile-app home-screen customer-flow-screen customer-cart-screen">
      <header class="customer-page-header"><button class="customer-back-icon customer-back-icon-plain" type="button" data-view="home" aria-label="Back">${customerIcon("back")}</button><h1>Review Booking</h1></header>
      <section class="content-section compact-section">
        ${cartRows()}
      </section>
      ${bottomNav("cart")}
    </section>`;
    return;
  }
  const totals = cartTotals();
  const activeBookingType = customerEffectiveBookingType(state.bookingType);
  const confirmLabel = state.bookingType === "schedule" ? "Schedule & Confirm" : "Confirm Booking";
  root.innerHTML = `<section class="mobile-app home-screen customer-flow-screen customer-cart-screen">
    <header class="customer-page-header"><button class="customer-back-icon customer-back-icon-plain" type="button" data-view="home" aria-label="Back">${customerIcon("back")}</button><h1>Review Booking</h1></header>
    <section class="content-section compact-section">
      <div class="cart-list">${cartRows()}</div>
    </section>
    <section class="content-section compact-section customer-cart-location-section">
      ${customerCartLocationsHtml()}
    </section>
    <section class="content-section compact-section">
      <h2>Bill details</h2>
      <div class="bill-card">
        <span>Total task time <b>${escapeHtml(customerDurationText(totals.duration))}</b></span>
        <span>Total <b>${money(totals.totalAmount)}</b></span>
        <span>Discount <b>${money(totals.discountAmount)}</b></span>
        <strong>To Pay <b>${money(totals.toPay)}</b></strong>
      </div>
    </section>
    <section class="content-section compact-section">
      <h2>Uploads</h2>
      <label class="customer-upload-drop">
        <input data-cart-upload type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx">
        <span>Upload images, videos, docs or PDF</span>
        <b>Browse</b>
      </label>
      ${cartUploadPreviewHtml()}
    </section>
    ${customerCartNoteHtml()}
    ${customerCartDeleteModalHtml()}
    ${customerCartUploadPopupHtml()}
    ${customerCartVoiceModalHtml()}
    ${customerCartConfirmBarHtml(totals, activeBookingType, confirmLabel)}
    ${bottomNav("cart")}
  </section>
  ${customerPaymentSheetHtml()}`;
}

function refreshCustomerCartLocationSection() {
  const section = root.querySelector(".customer-cart-location-section");
  if (!section) return false;
  section.innerHTML = customerCartLocationsHtml();
  return true;
}

function closeCustomerCartStopPickerToReview() {
  state.locationMessage = "";
  state.locationBusy = false;
  customerCartStopPickerClosedAfterPick = true;
  suppressCustomerLocationPickerForReview();
  refreshCustomerCartLocationSection();
  const overlay = root.querySelector("[data-location-picker-overlay]");
  if (overlay) {
    overlay.classList.add("is-closing");
    window.setTimeout(() => {
      overlay.remove();
      state.customerLocationPickerClosing = false;
      state.customerCartRouteEditIndex = -1;
    }, 150);
  } else {
    state.customerLocationPickerClosing = false;
    state.customerCartRouteEditIndex = -1;
  }
}

function openCustomerCartStopPicker({ editIndex = -1 } = {}) {
  customerCartStopPickerClosedAfterPick = false;
  customerLocationPickerSuppressUntil = 0;
  state.customerView = "cart";
  state.customerLocationPickerPurpose = "cart-stop";
  state.customerCartRouteEditIndex = Number.isInteger(Number(editIndex)) ? Number(editIndex) : -1;
  state.customerCartRouteDeleteIndex = -1;
  state.locationConfirmReturnStep = "cart-stop";
  state.locationStep = "manual";
  state.locationSearchQuery = "";
  state.locationResults = [];
  state.locationMessage = "";
  state.locationBusy = false;
  state.customerLocationPickerSheetOpen = true;
  state.customerLocationPickerClosing = false;
  syncCustomerHomeLocationPickerSheet({ focusSearch: true });
}

function setCustomerCartRouteOrder(stops = []) {
  const ordered = normalizeArray(stops).filter((stop) => stop && stop.address && stop.clusterId);
  if (!ordered.length) return false;
  const [primary, ...extras] = ordered.map((stop, index) => customerNormalizeCartLocationStop(stop, index, index === 0));
  state.customerRoutePrimaryStop = {
    ...primary,
    label: primary.label || customerCartRouteTitle(primary, "Start point"),
    source: primary.source || "manual",
    isDefault: false
  };
  state.customerRoutePrimaryCleared = false;
  state.customerLocationStops = extras.map((stop, index) => customerNormalizeCartLocationStop(stop, index + 1, false));
  syncCustomerCartLocationStops();
  writePortalSessionCache();
  return true;
}

function moveCustomerCartRouteStop(fromIndex, toIndex) {
  const stops = customerCartLocationStopsForPayload();
  const from = Math.max(0, Math.min(stops.length - 1, Number(fromIndex)));
  const to = Math.max(0, Math.min(stops.length - 1, Number(toIndex)));
  if (!stops.length || from === to) return false;
  const [moved] = stops.splice(from, 1);
  stops.splice(to, 0, moved);
  return setCustomerCartRouteOrder(stops);
}

function removeCustomerCartRouteStop(index) {
  const stops = customerCartLocationStopsForPayload();
  const removeIndex = Number(index);
  if (!Number.isInteger(removeIndex) || removeIndex < 0 || removeIndex >= stops.length) return false;
  stops.splice(removeIndex, 1);
  if (!stops.length) {
    state.customerRoutePrimaryStop = null;
    state.customerRoutePrimaryCleared = true;
    state.customerLocationStops = [];
    state.customerCartRouteExpanded = false;
    state.customerCartRouteEditIndex = -1;
    state.customerCartRouteDeleteIndex = -1;
    syncCustomerCartLocationStops();
    writePortalSessionCache();
    return true;
  }
  return setCustomerCartRouteOrder(stops);
}

function renderCustomerSchedulePage() {
  ensureCustomerBookingTypeAllowed();
  const plan = customerCartBookingTypePlan();
  if (!state.cart.length || !plan.hasSchedule) {
    state.customerView = "cart";
    renderCart();
    return;
  }
  state.customerView = "schedule";
  state.bookingType = "schedule";
  state.customerScheduleSheetOpen = false;
  const config = customerEffectiveBookingType("schedule");
  ensureCustomerScheduleSelection(config);
  const valid = customerScheduleSelectionIsValid(config);
  const location = state.selectedLocation || {};
  root.innerHTML = `<section class="mobile-app home-screen customer-flow-screen customer-schedule-screen">
    <header class="customer-page-header"><button class="customer-back-icon" type="button" data-view="cart" aria-label="Back">${customerIcon("back")}</button><h1>Schedule</h1></header>
    <section class="content-section compact-section customer-schedule-page-head">
      <p class="customer-schedule-location">${customerIcon("map")}<span><b>${escapeHtml(customerLocationTitle(location))}</b> | ${escapeHtml(locationShortAddress(location))}</span></p>
      <div class="booking-bottom-sheet-info customer-schedule-info"><span class="customer-schedule-mark" aria-hidden="true">${customerIcon("calendar")}</span><p>Choose from the next available slots for selected services.</p></div>
    </section>
    <section class="content-section compact-section customer-schedule-page-body">
      ${customerSchedulePickerHtml(config) || `<div class="empty-state">No schedule slots configured.</div>`}
    </section>
    <div class="customer-schedule-page-action">
      <button class="primary-btn" data-action="booking-master-confirm-schedule-booking" type="button" ${valid ? "" : "disabled"}>Back to Review</button>
    </div>
  </section>`;
  attachCustomerSchedulePageActionListeners(root);
}

function customerBookingStatusBucket(booking = {}) {
  const status = String(booking.statusCode || booking.status || booking.assignmentStatus || booking.metadata?.status || "").toLowerCase();
  const hasAssignment = customerTrackHasAssignment(booking);
  const isCompleted = ["completed", "success", "paid", "done"].includes(status);
  const isCancelled = ["rejected", "cancelled", "canceled", "failed", "expired"].includes(status);
  const scheduledAt = booking.scheduledAt || booking.metadata?.scheduledAt || booking.metadata?.startAt || booking.createdAt || null;
  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
  const upcoming = scheduledDate && !Number.isNaN(scheduledDate.getTime()) ? scheduledDate.getTime() > Date.now() && !isCompleted && !isCancelled : false;
  if (isCompleted) return "completed";
  if (isCancelled) return "cancelled";
  if (upcoming) return "upcoming";
  if (["working", "in_progress", "on_the_way", "on the way"].includes(status)) return "working";
  if (["assigned", "accepted", "processing", "pending", "hold", "reserved", "offered"].includes(status)) return hasAssignment ? "assigned" : "confirmed";
  if (["confirmed", "pending", "queued", "payment_pending", "paid"].includes(status)) return hasAssignment ? "assigned" : "confirmed";
  return hasAssignment ? "assigned" : "confirmed";
}

function customerVisibleBookingId(booking = {}) {
  const candidates = [
    booking.bookingCode,
    booking.bookingNo,
    booking.referenceCode,
    booking.code,
    booking.requestNumber,
    booking.metadata?.requestNumber
  ].map((value) => String(value || "").trim()).filter(Boolean);
  const external = candidates.find((value) => !/^ADM-/i.test(value));
  if (external) return external;
  const id = String(booking.id || booking.bookingId || "").trim();
  return id ? id.slice(0, 8).toUpperCase() : "BOOKING";
}

function bookingRows(tab = "all", rows = state.bookings || []) {
  const filteredRows = (Array.isArray(rows) ? rows : []).filter((booking) => tab === "all" || customerBookingStatusBucket(booking) === tab);
  if (!filteredRows.length) return `<p class="muted">No bookings yet.</p>`;
  return filteredRows.map((booking) => {
    const statusTone = bookingListStatusTone(booking);
    const statusText = bookingListStatusLabel(booking);
    const serviceItem = bookingListServiceItem(booking);
    const timestamp = bookingListTimestamp(booking);
    const bookingId = customerVisibleBookingId(booking);
    const serviceName = serviceItem?.displayName || serviceItem?.name || serviceItem?.categoryName || serviceItem?.serviceName || booking.serviceName || booking.metadata?.serviceName || "Service";
    const serviceImage = customerBookingServiceImage(booking, serviceItem);
    const slotName = bookingSlotLabel(booking, serviceItem);
    const amountPaise = Number(booking.bookingAmountPaise || booking.estimatedAmountPaise || booking.metadata?.paymentAmountPaise || booking.metadata?.bookingAmountPaise || 0);
    const discountPaise = Number(
      booking.discountPaise
      || booking.metadata?.discountPaise
      || booking.metadata?.pricingBreakdown?.discountAmountPaise
      || Math.max(0, Number(booking.estimatedAmountPaise || 0) - amountPaise)
      || 0
    );
    const amount = money(amountPaise / 100);
    const discount = money(discountPaise / 100);
    const stamp = `${timestamp.day}, ${timestamp.time}`;
    return `<article class="booking-card booking-list-card" data-track-booking="${escapeHtml(booking.id)}">
      <div class="booking-list-top">
        <span class="booking-id-pill">Booking ID ${escapeHtml(bookingId)}</span>
        <span class="booking-status-pill ${escapeHtml(statusTone)}"><span class="booking-status-dot" aria-hidden="true"></span><span>${escapeHtml(statusText)}</span></span>
      </div>
      <div class="booking-list-main">
        <div class="booking-list-image">${serviceImage ? `<img src="${escapeHtml(assetUrl(serviceImage))}" alt="${escapeHtml(serviceName)}">` : `<span>${escapeHtml(customerChipLabel(serviceName || "Service", "S"))}</span>`}</div>
        <div class="booking-list-copy">
          <div class="booking-service-name-row">
            <div class="booking-service-name">${escapeHtml(serviceName)}</div>
          </div>
          <div class="booking-service-time-row">
            <div class="booking-service-time">${escapeHtml(stamp)}</div>
          </div>
          ${slotName ? `<div class="booking-slot-name-row"><div class="booking-slot-name">${escapeHtml(slotName)}</div></div>` : ""}
        </div>
        <div class="booking-list-amount">
          <h1>${escapeHtml(amount)}</h1>
          ${discountPaise > 0 ? `<del>${escapeHtml(discount)}</del>` : ""}
        </div>
      </div>
      <div class="booking-list-footer">
        <button class="booking-see-details" type="button" data-track-booking="${escapeHtml(booking.id)}">View Details <span>›</span></button>
        <button class="booking-reorder-btn" type="button" data-reorder-booking="${escapeHtml(booking.id)}">Re-Order</button>
      </div>
    </article>`;
  }).join("");
}

function renderBookings() {
  const tabs = [
    ["all", "All"],
    ["working", "Working"],
    ["assigned", "Assigned"],
    ["upcoming", "Upcoming"],
    ["completed", "Completed"],
    ["cancelled", "Cancelled"]
  ];
  root.innerHTML = `<section class="mobile-app home-screen customer-flow-screen customer-bookings-page">
    <div class="booking-sticky-header">
      <header class="customer-page-header"><button class="customer-back-icon customer-back-icon-plain" type="button" data-view="${escapeHtml(customerReturnTargetFor("bookings", "home"))}" aria-label="Back">${customerIcon("back")}</button><h1>Bookings</h1></header>
      <section class="content-section compact-section booking-tabs-section">
        <div class="booking-tabs">
          ${tabs.map(([value, label]) => {
            const tone = bookingTabTone(value);
            const active = state.customerBookingsTab === value ? "active" : "";
            return `<button class="button booking-tab-pill booking-tab-tone-${tone} ${active}" type="button" data-bookings-tab="${value}">${label}</button>`;
          }).join("")}
        </div>
      </section>
    </div>
    <section class="content-section"><div class="booking-list">${bookingRows(state.customerBookingsTab, state.bookings)}${customerBookingsBottomLoaderHtml()}</div></section>
    ${bottomNav("bookings")}
  </section>`;
  attachCustomerBookingsScrollLoader();
}

function customerBookingServiceSummary(booking = {}) {
  const items = Array.isArray(booking.metadata?.cartItems) ? booking.metadata.cartItems : [];
  if (items.length) {
    return items.map((item) => [item.serviceName, item.categoryName, item.storeName || item.name].filter(Boolean).join(" / ")).join(", ");
  }
  return booking.serviceName || booking.metadata?.serviceName || "Service";
}

function bookingTabTone(tab = "") {
  const value = String(tab || "").toLowerCase();
  if (value === "assigned") return "sky";
  if (value === "working") return "yellow";
  if (value === "upcoming") return "blue";
  if (value === "completed") return "green";
  if (value === "cancelled") return "red";
  return "neutral";
}

function bookingListStatusTone(booking = {}) {
  const value = String(booking.statusCode || booking.status || booking.assignmentStatus || booking.metadata?.status || "").toLowerCase();
  const hasAssignment = customerTrackHasAssignment(booking);
  if (!hasAssignment && (["assigned", "accepted", "pending", "hold", "processing", "reserved", "offered", "confirmed", "queued", "payment_pending", "paid"].includes(value))) {
    return "orange";
  }
  if (["completed", "success", "paid", "done"].includes(value)) return "green";
  if (["assigned", "accepted", "pending", "hold", "processing"].includes(value)) return "blue";
  if (["working", "in_progress", "on_the_way", "on the way"].includes(value)) return "yellow";
  if (["rejected", "cancelled", "canceled", "failed", "expired"].includes(value)) return "red";
  return "orange";
}

function bookingListStatusLabel(booking = {}) {
  const value = String(booking.statusCode || booking.status || booking.assignmentStatus || booking.metadata?.status || "").toLowerCase();
  const hasAssignment = customerTrackHasAssignment(booking);
  if (["completed", "success", "paid", "done"].includes(value)) return "Completed";
  if (["working", "in_progress", "on_the_way", "on the way"].includes(value)) return "Working";
  if (["assigned", "accepted", "pending", "hold", "processing", "reserved", "offered", "confirmed", "queued", "payment_pending", "paid"].includes(value)) return hasAssignment ? "Assigned" : "Confirmed";
  if (["rejected", "cancelled", "canceled", "failed", "expired"].includes(value)) return "Cancelled";
  return hasAssignment ? "Assigned" : "Confirmed";
}

function bookingListTimestamp(booking = {}) {
  const source = booking.scheduledAt || booking.createdAt || booking.metadata?.scheduledAt || booking.metadata?.createdAt || null;
  const date = source ? new Date(source) : null;
  if (!date || Number.isNaN(date.getTime())) return { day: "-", time: "-" };
  const dateParts = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date).replace(/\s*,\s*/g, ", ");
  const timeText = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date).replace(/\s+/g, " ").replace(/AM$/, "am").replace(/PM$/, "pm");
  return {
    day: dateParts,
    time: timeText
  };
}

function customerBookingPaymentState(booking = {}) {
  const paymentDetails = booking?.paymentDetails && typeof booking.paymentDetails === "object" ? booking.paymentDetails : {};
  const paymentType = String(booking?.metadata?.paymentType || booking?.paymentType || "").toLowerCase();
  const paymentStatus = String(booking?.metadata?.paymentStatus || booking?.paymentStatus || "").toLowerCase();
  const explicitPaid = booking?.metadata?.isPaid === true || booking?.isPaid === true;
  const paid = paymentStatus === "paid"
    || paymentStatus === "success"
    || paymentStatus === "captured"
    || paymentStatus === "completed"
    || explicitPaid === true;
  const pending = !paid && ["pending", "proof_submitted", "proof submitted", "pending_confirmation"].includes(paymentStatus);
  return {
    paid,
    pending,
    label: paid ? "Paid" : pending ? "Pending" : "Due",
    type: booking?.metadata?.paymentType || booking?.paymentType || paymentDetails.mode || "Cash",
    remarks: booking?.metadata?.paymentReceivedRemarks || booking?.metadata?.lastCustomerPaymentRemarks || paymentDetails.remarks || paymentDetails.transactionId || "",
    proofMediaUrls: booking?.metadata?.paymentProofMediaUrls || paymentDetails.proofMediaUrls || []
  };
}

function customerTrackHasAssignment(booking = {}) {
  const metadata = booking.metadata || {};
  const assignmentMetadata = booking.assignmentMetadata || metadata.assignmentMetadata || {};
  const assistantMetadata = metadata.assistant || metadata.assignedAssistant || metadata.assistantDetails || {};
  const assignedName = String(booking.assistantName || booking.assignedAssistantName || assistantMetadata.name || assistantMetadata.displayName || "").trim();
  return Boolean(
    booking.assignmentId
    || booking.acceptedAssignmentId
    || booking.accepted_assignment_id
    || booking.assignment?.id
    || metadata.assignmentId
    || metadata.acceptedAssignmentId
    || assignmentMetadata.assignmentId
    || booking.assistantId
    || booking.assignedAssistantId
    || assistantMetadata.id
    || assistantMetadata.assistantId
    || assignedName
  );
}

function customerTrackStatus(booking = {}) {
  const status = String(booking.statusCode || booking.bookingStatus || booking.assignmentStatus || booking.status || booking.metadata?.status || "").toLowerCase();
  const hasAssignment = customerTrackHasAssignment(booking);
  if (["cancelled", "canceled", "failed", "rejected", "expired"].includes(status)) return "cancelled";
  if (["completed", "success", "done"].includes(status)) return "completed";
  if (["working", "in_progress", "on_the_way", "on the way", "approval_pending"].includes(status)) return "working";
  if (["accepted"].includes(status)) return "assigned";
  if (["assigned", "processing", "hold", "on_hold", "reserved", "offered"].includes(status)) return hasAssignment ? "assigned" : "confirmed";
  if (["pending", "queued", "confirmed", "payment_pending", "paid"].includes(status)) return hasAssignment ? "assigned" : "confirmed";
  const bucket = customerBookingStatusBucket(booking);
  if (["working", "completed", "cancelled"].includes(bucket)) return bucket;
  if (bucket === "assigned") return hasAssignment ? "assigned" : "confirmed";
  return hasAssignment ? "assigned" : "confirmed";
}

function customerTrackIsPaidCompleted(booking = {}) {
  const status = customerTrackStatus(booking);
  const payment = customerBookingPaymentState(booking);
  return status === "completed" && payment.paid;
}

function customerTrackStatusLabel(key = "") {
  return ({
    confirmed: "Confirmed",
    assigned: "Assigned",
    working: "Working",
    upcoming: "Upcoming",
    completed: "Completed",
    cancelled: "Cancelled"
  }[String(key || "").toLowerCase()] || "Confirmed");
}

function customerTrackStatusStepHtml(current = "confirmed") {
  const steps = ["confirmed", "assigned", "working", current === "cancelled" ? "cancelled" : "completed"];
  const activeIndex = steps.indexOf(current);
  const normalizedActiveIndex = activeIndex >= 0 ? activeIndex : 0;
  return `<div class="track-status-rail" role="list" aria-label="Booking status">
    ${steps.map((step, index) => {
      const classes = ["track-status-step"];
      if (index < normalizedActiveIndex) classes.push("done");
      if (index === normalizedActiveIndex) classes.push("active");
      if (step === "cancelled") classes.push("cancelled");
      if (step === "completed") classes.push("completed");
      return `<span class="${classes.join(" ")}" role="listitem">
        <span class="track-status-step-mark" aria-hidden="true"></span>
        <span class="track-status-step-label">${escapeHtml(customerTrackStatusLabel(step))}</span>
      </span>`;
    }).join("")}
  </div>`;
}

function customerTrackQuoteLineForItem(booking = {}, item = {}, index = 0) {
  const lines = normalizeArray(booking.metadata?.priceMasterQuote?.lineItems);
  if (!lines.length) return null;
  const storeId = String(item.storeId || item.store?.id || "").trim();
  const categoryId = String(item.categoryId || item.category?.id || "").trim();
  const categoryName = String(item.categoryName || "").trim().toLowerCase();
  return lines.find((line) => storeId && String(line.storeId || "").trim() === storeId)
    || lines.find((line) =>
      categoryId
      && String(line.categoryId || "").trim() === categoryId
      && String(line.storeId || "").trim() === storeId
    )
    || lines.find((line) => categoryName && String(line.categoryName || "").trim().toLowerCase() === categoryName && !storeId)
    || lines[index]
    || null;
}

function customerTrackItemDurationMinutes(item = {}, booking = {}, context = {}) {
  const quoteLine = context.quoteLine || null;
  const hasStore = Boolean(context.hasStore);
  const storeNumber = Math.max(0, Math.round(Number(context.storeNumber || item.storeNumber || item.store_number || 0)));
  const quoteDuration = Math.max(0, Number(quoteLine?.durationMinutes || quoteLine?.billedDurationMinutes || 0));
  const complexityDuration = Math.max(0, Number(
    item.complexityDurationMinutes
    ?? item.complexity_duration_minutes
    ?? item.cartDurationMinutes
    ?? quoteLine?.complexityDurationMinutes
    ?? 0
  ));
  if (hasStore && storeNumber > 1) {
    return Math.max(1, Math.round(complexityDuration || quoteDuration || Number(item.durationMinutes || 0) || 30));
  }
  const principleDuration = Math.max(0, Number(
    item.principleDurationMinutes
    ?? item.principalDurationMinutes
    ?? item.baseDurationMinutes
    ?? item.taskDurationMinutes
    ?? item.durationMinutes
    ?? item.cartDurationMinutes
    ?? quoteLine?.durationMinutes
    ?? quoteLine?.billedDurationMinutes
    ?? booking.durationMinutes
    ?? booking.metadata?.durationMinutes
    ?? 0
  ));
  return Math.max(1, Math.round(principleDuration || 30));
}

function customerTrackBookingItems(booking = {}) {
  const items = normalizeArray(booking.metadata?.cartItems);
  if (items.length) {
    const storePositions = new Map();
    return items.map((item, index) => {
      const serviceName = String(item.serviceName || booking.serviceName || booking.metadata?.serviceName || "Service").trim();
      const categoryName = String(item.categoryName || booking.metadata?.categoryName || "").trim();
      const serviceId = String(item.serviceId || item.service?.id || booking.serviceId || booking.metadata?.serviceId || "").trim();
      const categoryId = String(item.categoryId || item.category?.id || booking.categoryId || booking.metadata?.categoryId || "").trim();
      const explicitStoreName = String(item.storeName || item.store?.name || (items.length === 1 ? booking.metadata?.storeName : "") || "").trim();
      const hasStore = Boolean(item.storeId || item.store?.id || explicitStoreName);
      const storeName = hasStore ? String(explicitStoreName || item.name || "").trim() : "";
      const storePositionKey = categoryId || categoryName || serviceId || "store";
      const currentStorePosition = storePositions.get(storePositionKey) || 0;
      const explicitStoreNumber = Math.max(0, Math.round(Number(item.storeNumber || item.store_number || 0)));
      const storeNumber = hasStore ? Math.max(1, explicitStoreNumber || currentStorePosition + 1) : 0;
      if (hasStore) storePositions.set(storePositionKey, Math.max(currentStorePosition, storeNumber));
      const itemName = String(item.itemName || item.name || "").trim();
      const name = storeName || itemName || categoryName || serviceName || `Item ${index + 1}`;
      const quoteLine = customerTrackQuoteLineForItem(booking, item, index);
      const category = customerCategoryById(item.categoryId || item.category?.id || booking.metadata?.categoryId || "");
      const categoryImageUrl = String(
        item.categoryImageUrl
        || item.category?.imageUrl
        || item.category?.categoryImageUrl
        || (!hasStore ? item.imageUrl : "")
        || booking.metadata?.categoryImageUrl
        || category?.imageUrl
        || category?.categoryImageUrl
        || ""
      ).trim();
      const storeImageUrl = String(
        item.storeImageUrl
        || item.store?.primaryImageUrl
        || item.store?.imageUrl
        || (hasStore ? (item.primaryImageUrl || item.imageUrl) : "")
        || ""
      ).trim();
      const serviceImageUrl = String(item.serviceImageUrl || booking.serviceImageUrl || booking.metadata?.serviceImageUrl || "").trim();
      const imageUrl = String(hasStore
        ? (storeImageUrl || categoryImageUrl || serviceImageUrl)
        : (categoryImageUrl || serviceImageUrl || item.primaryImageUrl || item.imageUrl || "")
      ).trim();
      const durationMinutes = customerTrackItemDurationMinutes(item, booking, { hasStore, storeNumber, quoteLine });
      const allottedTime = item.allottedTime || quoteLine?.allottedTime || {};
      const waitingCharge = customerTrackWaitingChargeFromSource(item) || customerTrackWaitingChargeFromSource(quoteLine) || { enabled: false, amount: 0, chargePerMinutes: 0 };
      const basePrice = item.basePrice != null
        ? Number(item.basePrice || 0)
        : item.basePricePaise != null
          ? Number(item.basePricePaise || 0) / 100
          : 0;
      const sellingPrice = item.price != null
        ? Number(item.price || 0)
        : item.sellingPrice != null
          ? Number(item.sellingPrice || 0)
          : item.sellingPricePaise != null
            ? Number(item.sellingPricePaise || 0) / 100
            : 0;
      const discountAmountRaw = item.saveAmount ?? item.discountPrice ?? item.discountPaise ?? Math.max(0, basePrice - sellingPrice);
      const discountAmount = item.discountPaise != null && item.saveAmount == null && item.discountPrice == null
        ? Number(item.discountPaise || 0) / 100
        : Number(discountAmountRaw || 0) || 0;
      return {
        id: String(item.id || `${booking.id || "booking"}-${index}`),
        serviceId,
        categoryId,
        serviceName,
        categoryName,
        storeName,
        storeNumber,
        hasStore,
        name,
        imageUrl,
        categoryImageUrl,
        durationMinutes,
        allottedTime,
        waitingCharge,
        basePrice,
        discountAmount,
        sellingPrice
      };
    });
  }
  const serviceItem = bookingListServiceItem(booking);
  const serviceName = String(serviceItem?.serviceName || booking.serviceName || booking.metadata?.serviceName || "Service").trim();
  const serviceId = String(serviceItem?.serviceId || booking.serviceId || booking.metadata?.serviceId || "").trim();
  const categoryName = String(serviceItem?.categoryName || booking.metadata?.categoryName || "").trim();
  const categoryId = String(serviceItem?.categoryId || booking.categoryId || booking.metadata?.categoryId || "").trim();
  const storeName = String(serviceItem?.storeName || booking.metadata?.storeName || "").trim();
  const hasStore = Boolean(serviceItem?.storeId || booking.metadata?.storeId || storeName);
  const storeNumber = hasStore ? Math.max(1, Math.round(Number(serviceItem?.storeNumber || booking.metadata?.storeNumber || 1))) : 0;
  const quoteLine = customerTrackQuoteLineForItem(booking, serviceItem || {}, 0);
  const allottedTime = serviceItem?.allottedTime || quoteLine?.allottedTime || {};
  const waitingCharge = customerTrackWaitingChargeFromSource(serviceItem || {}) || customerTrackWaitingChargeFromSource(quoteLine) || { enabled: false, amount: 0, chargePerMinutes: 0 };
  const category = customerCategoryById(serviceItem?.categoryId || booking.metadata?.categoryId || "");
  const categoryImageUrl = String(
    serviceItem?.categoryImageUrl
    || booking.metadata?.categoryImageUrl
    || (!hasStore ? serviceItem?.imageUrl : "")
    || category?.imageUrl
    || category?.categoryImageUrl
    || ""
  ).trim();
  const fallbackImageUrl = String(customerBookingServiceImage(booking, serviceItem) || serviceItem?.imageUrl || "").trim();
  const imageUrl = String(hasStore ? (fallbackImageUrl || categoryImageUrl) : (categoryImageUrl || fallbackImageUrl)).trim();
  const basePrice = Number(booking.basePricePaise || booking.metadata?.basePricePaise || 0) / 100;
  const sellingPrice = Number(booking.sellingPricePaise || booking.bookingAmountPaise || booking.estimatedAmountPaise || booking.metadata?.sellingPricePaise || booking.metadata?.paymentAmountPaise || booking.metadata?.bookingAmountPaise || 0) / 100;
  const discountAmount = Number(booking.discountPaise || booking.metadata?.discountPaise || Math.max(0, basePrice - sellingPrice)) / 100;
  return [{
    id: String(booking.id || "booking-item"),
    serviceId,
    categoryId,
    serviceName,
    categoryName,
    storeName,
    storeNumber,
    hasStore,
    name: storeName || serviceItem?.name || categoryName || serviceName || "Service",
    imageUrl,
    categoryImageUrl,
    durationMinutes: customerTrackItemDurationMinutes(serviceItem || {}, booking, { hasStore, storeNumber, quoteLine }),
    allottedTime,
    waitingCharge,
    basePrice,
    discountAmount,
    sellingPrice
  }];
}

function bookingListServiceItem(booking = {}) {
  const items = Array.isArray(booking.metadata?.cartItems) ? booking.metadata.cartItems : [];
  const first = items[0] || null;
  if (!first) {
    const categoryDetails = booking.categoryDetails || booking.metadata?.categoryDetails || {};
    const serviceDetails = booking.serviceDetails || booking.metadata?.serviceDetails || {};
    const categoryName = categoryDetails.categoryName || booking.metadata?.categoryName || "";
    const serviceName = serviceDetails.serviceName || booking.serviceName || booking.metadata?.serviceName || "";
    return {
      serviceName,
      serviceId: booking.serviceId || serviceDetails.serviceId || booking.metadata?.serviceId || "",
      categoryId: booking.categoryId || categoryDetails.categoryId || booking.metadata?.categoryId || "",
      categoryName,
      storeName: booking.metadata?.storeName || "",
      name: categoryName || serviceName,
      displayName: categoryName || serviceName,
      imageUrl: booking.serviceImageUrl || booking.metadata?.serviceImageUrl || booking.metadata?.imageUrl || ""
    };
  }
  const categoryBooking = String(first.itemType || "").toLowerCase() === "category"
    || String(first.priceType || "").toLowerCase() === "time"
    || Boolean(first.categoryId && !first.storeId);
  const displayName = categoryBooking
    ? (first.name || first.categoryName || first.durationLabel || first.serviceName || "Category")
    : (first.storeName || first.name || first.serviceName || first.categoryName || "Service");
  return {
    ...first,
    serviceId: first.serviceId || booking.serviceId || booking.metadata?.serviceId || "",
    categoryId: first.categoryId || booking.categoryId || booking.metadata?.categoryId || "",
    displayName,
    imageUrl: first.imageUrl || first.primaryImageUrl || first.storeImageUrl || first.serviceImageUrl || booking.serviceImageUrl || booking.metadata?.serviceImageUrl || booking.metadata?.imageUrl || ""
  };
}

function bookingSlotLabel(booking = {}, serviceItem = null) {
  if (!bookingIsPersonalAssistant(booking, serviceItem)) return "";
  const raw = String(
    serviceItem?.name
    || booking.metadata?.slotName
    || booking.slotName
    || booking.metadata?.durationLabel
    || booking.durationLabel
    || ""
  ).trim().replace(/\s+/g, " ");
  if (raw) {
    const minuteMatch = raw.match(/^(\d+(?:\.\d+)?)\s*min(?:s)?$/i);
    if (minuteMatch) return `${minuteMatch[1]} mins`;
    const hourMatch = raw.match(/^(\d+(?:\.\d+)?)\s*hr(?:s)?$/i);
    if (hourMatch) {
      const value = Number(hourMatch[1]);
      if (value === 1) return "1hr";
      return Number.isInteger(value) ? `${value} hrs` : `${value} hrs`;
    }
    return raw;
  }
  const duration = Number(serviceItem?.durationMinutes || booking.durationMinutes || booking.metadata?.durationMinutes || 0);
  if (duration > 0) {
    if (duration < 60) return `${duration} mins`;
    const hours = duration / 60;
    if (hours === 1) return "1hr";
    return Number.isInteger(hours) ? `${hours} hrs` : `${Number(hours.toFixed(1))} hrs`;
  }
  return "";
}

function bookingIsPersonalAssistant(booking = {}, serviceItem = null) {
  const serviceId = String(serviceItem?.serviceId || booking.serviceId || booking.metadata?.serviceId || "").trim();
  const serviceName = String(serviceItem?.serviceName || booking.serviceName || booking.metadata?.serviceName || "").trim().toLowerCase();
  const catalogService = normalizeArray(activeCatalog().services).find((service) => {
    if (serviceId && String(service.id || service.serviceId || "").trim() === serviceId) return true;
    return serviceName && String(service.name || service.serviceName || "").trim().toLowerCase() === serviceName;
  });
  return Boolean(
    catalogService ? isPersonalAssistantService(catalogService) :
      serviceId === "personal-assistant" ||
      serviceName.includes("personal assistant")
  );
}

function customerBookingServiceImage(booking = {}, serviceItem = null) {
  const categoryBooking = String(serviceItem?.itemType || "").toLowerCase() === "category"
    || String(serviceItem?.priceType || "").toLowerCase() === "time"
    || Boolean(serviceItem?.categoryId && !serviceItem?.storeId);
  if (categoryBooking) {
    const categoryImage = serviceItem?.categoryImageUrl || serviceItem?.imageUrl || booking.metadata?.categoryImageUrl || "";
    if (categoryImage) return categoryImage;
  }
  const serviceId = String(serviceItem?.serviceId || booking.serviceId || booking.metadata?.serviceId || "").trim();
  const serviceName = String(serviceItem?.serviceName || booking.serviceName || booking.metadata?.serviceName || "").trim().toLowerCase();
  const catalogService = normalizeArray(activeCatalog().services).find((service) => {
    if (serviceId && String(service.id || service.serviceId || "").trim() === serviceId) return true;
    return serviceName && String(service.name || service.serviceName || "").trim().toLowerCase() === serviceName;
  });
  return catalogService?.imageUrl || catalogService?.serviceImageUrl || catalogService?.primaryImageUrl || serviceItem?.imageUrl || serviceItem?.categoryImageUrl || serviceItem?.serviceImageUrl || booking.serviceImageUrl || booking.metadata?.serviceImageUrl || booking.metadata?.imageUrl || "";
}

function customerChatComposer(booking = {}) {
  if (["completed", "cancelled", "canceled", "failed", "rejected"].includes(String(booking.statusCode || "").toLowerCase())) {
    return `<p class="muted chat-closed-note">This booking is closed.</p>`;
  }
  return `<form class="chat-composer customer-chat-composer" data-task-update-form data-booking-id="${escapeHtml(booking.id || booking.bookingId || "")}" data-assignment-id="${escapeHtml(booking.assignmentId || "")}">
    <input type="hidden" name="updateType" value="text">
    <textarea name="message" rows="2" placeholder="Message your assistant or admin"></textarea>
    <div class="chat-composer-row">
      <input name="media" type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx">
      <button class="primary-btn" data-task-update-action="send" type="submit">Send</button>
    </div>
  </form>`;
}

function customerCancelModal() {
  const bookingId = state.customerCancelBookingId;
  if (!bookingId) return "";
  return `<div class="assistant-confirm-backdrop customer-cancel-backdrop" role="dialog" aria-modal="true">
    <form class="assistant-confirm-card customer-cancel-modal" data-customer-cancel-form data-booking-id="${escapeHtml(bookingId)}">
      <button class="customer-cancel-modal-close" data-close-customer-cancel type="button" aria-label="Close">${customerIcon("x")}</button>
      <h2>Do you want to cancel your booking?</h2>
      <span>Please confirm cancellation with a reason.</span>
      <textarea name="reason" rows="3" placeholder="Reason for cancellation" required>Customer cancelled from app</textarea>
      <div class="assistant-confirm-actions">
        <button class="soft-btn" data-close-customer-cancel type="button">No</button>
        <button class="danger-btn" type="submit">Yes, Cancel</button>
      </div>
    </form>
  </div>`;
}

function customerDisputeSectionHtml(booking = {}) {
  const bookingId = booking?.id || booking?.bookingId || "";
  if (!bookingId) return "";
  const status = customerTrackStatus(booking);
  if (!["completed", "success"].includes(status)) return "";
  return `<section class="customer-dispute-section">
    <button class="customer-dispute-link" type="button" data-open-customer-dispute="${escapeHtml(bookingId)}">Need help? <span>click here</span></button>
  </section>`;
}

function customerDisputeModal() {
  const bookingId = state.customerDisputeBookingId;
  if (!bookingId) return "";
  const booking = state.bookings.find((item) => String(item.id || "") === String(bookingId)) || state.confirmedBooking || {};
  const amountPaise = Number(booking.bookingAmountPaise || booking.estimatedAmountPaise || booking.metadata?.paymentAmountPaise || 0);
  return `<div class="assistant-confirm-backdrop" role="dialog" aria-modal="true">
    <form class="assistant-confirm-card customer-dispute-modal" data-customer-dispute-form data-booking-id="${escapeHtml(bookingId)}">
      <h2>Raise a dispute</h2>
      <span>Share the issue with admin. You can also request refund or payment adjustment.</span>
      <label>Subject<input name="subject" type="text" maxlength="200" value="Booking dispute" required></label>
      <label>Complaint<textarea name="description" rows="4" maxlength="3000" placeholder="Explain your issue" required></textarea></label>
      <label class="customer-dispute-check"><input name="requestRefund" type="checkbox" value="true"> Ask for refund/payment adjustment</label>
      <label>Requested amount<input name="requestedRefundAmount" type="number" min="0" step="1" value="${escapeHtml(Math.round(amountPaise / 100))}"></label>
      <div class="assistant-confirm-actions">
        <button class="soft-btn" data-close-customer-dispute type="button">No</button>
        <button class="primary-btn" type="submit">Submit</button>
      </div>
    </form>
  </div>`;
}

function customerTrackServiceTitle(booking = {}, items = []) {
  const first = items[0] || bookingListServiceItem(booking) || {};
  return first.displayName || first.name || first.categoryName || first.serviceName || booking.serviceName || booking.metadata?.serviceName || customerBookingServiceSummary(booking) || "Booking";
}

function customerTrackDurationCapsuleText(minutes = 0) {
  const value = Math.max(0, Math.round(Number(minutes || 0)));
  if (value < 60) return `${value} mins`;
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  if (!mins) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr${hours === 1 ? "" : "s"} ${mins} mins`;
}

function customerTrackBaseDurationMinutes(booking = {}, items = []) {
  const metadata = booking.metadata || {};
  const itemTotal = normalizeArray(items).reduce((sum, item) => sum + Math.max(0, Number(item.durationMinutes || item.cartDurationMinutes || 0)), 0);
  if (itemTotal > 0) return Math.max(1, Math.round(itemTotal));
  const explicit = Number(booking.durationMinutes || metadata.durationMinutes || metadata.requestedDurationMinutes || 0);
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, Math.round(explicit));
  return 30;
}

function customerTrackCatalogWaitWindowRows(booking = {}, items = [], selectedType = "instant") {
  const rows = normalizeArray(items).length
    ? normalizeArray(items)
    : [{
        serviceId: booking.serviceId || booking.metadata?.serviceId || "",
        categoryId: booking.categoryId || booking.metadata?.categoryId || "",
        categoryName: booking.metadata?.categoryName || "",
        sellingPrice: Number(booking.bookingAmountPaise || booking.estimatedAmountPaise || booking.metadata?.paymentAmountPaise || 0) / 100
      }];
  return rows.map((item) => {
    const serviceId = String(item.serviceId || "").trim();
    const categoryId = String(item.sourceCategoryId || item.categoryId || "").trim();
    const category = categoryId ? customerCategoryById(categoryId) : null;
    const resolvedServiceId = serviceId || categoryServiceId(category || {});
    if (!resolvedServiceId && !categoryId) return null;
    const config = customerBookingTypeForCartItem({ ...item, serviceId: resolvedServiceId, categoryId });
    const mode = String(config.mode || "both").toLowerCase();
    const waitWindowMinutes = Math.max(0, Math.round(Number(config.waitWindowMinutes || 0)));
    if (!waitWindowMinutes || (mode && mode !== "both" && mode !== selectedType)) return null;
    const categoryName = String(item.categoryName || "").trim().toLowerCase();
    return {
      waitWindowMinutes,
      price: Math.max(0, Number(item.sellingPrice || item.price || item.sellingPricePaise / 100 || 0)),
      categoryKey: categoryId || categoryName || String(item.name || "")
    };
  }).filter(Boolean);
}

function customerTrackSelectWaitWindowMinutes(rows = [], fallback = 0) {
  const usableRows = normalizeArray(rows).filter((item) => Number(item.waitWindowMinutes || 0) > 0);
  if (!usableRows.length) return fallback;
  const categoryCount = new Set(usableRows.map((item) => item.categoryKey).filter(Boolean)).size;
  if (categoryCount > 2) {
    return usableRows.slice().sort((a, b) => b.price - a.price || b.waitWindowMinutes - a.waitWindowMinutes)[0]?.waitWindowMinutes || fallback;
  }
  return Math.max(fallback, ...usableRows.map((item) => item.waitWindowMinutes));
}

function customerTrackApplicableWaitMinutes(booking = {}, items = []) {
  return 0;
}

function customerTrackDurationUnitText(minutes = 0) {
  const value = Math.max(0, Math.round(Number(minutes || 0)));
  if (value < 60) return `${value} min${value === 1 ? "" : "s"}`;
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  const hourText = `${hours} hr${hours === 1 ? "" : "s"}`;
  return mins ? `${hourText} ${mins} min${mins === 1 ? "" : "s"}` : hourText;
}

function customerTrackWaitingChargeFromSource(source = {}) {
  if (!source || typeof source !== "object") return null;
  const waitingRaw = source.waitingCharge && typeof source.waitingCharge === "object" ? source.waitingCharge : {};
  const waitingNumber = typeof source.waitingCharge === "number" || typeof source.waitingCharge === "string" ? source.waitingCharge : null;
  const sourceLooksLikeWaitingCharge = source.chargePerMinutes != null || source.waitingChargeMinutes != null || source.waitingMinutes != null;
  const amountPaise = waitingRaw.amountPaise ?? waitingRaw.waitingChargePaise ?? source.waitingChargePaise ?? source.waitingChargesPaise;
  const amount = amountPaise != null
    ? customerTrackPaiseValue(amountPaise, 0)
    : numberValue(waitingRaw.amount ?? waitingRaw.waitingCharge ?? source.waitingChargeAmount ?? waitingNumber ?? (sourceLooksLikeWaitingCharge ? source.amount : undefined), 0);
  const chargePerMinutes = Math.max(0, Math.round(Number(
    waitingRaw.chargePerMinutes
    ?? waitingRaw.minutes
    ?? waitingRaw.durationMinutes
    ?? source.chargePerMinutes
    ?? source.waitingChargeMinutes
    ?? source.waitingMinutes
    ?? 0
  )));
  if (amount <= 0 || chargePerMinutes <= 0) return null;
  return {
    enabled: true,
    amount,
    chargePerMinutes
  };
}

function customerTrackWaitingChargeInfo(booking = {}, items = []) {
  const metadata = booking.metadata || {};
  const candidates = [];
  const addCandidate = (source, weight = 0) => {
    const waitingCharge = customerTrackWaitingChargeFromSource(source);
    if (waitingCharge) candidates.push({ ...waitingCharge, weight });
  };
  addCandidate(metadata.waitingCharge, 1);
  addCandidate(metadata.allottedTime, 1);
  normalizeArray(metadata.priceMasterQuote?.lineItems).forEach((line, index) => {
    addCandidate(line, Number(line.amount || 0) || (normalizeArray(items)[index]?.sellingPrice || 0));
  });
  normalizeArray(items).forEach((item) => {
    const weight = Number(item.sellingPrice || item.price || 0);
    addCandidate(item, weight);
    if (item.categoryId || item.categoryName) {
      const groupSlab = customerCategoryGroupSlab(item.categoryId || "", item.serviceId || "");
      addCandidate(groupSlab, weight);
    }
    if (item.categoryId || item.serviceId || item.storeId) {
      const rule = customerBestPriceRule("task", item.categoryId || "", item.serviceId || "", item.storeId || "", Boolean(item.storeId));
      addCandidate(rule?.metadata?.allottedTime || rule?.allottedTime || rule?.metadata || rule || null, weight);
    }
  });
  const selected = candidates.sort((a, b) => b.weight - a.weight || b.amount - a.amount || b.chargePerMinutes - a.chargePerMinutes)[0];
  if (!selected) return null;
  return {
    ...selected,
    bookingMinutes: customerTrackBaseDurationMinutes(booking, items)
  };
}

function customerTrackWaitingChargeStripHtml(booking = {}, items = []) {
  const info = customerTrackWaitingChargeInfo(booking, items);
  if (!info) return "";
  const decimals = Number.isInteger(Number(info.amount || 0)) ? 0 : 2;
  return `<div class="customer-track-waiting-strip">
    Waiting charge ${escapeHtml(customerTrackMoney(info.amount, decimals))} / ${escapeHtml(customerTrackDurationUnitText(info.chargePerMinutes))} will applicable after given booking time ${escapeHtml(customerTrackDurationUnitText(info.bookingMinutes))} will over.
  </div>`;
}

function customerTrackDateValue(...values) {
  for (const value of values) {
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function customerTrackBaseEndAt(booking = {}, baseMinutes = 30) {
  const metadata = booking.metadata || {};
  const assignmentMetadata = booking.assignmentMetadata || metadata.assignmentMetadata || {};
  const timer = metadata.taskTimer || {};
  const start = customerTrackDateValue(
    booking.actualTaskStartedAt,
    booking.assignmentActualStartedAt,
    assignmentMetadata.startedAt,
    assignmentMetadata.actualStartedAt,
    metadata.startedAt,
    metadata.actualStartedAt,
    timer.actualStartedAt,
    timer.startedAt
  );
  return start ? new Date(start.getTime() + Math.max(1, Number(baseMinutes || 30)) * 60_000) : null;
}

function customerTrackTotalTimeInfo(booking = {}, items = [], now = Date.now()) {
  const status = customerTrackStatus(booking);
  const metadata = booking.metadata || {};
  const timer = metadata.taskTimer || {};
  const baseMinutes = customerTrackBaseDurationMinutes(booking, items);
  const waitMinutes = customerTrackApplicableWaitMinutes(booking, items);
  const baseEndAt = status === "working" ? customerTrackBaseEndAt(booking, baseMinutes) : null;
  const startAt = customerTrackDateValue(
    booking.actualTaskStartedAt,
    booking.assignmentActualStartedAt,
    metadata.actualStartedAt,
    metadata.startedAt,
    timer.actualStartedAt,
    timer.startedAt
  );
  const heldAt = metadata.finishConfirmationPending
    ? customerTrackDateValue(metadata.finishRequestedAt, metadata.timerHeldAt, timer.finishRequestedAt, timer.timerHeldAt)
    : null;
  const effectiveNow = heldAt ? heldAt.getTime() : now;
  let displayMinutes = baseMinutes;
  let danger = baseMinutes < 10;
  if (baseEndAt) {
    const diffMinutes = Math.ceil((baseEndAt.getTime() - effectiveNow) / 60_000);
    if (diffMinutes > 0) {
      displayMinutes = Math.max(1, diffMinutes);
      danger = displayMinutes < 10;
    } else {
      const waitEndAt = new Date(baseEndAt.getTime() + waitMinutes * 60_000);
      displayMinutes = waitMinutes > 0 ? Math.max(0, Math.ceil((waitEndAt.getTime() - effectiveNow) / 60_000)) : 0;
      danger = true;
    }
  }
  return {
    text: customerTrackDurationCapsuleText(displayMinutes),
    danger,
    status,
    startAt,
    baseEndAt,
    held: Boolean(heldAt),
    waitMinutes,
    fallbackMinutes: displayMinutes,
    baseMinutes
  };
}

function customerTrackRingInfo(input = {}, now = Date.now()) {
  const startAt = input.startAt instanceof Date && !Number.isNaN(input.startAt.getTime()) ? input.startAt : null;
  const endAt = input.endAt instanceof Date && !Number.isNaN(input.endAt.getTime()) ? input.endAt : null;
  const waitMinutes = Math.max(0, Math.round(Number(input.waitMinutes || 0)));
  const staticMinutes = Math.max(0, Math.round(Number(input.staticMinutes || input.baseMinutes || 0)));
  let remainingMs = staticMinutes * 60_000;
  let totalMs = Math.max(1, Number(input.baseMinutes || staticMinutes || 1) * 60_000);
  if (endAt) {
    const baseEndMs = endAt.getTime();
    if (now <= baseEndMs) {
      remainingMs = Math.max(0, baseEndMs - now);
      totalMs = Math.max(1, baseEndMs - (startAt ? startAt.getTime() : now - totalMs));
    } else {
      const waitEndMs = baseEndMs + waitMinutes * 60_000;
      remainingMs = waitMinutes > 0 ? Math.max(0, waitEndMs - now) : 0;
      totalMs = Math.max(1, waitMinutes * 60_000);
    }
  }
  const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60_000));
  const text = customerTrackDurationCapsuleText(remainingMinutes);
  const progress = endAt ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 1;
  const tone = countdownRingTone(progress);
  return { text, tone, progress };
}

function customerTrackTotalTimeHtml(booking = {}, items = []) {
  const info = customerTrackTotalTimeInfo(booking, items);
  if (["completed", "success", "done", "cancelled", "canceled", "failed", "rejected"].includes(String(info.status || "").toLowerCase())) {
    const normalizedStatus = ["completed", "success", "done"].includes(String(info.status || "").toLowerCase()) ? "completed" : "cancelled";
    return `<span class="customer-track-total-time customer-track-final-status customer-track-status-pill ${escapeHtml(normalizedStatus)}">
      <i></i>${escapeHtml(customerTrackStatusLabel(normalizedStatus))}
    </span>`;
  }
  if (!customerTrackHasAssignment(booking)) {
    return `<span class="customer-track-total-time customer-track-duration-pill" data-customer-track-total-time>
      <i aria-hidden="true"></i><b>Confirmed</b>
    </span>`;
  }
  const radius = 23;
  const circumference = 2 * Math.PI * radius;
  const endAt = info.baseEndAt && !info.held ? info.baseEndAt : null;
  const startAt = info.startAt && !info.held ? info.startAt : null;
  const ringInfo = customerTrackRingInfo({
    startAt,
    endAt,
    staticMinutes: info.fallbackMinutes,
    baseMinutes: info.baseMinutes,
    waitMinutes: info.waitMinutes
  });
  const offset = circumference * (1 - ringInfo.progress);
  return `<span class="customer-track-total-time customer-track-countdown-ring ${escapeHtml(ringInfo.tone)}" data-customer-track-total-time data-customer-track-ring data-booking-id="${escapeHtml(booking.id || booking.bookingId || "")}" data-start-at="${escapeHtml(startAt ? startAt.toISOString() : "")}" data-base-end-at="${escapeHtml(endAt ? endAt.toISOString() : "")}" data-wait-minutes="${escapeHtml(info.waitMinutes)}" data-static-minutes="${escapeHtml(info.fallbackMinutes)}" data-base-minutes="${escapeHtml(info.baseMinutes)}" style="--ring-offset:${offset.toFixed(2)}; --ring-circumference:${circumference.toFixed(2)}">
    <svg viewBox="0 0 58 58" aria-hidden="true">
      <circle class="ring-track" cx="29" cy="29" r="${radius}"></circle>
      <circle class="ring-value" cx="29" cy="29" r="${radius}"></circle>
    </svg>
    <b class="countdown-ring-text">${escapeHtml(ringInfo.text)}</b>
  </span>`;
}

function customerTrackBookingReference(booking = {}) {
  return customerVisibleBookingId(booking);
}

function customerTrackIcon(name, className = "") {
  const icons = {
    bag: `<path d="M7 9V7a5 5 0 0 1 10 0v2"></path><path d="M5.5 9h13l-1 11h-11l-1-11Z"></path><path d="M15.5 14h3.5l-2 4.5h-3.5l2-4.5Z"></path><path d="M8.5 14h4"></path>`,
    instant: `<path d="m13 2-8 12h6l-1 8 9-13h-6l1-7Z"></path>`,
    calendar: `<path d="M8 2v4"></path><path d="M16 2v4"></path><path d="M3.5 9h17"></path><rect x="3.5" y="4" width="17" height="17" rx="2.5"></rect>`,
    timer: `<path d="M10 2h4"></path><path d="M12 14v-4"></path><path d="M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"></path><path d="m19 5-1.5 1.5"></path>`,
    watch: `<circle cx="12" cy="13" r="7"></circle><path d="M9 2h6"></path><path d="M9 22h6"></path><path d="M12 9v4l2.5 1.5"></path>`,
    headset: `<path d="M4 13v-1a8 8 0 0 1 16 0v1"></path><path d="M5 13h3v6H6a2 2 0 0 1-2-2v-2a2 2 0 0 1 1-2Z"></path><path d="M19 13h-3v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-2Z"></path><path d="M16 19c0 1.2-1.3 2-3 2h-1"></path>`,
    homeFill: `<path d="M3.5 11.3 12 4l8.5 7.3"></path><path d="M5.8 10.4V20h12.4v-9.6"></path><path d="M9.6 20v-5.8h4.8V20"></path>`,
    market: `<path d="M5 10h14l-1-5H6l-1 5Z"></path><path d="M6.5 10v10h11V10"></path><path d="M9 20v-5h6v5"></path><path d="M8 14h2"></path><path d="M14 14h2"></path>`,
    homeSolid: `<path fill="currentColor" stroke="none" d="M4.5 11.2 12 4.8l7.5 6.4v8a.8.8 0 0 1-.8.8h-4.3v-5.2H9.6V20H5.3a.8.8 0 0 1-.8-.8v-8Z"></path>`,
    marketSolid: `<path fill="currentColor" stroke="none" d="M5.8 4.8h12.4l1 4.6H4.8l1-4.6Zm.5 5.6h11.4v8.8a.8.8 0 0 1-.8.8h-2.5v-4.7H9.6V20H7.1a.8.8 0 0 1-.8-.8v-8.8Zm2.1 2.7v1.7h2.2v-1.7H8.4Zm5 0v1.7h2.2v-1.7h-2.2Z"></path>`,
    camera: `<path d="M8.5 7 10 5h4l1.5 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3.5Z"></path><circle cx="12" cy="13.5" r="3.2"></circle>`,
    chat: `<path d="M21 11.5a8.4 8.4 0 0 1-8.8 8.4 9 9 0 0 1-4.1-1L3 20l1.2-4.2A8.3 8.3 0 0 1 3 11.5 8.4 8.4 0 0 1 11.8 3 8.4 8.4 0 0 1 21 11.5Z"></path><path d="M8 11h8"></path><path d="M8 14h5"></path>`,
    call: `<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"></path>`,
    browser: `<circle cx="12" cy="12" r="9"></circle><path d="M3 12h18"></path><path d="M12 3a14 14 0 0 1 0 18"></path><path d="M12 3a14 14 0 0 0 0 18"></path>`,
    send: `<path d="M21 3 9.3 14.7"></path><path d="m21 3-6.8 18-3.8-8.4L2 8.8 21 3Z"></path>`,
    receiptFill: `<path d="M6 3h12v18l-2-1-2 1-2-1-2 1-2-1-2 1V3Z"></path><path d="M9 8h6"></path><path d="M9 12h6"></path><path d="M9 16h4"></path>`,
    chevronDown: `<path d="m6 9 6 6 6-6"></path>`,
    chevronUp: `<path d="m6 15 6-6 6 6"></path>`,
    more: `<circle cx="12" cy="5" r="1.6"></circle><circle cx="12" cy="12" r="1.6"></circle><circle cx="12" cy="19" r="1.6"></circle>`,
    maximize: `<path d="M8 3H5a2 2 0 0 0-2 2v3"></path><path d="M16 3h3a2 2 0 0 1 2 2v3"></path><path d="M8 21H5a2 2 0 0 1-2-2v-3"></path><path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>`,
    minimize: `<path d="M8 3v3a2 2 0 0 1-2 2H3"></path><path d="M16 3v3a2 2 0 0 0 2 2h3"></path><path d="M8 21v-3a2 2 0 0 0-2-2H3"></path><path d="M16 21v-3a2 2 0 0 1 2-2h3"></path>`,
    star: `<path fill="currentColor" stroke="none" d="m12 3.3 2.5 5.1 5.6.8-4 3.9.9 5.5-5-2.6-5 2.6.9-5.5-4-3.9 5.6-.8L12 3.3Z"></path>`,
    checks: `<path d="m4 13 3 3 5-7"></path><path d="m11 15 2 2 6-8"></path>`
  };
  return `<svg class="customer-track-svg ${escapeHtml(className)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.bag}</svg>`;
}

function customerTrackMoney(value, decimals = 0) {
  const amount = Number(value || 0);
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function customerTrackCategoryTone(label = "") {
  const value = String(label || "").toLowerCase();
  if (/med|pharma|health|care|doctor/.test(value)) return "medical";
  return "food";
}

function customerTrackServiceImageHtml(item = {}, index = 0) {
  const label = item.name || item.storeName || item.categoryName || `Item ${index + 1}`;
  const image = String(item.imageUrl || "").trim();
  if (image) return `<img src="${escapeHtml(assetUrl(image))}" alt="${escapeHtml(label)}">`;
  const tone = customerTrackCategoryTone(item.categoryName || item.name || "");
  const artClass = tone === "medical" ? "medical" : (index % 2 === 0 ? "food-one" : "food-two");
  return `<span class="track-service-photo-art ${escapeHtml(artClass)}" aria-hidden="true"></span>`;
}

function customerTrackMessageTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(date).replace(/\s+/g, " ").replace(/\bam\b/i, "AM").replace(/\bpm\b/i, "PM");
}

function customerTrackBookingDateText(booking = {}) {
  const source = booking.createdAt
    || booking.metadata?.createdAt
    || booking.scheduledAt
    || booking.metadata?.scheduledAt
    || booking.metadata?.bookingDate
    || "";
  const date = source ? new Date(source) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  const formatted = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(date).replace(/\s+/g, " ").replace(/\bam\b/i, "am").replace(/\bpm\b/i, "pm");
  return `Placed on ${formatted}`;
}

function customerTrackOrdinalDay(day = 0) {
  const value = Number(day || 0);
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const suffix = value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th";
  return `${value}${suffix}`;
}

function customerTrackScheduleDateText(value = "") {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  const day = customerTrackOrdinalDay(date.getDate());
  const month = new Intl.DateTimeFormat("en-IN", { month: "long" }).format(date);
  const year = date.getFullYear();
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(date).replace(/\s+/g, " ").replace(/\bam\b/i, "am").replace(/\bpm\b/i, "pm");
  return `${day} ${month} ${year}, ${time}`;
}

function customerTrackBookingTypeInfo(booking = {}) {
  const metadata = booking.metadata || {};
  const scheduledAt = booking.scheduledAt
    || metadata.scheduledAt
    || metadata.startAt
    || metadata.bookingDateTime
    || metadata.schedule?.scheduledAt
    || metadata.schedule?.startAt
    || "";
  const bookingType = String(metadata.bookingType || booking.bookingType || (scheduledAt ? "schedule" : "instant")).toLowerCase();
  const isSchedule = bookingType === "schedule" || bookingType === "scheduled";
  const bookedSlotAt = scheduledAt
    || metadata.bookedSlotAt
    || metadata.bookingSlotAt
    || metadata.slotAt
    || metadata.slotStartAt
    || metadata.schedule?.slotAt
    || metadata.schedule?.slotStartAt
    || "";
  const startAt = booking.bookingStartAt
    || metadata.bookingStartAt
    || booking.promisedStartAt
    || metadata.promisedStartAt
    || scheduledAt
    || "";
  return {
    type: isSchedule ? "schedule" : "instant",
    label: isSchedule ? "Schedule" : "Instant",
    icon: isSchedule ? "calendar" : "instant",
    dateText: startAt ? customerTrackScheduleDateText(startAt) : "",
    startTimeText: startAt ? customerTrackCompactTimeText(startAt) : "",
    slotTimeText: customerTrackCompactTimeText(bookedSlotAt || (!isSchedule ? startAt : ""))
  };
}

function customerTrackCompactTimeText(value = "") {
  const date = customerTrackDateValue(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(date).replace(/\s+/g, " ").replace(/\bam\b/i, "am").replace(/\bpm\b/i, "pm");
}

function customerTrackWaitWindowMessageHtml(booking = {}, items = []) {
  const waitMinutes = customerTrackApplicableWaitMinutes(booking, items);
  if (!waitMinutes) return "";
  return `<small class="customer-track-booking-wait-message">Assistant will arrive within ${escapeHtml(customerTrackDurationUnitText(waitMinutes))} of the selected slot.</small>`;
}

function customerTrackActualTimingHtml(booking = {}, items = []) {
  const metadata = booking.metadata || {};
  const timer = metadata.taskTimer || {};
  const actualStart = customerTrackDateValue(
    booking.actualTaskStartedAt,
    booking.assignmentActualStartedAt,
    metadata.actualStartedAt,
    metadata.startedAt,
    timer.actualStartedAt,
    timer.startedAt
  );
  const durationMinutes = customerTrackBaseDurationMinutes(booking, items);
  const recalculatedEnd = actualStart ? new Date(actualStart.getTime() + Math.max(1, Number(durationMinutes || 30)) * 60_000) : null;
  const actualEnd = customerTrackDateValue(
    recalculatedEnd,
    metadata.actualTaskEndAt,
    timer.taskEndAt,
    metadata.completedAt
    || timer.completedAt,
    booking.completedAt
  );
  const startText = customerTrackCompactTimeText(actualStart);
  const endText = customerTrackCompactTimeText(actualEnd);
  if (!startText && !endText) return "";
  return `<small class="customer-track-completed-time">
    ${startText ? `<span><strong>Started at</strong> ${escapeHtml(startText)}</span>` : ""}
    ${startText && endText ? `<span class="customer-track-time-separator">-</span>` : ""}
    ${endText ? `<span><strong>End at</strong> ${escapeHtml(endText)}</span>` : ""}
  </small>`;
}

function customerTrackBookingTypeHtml(booking = {}, items = []) {
  const info = customerTrackBookingTypeInfo(booking);
  const status = String(customerTrackStatus(booking) || "").toLowerCase();
  const hidePlannedStartLine = info.type === "instant"
    || ["working", "in_progress", "approval_pending", "completed", "success", "done"].includes(status);
  return `<section class="customer-track-section customer-track-booking-type-card ${escapeHtml(info.type)}">
    <span class="customer-track-booking-type-icon">${customerTrackIcon(info.icon)}</span>
    <span class="customer-track-booking-type-copy">
      <b>${escapeHtml(info.label)}${info.slotTimeText ? ` <em><strong>Booked for</strong> ${escapeHtml(info.slotTimeText)}</em>` : ""}</b>
      ${info.dateText && !hidePlannedStartLine ? `<small>${info.type === "instant" ? "Booking started at" : "Start Time"} ${escapeHtml(info.dateText)}</small>` : ""}
      ${customerTrackActualTimingHtml(booking, items)}
      ${customerTrackWaitWindowMessageHtml(booking, items)}
    </span>
  </section>`;
}

function customerTrackAssistantInfo(booking = {}) {
  const meta = booking.metadata || {};
  const assistantMeta = meta.assistant || meta.assignedAssistant || meta.assistantDetails || {};
  const name = [
    booking.assistantName,
    booking.assignedAssistantName,
    assistantMeta.name,
    assistantMeta.displayName,
    assistantMeta.assistantName
  ].map((value) => String(value || "").trim()).find(Boolean) || "Assistant";
  const phone = [
    booking.assistantPhone,
    booking.assignedAssistantPhone,
    assistantMeta.phone,
    assistantMeta.mobile,
    assistantMeta.mobileNumber
  ].map((value) => String(value || "").trim()).find(Boolean) || "";
  const imageUrl = [
    booking.assistantProfilePictureUrl,
    booking.assistantProfileUrl,
    booking.assignedAssistantProfilePictureUrl,
    assistantMeta.profilePictureUrl,
    assistantMeta.profileUrl,
    assistantMeta.imageUrl,
    assistantMeta.avatarUrl
  ].map((value) => String(value || "").trim()).find(Boolean) || "";
  return {
    name,
    phone,
    imageUrl,
    initials: customerChipLabel(name, "A") || "A"
  };
}

function customerTrackAssistantRating(booking = {}) {
  const meta = booking.metadata || {};
  const assistantMeta = meta.assistant || meta.assignedAssistant || meta.assistantDetails || {};
  const raw = [
    booking.assistantRating,
    booking.assistantRatingAvg,
    booking.assignedAssistantRating,
    assistantMeta.rating,
    assistantMeta.ratingAvg,
    assistantMeta.averageRating
  ].map((value) => Number(value)).find((value) => Number.isFinite(value) && value > 0);
  return raw ? raw.toFixed(1) : "0.0";
}

function customerTrackChatStatusDotTone(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "assigned") return "blue";
  if (normalized === "working") return "green";
  if (normalized === "completed" || normalized === "cancelled") return "grey";
  return "black";
}

function customerTrackBookingReadKey(booking = {}) {
  return String(booking.id || booking.bookingId || booking.requestId || booking.bookingCode || booking.referenceCode || "");
}

function customerTrackAssistantUpdateHasContent(update = {}) {
  const mediaUrls = Array.isArray(update.mediaUrls) ? update.mediaUrls : [];
  const updateType = String(update.updateType || "text").toLowerCase();
  return Boolean(String(update.message || "").trim() || mediaUrls.length || ["payment_request", "approval_request", "time_extension_request"].includes(updateType));
}

function customerTrackIsAssistantUpdate(update = {}) {
  const actorType = String(update.actorType || update.from || update.metadata?.actorType || "").toLowerCase();
  return actorType === "assistant";
}

function customerTrackUpdateReadByCustomer(update = {}) {
  const metadata = update.metadata || {};
  const readValues = [
    update.viewerReadAt,
    update.customerReadAt,
    update.readByCustomerAt,
    update.readAt,
    metadata.viewerReadAt,
    metadata.customerReadAt,
    metadata.readByCustomerAt,
    metadata.readAt
  ];
  if (readValues.some(Boolean)) return true;
  const explicitRead = [
    update.readByCustomer,
    update.customerRead,
    update.isRead,
    update.read,
    metadata.readByCustomer,
    metadata.customerRead,
    metadata.isRead,
    metadata.read
  ];
  return explicitRead.some((value) => value === true || String(value).toLowerCase() === "true");
}

function customerTrackUnreadAssistantChatCount(booking = {}, updates = taskUpdates(booking)) {
  return normalizeArray(updates).filter((update) => {
    if (!customerTrackIsAssistantUpdate(update) || !customerTrackAssistantUpdateHasContent(update)) return false;
    if (customerTrackUpdateReadByCustomer(update)) return false;
    return true;
  }).length;
}

async function customerTrackMarkChatRead(booking = {}) {
  const bookingKey = customerTrackBookingReadKey(booking);
  if (!bookingKey) return;
  await api("/portal/task-updates/read", {
    method: "POST",
    body: JSON.stringify({ bookingId: bookingKey })
  });
  const readAt = new Date().toISOString();
  const markUpdates = (target) => {
    if (!target || customerTrackBookingReadKey(target) !== bookingKey) return;
    target.taskUpdates = normalizeArray(target.taskUpdates).map((update) => {
      if (!customerTrackIsAssistantUpdate(update)) return update;
      return { ...update, viewerReadAt: readAt, customerReadAt: readAt };
    });
  };
  normalizeArray(state.bookings).forEach(markUpdates);
  markUpdates(state.confirmedBooking);
}

function customerTrackPhoneHref(phone = "") {
  const cleaned = String(phone || "").replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}

function customerTrackCallTone(booking = {}) {
  const status = customerTrackStatus(booking);
  if (status === "working") return "working";
  if (status === "assigned") return "assigned";
  if (status === "confirmed") return "confirmed";
  if (status === "completed" || status === "cancelled") return "ended";
  return "confirmed";
}

function customerTrackAssistantAvatarHtml(info = {}, className = "") {
  const name = info.name || "Assistant";
  const imageUrl = String(info.imageUrl || "").trim();
  const classes = `customer-track-assistant-avatar ${className}`.trim();
  return `<span class="${escapeHtml(classes)}" aria-hidden="true">
    ${imageUrl
      ? `<img src="${escapeHtml(assetUrl(imageUrl))}" alt="">`
      : `<span>${escapeHtml(info.initials || customerChipLabel(name, "A") || "A")}</span>`}
  </span>`;
}

function customerTrackAssistantCallHtml(info = {}, className = "", booking = {}) {
  const href = customerTrackPhoneHref(info.phone);
  const label = `Call ${info.name || "assistant"}`;
  const closed = customerTrackIsPaidCompleted(booking);
  const classes = `customer-track-assistant-call ${className} ${closed ? "is-disabled" : ""}`.trim();
  const content = customerTrackIcon("call");
  if (closed) {
    return `<button class="${escapeHtml(classes)}" type="button" aria-label="${escapeHtml(label)}" disabled aria-disabled="true">${content}</button>`;
  }
  return href
    ? `<a class="${escapeHtml(classes)}" href="${escapeHtml(href)}" aria-label="${escapeHtml(label)}">${content}</a>`
    : `<button class="${escapeHtml(classes)}" type="button" aria-label="${escapeHtml(label)}" disabled>${content}</button>`;
}

function customerTrackChatToggleHtml(expanded = false) {
  return `<button class="customer-track-chat-toggle" type="button" data-track-chat-toggle aria-expanded="${expanded ? "true" : "false"}" aria-label="${expanded ? "Collapse chat" : "Expand chat"}">${customerTrackIcon(expanded ? "chevronDown" : "chevronUp")}</button>`;
}

function customerTrackChatNotificationHtml(count = 0) {
  const value = Math.max(0, Number(count || 0));
  const label = value ? `${value} unread assistant message${value === 1 ? "" : "s"}` : "No unread assistant messages";
  const display = value > 99 ? "99+" : String(value);
  return `<button class="customer-track-chat-notify" type="button" data-track-chat-open aria-label="${escapeHtml(label)}">
    ${customerTrackIcon("chat")}
    ${value ? `<b>${escapeHtml(display)}</b>` : ""}
  </button>`;
}

function customerTrackChatHeaderHtml(booking = {}, expanded = false, updates = taskUpdates(booking)) {
  const status = customerTrackStatus(booking);
  const unreadCount = customerTrackUnreadAssistantChatCount(booking, updates);
  const notification = customerTrackChatNotificationHtml(unreadCount);
  if (status === "confirmed") {
    return `<div class="customer-track-chat-title customer-track-chat-tone-confirmed">
      <div class="customer-track-chat-pending">
        <i class="customer-track-chat-status-dot black" aria-hidden="true"></i>
        <b>Assistant will assign shortly</b>
      </div>
      ${notification}
      ${customerTrackChatToggleHtml(expanded)}
    </div>`;
  }
  const assistant = customerTrackAssistantInfo(booking);
  const rating = customerTrackAssistantRating(booking);
  const statusLabel = customerTrackStatusLabel(status);
  return `<div class="customer-track-chat-title customer-track-chat-tone-${escapeHtml(status)}">
    <div class="customer-track-chat-agent">
      ${customerTrackAssistantAvatarHtml(assistant)}
      <span>
        <span class="customer-track-chat-name-row">
          <b>${escapeHtml(assistant.name)}</b>
          <span class="customer-track-assistant-status ${escapeHtml(status)}"><i></i>${escapeHtml(statusLabel)}</span>
        </span>
        <small><span class="customer-track-chat-rating">Ratings ${customerTrackIcon("star")}${escapeHtml(rating)}</span></small>
      </span>
    </div>
    ${customerTrackAssistantCallHtml(assistant, `customer-track-chat-call ${status}`, booking)}
    ${notification}
    ${customerTrackChatToggleHtml(expanded)}
  </div>`;
}

function customerTrackAssistantSummaryHtml(booking = {}, status = "") {
  if (!customerTrackHasAssignment(booking) || status === "confirmed") return "";
  const assistant = customerTrackAssistantInfo(booking);
  const rating = customerTrackAssistantRating(booking);
  const statusLabel = customerTrackStatusLabel(status || customerTrackStatus(booking));
  return `<section class="customer-track-section customer-track-assistant-card">
    ${customerTrackAssistantAvatarHtml(assistant)}
    <span class="customer-track-assistant-copy">
      <span class="customer-track-assistant-name-row">
        <b>${escapeHtml(assistant.name)}</b>
        <span class="customer-track-assistant-status ${escapeHtml(status || customerTrackStatus(booking))}"><i></i>${escapeHtml(statusLabel)}</span>
      </span>
      <small><span class="customer-track-assistant-rating">Ratings ${customerTrackIcon("star")}${escapeHtml(rating)}</span></small>
    </span>
    ${customerTrackAssistantCallHtml(assistant, "", booking)}
  </section>`;
}

function customerTrackPreviewKind(url = "", explicit = "") {
  const type = String(explicit || "").toLowerCase();
  if (type === "image" || type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg)(?:$|\?)/i.test(url)) return "image";
  if (type === "video" || type.startsWith("video/") || /\.(mp4|webm|mov|m4v)(?:$|\?)/i.test(url)) return "video";
  if (type === "voice" || type === "audio" || type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|aac)(?:$|\?)/i.test(url)) return "audio";
  if (type === "pdf" || type === "application/pdf" || /\.pdf(?:$|\?)/i.test(url)) return "pdf";
  return "file";
}

function customerTrackPreviewExtension(url = "", name = "") {
  const source = String(name || url || "").split("?")[0].split("#")[0];
  const ext = source.includes(".") ? source.split(".").pop() : "";
  return String(ext || "FILE").slice(0, 5).toUpperCase();
}

function customerTrackPreviewTriggerAttrs(url = "", name = "", kind = "") {
  return `data-track-preview-url="${escapeHtml(url)}" data-track-preview-name="${escapeHtml(name)}" data-track-preview-kind="${escapeHtml(kind)}"`;
}

function customerTrackPreviewModal(file = state.customerTrackPreviewFile) {
  if (!file?.url) return "";
  const url = assetUrl(String(file.url || ""));
  const name = String(file.name || "Attachment");
  const kind = customerTrackPreviewKind(url, file.kind);
  const body = kind === "image"
    ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(name)}">`
    : kind === "video"
      ? `<video src="${escapeHtml(url)}" controls playsinline></video>`
      : kind === "audio"
        ? `<div class="customer-track-preview-file">${customerIcon("package")}<b>${escapeHtml(customerTrackPreviewExtension(url, name))}</b></div><audio src="${escapeHtml(url)}" controls></audio>`
        : kind === "pdf"
          ? `<iframe src="${escapeHtml(url)}" title="${escapeHtml(name)}"></iframe>`
          : `<div class="customer-track-preview-file">${customerIcon("package")}<b>${escapeHtml(customerTrackPreviewExtension(url, name))}</b></div>`;
  return `<div class="customer-track-preview-backdrop" data-track-preview-backdrop role="dialog" aria-modal="true" aria-label="Attachment preview">
    <section class="customer-track-preview-card">
      <header>
        <button type="button" data-close-track-preview aria-label="Close preview">${customerIcon("x")}</button>
        <h2>${escapeHtml(name)}</h2>
      </header>
      <div class="customer-track-preview-body ${escapeHtml(kind)}">${body}</div>
    </section>
  </div>`;
}

function customerTrackOpenPreview(file = {}) {
  const url = assetUrl(String(file.url || "").trim());
  if (!url) return;
  state.customerTrackPreviewFile = {
    url,
    name: String(file.name || "Attachment"),
    kind: customerTrackPreviewKind(url, file.kind)
  };
  root.querySelector("[data-track-preview-backdrop]")?.remove();
  root.insertAdjacentHTML("beforeend", customerTrackPreviewModal());
}

function customerTrackClosePreview() {
  state.customerTrackPreviewFile = null;
  root.querySelector("[data-track-preview-backdrop]")?.remove();
}

function taskUpdateAttachmentFormKey(form) {
  if (!form) return "";
  if (!form.dataset.taskAttachmentKey) {
    taskUpdateAttachmentPreviewSeq += 1;
    form.dataset.taskAttachmentKey = `task-attachment-${Date.now()}-${taskUpdateAttachmentPreviewSeq}`;
  }
  return form.dataset.taskAttachmentKey;
}

function taskUpdateAttachmentItems(form) {
  const key = form?.dataset?.taskAttachmentKey || "";
  return key ? (taskUpdateAttachmentPreviews.get(key) || []) : [];
}

function taskUpdateAttachmentKind(file = {}) {
  return customerTrackPreviewKind(file.name || "", file.type || "");
}

function taskUpdateAttachmentName(file = {}) {
  return String(file.name || "Attachment").trim() || "Attachment";
}

function taskUpdateAttachmentThumbHtml(item = {}) {
  const kind = String(item.kind || "file");
  const url = assetUrl(String(item.url || ""));
  const name = String(item.name || "Attachment");
  if (kind === "image") return `<img src="${escapeHtml(url)}" alt="${escapeHtml(name)}">`;
  if (kind === "video") return `<video src="${escapeHtml(url)}" muted playsinline preload="metadata"></video>`;
  if (kind === "audio") return `<span class="task-attachment-preview-icon">${customerIcon("mic")}</span>`;
  return `<span class="task-attachment-preview-icon"><b>${escapeHtml(customerTrackPreviewExtension(name, name))}</b></span>`;
}

function taskUpdateAttachmentTrayHtml(items = []) {
  if (!items.length) return "";
  return items.map((item) => `<span class="task-attachment-preview-chip" title="${escapeHtml(item.name || "Attachment")}">
    <button class="task-attachment-preview-open" data-task-attachment-preview="${escapeHtml(item.id)}" type="button" aria-label="Preview attachment">
      <span class="task-attachment-preview-thumb ${escapeHtml(item.kind || "file")}">${taskUpdateAttachmentThumbHtml(item)}</span>
    </button>
    <button class="task-attachment-preview-remove" data-task-attachment-remove="${escapeHtml(item.id)}" type="button" aria-label="Remove attachment">${customerIcon("trash")}</button>
    <small>${escapeHtml(item.name || "Attachment")}</small>
  </span>`).join("");
}

function taskUpdateAttachmentTrayAnchor(form) {
  if (!form) return null;
  if (form.classList.contains("customer-track-composer")) return form.querySelector("textarea") || form.firstElementChild;
  return form.querySelector("label[aria-label='Attach file']")
    || form.querySelector(".task-update-controls")
    || form.querySelector(".chat-composer-row")
    || form.querySelector("textarea")
    || form.firstElementChild;
}

function renderTaskUpdateAttachmentTray(form) {
  if (!form) return;
  const items = taskUpdateAttachmentItems(form);
  let tray = form.querySelector("[data-task-attachment-tray]");
  form.classList.toggle("has-attachments", Boolean(items.length));
  if (!items.length) {
    tray?.remove();
    return;
  }
  if (!tray) {
    tray = document.createElement("div");
    tray.className = "task-attachment-preview-tray";
    tray.dataset.taskAttachmentTray = "true";
    const anchor = taskUpdateAttachmentTrayAnchor(form);
    if (anchor) form.insertBefore(tray, anchor);
    else form.prepend(tray);
  }
  tray.innerHTML = taskUpdateAttachmentTrayHtml(items);
}

function clearTaskUpdateAttachmentTray(form) {
  if (!form) return;
  const key = form.dataset.taskAttachmentKey || "";
  if (key) taskUpdateAttachmentPreviews.delete(key);
  form.classList.remove("has-attachments");
  form.querySelector("[data-task-attachment-tray]")?.remove();
  const input = form.querySelector("input[type='file']");
  if (input) input.value = "";
}

function taskUpdateSelectedFiles(form) {
  const cached = taskUpdateAttachmentItems(form).map((item) => item.file).filter(Boolean);
  if (cached.length) return cached;
  return Array.from(form?.querySelector("input[type='file']")?.files || []);
}

async function handleTaskUpdateAttachmentInput(input) {
  const form = input?.closest?.("[data-task-update-form]");
  if (!form) return;
  const files = Array.from(input.files || []);
  if (!files.length) return;
  const key = taskUpdateAttachmentFormKey(form);
  const existing = taskUpdateAttachmentPreviews.get(key) || [];
  const nextItems = [];
  for (const file of files) {
    const kind = taskUpdateAttachmentKind(file);
    let url = "";
    try {
      url = await fileToDataBase64(file);
    } catch (error) {
      url = "";
    }
    nextItems.push({
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      url,
      kind,
      name: taskUpdateAttachmentName(file),
      type: file.type || "",
      size: file.size || 0
    });
  }
  taskUpdateAttachmentPreviews.set(key, [...existing, ...nextItems].slice(0, 8));
  input.value = "";
  renderTaskUpdateAttachmentTray(form);
}

function openTaskUpdateAttachmentPreview(button) {
  const form = button?.closest?.("[data-task-update-form]");
  const id = String(button?.dataset?.taskAttachmentPreview || "");
  const item = taskUpdateAttachmentItems(form).find((entry) => String(entry.id) === id);
  if (!item?.url) return;
  customerTrackOpenPreview({
    url: item.url,
    name: item.name || "Attachment",
    kind: item.kind || taskUpdateAttachmentKind(item.file)
  });
}

function removeTaskUpdateAttachment(button) {
  const form = button?.closest?.("[data-task-update-form]");
  const id = String(button?.dataset?.taskAttachmentRemove || "");
  const key = form?.dataset?.taskAttachmentKey || "";
  if (!form || !id || !key) return;
  const nextItems = taskUpdateAttachmentItems(form).filter((entry) => String(entry.id) !== id);
  if (nextItems.length) taskUpdateAttachmentPreviews.set(key, nextItems);
  else taskUpdateAttachmentPreviews.delete(key);
  renderTaskUpdateAttachmentTray(form);
}

function customerTrackUploadStripHtml(booking = {}) {
  const uploads = taskUploadItems(booking);
  return `<section class="customer-track-section customer-track-uploads">
    <h2>Uploads</h2>
    <div class="customer-track-upload-strip">
      ${uploads.length
        ? uploads.map((upload, index) => {
          const url = upload.url || upload.href || upload.path || upload.fileUrl || upload.imageUrl || upload.mediaUrl || upload.downloadUrl || "";
          const name = upload.name || upload.fileName || upload.type || `Upload ${index + 1}`;
          const kind = customerTrackPreviewKind(url, upload.type || upload.mimeType || "");
          const viewUrl = assetUrl(url);
          const content = kind === "image" ? `<img src="${escapeHtml(viewUrl)}" alt="${escapeHtml(name)}">` : `<span class="customer-track-upload-art ${escapeHtml(upload.placeholder || "box")}"></span>`;
          return url ? `<button class="customer-track-upload-tile" type="button" ${customerTrackPreviewTriggerAttrs(viewUrl, name, kind)} title="${escapeHtml(name)}">${content}</button>`
            : `<span class="customer-track-upload-tile" title="${escapeHtml(name)}">${content}</span>`;
        }).join("")
        : `<p class="customer-track-upload-empty">No file uploaded</p>`}
    </div>
  </section>`;
}

function customerTrackLocationRows(booking = {}) {
  const direct = Array.isArray(booking.locations) ? booking.locations : [];
  if (direct.length) return direct;
  const bookingLocations = booking.metadata?.bookingLocations;
  const stops = Array.isArray(bookingLocations?.stops) ? bookingLocations.stops : [];
  if (stops.length) return stops;
  const selected = booking.metadata?.selectedLocation;
  return selected?.address ? [selected] : [];
}

function customerTrackLocationQuery(location = {}) {
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) return `${latitude},${longitude}`;
  return String(location.address || location.addressText || location.name || "").trim();
}

function customerTrackLocationBrowserUrl(location = {}) {
  const query = customerTrackLocationQuery(location);
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
}

function customerTrackLocationAppUrl(location = {}, index = 0) {
  const query = customerTrackLocationQuery(location);
  if (!query) return "";
  const title = taskLocationTitle(location, index);
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `geo:${latitude},${longitude}?q=${encodeURIComponent(`${latitude},${longitude}(${title})`)}`;
  }
  return `geo:0,0?q=${encodeURIComponent(query)}`;
}

function customerTrackLocationAppleUrl(location = {}) {
  const query = customerTrackLocationQuery(location);
  return query ? `https://maps.apple.com/?q=${encodeURIComponent(query)}` : "";
}

function customerTrackMapSheetHtml(sheet = state.customerTrackMapSheet) {
  if (!sheet?.browserUrl) return "";
  return `<div class="customer-track-map-sheet-backdrop" data-track-map-sheet-backdrop role="presentation">
    <section class="customer-track-map-sheet" role="dialog" aria-modal="true" aria-label="Open location">
      <span class="customer-track-map-sheet-handle" aria-hidden="true"></span>
      <header>
        <div>
          <small>Open location</small>
          <h2>${escapeHtml(sheet.title || "Location")}</h2>
          ${sheet.address ? `<p>${escapeHtml(sheet.address)}</p>` : ""}
        </div>
        <button type="button" data-close-track-map-sheet aria-label="Close">${customerIcon("x")}</button>
      </header>
      <div class="customer-track-map-options">
        ${sheet.appUrl ? `<a href="${escapeHtml(sheet.appUrl)}"><span>${customerIcon("map")}</span><b>Map app</b><small>Choose installed app</small></a>` : ""}
        ${sheet.appleUrl ? `<a href="${escapeHtml(sheet.appleUrl)}" target="_blank" rel="noreferrer"><span>${customerIcon("map")}</span><b>Apple Maps</b><small>Open maps app/browser</small></a>` : ""}
        <a href="${escapeHtml(sheet.browserUrl)}" target="_blank" rel="noreferrer" data-close-track-map-sheet><span>${customerTrackIcon("browser")}</span><b>Browser</b><small>Open map in new tab</small></a>
      </div>
    </section>
  </div>`;
}

function customerTrackOpenMapSheet(sheet = {}) {
  if (!sheet.browserUrl) return;
  state.customerTrackMapSheet = sheet;
  root.querySelector("[data-track-map-sheet-backdrop]")?.remove();
  root.insertAdjacentHTML("beforeend", customerTrackMapSheetHtml());
}

function customerTrackCloseMapSheet() {
  state.customerTrackMapSheet = null;
  root.querySelector("[data-track-map-sheet-backdrop]")?.remove();
}

function customerTrackLocationsHtml(booking = {}) {
  const locations = customerTrackLocationRows(booking);
  const expanded = Boolean(state.customerTrackLocationsExpanded);
  return `<section class="customer-track-section customer-track-locations">
    <div class="customer-track-section-title-row">
      <h2>Locations</h2>
      <button type="button" data-track-location-toggle aria-expanded="${expanded ? "true" : "false"}" aria-label="${expanded ? "Collapse" : "Expand"} locations">${customerTrackIcon(expanded ? "chevronUp" : "chevronDown")}</button>
    </div>
    <div class="customer-track-location-card ${expanded ? "" : "is-collapsed"}">
      <div class="customer-track-location-rows">
        ${locations.length
          ? locations.map((location, index) => {
            const browserUrl = customerTrackLocationBrowserUrl(location);
            const appUrl = customerTrackLocationAppUrl(location, index);
            const appleUrl = customerTrackLocationAppleUrl(location);
            const title = taskLocationTitle(location, index);
            const address = locationShortAddress(location);
            const iconName = index === 0 ? "homeSolid" : "marketSolid";
            const attrs = browserUrl
              ? `type="button" data-track-map-location data-track-map-title="${escapeHtml(title)}" data-track-map-address="${escapeHtml(address)}" data-track-map-browser-url="${escapeHtml(browserUrl)}" data-track-map-app-url="${escapeHtml(appUrl)}" data-track-map-apple-url="${escapeHtml(appleUrl)}"`
              : "";
            return `<${browserUrl ? "button" : "div"} class="customer-track-location-row" ${attrs}>
              <span class="customer-track-location-pin ${index === 0 ? "home" : "market"}">${customerTrackIcon(iconName)}</span>
              <span class="customer-track-location-copy">
                <b>${escapeHtml(title)}</b>
                <small>${escapeHtml(address)}</small>
              </span>
              <span class="customer-track-location-arrow">${customerIcon("chevron")}</span>
            </${browserUrl ? "button" : "div"}>`;
          }).join("")
          : `<div class="customer-track-location-empty">No locations added</div>`}
      </div>
    </div>
  </section>`;
}

function customerTrackLocationsUploadsHtml(booking = {}) {
  const locations = customerTrackLocationRows(booking);
  const uploads = taskUploadItems(booking);
  const locationCount = locations.length;
  const uploadCount = uploads.length;
  const expanded = Boolean(state.customerTrackMediaExpanded);
  return `<section class="customer-track-section customer-track-media-section">
    <div class="customer-track-media-card ${expanded ? "" : "is-collapsed"}">
      <div class="customer-track-media-head">
        <div>
          <h2>Locations &amp; Uploads</h2>
          <small>${escapeHtml(`${locationCount} location${locationCount === 1 ? "" : "s"} · ${uploadCount} upload${uploadCount === 1 ? "" : "s"}`)}</small>
        </div>
        <button type="button" data-track-media-toggle aria-expanded="${expanded ? "true" : "false"}" aria-label="${expanded ? "Collapse" : "Expand"} locations and uploads">${customerTrackIcon(expanded ? "chevronUp" : "chevronDown")}</button>
      </div>
      <div class="customer-track-media-body">
        <div class="customer-track-media-block">
          <h3>Locations</h3>
          <div class="customer-track-location-card">
            <div class="customer-track-location-rows">
              ${locations.length
                ? locations.map((location, index) => {
                  const browserUrl = customerTrackLocationBrowserUrl(location);
                  const appUrl = customerTrackLocationAppUrl(location, index);
                  const appleUrl = customerTrackLocationAppleUrl(location);
                  const title = taskLocationTitle(location, index);
                  const address = locationShortAddress(location);
                  const iconName = index === 0 ? "homeSolid" : "marketSolid";
                  const attrs = browserUrl
                    ? `type="button" data-track-map-location data-track-map-title="${escapeHtml(title)}" data-track-map-address="${escapeHtml(address)}" data-track-map-browser-url="${escapeHtml(browserUrl)}" data-track-map-app-url="${escapeHtml(appUrl)}" data-track-map-apple-url="${escapeHtml(appleUrl)}"`
                    : "";
                  return `<${browserUrl ? "button" : "div"} class="customer-track-location-row" ${attrs}>
                    <span class="customer-track-location-pin ${index === 0 ? "home" : "market"}">${customerTrackIcon(iconName)}</span>
                    <span class="customer-track-location-copy">
                      <b>${escapeHtml(title)}</b>
                      <small>${escapeHtml(address)}</small>
                    </span>
                    <span class="customer-track-location-arrow">${customerIcon("chevron")}</span>
                  </${browserUrl ? "button" : "div"}>`;
                }).join("")
                : `<div class="customer-track-location-empty">No locations added</div>`}
            </div>
          </div>
        </div>
        <div class="customer-track-media-block">
          <h3>Uploads</h3>
          <div class="customer-track-upload-strip">
            ${uploads.length
              ? uploads.map((upload, index) => {
                const url = upload.url || upload.href || upload.path || upload.fileUrl || upload.imageUrl || upload.mediaUrl || upload.downloadUrl || "";
                const name = upload.name || upload.fileName || upload.type || `Upload ${index + 1}`;
                const kind = customerTrackPreviewKind(url, upload.type || upload.mimeType || "");
                const viewUrl = assetUrl(url);
                const content = kind === "image" ? `<img src="${escapeHtml(viewUrl)}" alt="${escapeHtml(name)}">` : `<span class="customer-track-upload-art ${escapeHtml(upload.placeholder || "box")}"></span>`;
                return url ? `<button class="customer-track-upload-tile" type="button" ${customerTrackPreviewTriggerAttrs(viewUrl, name, kind)} title="${escapeHtml(name)}">${content}</button>`
                  : `<span class="customer-track-upload-tile" title="${escapeHtml(name)}">${content}</span>`;
              }).join("")
              : `<p class="customer-track-upload-empty">No file uploaded</p>`}
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function customerTrackPriceValue(value, fallback = 0) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return fallback;
  if (Math.abs(amount) >= 10000 && Number.isInteger(amount)) return amount / 100;
  return amount;
}

function customerTrackPaiseValue(value, fallback = 0) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return fallback;
  return amount / 100;
}

function customerTrackLiveWaitingSummary(booking = {}, items = []) {
  const metadata = booking.metadata || {};
  const timer = metadata.taskTimer || {};
  const storedMinutes = Math.max(0, Math.round(Number(
    booking.waitingTimeMinutes
    ?? metadata.waitingTimeMinutes
    ?? metadata.paymentDetails?.waitingTimeMinutes
    ?? timer.waitingMinutes
    ?? 0
  ) || 0));
  const storedCharges = Math.max(0, customerTrackPaiseValue(
    booking.waitingChargesPaise
    ?? metadata.waitingChargesPaise
    ?? metadata.paymentDetails?.waitingChargesPaise
    ?? timer.waitingChargesPaise,
    0
  ));
  const info = customerTrackWaitingChargeInfo(booking, items);
  const baseEndAt = customerTrackBaseEndAt(booking, customerTrackBaseDurationMinutes(booking, items));
  const heldAt = metadata.finishConfirmationPending
    ? customerTrackDateValue(metadata.finishRequestedAt, metadata.timerHeldAt, timer.finishRequestedAt, timer.timerHeldAt)
    : null;
  const effectiveNow = heldAt ? heldAt.getTime() : Date.now();
  let liveMinutes = 0;
  let liveCharges = 0;
  if (customerTrackStatus(booking) === "working" && info && baseEndAt) {
    liveMinutes = Math.max(0, Math.ceil((effectiveNow - baseEndAt.getTime()) / 60_000));
    liveCharges = liveMinutes > 0 ? Math.ceil(liveMinutes / info.chargePerMinutes) * Number(info.amount || 0) : 0;
  }
  return {
    minutes: Math.max(storedMinutes, liveMinutes),
    charges: Math.max(storedCharges, liveCharges)
  };
}

function customerTrackBillSummary(booking = {}, items = []) {
  const metadata = booking.metadata || {};
  const pricing = metadata.pricingBreakdown || {};
  const waiting = customerTrackLiveWaitingSummary(booking, items);
  const tipAmount = Math.max(0, Number(state.customerTrackTipAmount || 0));
  const rawTotal = customerTrackPaiseValue(
    booking.bookingAmountPaise
    || booking.estimatedAmountPaise
    || metadata.paymentAmountPaise
    || metadata.bookingAmountPaise
    || metadata.estimatedAmountPaise
    || pricing.grandTotalPaise
    || pricing.finalTotalAmountPaise
    || pricing.totalAmountPaise
  );
  const itemTotalFromItems = normalizeArray(items).reduce((sum, item) => sum + Number(item.sellingPrice || item.price || 0), 0);
  const itemTotal = customerTrackPaiseValue(
    pricing.itemTotalPaise
    || pricing.subtotalPaise
    || pricing.sellingAmountPaise
    || metadata.itemTotalPaise
    || metadata.subtotalPaise,
    itemTotalFromItems
  ) || itemTotalFromItems || Math.max(0, rawTotal - waiting.charges);
  const fees = customerTrackPaiseValue(
    pricing.feesPaise
    || pricing.serviceFeePaise
    || pricing.gstPaise
    || pricing.taxAmountPaise
    || metadata.feesPaise
    || metadata.serviceFeePaise
    || metadata.gstPaise,
    Math.max(0, rawTotal - waiting.charges - itemTotal)
  );
  const discountFromItems = normalizeArray(items).reduce((sum, item) => {
    const base = Number(item.basePrice || 0);
    const selling = Number(item.sellingPrice || 0);
    return sum + Math.max(0, base - selling);
  }, 0);
  const discount = customerTrackPaiseValue(
    booking.discountPaise
    || metadata.discountPaise
    || pricing.discountAmountPaise,
    discountFromItems
  ) || discountFromItems;
  return {
    total: Math.max(rawTotal, itemTotal + fees + waiting.charges) + tipAmount,
    itemTotal,
    fees,
    discount,
    tipAmount,
    waitingMinutes: waiting.minutes,
    waitingCharges: waiting.charges
  };
}

function customerTrackBillDetailsHtml(booking = {}, items = []) {
  const bill = customerTrackBillSummary(booking, items);
  const payment = customerBookingPaymentState(booking);
  const paymentClass = payment.paid ? "paid" : payment.pending ? "pending" : "due";
  const bookingId = booking.id || booking.bookingId || "";
  const expanded = Boolean(state.customerTrackBillExpanded);
  return `<section class="customer-track-section customer-track-bill">
    <h2>Bill details</h2>
    <div class="customer-track-bill-card ${expanded ? "" : "is-collapsed"}">
      <div class="customer-track-bill-head">
        <span>${customerTrackIcon("receiptFill")}</span>
        <div>
          <b>To pay ${escapeHtml(customerTrackMoney(bill.total, 2))} <em class="customer-track-payment-pill ${escapeHtml(paymentClass)}">${escapeHtml(payment.label)}</em></b>
          ${bill.discount > 0 ? `<small>${escapeHtml(customerTrackMoney(bill.discount, 0))} saved on the total bill</small>` : ""}
        </div>
        <button type="button" data-track-bill-toggle aria-expanded="${expanded ? "true" : "false"}" aria-label="${expanded ? "Collapse" : "Expand"} bill details">${customerTrackIcon(expanded ? "chevronUp" : "chevronDown")}</button>
      </div>
      <div class="customer-track-bill-rows">
        <div class="customer-track-bill-row"><span>Item total</span><b>${escapeHtml(customerTrackMoney(bill.itemTotal, 2))}</b></div>
        <div class="customer-track-bill-row"><span>GST &amp; Service Fees</span><b>${escapeHtml(customerTrackMoney(bill.fees, 2))}</b></div>
        ${bill.tipAmount > 0 ? `<div class="customer-track-bill-row"><span>Tip</span><b>${escapeHtml(customerTrackMoney(bill.tipAmount, 2))}</b></div>` : ""}
        ${payment.paid && payment.remarks ? `<div class="customer-track-bill-row"><span>Payment Remarks</span><b>${escapeHtml(payment.remarks)}</b></div>` : ""}
        ${payment.paid && normalizeArray(payment.proofMediaUrls).length ? `<div class="customer-track-bill-row"><span>Payment Proof</span><b>${normalizeArray(payment.proofMediaUrls).slice(0, 2).map((url, index) => {
          const viewUrl = assetUrl(url);
          return `<a href="${escapeHtml(viewUrl)}" target="_blank" rel="noreferrer" ${customerTrackPreviewTriggerAttrs(viewUrl, `Payment proof ${index + 1}`, customerTrackPreviewKind(viewUrl, "image"))}>View</a>`;
        }).join(" ")}</b></div>` : ""}
        ${bill.waitingCharges > 0 || bill.waitingMinutes > 0 ? `<div class="customer-track-bill-row"><span>Waiting charges (${escapeHtml(customerTrackDurationUnitText(bill.waitingMinutes))})</span><b>${escapeHtml(customerTrackMoney(bill.waitingCharges, 2))}</b></div>` : ""}
        <div class="customer-track-bill-row total"><span>To Pay</span><b>${escapeHtml(customerTrackMoney(bill.total, 2))}</b></div>
        ${!payment.paid && !payment.pending && bookingId ? `<div class="customer-track-pay-now-row">
          <b>${escapeHtml(customerTrackMoney(bill.total, 2))}</b>
          <button class="primary-btn" data-customer-pay-now data-payment-booking-id="${escapeHtml(bookingId)}" data-payment-assignment-id="${escapeHtml(booking.assignmentId || "")}" data-payment-amount="${escapeHtml(bill.total)}" type="button">Pay Now</button>
        </div>` : ""}
      </div>
    </div>
  </section>`;
}

function customerTrackTipCardHtml(booking = {}) {
  const payment = customerBookingPaymentState(booking);
  if (payment.paid) return "";
  const locked = Boolean(payment.pending);
  const bookingId = String(booking.id || booking.bookingId || "current").replace(/[^a-zA-Z0-9_-]/g, "");
  const selected = Number(state.customerTrackTipAmount || 0);
  const customActive = selected > 0 && ![20, 30, 50].includes(selected);
  const customOpen = Boolean(state.customerTrackTipCustomOpen);
  const tipOptions = [
    { value: 20, icon: "🙂" },
    { value: 30, icon: "😊" },
    { value: 50, icon: "⭐" }
  ];
  return `<section class="customer-track-tip-card ${locked ? "is-disabled" : ""}" aria-label="Tip your ZIGO assistant" aria-disabled="${locked ? "true" : "false"}">
    <div class="customer-track-tip-copy">
      <h2>Tip your ZIGO assistant</h2>
      <p>Your kindness means a lot. 100% of your tip will go directly to your assistant.</p>
    </div>
    <div class="customer-track-tip-hero" aria-hidden="true">
      <span class="customer-track-tip-person"></span>
      <span class="customer-track-tip-spark one"></span>
      <span class="customer-track-tip-spark two"></span>
    </div>
    <div class="customer-track-tip-options ${customOpen ? "is-custom-open" : ""}">
      ${tipOptions.map((option) => `<button class="${selected === option.value ? "active" : ""}" data-track-tip-amount="${option.value}" type="button"${locked ? " disabled" : ""}><span>${option.icon}</span>₹${option.value}</button>`).join("")}
      ${customOpen ? `<label class="customer-track-tip-inline-custom"><span>₹</span>
        <input id="customer-track-tip-custom-${escapeHtml(bookingId)}" name="customerTrackTipCustom" data-track-tip-custom-input inputmode="numeric" type="text" value="${escapeHtml(state.customerTrackTipCustom)}" placeholder="Amount" autocomplete="off" aria-label="Custom tip amount"${locked ? " disabled" : ""}>
        <button ${state.customerTrackTipCustom ? "data-track-tip-custom-add" : "data-track-tip-custom-close"} type="button"${locked ? " disabled" : ""}>${state.customerTrackTipCustom ? "Add" : "Close"}</button>
      </label>` : `<button class="${customActive ? "active" : ""}" data-track-tip-custom type="button"${locked ? " disabled" : ""}>${customActive ? `₹${escapeHtml(String(selected))} ${customerIcon("edit")}` : "<span>💙</span>Custom"}</button>`}
    </div>
    <div class="customer-track-tip-footer">
      <label for="customer-track-tip-future-${escapeHtml(bookingId)}"><input id="customer-track-tip-future-${escapeHtml(bookingId)}" name="customerTrackTipFuture" data-track-tip-future type="checkbox"${state.customerTrackTipFuture ? " checked" : ""}${locked ? " disabled" : ""}> Apply this tip to future bookings</label>
      <button data-track-tip-clear type="button"${locked ? " disabled" : ""}>Clear Tip</button>
    </div>
    ${locked ? `<small class="customer-track-tip-lock">Payment confirmation is pending. Tip can be changed if assistant/admin does not confirm payment.</small>` : ""}
  </section>`;
}

function focusCustomerTrackTipControl(selector = "") {
  requestAnimationFrame(() => {
    const target = selector ? root.querySelector(selector) : null;
    const row = target?.closest?.(".customer-track-tip-options");
    if (row && target) {
      const rowRect = row.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      if (targetRect.left < rowRect.left || targetRect.right > rowRect.right) {
        row.scrollLeft += targetRect.left - rowRect.left - ((rowRect.width - targetRect.width) / 2);
      }
    }
  });
}

function renderTrackPreservingTipScroll(focusSelector = "") {
  const currentRow = root.querySelector(".customer-track-tip-options");
  const scrollLeft = currentRow ? currentRow.scrollLeft : 0;
  const currentCard = root.querySelector(".customer-track-tip-card");
  const booking = customerTrackCurrentBooking();
  const nextHtml = customerTrackTipCardHtml(booking);
  if (currentCard && nextHtml) {
    const template = document.createElement("template");
    template.innerHTML = nextHtml.trim();
    const nextCard = template.content.firstElementChild;
    if (nextCard) {
      currentCard.replaceWith(nextCard);
    } else {
      renderTrackRealtimeUpdate();
    }
  } else {
    renderTrackRealtimeUpdate();
  }
  requestAnimationFrame(() => {
    const nextRow = root.querySelector(".customer-track-tip-options");
    if (nextRow) nextRow.scrollLeft = scrollLeft;
    if (focusSelector) requestAnimationFrame(() => focusCustomerTrackTipControl(focusSelector));
  });
}

function customerTrackChatBubbleHtml(update = {}, booking = {}, options = {}) {
  const actor = String(update.actorType || "").toLowerCase();
  const fromCustomer = actor === "customer" || actor === "user" || update.from === "customer";
  const urls = Array.isArray(update.mediaUrls) ? update.mediaUrls : [];
  const specialHtml = taskTimelineSpecialHtml(update, booking, { allowApprove: true, allowPayment: true }, options.approvalResponses, options.paymentResponses);
  const timeText = update.displayTime || customerTrackMessageTime(update.createdAt || new Date());
  const assistant = customerTrackAssistantInfo(booking);
  return `<article class="customer-track-chat-bubble ${fromCustomer ? "me" : "assistant"}">
    ${fromCustomer ? "" : customerTrackAssistantAvatarHtml(assistant, "customer-track-chat-avatar")}
    <div class="customer-track-chat-message">
      ${update.message ? `<p>${escapeHtml(update.message)}</p>` : ""}
      ${specialHtml}
      ${urls.length ? `<div class="customer-track-chat-media">${urls.map((url, index) => taskUpdateMediaHtml(url, index, update.updateType)).join("")}</div>` : ""}
      <time>${escapeHtml(timeText)}${fromCustomer ? `<span>${customerTrackIcon("checks")}</span>` : ""}</time>
    </div>
  </article>`;
}

function customerTrackCustomerNote(booking = {}) {
  const candidates = [
    booking.metadata?.customerNote,
    booking.metadata?.note,
    booking.customerNote,
    booking.customerNotes,
    booking.notes
  ];
  const note = candidates.map((value) => String(value || "").trim()).find(Boolean) || "";
  return /^Customer portal\s+/i.test(note) ? "" : note;
}

function customerTrackChatEnabled(booking = {}) {
  const payment = customerBookingPaymentState(booking);
  const status = customerTrackStatus(booking);
  if (payment.paid || booking.metadata?.chatLocked === true) return false;
  return ["assigned", "working"].includes(status) || (status === "completed" && !payment.paid);
}

function customerTrackCurrentBooking(bookingId = "") {
  const id = String(bookingId || "");
  return normalizeArray(state.bookings).find((item) => String(item.id || item.bookingId || "") === id)
    || (String(state.confirmedBooking?.id || state.confirmedBooking?.bookingId || "") === id ? state.confirmedBooking : null)
    || state.confirmedBooking
    || {};
}

function customerTrackStoreUpdate(bookingId = "", update = {}) {
  const id = String(bookingId || "");
  const apply = (booking) => {
    if (!booking || String(booking.id || booking.bookingId || "") !== id) return;
    const updates = Array.isArray(booking.taskUpdates) ? booking.taskUpdates : [];
    booking.taskUpdates = [...updates, update];
  };
  normalizeArray(state.bookings).forEach(apply);
  apply(state.confirmedBooking);
}

function customerTrackAppendChatUpdate(form, update = {}) {
  const chatList = form.closest(".customer-track-chat-section")?.querySelector(".customer-track-chat-list");
  if (!chatList) return false;
  const booking = customerTrackCurrentBooking(form.dataset.bookingId);
  chatList.insertAdjacentHTML("beforeend", customerTrackChatBubbleHtml(update, booking, {
    approvalResponses: new Map(),
    paymentResponses: new Map()
  }));
  const revealLatest = () => {
    chatList.scrollTop = chatList.scrollHeight;
  };
  revealLatest();
  requestAnimationFrame(() => requestAnimationFrame(revealLatest));
  return true;
}

function customerTrackScrollChatToLatest() {
  const scrollLatest = () => {
    const chatList = root.querySelector(".customer-track-page .customer-track-chat-list");
    if (chatList) chatList.scrollTop = chatList.scrollHeight;
  };
  requestAnimationFrame(() => requestAnimationFrame(scrollLatest));
}

async function customerTrackSetChatExpanded(chatSection, shouldExpand = false) {
  const page = chatSection?.closest(".customer-track-page");
  if (!chatSection) return;
  state.customerTrackChatExpanded = Boolean(shouldExpand);
  chatSection.classList.toggle("is-collapsed", !shouldExpand);
  chatSection.classList.toggle("is-expanded", shouldExpand);
  page?.classList.toggle("customer-track-chat-collapsed", !shouldExpand);
  page?.classList.toggle("customer-track-chat-expanded", shouldExpand);
  const toggle = chatSection.querySelector("[data-track-chat-toggle]");
  if (toggle) {
    toggle.setAttribute("aria-expanded", shouldExpand ? "true" : "false");
    toggle.setAttribute("aria-label", shouldExpand ? "Collapse chat" : "Expand chat");
    toggle.innerHTML = customerTrackIcon(shouldExpand ? "chevronDown" : "chevronUp");
  }
  if (shouldExpand) {
    const bookingId = chatSection.dataset.bookingId || chatSection.querySelector("[data-booking-id]")?.dataset.bookingId || "";
    try {
      await customerTrackMarkChatRead(customerTrackCurrentBooking(bookingId));
      const notification = chatSection.querySelector(".customer-track-chat-notify");
      notification?.setAttribute("aria-label", "No unread assistant messages");
      notification?.querySelector("b")?.remove();
    } catch (error) {
      notify(error.message || "Unable to update chat read status.");
    }
    customerTrackScrollChatToLatest();
  }
}

function assistantStoreTaskUpdate(bookingId = "", assignmentId = "", update = {}) {
  const bookingKey = String(bookingId || "");
  const assignmentKey = String(assignmentId || "");
  normalizeArray(state.tasks).forEach((task) => {
    const matchesBooking = bookingKey && String(task.bookingId || task.id || "") === bookingKey;
    const matchesAssignment = assignmentKey && String(task.assignmentId || "") === assignmentKey;
    if (!matchesBooking && !matchesAssignment) return;
    const updates = Array.isArray(task.taskUpdates) ? task.taskUpdates : [];
    task.taskUpdates = [...updates, update];
  });
}

function assistantScrollChatToLatest() {
  const scrollLatest = () => {
    const chatBody = root.querySelector(".task-chat-window .task-chat-body");
    if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
  };
  requestAnimationFrame(() => requestAnimationFrame(scrollLatest));
}

function assistantRefreshChatTimelineOnly() {
  const chatBody = root.querySelector(".task-chat-window .task-chat-body");
  const task = assistantChatTask();
  if (!chatBody || !task) return false;
  chatBody.innerHTML = assistantChatMessagesHtml(task);
  const countNode = root.querySelector(".working-chat-meta b");
  if (countNode) countNode.textContent = `${taskUpdates(task).length} updates`;
  assistantScrollChatToLatest();
  updateAssistantCountdowns();
  return true;
}

function assistantApplyLocalTaskUpdate(input = {}, created = {}) {
  const update = {
    id: created.id || `local-${Date.now()}`,
    actorType: "assistant",
    actorName: state.user?.displayName || "Assistant",
    updateType: input.updateType || "text",
    message: input.message || "",
    mediaUrls: input.mediaUrls || [],
    metadata: input.metadata || {},
    createdAt: created.createdAt || new Date().toISOString()
  };
  assistantStoreTaskUpdate(input.bookingId, input.assignmentId, update);
  return assistantRefreshChatTimelineOnly();
}

function customerTrackChatHtml(booking = {}) {
  const chatEnabled = customerTrackChatEnabled(booking);
  const sourceUpdates = taskUpdates(booking);
  const customerNote = customerTrackCustomerNote(booking);
  const updates = [];
  if (customerNote) {
    updates.push({
      actorType: "customer",
      message: customerNote,
      createdAt: booking.createdAt || booking.scheduledAt || new Date()
    });
  }
  const noteText = customerNote.toLowerCase();
  sourceUpdates.forEach((update) => {
    const message = String(update.message || "").trim().toLowerCase();
    if (noteText && message === noteText) return;
    updates.push(update);
  });
  const approvalResponses = taskUpdateResponseMap(updates);
  const paymentResponses = taskUpdateResponseMap(updates, "payment_response");
  const disabledAttr = chatEnabled ? "" : " disabled";
  const chatExpanded = Boolean(state.customerTrackChatExpanded);
  const status = customerTrackStatus(booking);
  return `<section class="customer-track-section customer-track-chat-section customer-track-chat-status-${escapeHtml(status)} ${chatExpanded ? "is-expanded" : "is-collapsed"}" data-booking-id="${escapeHtml(booking.id || booking.bookingId || "")}">
    ${customerTrackChatHeaderHtml(booking, chatExpanded, updates)}
    <div class="customer-track-chat-panel">
      <div class="customer-track-chat-list">
        ${updates.map((update) => customerTrackChatBubbleHtml(update, booking, { allowApprove: true, allowPayment: true, approvalResponses, paymentResponses })).join("")}
      </div>
    </div>
    ${chatEnabled ? portalQuickReplyChipsHtml(booking.id || booking.bookingId || "", booking.assignmentId || "") : ""}
    <form class="customer-track-composer ${chatEnabled ? "" : "is-disabled"}" data-task-update-form data-chat-disabled="${chatEnabled ? "false" : "true"}" aria-disabled="${chatEnabled ? "false" : "true"}" data-booking-id="${escapeHtml(booking.id || booking.bookingId || "")}" data-assignment-id="${escapeHtml(booking.assignmentId || "")}">
          <input type="hidden" name="updateType" value="text">
          <label aria-label="Attach file">${customerIcon("paperclip")}<input name="media" type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx"${disabledAttr}></label>
          <textarea name="message" rows="1" placeholder="Type your message"${disabledAttr}></textarea>
          <button type="submit" data-task-update-action="send" aria-label="Send message"${disabledAttr}>${customerTrackIcon("send")}</button>
        </form>
  </section>`;
}

function customerPaymentProofPopupHtml(booking = {}) {
  const request = state.customerPaymentProofRequest;
  if (!request || String(request.bookingId || "") !== String(booking.id || booking.bookingId || "")) return "";
  const amount = Math.max(0, Number(request.amount || customerTrackBillSummary(booking, customerTrackItems(booking)).total || 0));
  const qrUrl = upiQrImageUrl(amount, `${customerVisibleBookingId(booking)} payment`);
  return `<div class="customer-track-modal-backdrop" role="dialog" aria-modal="true">
    <form class="customer-track-modal-card customer-payment-proof-card" data-customer-payment-proof-form data-booking-id="${escapeHtml(request.bookingId || "")}" data-assignment-id="${escapeHtml(request.assignmentId || booking.assignmentId || "")}" data-update-id="${escapeHtml(request.updateId || "")}" data-amount="${escapeHtml(amount)}">
      <button class="customer-track-modal-close" data-close-customer-payment-proof type="button" aria-label="Close">${customerTrackIcon("close")}</button>
      <p>Payment Confirmation</p>
      <h2>${escapeHtml(customerTrackMoney(amount, 2))} to pay</h2>
      <span>Scan QR or hand over cash, then confirm your payment details.</span>
      <div class="customer-payment-qr">
        <img src="${escapeHtml(qrUrl)}" alt="ZIGO UPI QR code">
        <small>UPI ID: ${escapeHtml(zigoPaymentUpiId)}</small>
      </div>
      <label class="customer-payment-field">Mode
        <span class="customer-payment-mode-tabs" role="radiogroup" aria-label="Payment mode">
          <label><input name="mode" data-customer-payment-mode type="radio" value="cash" checked><span>Cash</span></label>
          <label><input name="mode" data-customer-payment-mode type="radio" value="upi"><span>UPI</span></label>
        </span>
      </label>
      <label class="customer-payment-field">Amount<input name="amount" inputmode="decimal" value="${escapeHtml(amount ? amount.toFixed(2) : "")}" required></label>
      <label class="customer-payment-field">Transaction / Reference ID<input name="referenceId" placeholder="Optional"></label>
      <label class="customer-payment-field">Note<textarea name="note" rows="3" placeholder="Optional note"></textarea></label>
      <label class="customer-payment-proof-upload">Payment picture
        <span class="customer-payment-upload-control">
          <input name="proof" type="file" accept="image/*,.pdf" data-customer-payment-proof-input>
          <span class="customer-payment-upload-icon">${customerTrackIcon("paperclip")}</span>
          <span class="customer-payment-upload-text" data-customer-payment-proof-name>Upload payment proof</span>
        </span>
      </label>
      <div class="customer-track-modal-actions">
        <button class="soft-btn" data-close-customer-payment-proof type="button">Cancel</button>
        <button class="primary-btn" type="submit">Confirm Payment</button>
      </div>
    </form>
  </div>`;
}

function customerTrackReviewValue(booking = {}, key = "", fallback = 5) {
  const review = booking.customerReview || booking.review || booking.metadata?.customerReview || {};
  const value = Number(review?.[key]);
  return Number.isFinite(value) && value >= 1 && value <= 5 ? Math.round(value) : fallback;
}

function customerTrackReviewText(booking = {}) {
  const review = booking.customerReview || booking.review || booking.metadata?.customerReview || {};
  return String(review?.reviewText || review?.review || "").trim();
}

function customerTrackReviewAverage(booking = {}) {
  const values = [
    customerTrackReviewValue(booking, "zigoRating", 0),
    customerTrackReviewValue(booking, "assistantRating", 0),
    customerTrackReviewValue(booking, "serviceRating", 0)
  ].filter((value) => value > 0);
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function customerTrackRatingStarsHtml(value = 0, className = "") {
  const rounded = Math.max(0, Math.min(5, Math.round(Number(value || 0))));
  return `<span class="customer-track-rating-stars-strip ${escapeHtml(className)}" aria-label="${escapeHtml(value || 0)} out of 5">
    ${[1, 2, 3, 4, 5].map((star) => `<i class="${star <= rounded ? "active" : ""}">${customerTrackIcon("star")}</i>`).join("")}
  </span>`;
}

function customerTrackReviewRatingHtml(booking = {}, name = "", label = "", locked = false) {
  const bookingId = String(booking.id || "");
  const value = customerTrackReviewValue(booking, name, 5);
  const disabledAttr = locked ? " disabled aria-disabled=\"true\"" : "";
  return `<div class="customer-track-review-rating" data-review-rating-group="${escapeHtml(name)}">
    <span>${escapeHtml(label)}</span>
    <input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">
    <div class="customer-track-review-stars" role="radiogroup" aria-label="${escapeHtml(label)} rating">
      ${[1, 2, 3, 4, 5].map((star) => `<button class="${star <= value ? "active" : ""}" type="button"${locked ? "" : ` data-review-star="${star}" data-review-name="${escapeHtml(name)}" data-booking-id="${escapeHtml(bookingId)}"`}${disabledAttr} aria-label="${star} star">${customerTrackIcon("star")}</button>`).join("")}
    </div>
  </div>`;
}

function customerTrackReviewHtml(booking = {}) {
  if (!booking?.id) return "";
  if (customerTrackStatus(booking) !== "completed") return "";
  const review = booking.customerReview || booking.review || null;
  const savedAt = review?.updatedAt || review?.createdAt;
  const hasSavedReview = Boolean(
    review?.id
    || savedAt
    || review?.zigoRating
    || review?.assistantRating
    || review?.serviceRating
    || String(review?.reviewText || review?.review || "").trim()
  );
  if (customerTrackIsPaidCompleted(booking) && !hasSavedReview) return "";
  const locked = Boolean(hasSavedReview);
  const average = customerTrackReviewAverage(booking);
  if (locked) {
    return `<section class="customer-track-review-card is-collapsed" data-track-review-card>
      <div class="customer-track-review-summary">
        <div>
          <h2>Overall rating <b>${escapeHtml(average.toFixed(average % 1 ? 1 : 0))}</b></h2>
          <div class="customer-track-review-strip">${customerTrackRatingStarsHtml(average)}<span>${escapeHtml(average.toFixed(average % 1 ? 1 : 0))}/5</span></div>
          <small>${savedAt ? `Review submitted ${escapeHtml(customerTrackMessageTime(savedAt))}` : "Review submitted"}</small>
        </div>
        <button type="button" data-track-review-toggle aria-expanded="false" aria-label="Expand review details">${customerTrackIcon("chevronDown")}</button>
      </div>
      <div class="customer-track-review-details">
        <form class="customer-track-review-form is-readonly" data-booking-id="${escapeHtml(booking.id)}">
          ${customerTrackReviewRatingHtml(booking, "zigoRating", "ZIGO", true)}
          ${customerTrackReviewRatingHtml(booking, "assistantRating", "Assistant", true)}
          ${customerTrackReviewRatingHtml(booking, "serviceRating", "Service", true)}
          <label class="customer-track-review-note">
            <span>Review</span>
            <textarea name="reviewText" rows="3" maxlength="2000" placeholder="No review note added." readonly>${escapeHtml(customerTrackReviewText(booking))}</textarea>
          </label>
        </form>
      </div>
    </section>`;
  }
  return `<section class="customer-track-review-card">
    <div class="customer-track-review-head">
      <div>
        <h2>Rate your experience</h2>
        <small>Share feedback for this booking</small>
      </div>
      <span>${customerTrackIcon("star")} Review</span>
    </div>
    <form class="customer-track-review-form" data-track-review-form data-booking-id="${escapeHtml(booking.id)}">
      ${customerTrackReviewRatingHtml(booking, "zigoRating", "ZIGO")}
      ${customerTrackReviewRatingHtml(booking, "assistantRating", "Assistant")}
      ${customerTrackReviewRatingHtml(booking, "serviceRating", "Service")}
      <label class="customer-track-review-note">
        <span>Add review</span>
        <textarea name="reviewText" rows="3" maxlength="2000" placeholder="Write your review">${escapeHtml(customerTrackReviewText(booking))}</textarea>
      </label>
      <button class="customer-track-review-submit" type="submit">Submit review</button>
    </form>
  </section>`;
}

function customerTrackRatingThanksModal() {
  const thanks = state.customerTrackRatingThanks;
  if (!thanks) return "";
  const booking = state.bookings.find((item) => String(item.id || "") === String(thanks.bookingId || ""))
    || (String(state.confirmedBooking?.id || "") === String(thanks.bookingId || "") ? state.confirmedBooking : null)
    || state.confirmedBooking
    || {};
  const items = customerTrackBookingItems(booking);
  const primaryItem = items[0] || {};
  const average = customerTrackReviewAverage(booking) || Number(thanks.average || 5);
  return `<div class="customer-track-rating-thanks-backdrop" data-track-rating-thanks-backdrop>
    <section class="customer-track-rating-thanks" role="dialog" aria-modal="true" aria-label="Thank you for rating">
      <button type="button" data-close-track-rating-thanks aria-label="Close">${customerIcon("x")}</button>
      <h2>Thank you for your rating</h2>
      ${customerTrackRatingStarsHtml(average, "large")}
      <div class="customer-track-rating-thanks-image">
        ${customerTrackServiceImageHtml(primaryItem, 0)}
        <span>${customerTrackIcon("star")} ${escapeHtml(average.toFixed(average % 1 ? 1 : 0))}</span>
      </div>
    </section>
  </div>`;
}

function updateCustomerTrackReviewInState(bookingId = "", review = {}) {
  if (!bookingId) return;
  state.bookings = state.bookings.map((booking) => String(booking.id || "") === String(bookingId)
    ? { ...booking, customerReview: review }
    : booking);
  if (state.confirmedBooking && String(state.confirmedBooking.id || "") === String(bookingId)) {
    state.confirmedBooking = { ...state.confirmedBooking, customerReview: review };
  }
}

function customerTrackTaskPinHtml(booking = {}, trackStatus = "") {
  const metadata = booking.metadata || {};
  const pins = metadata.taskPins || {};
  const normalizedStatus = String(trackStatus || booking.statusCode || "").toLowerCase();
  const finalStatuses = new Set(["completed", "success", "done", "cancelled", "canceled", "failed", "rejected"]);
  if (finalStatuses.has(normalizedStatus)) return "";
  const isWorking = ["working", "in_progress", "approval_pending"].includes(normalizedStatus)
    || Boolean(booking.actualTaskStartedAt || booking.assignmentActualStartedAt);
  const label = isWorking ? "Finish PIN" : "Start PIN";
  const pin = String(isWorking ? pins.finishPin || metadata.finishPin || "" : pins.startPin || metadata.startPin || "").trim();
  if (!/^\d{4}$/.test(pin)) return "";
  const endAt = booking.bookingEndAt ? new Date(booking.bookingEndAt) : null;
  const msLeft = endAt && !Number.isNaN(endAt.getTime()) ? endAt.getTime() - Date.now() : null;
  const warning = isWorking && msLeft !== null && msLeft > 0 && msLeft <= 10 * 60_000
    ? `<small class="customer-track-pin-warning">Less than 10 mins left. Add more duration if needed.</small>`
    : "";
  return `<section class="customer-track-pin-card">
    <div>
      <span>${escapeHtml(label)}</span>
      <b>${escapeHtml(pin)}</b>
      ${warning}
    </div>
    <p>${escapeHtml(isWorking ? "Share this PIN only when the assistant finishes the task." : "Share this PIN only with the assigned assistant to start the task.")}</p>
  </section>`;
}

function customerTrackPageHtml() {
  const confirmedId = state.confirmedBooking?.id ? String(state.confirmedBooking.id) : "";
  const booking = confirmedId
    ? (state.bookings.find((item) => String(item.id || "") === confirmedId) || state.confirmedBooking || state.bookings[0] || null)
    : (state.confirmedBooking || state.bookings[0] || null);
  const trackStatus = customerTrackStatus(booking || {});
  const trackStatusLabel = customerTrackStatusLabel(trackStatus);
  const trackItems = customerTrackBookingItems(booking || {});
  const serviceTitle = customerTrackServiceTitle(booking || {}, trackItems);
  const bookingDateText = customerTrackBookingDateText(booking || {});
  return `<section class="mobile-app home-screen customer-flow-screen customer-bookings-page customer-track-screen customer-track-page ${state.customerTrackChatExpanded ? "customer-track-chat-expanded" : "customer-track-chat-collapsed"}">
    <div class="booking-sticky-header customer-track-sticky-header">
      <header class="customer-track-header">
        <button class="customer-track-back" type="button" data-view="bookings" aria-label="Back">${customerIcon("back")}</button>
        <div class="customer-track-heading">
          <h1>Track Booking</h1>
          ${bookingDateText ? `<span>${escapeHtml(bookingDateText)}</span>` : ""}
          ${booking ? `<span class="customer-track-booking-id-line">Booking ID ${escapeHtml(customerVisibleBookingId(booking))}</span>` : ""}
        </div>
        ${booking ? customerTrackTotalTimeHtml(booking, trackItems) : ""}
      </header>
    </div>
    <main class="content-section customer-track-body">
      ${booking ? `${customerTrackWaitingChargeStripHtml(booking, trackItems)}
      <section class="customer-track-shell">
        <section class="customer-track-booking-card">
          <div class="customer-track-services-panel">
            <div class="track-services-list">
              ${trackItems.map((item, index) => customerTrackServiceRowHtml(item, index, booking, trackItems, trackStatus)).join("")}
            </div>
          </div>
        </section>
        ${customerTrackBookingTypeHtml(booking, trackItems)}
        ${customerTrackTaskPinHtml(booking, trackStatus)}
        ${customerTrackLocationsUploadsHtml(booking)}
        ${customerTrackBillDetailsHtml(booking, trackItems)}
        ${customerTrackTipCardHtml(booking)}
        ${customerCancelSectionHtml(booking)}
        ${customerTrackReviewHtml(booking)}
        ${customerTrackChatHtml(booking)}
      </section>
      ${customerDisputeSectionHtml(booking)}
      ` : `<p class="muted customer-track-empty">No booking selected.</p>`}
    </main>
    ${customerCancelModal()}
    ${customerDisputeModal()}
    ${customerPaymentProofPopupHtml(booking || {})}
    ${customerTrackPreviewModal()}
    ${customerTrackMapSheetHtml()}
    ${customerTrackRatingThanksModal()}
  </section>`;
}

function renderTrack() {
  state.customerTrackChatExpanded = false;
  root.innerHTML = customerTrackPageHtml();
  attachCustomerTrackScrollStability();
  customerTrackScrollChatToLatest();
}

function attachCustomerTrackScrollStability() {
  const page = root.querySelector(".customer-track-page");
  if (!page || page.dataset.trackScrollStableBound === "true") return;
  page.dataset.trackScrollStableBound = "true";
  const markActive = () => {
    customerTrackScrollActiveUntil = Date.now() + 280;
    clearTimeout(customerTrackScrollSettledTimer);
    customerTrackScrollSettledTimer = setTimeout(() => {
      if (Date.now() < customerTrackScrollActiveUntil) return;
      if (!customerTrackPendingRealtimeUpdate || state.customerView !== "track") return;
      customerTrackPendingRealtimeUpdate = false;
      renderTrackRealtimeUpdate({ force: true });
    }, 300);
  };
  page.addEventListener("scroll", markActive, { passive: true });
  page.addEventListener("touchmove", markActive, { passive: true });
  page.addEventListener("wheel", markActive, { passive: true });
}

function renderTrackRealtimeUpdate(options = {}) {
  const currentPage = root.querySelector(".customer-track-page");
  if (!currentPage) {
    renderTrack();
    return;
  }
  if (!options.force && Date.now() < customerTrackScrollActiveUntil) {
    customerTrackPendingRealtimeUpdate = true;
    clearTimeout(customerTrackScrollSettledTimer);
    customerTrackScrollSettledTimer = setTimeout(() => {
      if (Date.now() < customerTrackScrollActiveUntil) return;
      if (!customerTrackPendingRealtimeUpdate || state.customerView !== "track") return;
      customerTrackPendingRealtimeUpdate = false;
      renderTrackRealtimeUpdate({ force: true });
    }, 320);
    return;
  }
  const scrollTop = currentPage.scrollTop || root.scrollTop || document.documentElement.scrollTop || 0;
  const chatList = currentPage.querySelector(".customer-track-chat-list");
  const chatWasAtBottom = chatList ? chatList.scrollTop + chatList.clientHeight >= chatList.scrollHeight - 24 : true;
  const template = document.createElement("template");
  template.innerHTML = customerTrackPageHtml().trim();
  const nextPage = template.content.querySelector(".customer-track-page");
  if (!nextPage) {
    renderTrack();
    return;
  }
  currentPage.className = nextPage.className;
  [
    ".customer-track-sticky-header",
    ".customer-track-body"
  ].forEach((selector) => {
    const current = currentPage.querySelector(selector);
    const next = nextPage.querySelector(selector);
    if (current && next) current.replaceWith(next);
  });
  currentPage.querySelectorAll(":scope > .assistant-confirm-backdrop, :scope > .customer-track-modal-backdrop, :scope > .customer-track-preview-backdrop, :scope > .customer-track-map-sheet, :scope > .customer-track-rating-thanks").forEach((node) => node.remove());
  nextPage.querySelectorAll(":scope > .assistant-confirm-backdrop, :scope > .customer-track-modal-backdrop, :scope > .customer-track-preview-backdrop, :scope > .customer-track-map-sheet, :scope > .customer-track-rating-thanks").forEach((node) => currentPage.appendChild(node));
  currentPage.scrollTop = scrollTop;
  root.scrollTop = scrollTop;
  if (state.customerTrackChatExpanded && chatWasAtBottom) customerTrackScrollChatToLatest();
  attachCustomerTrackScrollStability();
}

function customerTrackExtendDurationHtml(booking = {}, trackItems = [], trackStatus = "") {
  const normalizedStatus = String(trackStatus || customerTrackStatus(booking) || "").toLowerCase();
  const isWorking = ["working", "in_progress", "approval_pending"].includes(normalizedStatus)
    || Boolean(booking.actualTaskStartedAt || booking.assignmentActualStartedAt);
  if (!isWorking) return "";
  const primaryItem = normalizeArray(trackItems)[0] || {};
  const categoryId = String(primaryItem.categoryId || booking.categoryId || booking.metadata?.categoryId || booking.metadata?.selectedCategoryId || "");
  const bookingId = String(booking.id || booking.bookingId || "");
  const assignmentId = String(booking.assignmentId || booking.metadata?.assignmentId || "");
  if (!categoryId || !bookingId) return "";
  const durations = customerHomeCategoryPriceDurationOptions(categoryId, { availableFor: "extend" });
  if (!durations.length) return "";
  return `<div class="customer-track-extend-card">
    <div class="customer-track-extend-options">
      ${durations.map((item) => {
        const durationMinutes = Math.max(1, Math.round(numberValue(item.durationMinutes || item.timeDurationMinutes, 0)));
        const price = numberValue(item.sellingPrice ?? item.price, 0);
        const basePrice = numberValue(item.basePrice, 0);
        const label = String(item.label || "").trim() || personalAssistantDurationLabel({ durationMinutes });
        return `<button type="button" data-customer-track-extend-duration="${escapeHtml(durationMinutes)}" data-customer-track-extend-booking-id="${escapeHtml(bookingId)}" data-customer-track-extend-assignment-id="${escapeHtml(assignmentId)}">
          <strong>${escapeHtml(label)}</strong>
          <span>${price > 0 ? escapeHtml(money(price)) : "Request"}${basePrice > price ? ` <del>${escapeHtml(money(basePrice))}</del>` : ""}</span>
        </button>`;
      }).join("")}
    </div>
  </div>`;
}

function customerTrackServiceRowHtml(item = {}, index = 0, booking = {}, trackItems = [], trackStatus = "") {
  const selling = Number(item.sellingPrice || 0);
  const base = Number(item.basePrice || 0);
  const priceText = customerTrackMoney(selling, 0);
  const basePriceText = base > selling && base > 0 ? customerTrackMoney(base, 0) : "";
  const category = item.categoryName || item.serviceName || "";
  const tone = customerTrackCategoryTone(category);
  const showCategoryPill = Boolean(item.hasStore && category);
  const durationText = customerTrackDurationCapsuleText(item.durationMinutes || 30);
  const extendHtml = index === 0 ? customerTrackExtendDurationHtml(booking, trackItems, trackStatus) : "";
  return `<div class="track-service-row">
    <div class="track-service-image">${customerTrackServiceImageHtml(item, index)}</div>
    <div class="track-service-copy">
      <h3>${escapeHtml(item.name || item.serviceName || `Item ${index + 1}`)}</h3>
      <div class="track-service-meta ${showCategoryPill ? "" : "duration-only"}">
        ${showCategoryPill ? `<b class="${escapeHtml(tone)}">${escapeHtml(category)}</b>` : ""}
        <span class="track-service-duration">${customerTrackIcon("watch")}${escapeHtml(durationText)}</span>
      </div>
    </div>
    <div class="track-service-price">
      ${basePriceText ? `<del>${escapeHtml(basePriceText)}</del>` : ""}
      <strong>${escapeHtml(priceText)}</strong>
    </div>
    ${extendHtml}
  </div>`;
}

function renderAccount() {
  const name = state.user?.displayName || "Customer";
  const phone = state.user?.phone || "";
  const initials = String(name || "C").slice(0, 1).toUpperCase();
  root.innerHTML = `<section class="mobile-app customer-flow-screen customer-account-screen">
    <header class="customer-account-header">
      <button type="button" data-view="home" aria-label="Back">${customerIcon("back")}</button>
      <h1>Profile</h1>
    </header>
    <section class="customer-account-profile">
      <div class="customer-account-avatar">${escapeHtml(initials)}</div>
      <button class="customer-account-name" type="button">
        <b>${escapeHtml(name)}</b>
        <span>${customerIcon("chevronRight")}</span>
      </button>
      ${phone ? `<small>${escapeHtml(phone)}</small>` : ""}
    </section>
    <section class="customer-account-card-grid">
      <button type="button" data-view="bookings" data-return-view="account">
        <span>${customerIcon("calendar")}</span>
        <b>My Bookings</b>
        <small>View all bookings</small>
        <i>${customerIcon("chevronRight")}</i>
      </button>
      <button type="button">
        <span>${customerIcon("wallet")}</span>
        <b>My Wallet</b>
        <small>₹0</small>
        <i>${customerIcon("chevronRight")}</i>
      </button>
      <button type="button">
        <span>${customerIcon("percent")}</span>
        <b>All Offers</b>
        <small>No active offers</small>
        <i>${customerIcon("chevronRight")}</i>
      </button>
      <button type="button">
        <span>${customerIcon("help")}</span>
        <b>Help & Support</b>
        <small>Get quick help</small>
        <i>${customerIcon("chevronRight")}</i>
      </button>
    </section>
    <section class="customer-account-manage">
      <h2>Manage Account</h2>
      <div>
        <button type="button"><span>${customerIcon("users")}</span><b>Your Experts</b><i>${customerIcon("chevronRight")}</i></button>
        <button type="button" data-open-saved-locations data-return-view="account"><span>${customerIcon("map")}</span><b>Saved Addresses</b><i>${customerIcon("chevronRight")}</i></button>
        <button type="button"><span>${customerIcon("settings")}</span><b>Manage Account</b><i>${customerIcon("chevronRight")}</i></button>
      </div>
    </section>
    <button class="customer-account-logout" type="button" data-logout>Logout</button>
  </section>`;
}

function renderCustomerSavedLocations() {
  const addresses = customerSortedSavedLocations(state.customerAddresses);
  const pageSize = Math.max(1, Number(state.customerSavedLocationsPageSize || 10));
  const totalPages = Math.max(1, Math.ceil(addresses.length / pageSize));
  state.customerSavedLocationsPage = Math.min(Math.max(1, Number(state.customerSavedLocationsPage || 1)), totalPages);
  const visibleCount = state.customerSavedLocationsPage * pageSize;
  const pageItems = addresses.slice(0, visibleCount);
  const hasMore = visibleCount < addresses.length;
  root.innerHTML = `<section class="mobile-app customer-flow-screen customer-saved-locations-screen">
    <header class="customer-page-header customer-saved-locations-header">
      <button class="customer-back-icon customer-back-icon-plain" type="button" data-view="${escapeHtml(customerReturnTargetFor("savedLocations", "home"))}" aria-label="Back">${customerIcon("back")}</button>
      <h1>Saved Locations</h1>
    </header>
    <section class="customer-saved-locations-list" data-saved-locations-scroll>
      ${pageItems.length ? pageItems.map((address, index) => {
        const originalIndex = state.customerAddresses.findIndex((item) => customerLocationAddressId(item) === customerLocationAddressId(address));
        return `<article class="customer-saved-location-row" data-use-saved-address="${originalIndex}" role="button" tabindex="0">
          <span class="customer-location-picker-icon saved-icon">${customerSavedLocationIcon(address.label || "")}</span>
          <span>
            <b>${escapeHtml(address.label || "Saved")}</b>
            <em>${escapeHtml(locationShortAddress(address))}</em>
            ${address.metadata?.contactNumber ? `<small>Phone number: <strong>${escapeHtml(address.metadata.contactNumber)}</strong></small>` : ""}
          </span>
          <span class="customer-saved-location-actions">
            <button class="customer-saved-location-action edit" data-edit-saved-address="${originalIndex}" type="button" aria-label="Edit saved location">${customerIcon("edit")}</button>
            <button class="customer-saved-location-action delete" data-delete-saved-address="${escapeHtml(customerLocationAddressId(address))}" type="button" aria-label="Delete saved location">${customerIcon("trash")}</button>
          </span>
        </article>`;
      }).join("") : `<p class="customer-location-picker-empty">No saved locations yet.</p>`}
      ${hasMore ? `<div class="customer-saved-locations-loader" data-saved-locations-loader>Loading more locations...</div>` : ""}
    </section>
    ${customerSavedLocationDeletePopupHtml()}
  </section>`;
  attachCustomerSavedLocationsScrollLoader();
}

function customerSavedLocationDeletePopupHtml() {
  const address = customerSavedLocationDeleteTarget();
  if (!address) return "";
  return `<div class="assistant-confirm-backdrop customer-saved-location-delete-backdrop" role="dialog" aria-modal="true" data-saved-location-delete-backdrop>
    <section class="assistant-confirm-card customer-saved-location-delete-card" role="document">
      <button class="customer-modal-close" type="button" data-close-saved-location-delete aria-label="Close">${customerIcon("x")}</button>
      <h3>Delete saved location?</h3>
      <div class="customer-saved-location-delete-preview">
        <span class="customer-location-picker-icon saved-icon">${customerSavedLocationIcon(address.label || "")}</span>
        <span>
          <b>${escapeHtml(address.label || "Saved")}</b>
          <em>${escapeHtml(locationShortAddress(address))}</em>
        </span>
      </div>
      <p>This location will be removed from your saved addresses.</p>
      <div class="customer-saved-location-delete-actions">
        <button class="soft-btn" type="button" data-close-saved-location-delete>Cancel</button>
        <button class="danger-btn" type="button" data-confirm-saved-location-delete ${state.customerSavedLocationDeleting ? "disabled" : ""}>${customerIcon("trash")} ${state.customerSavedLocationDeleting ? "Deleting..." : "Delete"}</button>
      </div>
    </section>
  </div>`;
}

function attachCustomerSavedLocationsScrollLoader() {
  const list = root.querySelector("[data-saved-locations-scroll]");
  if (!list) return;
  list.addEventListener("scroll", () => {
    const remaining = list.scrollHeight - list.scrollTop - list.clientHeight;
    const addresses = customerSortedSavedLocations(state.customerAddresses);
    const pageSize = Math.max(1, Number(state.customerSavedLocationsPageSize || 10));
    const hasMore = state.customerSavedLocationsPage * pageSize < addresses.length;
    if (!hasMore || remaining > 90) return;
    state.customerSavedLocationsPage += 1;
    renderCustomerSavedLocations();
  }, { passive: true });
}

function renderCustomerBookingConfirmed() {
  root.innerHTML = `<section class="mobile-app customer-flow-screen customer-booking-confirmed-screen">
    <div class="customer-booking-confirmed-card" role="status" aria-live="polite">
      <div class="customer-booking-confirmed-check">${customerIcon("check")}</div>
      <h1>Booking confirmed</h1>
    </div>
  </section>`;
}

function renderCustomerPaymentResult() {
  const result = state.customerPaymentResult || {};
  const status = customerPaymentResultStatus(result);
  const amount = Number(result.amountPaise || 0) / 100;
  const config = {
    success: {
      icon: "check",
      title: "Payment successful",
      message: "Your payment is verified. Confirm your booking to continue.",
      className: "success"
    },
    pending: {
      icon: "clock",
      title: "Payment processing",
      message: result.message || "Your payment is still processing. We will update the status automatically.",
      className: "pending"
    },
    failed: {
      icon: "x",
      title: "Payment failed",
      message: result.message || "Payment could not be completed. Please retry or choose another payment mode.",
      className: "failed"
    }
  }[status] || {};
  root.innerHTML = `<section class="mobile-app customer-flow-screen customer-payment-result-screen">
    <div class="customer-payment-result-card ${escapeHtml(config.className || status)}" role="status" aria-live="polite">
      <div class="customer-payment-result-icon">${customerIcon(config.icon || "info")}</div>
      <h1>${escapeHtml(config.title || "Payment status")}</h1>
      <p>${escapeHtml(config.message || "")}</p>
      ${amount > 0 ? `<strong>${escapeHtml(money(amount))}</strong>` : ""}
      ${(result.paymentId || result.orderId) ? `<small>${escapeHtml(result.paymentId || result.orderId)}</small>` : ""}
      ${status === "success" ? `<em>Returning to Review Booking...</em>` : `<div class="customer-payment-result-actions">
        ${status === "failed" ? `<button class="primary-btn" data-retry-customer-payment type="button">Retry Payment ${customerIcon("chevronRight")}</button>` : ""}
        <button class="soft-btn" data-close-customer-payment-result type="button">${status === "pending" ? "Back to Review Booking" : "Change Payment Mode"}</button>
      </div>`}
    </div>
  </section>`;
}

function renderCustomer() {
  stopCustomerHomeCategoryImageSequence();
  if (state.customerView !== "bookings") {
    detachCustomerBookingsScrollLoader();
  }
  if (state.customerView === "location" && state.locationStep !== "confirm") {
    state.customerView = "home";
    state.customerLocationPickerSheetOpen = true;
  }
  if (state.customerView === "location" && state.locationStep === "confirm") return renderCustomerLocation();
  if (state.customerView === "service") renderServiceDetail();
  else if (state.customerView === "cart") renderCart();
  else if (state.customerView === "homeSchedule") renderCustomerHomeSchedulePage();
  else if (state.customerView === "schedule") renderCustomerSchedulePage();
  else if (state.customerView === "bookings") renderBookings();
  else if (state.customerView === "track") renderTrack();
  else if (state.customerView === "account") renderAccount();
  else if (state.customerView === "search") renderCustomerSearch();
  else if (state.customerView === "savedLocations") renderCustomerSavedLocations();
  else if (state.customerView === "bookingConfirmed") renderCustomerBookingConfirmed();
  else if (state.customerView === "paymentResult") renderCustomerPaymentResult();
  else renderCustomerHome();
  root.insertAdjacentHTML("beforeend", customerCartReplaceModal());
  root.insertAdjacentHTML("beforeend", customerStoreDetailModal());
  root.insertAdjacentHTML("beforeend", customerCategorySwitchSheet());
  root.insertAdjacentHTML("beforeend", customerHomeCategoryDetailSheet());
  root.insertAdjacentHTML("beforeend", customerHomeDurationSheet());
}

function renderAssistantLogin() {
  const codeActive = state.assistantLoginMode !== "password";
  root.innerHTML = `<section class="assistant-app">
    <div class="assistant-card assistant-login-card">
      <img src="${assetUrl("/assets/zigo-logo-new.png")}" alt="ZIGO" style="width:120px">
      <h1>Assistant Login</h1>
      <p class="muted">Login to go online, execute tasks, and update customers.</p>
      <div class="assistant-login-tabs">
        <button class="${codeActive ? "active" : ""}" data-assistant-login-mode="code" type="button">Verification Code</button>
        <button class="${!codeActive ? "active" : ""}" data-assistant-login-mode="password" type="button">Password</button>
      </div>
      ${codeActive ? `<form id="assistantLoginForm" class="portal-form-stack">
        <label>Mobile Number<input name="phone" inputmode="tel" placeholder="Mobile number" required></label>
        <button class="primary-btn" name="action" value="send" type="submit" ${state.loginBusy ? "disabled" : ""}>${state.loginBusy ? "Sending..." : "Send Verification Code"}</button>
        <label>Verification Code<input name="code" inputmode="numeric" maxlength="6" placeholder="6 digit code"></label>
        <button class="soft-btn" name="action" value="verify" type="submit" ${state.loginBusy ? "disabled" : ""}>Verify & Continue</button>
      </form>` : `<form id="assistantPasswordLoginForm" class="portal-form-stack">
        <label>Mobile Number or Email<input name="identifier" inputmode="email" placeholder="Mobile number or email" required></label>
        <label>Password<input name="password" type="password" placeholder="Password" required></label>
        <button class="primary-btn" type="submit" ${state.loginBusy ? "disabled" : ""}>${state.loginBusy ? "Logging in..." : "Login"}</button>
      </form>
      <button class="link-btn assistant-reset-toggle" data-assistant-reset-toggle type="button">${state.assistantResetOpen ? "Hide password reset" : "No password? Set password by email"}</button>
      ${state.assistantResetOpen ? `<form id="assistantPasswordResetForm" class="portal-form-stack password-reset-panel">
        <label>Registered Mobile / Assistant ID<input name="identifier" placeholder="Mobile number or AST code" value="${escapeHtml(state.assistantResetIdentifier)}" required></label>
        <label>Email<input name="email" type="email" placeholder="assistant@example.com" value="${escapeHtml(state.assistantResetEmail)}" required></label>
        ${state.assistantResetCodeSent ? `<label>Verification Code<input name="code" inputmode="numeric" maxlength="6" placeholder="6 digit code" required></label>
        <label>New Password<input name="password" type="password" minlength="8" placeholder="Minimum 8 characters" required></label>` : ""}
        <button class="${state.assistantResetCodeSent ? "primary-btn" : "soft-btn"}" name="action" value="${state.assistantResetCodeSent ? "verify" : "send"}" type="submit" ${state.loginBusy ? "disabled" : ""}>
          ${state.loginBusy ? "Please wait..." : state.assistantResetCodeSent ? "Set Password & Login" : "Send Email Code"}
        </button>
      </form>` : ""}`}
    </div>
  </section>`;
}

function renderAssistantHome() {
  if (state.assistantChatTaskId && assistantChatTask()) {
    root.innerHTML = assistantTaskChatWindow();
    syncAssistantTaskConfirmOverlay();
    updateAssistantCountdowns();
    assistantScrollChatToLatest();
    return;
  }
  root.innerHTML = `<section class="assistant-app assistant-task-screen">
    <div class="assistant-card">
      <div class="assistant-home-head">
        <img src="${assetUrl("/assets/zigo-logo-new.png")}" alt="ZIGO">
        <div>
          <h1>${escapeHtml(state.user?.displayName || "Assistant")}</h1>
          <p class="muted">${escapeHtml(state.user?.phone || "")}</p>
        </div>
      </div>
      <div class="assistant-online-actions">
        <button class="primary-btn" data-online="true" type="button">Go Online</button>
        <button class="danger-btn" data-online="false" type="button">Go Offline</button>
        <button class="soft-btn" data-logout type="button">Logout</button>
      </div>
    </div>
    <div class="assistant-task-title">
      <h2>${escapeHtml(assistantTaskTabs().find((tab) => tab.key === state.assistantTaskTab)?.label || "Pending")}</h2>
      <span>${assistantFilteredTasks().length} shown</span>
    </div>
    <div class="task-list">${assistantTaskRows()}</div>
    ${assistantBottomNav()}
  </section>`;
  syncAssistantTaskConfirmOverlay();
  updateAssistantCountdowns();
}

function assistantTaskTabs() {
  return [
    { key: "accepted", label: "Pending", short: "Pending" },
    { key: "working", label: "Working", short: "Working" },
    { key: "success", label: "Success", short: "Success" },
    { key: "rejected", label: "Rejected", short: "Rejected" },
    { key: "cancelled", label: "Cancelled", short: "Cancel" },
    { key: "hold", label: "Hold", short: "Hold" }
  ];
}

function assistantTaskBaseTabFor(task = {}) {
  const assignmentStatus = String(task.assignmentStatus || "").toLowerCase();
  const bookingStatus = String(task.bookingStatus || "").toLowerCase();
  if (["completed", "success"].includes(assignmentStatus) || ["completed", "success"].includes(bookingStatus)) return "success";
  if (["cancelled", "canceled"].includes(assignmentStatus) || ["cancelled", "canceled"].includes(bookingStatus)) return "cancelled";
  if (["rejected", "declined", "not_accepted", "failed"].includes(assignmentStatus) || ["rejected", "failed"].includes(bookingStatus)) return "rejected";
  if (["hold", "on_hold", "draft"].includes(assignmentStatus) || ["hold", "on_hold", "draft"].includes(bookingStatus)) return "hold";
  if (["in_progress", "working", "approval_pending"].includes(assignmentStatus) || ["in_progress", "working", "approval_pending"].includes(bookingStatus)) {
    const endAt = assistantTaskDurationEndAt(task) || assistantTaskEndAt(task);
    if (endAt && endAt.getTime() <= Date.now()) return "success";
    return "working";
  }
  if (["accepted", "assigned", "reserved", "offered"].includes(assignmentStatus) || ["accepted", "assigned", "queued", "paid", "payment_pending"].includes(bookingStatus)) return "accepted";
  return "accepted";
}

function assistantTaskIsResponseOverdue(task = {}) {
  return false;
}

function assistantTaskIsTimeOverdue(task = {}) {
  const baseTab = assistantTaskBaseTabFor(task);
  if (baseTab === "working") return false;
  return assistantTaskIsResponseOverdue(task);
}

function assistantTaskTabFor(task = {}) {
  if (assistantTaskIsTimeOverdue(task)) return "rejected";
  return assistantTaskBaseTabFor(task);
}

function rebuildAssistantTaskTabIndex(tasks = state.tasks) {
  const byTab = { accepted: [], working: [], success: [], rejected: [], cancelled: [], hold: [] };
  const counts = { accepted: 0, working: 0, success: 0, rejected: 0, cancelled: 0, hold: 0 };
  const list = Array.isArray(tasks) ? tasks : [];
  let total = 0;
  for (const task of list) {
    const key = assistantTaskTabFor(task);
    const tabKey = Object.prototype.hasOwnProperty.call(byTab, key) ? key : "accepted";
    byTab[tabKey].push(task);
    counts[tabKey] += 1;
    total += 1;
  }
  state.assistantTaskTabIndex = {
    byTab,
    counts,
    total
  };
  return state.assistantTaskTabIndex;
}

function assistantFilteredTasks() {
  if (!state.assistantTaskTabIndex || !state.assistantTaskTabIndex.byTab) {
    rebuildAssistantTaskTabIndex(state.tasks);
  }
  return state.assistantTaskTabIndex.byTab[state.assistantTaskTab] || [];
}

function assistantTaskCount(tabKey) {
  if (!state.assistantTaskTabIndex || !state.assistantTaskTabIndex.counts) {
    rebuildAssistantTaskTabIndex(state.tasks);
  }
  return Number(state.assistantTaskTabIndex.counts[tabKey] || 0);
}

function assistantBottomNav() {
  return `<nav class="assistant-bottom-nav" aria-label="Assistant task queues">
    ${assistantTaskTabs().map((tab) => `<button class="${state.assistantTaskTab === tab.key ? "active" : ""}" data-assistant-task-tab="${escapeHtml(tab.key)}" type="button">
      <b>${escapeHtml(tab.short)}</b>
      <span>${assistantTaskCount(tab.key)}</span>
    </button>`).join("")}
  </nav>`;
}

function assistantNoRecordState() {
  return `<p class="muted assistant-empty-state">No record found.</p>`;
}

function renderAssistantTaskView() {
  if (actor !== "assistant" || !root) return false;
  if (state.assistantChatTaskId && assistantChatTask()) {
    renderAssistantHome();
    return true;
  }
  const screen = root.querySelector(".assistant-task-screen");
  if (!screen) return false;
  if (!state.assistantTaskTabIndex || !state.assistantTaskTabIndex.byTab || !state.assistantTaskTabIndex.counts) {
    rebuildAssistantTaskTabIndex(state.tasks);
  }

  const tabs = assistantTaskTabs();
  const taskTab = tabs.find((tab) => tab.key === state.assistantTaskTab);
  const filteredTasks = assistantFilteredTasks();
  const taskCounts = state.assistantTaskTabIndex?.counts || {};

  const titleEl = screen.querySelector(".assistant-task-title");
  if (titleEl) {
    const count = filteredTasks.length;
    titleEl.innerHTML = `<h2>${escapeHtml(taskTab?.label || "Pending")}</h2><span>${count} shown</span>`;
  }

  const listEl = screen.querySelector(".task-list");
  if (listEl) listEl.innerHTML = assistantTaskRows(filteredTasks);

  const navEl = screen.querySelector(".assistant-bottom-nav");
  if (navEl) {
    navEl.querySelectorAll("[data-assistant-task-tab]").forEach((button) => {
      const tabKey = button.getAttribute("data-assistant-task-tab");
      const isActive = tabKey === state.assistantTaskTab;
      button.classList.toggle("active", isActive);
      const countNode = button.querySelector("span");
      if (countNode) countNode.textContent = String(taskCounts[tabKey] || 0);
    });
  }

  syncAssistantTaskConfirmOverlay();

  updateAssistantCountdowns();
  return true;
}

function syncAssistantTaskConfirmOverlay() {
  if (!root) return;
  const confirm = state.assistantTaskConfirm;
  const nextKey = confirm ? `${confirm.assignmentId || ""}:${confirm.status || ""}:${confirm.actionLabel || ""}:${confirm.error || ""}` : "";
  const existing = root.querySelector(":scope > .assistant-confirm-backdrop");
  if (existing && existing.getAttribute("data-confirm-key") === nextKey) return;
  root.querySelectorAll(":scope > .assistant-confirm-backdrop").forEach((node) => node.remove());
  root.querySelectorAll(".assistant-task-screen .assistant-confirm-backdrop, .task-chat-backdrop .assistant-confirm-backdrop").forEach((node) => node.remove());
  const confirmHtml = assistantTaskConfirmModal();
  if (confirmHtml) root.insertAdjacentHTML("beforeend", confirmHtml);
}

function refreshAssistantAfterPopupMutation() {
  if (actor !== "assistant") return false;
  rebuildAssistantTaskTabIndex(state.tasks);
  return renderAssistantTaskView();
}

function assistantTaskStatusLabel(task = {}) {
  const tab = assistantTaskTabFor(task);
  const metadata = task.assignmentMetadata || {};
  const finishPending = assistantTaskFinishPending(task);
  const isAutoRejected = metadata.autoRejected || assistantTaskIsTimeOverdue(task);
  const label = {
    accepted: "Pending",
    working: finishPending ? "Finish Pending" : "Working",
    success: "Success",
    rejected: isAutoRejected ? "Auto Rejected" : "Rejected",
    cancelled: "Cancelled",
    hold: "Hold"
  }[tab] || "Task";
  return `<span class="status task-status-${escapeHtml(tab)}">${escapeHtml(label)}</span>`;
}

function assistantTaskStatusText(task = {}) {
  const tab = assistantTaskTabFor(task);
  const metadata = task.assignmentMetadata || {};
  const finishPending = assistantTaskFinishPending(task);
  const isAutoRejected = metadata.autoRejected || assistantTaskIsTimeOverdue(task);
  return {
    accepted: "Pending",
    working: finishPending ? "Finish Pending" : "Working",
    success: "Success",
    rejected: isAutoRejected ? "Auto Rejected" : "Rejected",
    cancelled: "Cancelled",
    hold: "Hold"
  }[tab] || "Task";
}

function assistantTaskOpenId(task = {}) {
  return escapeHtml(task.assignmentId || task.bookingId || "");
}

function assistantTaskFinishPending(task = {}) {
  const metadata = task.metadata || {};
  const assignmentMetadata = task.assignmentMetadata || {};
  if (metadata.finishConfirmationPending || assignmentMetadata.finishConfirmationPending) return true;
  return taskUpdates(task).some((update) =>
    update.updateType === "approval_request"
    && String(update.metadata?.purpose || "") === "finish_confirmation"
    && String(update.metadata?.status || "pending").toLowerCase() === "pending"
  );
}

function assistantTaskFinishConfirmBy(task = {}) {
  const metadata = task.metadata || {};
  const assignmentMetadata = task.assignmentMetadata || {};
  const pending = taskUpdates(task).find((update) =>
    update.updateType === "approval_request"
    && String(update.metadata?.purpose || "") === "finish_confirmation"
    && String(update.metadata?.status || "pending").toLowerCase() === "pending"
  );
  const raw = pending?.metadata?.confirmBy || metadata.finishConfirmBy || assignmentMetadata.finishConfirmBy || metadata.taskTimer?.confirmBy || assignmentMetadata.taskTimer?.confirmBy;
  const parsed = raw ? new Date(raw) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function assistantTaskActions(task = {}) {
  const tab = assistantTaskTabFor(task);
  const assignmentId = escapeHtml(task.assignmentId || "");
  if (!assignmentId || ["success", "rejected", "cancelled", "hold"].includes(tab)) return "";
  if (tab === "accepted") {
    return `<div class="task-actions">
      <button class="primary-btn" data-task-status="in_progress" data-id="${assignmentId}" type="button">Start</button>
      <button class="danger-btn" data-task-status="rejected" data-id="${assignmentId}" type="button">Reject</button>
    </div>`;
  }
  if (tab === "working") {
    return `<div class="task-actions">
      <button class="primary-btn" data-task-status="completed" data-id="${assignmentId}" type="button">Finish</button>
    </div>`;
  }
  return `<div class="task-actions">
    <button class="soft-btn" data-task-status="accepted" data-id="${assignmentId}" type="button">Accept</button>
    <button class="danger-btn" data-task-status="rejected" data-id="${assignmentId}" type="button">Reject</button>
  </div>`;
}

function assistantTaskStartAt(task = {}) {
  const metadata = task.metadata || {};
  const assignmentMetadata = task.assignmentMetadata || {};
  const scheduleMetadata = metadata.schedule || {};
  const bookingMetadata = metadata.booking || {};
  const dateTimePairs = [
    [assignmentMetadata.scheduledDate, assignmentMetadata.scheduledTime],
    [metadata.scheduledDate, metadata.scheduledTime],
    [scheduleMetadata.scheduledDate || scheduleMetadata.date, scheduleMetadata.scheduledTime || scheduleMetadata.time],
    [bookingMetadata.scheduledDate || bookingMetadata.date, bookingMetadata.scheduledTime || bookingMetadata.time]
  ];
  for (const [rawDate, rawTime] of dateTimePairs) {
    const scheduledDate = String(rawDate || "").trim();
    const scheduledTime = String(rawTime || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) && /^\d{2}:\d{2}/.test(scheduledTime)) {
      const parsed = new Date(`${scheduledDate}T${scheduledTime.slice(0, 5)}:00`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  const candidates = [
    task.scheduledAt,
    metadata.scheduledAt,
    metadata.startAt,
    metadata.bookingStartAt,
    scheduleMetadata.scheduledAt,
    bookingMetadata.scheduledAt,
    assignmentMetadata.scheduledAt,
    assignmentMetadata.startAt,
    task.assignmentExpiresAt,
    assignmentMetadata.expiresAt,
    task.assignmentAssignedAt,
    task.assignmentOfferedAt,
    task.createdAt
  ];
  for (const value of candidates) {
    const parsed = value ? new Date(value) : null;
    if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function assistantTaskEndAt(task = {}) {
  const metadata = task.metadata || {};
  const assignmentMetadata = task.assignmentMetadata || {};
  const timer = metadata.taskTimer || {};
  const explicitEnd = task.bookingEndAt
    || task.taskEndAt
    || metadata.bookingEndAt
    || metadata.taskEndAt
    || assignmentMetadata.taskEndAt
    || timer.taskEndAt;
  const parsedEnd = explicitEnd ? new Date(explicitEnd) : null;
  if (parsedEnd && !Number.isNaN(parsedEnd.getTime())) return parsedEnd;
  const startedAt = portalValidDateValue(
    task.assignmentActualStartedAt,
    task.actualTaskStartedAt,
    assignmentMetadata.actualStartedAt,
    metadata.actualStartedAt,
    metadata.startedAt,
    timer.actualStartedAt,
    task.assignmentRespondedAt
  ) || assistantTaskStartAt(task);
  if (!startedAt || Number.isNaN(startedAt.getTime())) return null;
  return new Date(startedAt.getTime() + Math.max(1, Number(task.durationMinutes || 30)) * 60_000);
}

function assistantTaskActualStartAt(task = {}) {
  const metadata = task.metadata || {};
  const assignmentMetadata = task.assignmentMetadata || {};
  const timer = metadata.taskTimer || assignmentMetadata.taskTimer || {};
  return portalValidDateValue(
    task.assignmentActualStartedAt,
    task.actualTaskStartedAt,
    assignmentMetadata.actualStartedAt,
    metadata.actualStartedAt,
    metadata.startedAt,
    timer.actualStartedAt,
    timer.startedAt
  );
}

function assistantTaskDurationEndAt(task = {}) {
  const startedAt = assistantTaskActualStartAt(task);
  if (!startedAt || Number.isNaN(startedAt.getTime())) return null;
  const durationMinutes = Math.max(1, Math.round(Number(task.durationMinutes || task.assignmentMetadata?.durationMinutes || task.metadata?.durationMinutes || 30)));
  return new Date(startedAt.getTime() + durationMinutes * 60_000);
}

function formatPortalDateTime(value) {
  const dateValue = value instanceof Date ? value : (value ? new Date(value) : null);
  if (!dateValue || Number.isNaN(dateValue.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(dateValue);
}

function countdownInfo(startAt = null) {
  if (!startAt) return { text: "Start time pending", tone: "green" };
  const diffMs = startAt.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const totalMinutes = Math.max(1, Math.ceil(absMs / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours) parts.push(`${hours} hr${hours === 1 ? "" : "s"}`);
  if (minutes || !parts.length) parts.push(`${minutes} min${minutes === 1 ? "" : "s"}`);
  const time = parts.slice(0, 2).join(" ");
  const minutesLeft = diffMs / 60_000;
  if (diffMs < 0) return { text: "Time expired", tone: "red" };
  if (minutesLeft <= 10) return { text: `${time} left`, tone: "red" };
  if (minutesLeft <= 30) return { text: `${time} left`, tone: "yellow" };
  return { text: `${time} left`, tone: "green" };
}

function portalValidDateValue(...values) {
  for (const value of values) {
    if (!value) continue;
    const parsed = value instanceof Date ? value : new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function countdownRingTone(progress = 1) {
  const elapsedRatio = 1 - Math.max(0, Math.min(1, Number(progress) || 0));
  if (elapsedRatio >= 0.75) return "red";
  if (elapsedRatio >= 0.5) return "yellow";
  return "green";
}

function assistantPendingTimerInfo(startAt = null, createdAt = null) {
  if (!startAt || Number.isNaN(startAt.getTime())) {
    return { text: "--", tone: "green", progress: 1 };
  }
  const now = Date.now();
  const diffMs = Math.max(0, startAt.getTime() - now);
  const totalMs = Math.max(
    60_000,
    startAt.getTime() - (createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.getTime() : now - 30 * 60_000)
  );
  const remainingSeconds = Math.max(0, Math.ceil(diffMs / 1000));
  const remainingMinutes = Math.ceil(remainingSeconds / 60);
  const text = remainingSeconds < 120
    ? `${remainingSeconds}s`
    : remainingMinutes < 60
      ? `${remainingMinutes}m`
      : remainingMinutes < 1440
        ? `${Math.ceil(remainingMinutes / 60)}h`
        : `${Math.ceil(remainingMinutes / 1440)}d`;
  const progress = Math.max(0, Math.min(1, diffMs / totalMs));
  const tone = remainingSeconds <= 0 ? "red" : countdownRingTone(progress);
  return { text, tone, progress };
}

function assistantWorkingTimerInfo(task = {}) {
  const startAt = assistantTaskActualStartAt(task);
  const endAt = assistantTaskDurationEndAt(task);
  if (!endAt || Number.isNaN(endAt.getTime())) return { text: "--", tone: "green", progress: 1, startAt, endAt: null };
  const now = Date.now();
  const remainingMs = Math.max(0, endAt.getTime() - now);
  const totalMs = Math.max(1, endAt.getTime() - (startAt && !Number.isNaN(startAt.getTime()) ? startAt.getTime() : now - Math.max(1, Number(task.durationMinutes || 30)) * 60_000));
  const remainingMinutes = Math.ceil(remainingMs / 60_000);
  const text = remainingMs <= 0
    ? "0m"
    : remainingMinutes < 60
      ? `${remainingMinutes}m`
      : `${Math.floor(remainingMinutes / 60)}h${remainingMinutes % 60 ? ` ${remainingMinutes % 60}m` : ""}`;
  const progress = Math.max(0, Math.min(1, remainingMs / totalMs));
  const tone = countdownRingTone(progress);
  return { text, tone, progress, startAt, endAt };
}

function assistantTaskIsFinal(task = {}) {
  const assignmentStatus = String(task.assignmentStatus || "").toLowerCase();
  const bookingStatus = String(task.bookingStatus || task.statusCode || "").toLowerCase();
  return ["completed", "success", "done", "cancelled", "canceled", "failed", "rejected"].includes(assignmentStatus)
    || ["completed", "success", "done", "cancelled", "canceled", "failed", "rejected"].includes(bookingStatus);
}

function assistantPendingCountdownCircle(task = {}, startAt = assistantTaskStartAt(task)) {
  const createdAt = task.assignmentOfferedAt || task.assignmentAssignedAt || task.createdAt ? new Date(task.assignmentOfferedAt || task.assignmentAssignedAt || task.createdAt) : null;
  const info = assistantPendingTimerInfo(startAt, createdAt);
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - info.progress);
  return `<span class="task-countdown-ring ${escapeHtml(info.tone)}" data-task-countdown data-task-countdown-ring data-start-at="${escapeHtml(startAt ? startAt.toISOString() : "")}" data-created-at="${escapeHtml(createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toISOString() : "")}" data-watch-overdue="${startAt ? "1" : ""}" style="--ring-offset:${offset.toFixed(2)}; --ring-circumference:${circumference.toFixed(2)}">
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle class="ring-track" cx="32" cy="32" r="${radius}"></circle>
      <circle class="ring-value" cx="32" cy="32" r="${radius}"></circle>
    </svg>
    <b class="countdown-ring-text">${escapeHtml(info.text)}</b>
  </span>`;
}

function assistantWorkingCountdownCircle(task = {}) {
  const info = assistantWorkingTimerInfo(task);
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - info.progress);
  return `<span class="task-countdown-ring ${escapeHtml(info.tone)}" data-task-countdown data-task-countdown-ring data-task-working-ring data-booking-id="${escapeHtml(task.bookingId || "")}" data-start-at="${escapeHtml(info.startAt ? info.startAt.toISOString() : "")}" data-end-at="${escapeHtml(info.endAt ? info.endAt.toISOString() : "")}" data-duration-minutes="${escapeHtml(task.durationMinutes || 30)}" style="--ring-offset:${offset.toFixed(2)}; --ring-circumference:${circumference.toFixed(2)}">
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle class="ring-track" cx="32" cy="32" r="${radius}"></circle>
      <circle class="ring-value" cx="32" cy="32" r="${radius}"></circle>
    </svg>
    <b class="countdown-ring-text">${escapeHtml(info.text)}</b>
  </span>`;
}

function assistantTaskCountdown(task = {}) {
  const startAt = assistantTaskStartAt(task);
  if (assistantTaskIsFinal(task)) {
    return `<span class="task-countdown task-countdown-static ${escapeHtml(assistantTaskTabFor(task))}">
      <strong>${escapeHtml(formatPortalDateTime(startAt))}</strong>
      <b>${escapeHtml(assistantTaskStatusText(task))}</b>
    </span>`;
  }
  if (assistantTaskTabFor(task) === "accepted") return assistantPendingCountdownCircle(task, startAt);
  if (assistantTaskTabFor(task) === "working") return assistantWorkingCountdownCircle(task);
  const info = countdownInfo(startAt);
  const baseTab = assistantTaskBaseTabFor(task);
  const watchOverdue = Boolean(startAt && ["new", "accepted"].includes(baseTab) && !assistantTaskIsResponseOverdue(task));
  return `<span class="task-countdown ${escapeHtml(info.tone)}" data-task-countdown data-start-at="${escapeHtml(startAt ? startAt.toISOString() : "")}" data-watch-overdue="${watchOverdue ? "1" : ""}">
    <strong>${escapeHtml(formatPortalDateTime(startAt))}</strong>
    <b>${escapeHtml(info.text)}</b>
  </span>`;
}

function assistantTaskReason(task = {}) {
  const metadata = task.assignmentMetadata || {};
  const reason = metadata.rejectionReason || metadata.reason || task.rejectionReason || (assistantTaskIsTimeOverdue(task) ? "Booking slot expired, Auto Cancelled" : "");
  if (assistantTaskTabFor(task) !== "rejected" || !reason) return "";
  return `<div class="task-reject-reason"><b>Reason</b><span>${escapeHtml(reason)}</span></div>`;
}

function formatPortalDateOnly(value) {
  const dateValue = value instanceof Date ? value : (value ? new Date(value) : null);
  if (!dateValue || Number.isNaN(dateValue.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(dateValue);
}

function formatPortalTimeOnly(value) {
  const dateValue = value instanceof Date ? value : (value ? new Date(value) : null);
  if (!dateValue || Number.isNaN(dateValue.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(dateValue);
}

function taskBookingTypeLabel(task = {}) {
  const metadata = task.metadata || {};
  const bookingType = String(metadata.bookingType || task.bookingType || "instant").trim();
  return bookingType ? bookingType.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "-";
}

function taskCartItems(task = {}) {
  const metadata = task.metadata || {};
  return Array.isArray(metadata.cartItems) && metadata.cartItems.length
    ? metadata.cartItems
    : [{ serviceName: task.serviceName || metadata.serviceName || "Service", name: metadata.categoryName || metadata.itemName || "" }];
}

function taskServiceRows(task = {}) {
  const metadata = task.metadata || {};
  const items = taskCartItems(task);
  const firstService = items[0]?.serviceName || task.serviceName || metadata.serviceName || "Service";
  const categoryNames = items.map((item) => item.categoryName || item.name).filter(Boolean);
  const storeRows = items
    .map((item, index) => {
      const label = item.storeName || item.itemName || item.name || item.categoryName || `Item ${index + 1}`;
      const phone = item.phone || item.storePhone || "";
      const mapHref = item.latitude && item.longitude
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.latitude},${item.longitude}`)}`
        : item.address
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`
          : "";
      return `<div class="task-store-line">
        <span>${escapeHtml(`Store / Item ${index + 1}`)}</span>
        <b>${escapeHtml(label)}</b>
        <div class="task-inline-icons">
          ${mapHref ? `<a href="${escapeHtml(mapHref)}" target="_blank" rel="noreferrer">Map</a>` : ""}
          ${phone ? `<a href="tel:${escapeHtml(phone)}">Call</a>` : ""}
        </div>
      </div>`;
    })
    .join("");
  return `<div class="task-service-block">
    <div class="task-service-line"><span>Service Name</span><b>${escapeHtml(firstService)}</b></div>
    <div class="task-service-line"><span>CategoryName</span><b>${escapeHtml(categoryNames.length ? categoryNames.join(", ") : "-")}</b></div>
    ${storeRows || `<span class="muted">No store/item selected</span>`}
  </div>`;
}

function taskLocationTitle(location = {}, index = 0) {
  return location.title || location.label || location.name || `Location ${index + 1}`;
}

function taskMapHref(location = {}) {
  if (location.latitude && location.longitude) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`;
  if (location.address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`;
  return "";
}

function taskLocationSummary(task = {}) {
  const locations = Array.isArray(task.locations) ? task.locations : [];
  if (!locations.length) return `<span class="muted">No location</span>`;
  return `<div class="task-location-list">
    ${locations.map((location, index) => {
      const href = taskMapHref(location);
      return `<div class="task-location-pill">
        <b>${escapeHtml(`${index + 1}. ${taskLocationTitle(location, index)}`)}</b>
        ${href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">View</a>` : ""}
      </div>`;
    }).join("")}
  </div>`;
}

function taskUploadItems(task = {}) {
  const metadata = task.metadata || {};
  const uploads = metadata.uploads
    || metadata.uploadedFiles
    || metadata.files
    || metadata.mediaUrls
    || metadata.attachments
    || task.uploads
    || task.uploadedFiles
    || task.files
    || task.mediaUrls
    || task.attachments
    || [];
  if (!Array.isArray(uploads)) return [];
  return uploads
    .map((item) => (typeof item === "string" ? { url: item } : item))
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const url = item.url || item.href || item.path || item.fileUrl || item.imageUrl || item.mediaUrl || item.downloadUrl || "";
      return url ? { ...item, url: assetUrl(url) } : null;
    })
    .filter(Boolean);
}

function taskUploadThumbs(task = {}) {
  const uploads = taskUploadItems(task);
  if (!uploads.length) return `<span class="muted">No uploads</span>`;
  return `<div class="task-upload-grid">
    ${uploads.slice(0, 6).map((upload, index) => {
      const url = upload.url || upload.href || upload.path || "";
      const name = upload.name || upload.fileName || upload.type || `File ${index + 1}`;
      const isImage = /\.(png|jpe?g|webp|gif)$/i.test(url);
      const viewUrl = assetUrl(url);
      return `<a href="${escapeHtml(viewUrl)}" target="_blank" rel="noreferrer" title="${escapeHtml(name)}">
        ${isImage ? `<img src="${escapeHtml(viewUrl)}" alt="${escapeHtml(name)}">` : `<span>${escapeHtml(String(name).slice(0, 3).toUpperCase())}</span>`}
      </a>`;
    }).join("")}
  </div>`;
}

function taskUpdates(task = {}) {
  const updates = Array.isArray(task.taskUpdates) ? task.taskUpdates : [];
  return updates.slice().sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
}

function taskUpdateLabel(update = {}) {
  const purpose = String(update.metadata?.purpose || "");
  if (purpose === "finish_confirmation" && update.updateType === "approval_request") return "Finish Confirmation";
  if (purpose === "finish_confirmation" && update.updateType === "approval_response") return "Finish Response";
  const label = {
    text: "Message",
    image: "Image",
    voice: "Voice",
    video: "Video",
    file: "File",
    location: "Current location",
    status: "Status",
    payment_request: "Payment request",
    payment_response: "Payment proof",
    payment_received: "Payment received",
    approval_request: "Approval request",
    approval_response: "Approval response",
    time_extension_request: "More time requested",
    time_extension_approved: "Extra time approved"
  }[String(update.updateType || "text")] || "Update";
  return label;
}

function taskUpdateMediaHtml(url = "", index = 0, updateType = "") {
  const viewUrl = assetUrl(url);
  const safeUrl = escapeHtml(viewUrl);
  const label = `Attachment ${index + 1}`;
  const kind = customerTrackPreviewKind(viewUrl, updateType);
  const previewAttrs = customerTrackPreviewTriggerAttrs(viewUrl, label, kind);
  if (kind === "image") return `<a href="${safeUrl}" target="_blank" rel="noreferrer" ${previewAttrs}><img src="${safeUrl}" alt="${escapeHtml(label)}"></a>`;
  if (kind === "audio") return `<audio src="${safeUrl}" controls ${previewAttrs}></audio>`;
  if (kind === "video") return `<video src="${safeUrl}" controls playsinline ${previewAttrs}></video>`;
  return `<a class="timeline-file-link" href="${safeUrl}" target="_blank" rel="noreferrer" ${previewAttrs}>${escapeHtml(label)}</a>`;
}

function taskUpdateResponseMap(updates = [], updateType = "approval_response") {
  const map = new Map();
  updates.forEach((update) => {
    if (String(update.updateType || "") !== updateType) return;
    const sourceUpdateId = update.metadata?.sourceUpdateId;
    if (sourceUpdateId) map.set(String(sourceUpdateId), update);
  });
  return map;
}

function taskTimelineSpecialHtml(update = {}, task = {}, options = {}, approvalResponses = new Map(), paymentResponses = new Map()) {
  const metadata = update.metadata || {};
  if (update.updateType === "location") {
    const lat = Number(metadata.latitude);
    const lng = Number(metadata.longitude);
    const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);
    const mapHref = hasLocation ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}` : "";
    return `<div class="timeline-special-card location">
      <span>${hasLocation ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Location shared"}</span>
      ${mapHref ? `<a href="${escapeHtml(mapHref)}" target="_blank" rel="noreferrer">Open Map</a>` : ""}
    </div>`;
  }
  if (update.updateType === "payment_request") {
    const amount = Number(metadata.amount || 0);
    const response = paymentResponses.get(String(update.id || ""));
    const paid = String(metadata.status || "").toLowerCase() === "paid";
    const proofShared = Boolean(response);
    return `<div class="timeline-special-card payment">
      <span>${amount > 0 ? money(amount) : "Payment requested"}</span>
      ${metadata.upiId ? `<small>UPI ID: ${escapeHtml(metadata.upiId)}</small>` : ""}
      <b>${escapeHtml(paid ? "Paid" : proofShared ? "Proof shared" : metadata.status || "Pending")}</b>
      ${metadata.upiUri ? `<a class="timeline-pay-link" href="${escapeHtml(metadata.upiUri)}">Open UPI</a>` : ""}
      ${options.allowPayment && !paid && !proofShared ? `<button class="primary-btn timeline-pay-btn" data-payment-response data-payment-update-id="${escapeHtml(update.id || "")}" data-payment-booking-id="${escapeHtml(task.bookingId || task.id || "")}" data-payment-assignment-id="${escapeHtml(task.assignmentId || "")}" data-payment-amount="${escapeHtml(amount)}" type="button">Pay Now</button>` : ""}
    </div>`;
  }
  if (update.updateType === "payment_response") {
    const amount = Number(metadata.amount || 0);
    const mode = String(metadata.mode || metadata.paymentMode || "").toLowerCase();
    const status = String(metadata.status || "pending").toLowerCase();
    const assistantResponse = paymentResponses.get(String(update.id || ""));
    const assistantResponseStatus = String(assistantResponse?.metadata?.status || "").toLowerCase();
    const finalStatus = assistantResponseStatus || status;
    const needsAssistantCashConfirm = options.allowPaymentConfirm && !assistantResponse && mode === "cash" && status === "pending" && String(metadata.confirmationTarget || "") === "assistant";
    return `<div class="timeline-special-card payment paid">
      <span>${amount ? money(amount) : "Payment confirmation shared"}${mode ? ` · ${escapeHtml(mode.toUpperCase())}` : ""}</span>
      <b>${escapeHtml(finalStatus === "paid" ? "Paid" : finalStatus === "due" ? "Not confirmed - payment due" : "Pending confirmation")}</b>
      ${metadata.referenceId ? `<small>Ref: ${escapeHtml(metadata.referenceId)}</small>` : ""}
      ${metadata.note ? `<small>${escapeHtml(metadata.note)}</small>` : ""}
      ${needsAssistantCashConfirm ? `<div class="approval-actions">
        <button class="primary-btn" data-assistant-cash-payment-confirm="yes" data-payment-booking-id="${escapeHtml(task.bookingId || task.id || "")}" data-payment-assignment-id="${escapeHtml(task.assignmentId || "")}" data-payment-update-id="${escapeHtml(update.id || "")}" data-payment-amount="${escapeHtml(amount)}" type="button">Yes</button>
        <button class="danger-btn" data-assistant-cash-payment-confirm="no" data-payment-booking-id="${escapeHtml(task.bookingId || task.id || "")}" data-payment-assignment-id="${escapeHtml(task.assignmentId || "")}" data-payment-update-id="${escapeHtml(update.id || "")}" data-payment-amount="${escapeHtml(amount)}" type="button">No</button>
      </div>` : ""}
    </div>`;
  }
  if (update.updateType === "payment_received") {
    const mode = String(metadata.mode || metadata.paymentMode || "cash").toUpperCase();
    const remarks = String(metadata.remarks || metadata.transactionId || "").trim();
    return `<div class="timeline-special-card payment paid">
      <span>${metadata.amount ? money(Number(metadata.amount)) : "Payment received"}${mode ? ` · ${escapeHtml(mode)}` : ""}</span>
      <b>Paid</b>
      ${remarks ? `<small>${escapeHtml(remarks)}</small>` : ""}
    </div>`;
  }
  if (update.updateType === "approval_request") {
    const response = approvalResponses.get(String(update.id || ""));
    const status = response?.metadata?.response ? String(response.metadata.response) : String(metadata.status || "pending");
    const isFinishConfirmation = String(metadata.purpose || "") === "finish_confirmation";
    const title = isFinishConfirmation
      ? (status === "yes" ? "Finish confirmed" : status === "no" ? "Finish rejected" : "Assistant requested finish confirmation")
      : (status === "yes" ? "Approved" : status === "no" ? "Not approved" : "Waiting for customer");
    const confirmBy = metadata.confirmBy ? formatPortalDateTime(new Date(metadata.confirmBy)) : "";
    return `<div class="timeline-special-card approval">
      <span>${escapeHtml(title)}</span>
      ${isFinishConfirmation && !response && confirmBy ? `<small>Auto finish after ${escapeHtml(confirmBy)}</small>` : ""}
      ${response ? `<b>${escapeHtml(response.message || `Customer replied ${status}`)}</b>` : ""}
      ${options.allowApprove && !response ? `<div class="approval-actions">
        <button class="primary-btn" data-approval-response="yes" data-approval-purpose="${escapeHtml(metadata.purpose || "")}" data-approval-update-id="${escapeHtml(update.id || "")}" data-approval-booking-id="${escapeHtml(task.bookingId || task.id || "")}" data-approval-assignment-id="${escapeHtml(task.assignmentId || "")}" type="button">Yes</button>
        <button class="danger-btn" data-approval-response="no" data-approval-purpose="${escapeHtml(metadata.purpose || "")}" data-approval-update-id="${escapeHtml(update.id || "")}" data-approval-booking-id="${escapeHtml(task.bookingId || task.id || "")}" data-approval-assignment-id="${escapeHtml(task.assignmentId || "")}" type="button">No</button>
      </div>` : ""}
    </div>`;
  }
  return "";
}

function taskTimelineHtml(task = {}, options = {}) {
  const updates = taskUpdates(task);
  if (!updates.length) return `<div class="task-timeline-empty">No live updates yet.</div>`;
  const approvalResponses = taskUpdateResponseMap(updates);
  const paymentResponses = taskUpdateResponseMap(updates, "payment_response");
  return `<div class="task-timeline">
    ${updates.map((update) => {
      const metadata = update.metadata || {};
      const urls = Array.isArray(update.mediaUrls) ? update.mediaUrls : [];
      const pendingMoreTime = update.updateType === "time_extension_request" && String(metadata.status || "pending").toLowerCase() !== "approved";
      const specialHtml = taskTimelineSpecialHtml(update, task, options, approvalResponses, paymentResponses);
      return `<article class="task-timeline-item ${escapeHtml(update.actorType || "")}">
        <div class="task-timeline-head">
          <b>${escapeHtml(taskUpdateLabel(update))}</b>
          <span>${escapeHtml(update.actorName || update.actorType || "User")} - ${escapeHtml(formatPortalDateTime(update.createdAt ? new Date(update.createdAt) : null))}</span>
        </div>
        ${update.message ? `<p>${escapeHtml(update.message)}</p>` : ""}
        ${specialHtml}
        ${urls.length ? `<div class="task-timeline-media">${urls.map((url, index) => taskUpdateMediaHtml(url, index, update.updateType)).join("")}</div>` : ""}
        ${update.updateType === "time_extension_request" ? `<div class="time-extension-chip">
          <span>${Number(metadata.requestedMinutes || 15)} mins requested</span>
          ${String(metadata.status || "pending").toLowerCase() === "approved" ? `<b>Approved</b>` : `<b>Pending</b>`}
          ${options.allowApprove && pendingMoreTime ? `<button class="primary-btn" data-approve-time-update="${escapeHtml(update.id)}" type="button">Approve Extra Time</button>` : ""}
        </div>` : ""}
      </article>`;
    }).join("")}
  </div>`;
}

function assistantCustomerRating(task = {}) {
  const value = Number(
    task.customerRatingAvg
    ?? task.customerRating
    ?? task.metadata?.customerRatingAvg
    ?? task.metadata?.customer?.ratingAvg
    ?? 0
  );
  return Number.isFinite(value) && value > 0 ? value.toFixed(1) : "0.0";
}

function assistantCustomerAvatarHtml(task = {}, className = "") {
  const name = task.customerName || "Customer";
  const imageUrl = String(task.customerProfilePictureUrl || task.metadata?.customerProfilePictureUrl || task.metadata?.customer?.profilePictureUrl || "").trim();
  return `<span class="assistant-chat-customer-avatar ${escapeHtml(className)}" aria-hidden="true">
    ${imageUrl ? `<img src="${escapeHtml(assetUrl(imageUrl))}" alt="">` : `<span>${escapeHtml(String(name).slice(0, 1).toUpperCase() || "C")}</span>`}
  </span>`;
}

function assistantChatBubbleHtml(update = {}, task = {}, options = {}) {
  const fromAssistant = String(update.actorType || update.from || "").toLowerCase() === "assistant";
  const urls = Array.isArray(update.mediaUrls) ? update.mediaUrls : [];
  const timeText = customerTrackMessageTime(update.createdAt);
  const specialHtml = taskTimelineSpecialHtml(update, task, options, new Map(), new Map());
  return `<article class="assistant-chat-bubble ${fromAssistant ? "me" : "customer"}">
    ${fromAssistant ? "" : assistantCustomerAvatarHtml(task, "message-avatar")}
    <div class="assistant-chat-message">
      ${update.message ? `<p>${escapeHtml(update.message)}</p>` : ""}
      ${specialHtml}
      ${urls.length ? `<div class="assistant-chat-media">${urls.map((url, index) => taskUpdateMediaHtml(url, index, update.updateType)).join("")}</div>` : ""}
      <time>${escapeHtml(timeText)}</time>
    </div>
  </article>`;
}

function assistantChatMessagesHtml(task = {}) {
  const updates = taskUpdates(task);
  if (!updates.length) return `<div class="assistant-chat-empty">No live updates yet.</div>`;
  return `<div class="assistant-chat-list">${updates.map((update) => assistantChatBubbleHtml(update, task, { allowPaymentConfirm: true })).join("")}</div>`;
}

function assistantTaskUpdatePanel(task = {}) {
  if (assistantTaskTabFor(task) !== "working") return "";
  const finishPending = assistantTaskFinishPending(task);
  const endAt = finishPending ? assistantTaskFinishConfirmBy(task) : assistantTaskDurationEndAt(task);
  const finishInfo = countdownInfo(endAt);
  return `<section class="task-app-section task-update-console">
    <div class="task-section-title">Live Updates <span>${taskUpdates(task).length}</span></div>
    <div class="task-finish-warning">
      <span>${finishPending ? "Customer confirmation" : "Task finish"}</span>
      <b class="${escapeHtml(finishInfo.tone)}" data-task-countdown data-start-at="${escapeHtml(endAt ? endAt.toISOString() : "")}" data-watch-overdue="${endAt ? "1" : ""}">${escapeHtml(finishInfo.text)}</b>
    </div>
    ${taskTimelineHtml(task)}
    <form class="task-update-form" data-task-update-form data-booking-id="${escapeHtml(task.bookingId || "")}" data-assignment-id="${escapeHtml(task.assignmentId || "")}">
      <textarea name="message" rows="2" placeholder="Write update for customer"></textarea>
      <div class="task-update-controls">
        <select name="updateType" aria-label="Update type">
          <option value="text">Text</option>
          <option value="image">Image</option>
          <option value="voice">Voice</option>
          <option value="video">Video</option>
          <option value="status">Status</option>
        </select>
        <input name="media" type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx">
      </div>
      <div class="task-update-actions">
        <button class="primary-btn" data-task-update-action="send" type="submit">Send Update</button>
        <label>Need more time
          <select name="requestedMinutes">
            <option value="15">15 mins</option>
            <option value="30">30 mins</option>
            <option value="45">45 mins</option>
            <option value="60">1 hr</option>
          </select>
        </label>
        <button class="soft-btn" data-task-update-action="more-time" type="submit">Ask Customer</button>
      </div>
    </form>
  </section>`;
}

function assistantChatTask() {
  return state.tasks.find((task) => task.assignmentId === state.assistantChatTaskId || task.bookingId === state.assistantChatTaskId) || null;
}

function taskLastUpdateSummary(task = {}) {
  const updates = taskUpdates(task);
  const last = updates[updates.length - 1];
  if (!last) return "Tap to open live task chat";
  const message = String(last.message || "").trim();
  return message || taskUpdateLabel(last);
}

function assistantWorkingChatRows(tasks = assistantFilteredTasks()) {
  if (!tasks.length) return assistantNoRecordState();
  return `<div class="working-chat-list">
    ${tasks.map((task) => {
      const name = task.customerName || "Customer";
      const endAt = assistantTaskDurationEndAt(task);
      const finishInfo = countdownInfo(endAt);
      return `<button class="working-chat-row" data-open-task-chat="${escapeHtml(task.assignmentId || task.bookingId || "")}" type="button">
        <div class="task-avatar">${escapeHtml(String(name).slice(0, 1).toUpperCase())}</div>
        <div class="working-chat-main">
          <div>
            <b>${escapeHtml(name)}</b>
            <span>${escapeHtml(task.customerPhone || "-")}</span>
          </div>
          <p>${escapeHtml(customerVisibleBookingId(task))} - ${escapeHtml(task.serviceName || task.metadata?.serviceName || "Service")}</p>
          <small>${escapeHtml(taskLastUpdateSummary(task))}</small>
        </div>
        <div class="working-chat-meta">
          <span class="${escapeHtml(finishInfo.tone)}" data-task-countdown data-start-at="${escapeHtml(endAt ? endAt.toISOString() : "")}" data-watch-overdue="${endAt ? "1" : ""}">${escapeHtml(finishInfo.text)}</span>
          <b>${taskUpdates(task).length} updates</b>
        </div>
      </button>`;
    }).join("")}
  </div>`;
}

function assistantChatActionPanel(task = {}) {
  const action = state.assistantChatAction;
  if (!action) return "";
  const bookingId = escapeHtml(task.bookingId || "");
  const assignmentId = escapeHtml(task.assignmentId || "");
  if (action === "payment") {
    const payment = customerBookingPaymentState(task);
    if (!payment.paid) {
      const amount = bookingPaymentAmount(task);
      return `<form class="chat-action-panel" data-chat-action-form="payment_received" data-booking-id="${bookingId}" data-assignment-id="${assignmentId}">
        <div class="chat-action-head">
          <b>Payment Received</b>
          <button type="button" data-close-chat-action>x</button>
        </div>
        ${assistantPaymentQrCardHtml(task, amount)}
        <label>Mode
          <select name="mode">
            <option value="cash"${String(payment.type || "").toLowerCase() === "cash" ? " selected" : ""}>Cash</option>
            <option value="upi"${String(payment.type || "").toLowerCase() === "upi" ? " selected" : ""}>UPI</option>
            <option value="card"${String(payment.type || "").toLowerCase() === "card" ? " selected" : ""}>Card</option>
          </select>
        </label>
        <label>Amount<input name="amount" inputmode="decimal" placeholder="Amount" value="${escapeHtml(amount ? amount.toFixed(2) : "")}" required></label>
        <label>Remarks / Transaction ID<input name="remarks" placeholder="Cash received / UPI transaction ID"></label>
        <label>Proof Photo<input name="proof" type="file" accept="image/*,.pdf"></label>
        <button class="primary-btn" type="submit">Mark Payment Received</button>
      </form>`;
    }
    return `<form class="chat-action-panel" data-chat-action-form="payment" data-booking-id="${bookingId}" data-assignment-id="${assignmentId}">
      <div class="chat-action-head">
        <b>Request Payment</b>
        <button type="button" data-close-chat-action>x</button>
      </div>
      <label>Amount<input name="amount" inputmode="decimal" placeholder="Amount" required></label>
      <textarea name="message" rows="2" placeholder="Payment note">Please complete the pending payment for this task.</textarea>
      <button class="primary-btn" type="submit">Send Payment Request</button>
    </form>`;
  }
  if (action === "approval") {
    return `<form class="chat-action-panel" data-chat-action-form="approval" data-booking-id="${bookingId}" data-assignment-id="${assignmentId}">
      <div class="chat-action-head">
        <b>Ask Approval</b>
        <button type="button" data-close-chat-action>x</button>
      </div>
      <textarea name="message" rows="3" placeholder="Ask customer for yes/no approval" required></textarea>
      <button class="primary-btn" type="submit">Ask Customer</button>
    </form>`;
  }
  if (action === "more_time") {
    return `<form class="chat-action-panel" data-chat-action-form="more_time" data-booking-id="${bookingId}" data-assignment-id="${assignmentId}">
      <div class="chat-action-head">
        <b>Add More Time</b>
        <button type="button" data-close-chat-action>x</button>
      </div>
      <label>Extra time
        <select name="requestedMinutes">
          <option value="15">15 mins</option>
          <option value="30">30 mins</option>
          <option value="45">45 mins</option>
          <option value="60">1 hr</option>
          <option value="90">1.5 hrs</option>
          <option value="120">2 hrs</option>
        </select>
      </label>
      <textarea name="message" rows="2" placeholder="Tell customer why more time is needed"></textarea>
      <button class="primary-btn" type="submit">Request More Time</button>
    </form>`;
  }
  return "";
}

function assistantTrackFooterControls(task = {}) {
  const tab = assistantTaskTabFor(task);
  const assignmentId = escapeHtml(task.assignmentId || "");
  if (!assignmentId || ["success", "rejected", "cancelled", "hold"].includes(tab)) return "";
  if (tab === "accepted") {
    return `<div class="task-chat-footer">
      <button class="primary-btn" data-task-status="in_progress" data-id="${assignmentId}" type="button">Start</button>
      <button class="danger-btn" data-task-status="rejected" data-id="${assignmentId}" type="button">Reject</button>
    </div>`;
  }
  if (tab === "working") {
    return `<div class="task-chat-footer">
      <button class="danger-btn" data-task-status="rejected" data-task-action-label="cancel" data-id="${assignmentId}" type="button">Cancel</button>
      <button class="primary-btn" data-task-status="completed" data-id="${assignmentId}" type="button">Finish</button>
    </div>`;
  }
  return "";
}

function assistantTrackBookingDetailsHtml(task = {}) {
  const startAt = assistantTaskStartAt(task);
  const createdAt = task.createdAt ? new Date(task.createdAt) : null;
  const locations = Array.isArray(task.locations) ? task.locations : [];
  const payment = customerBookingPaymentState(task);
  const amount = bookingPaymentAmount(task);
  const duration = Number(task.durationMinutes || task.metadata?.durationMinutes || 0) || 30;
  return `<section class="assistant-track-summary task-app-card">
    <div class="task-app-head">
      <div class="task-app-id">
        <span>Booking ID</span>
        <b>${escapeHtml(customerVisibleBookingId(task))}</b>
      </div>
      ${assistantTaskStatusLabel(task)}
    </div>
    <div class="assistant-track-service-row">
      <div class="assistant-track-service-copy">
        <b>${escapeHtml(task.serviceName || task.metadata?.serviceName || "Service")}</b>
        <span>${escapeHtml(taskBookingTypeLabel(task))} · ${duration} mins</span>
        <small>Start ${escapeHtml(formatPortalDateOnly(startAt))} - ${escapeHtml(formatPortalTimeOnly(startAt))}</small>
      </div>
      <strong>${money(amount)}</strong>
    </div>
    <div class="task-app-chips">
      <span>Booked ${escapeHtml(formatPortalDateTime(createdAt))}</span>
      <span>Payment ${escapeHtml(payment.label || "Due")}</span>
      <span>${escapeHtml(locations.length ? `${locations.length} location${locations.length === 1 ? "" : "s"}` : "No location")}</span>
    </div>
  </section>
  <section class="task-app-section">
    <div class="task-section-title">Service Details</div>
    ${taskServiceRows(task)}
  </section>
  <section class="task-app-section">
    <div class="task-section-title">Customer</div>
    ${taskCustomerLine(task)}
  </section>
  <section class="task-app-section">
    <div class="task-section-title">Locations <span>${locations.length}</span></div>
    ${taskLocationSummary(task)}
    <p class="task-address-line">${escapeHtml(locations[0]?.address || "-")}</p>
  </section>
  <div class="task-app-grid">
    <section class="task-app-section">
      <div class="task-section-title">Uploads</div>
      ${taskUploadThumbs(task)}
    </section>
    <section class="task-app-section">
      <div class="task-section-title">Note</div>
      <p class="task-note-text">${escapeHtml(task.notes || task.metadata?.notes || "-")}</p>
    </section>
  </div>`;
}

function assistantTaskChatWindow() {
  const task = assistantChatTask();
  if (!task) return "";
  const finishPending = assistantTaskFinishPending(task);
  const endAt = finishPending ? assistantTaskFinishConfirmBy(task) : assistantTaskDurationEndAt(task);
  const finishInfo = countdownInfo(endAt);
  const payment = customerBookingPaymentState(task);
  const chatEnabled = !payment.paid && task.metadata?.chatLocked !== true;
  const taskCompleted = ["completed", "success", "done"].includes(String(task.assignmentStatus || task.bookingStatus || "").toLowerCase())
    || ["completed", "success", "done"].includes(String(task.bookingStatus || "").toLowerCase());
  const disabledAttr = chatEnabled ? "" : " disabled";
  const trackTitle = assistantTaskStatusText(task);
  const finalTask = assistantTaskIsFinal(task);
  const titleTimer = finalTask
    ? `<span class="task-chat-timer ${taskCompleted ? "green" : "red"}">${escapeHtml(trackTitle)}</span>`
    : `<span class="task-chat-timer ${escapeHtml(finishInfo.tone)}" data-task-countdown data-start-at="${escapeHtml(endAt ? endAt.toISOString() : "")}" data-watch-overdue="${endAt ? "1" : ""}">${escapeHtml(finishInfo.text)}</span>`;
  return `<section class="assistant-app assistant-track-page task-chat-window">
      <div class="assistant-chat-page-title">
        <button class="assistant-chat-back" data-close-task-chat type="button" aria-label="Back">${customerTrackIcon("back")}</button>
        <h2>${escapeHtml(trackTitle)}</h2>
        ${titleTimer}
      </div>
      <div class="assistant-track-scroll">
        ${assistantTrackBookingDetailsHtml(task)}
      <header class="assistant-chat-header">
        ${assistantCustomerAvatarHtml(task)}
        <div class="assistant-chat-customer">
          <b>${escapeHtml(task.customerName || "Customer")}</b>
          <small>Ratings ${customerTrackIcon("star")}${escapeHtml(assistantCustomerRating(task))}</small>
        </div>
        ${task.customerPhone ? `<a class="assistant-chat-call" href="${escapeHtml(customerTrackPhoneHref(task.customerPhone))}" aria-label="Call customer">${customerTrackIcon("call")}</a>` : ""}
        <button class="assistant-chat-icon-btn" data-close-task-chat type="button" aria-label="Close chat">${customerTrackIcon("minimize")}</button>
      </header>
      <div class="task-chat-actions">
        <button class="soft-btn" data-chat-quick-action="location" type="button"${disabledAttr}>Location</button>
        <button class="soft-btn" data-chat-quick-action="payment" type="button"${payment.paid ? " disabled" : ""}>${payment.paid ? "Paid" : "Payment"}</button>
        <button class="soft-btn" data-chat-quick-action="approval" type="button"${disabledAttr}>Approval</button>
        <button class="soft-btn" data-chat-quick-action="more_time" type="button"${disabledAttr}>More Time</button>
      </div>
      ${assistantChatActionPanel(task)}
      <div class="task-chat-body">${assistantChatMessagesHtml(task)}</div>
      </div>
      ${chatEnabled ? portalQuickReplyChipsHtml(task.bookingId || "", task.assignmentId || "") : ""}
      <form class="chat-composer assistant-chat-composer ${chatEnabled ? "" : "is-disabled"}" data-task-update-form data-chat-disabled="${chatEnabled ? "false" : "true"}" aria-disabled="${chatEnabled ? "false" : "true"}" data-booking-id="${escapeHtml(task.bookingId || "")}" data-assignment-id="${escapeHtml(task.assignmentId || "")}">
        <input type="hidden" name="updateType" value="text">
        <label aria-label="Attach file">${customerIcon("paperclip")}<input name="media" type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx"${disabledAttr}></label>
        <textarea name="message" rows="1" placeholder="${chatEnabled ? "Type your message" : "Payment received. Chat closed."}"${disabledAttr}></textarea>
        <button data-task-update-action="send" type="submit" aria-label="Send message"${disabledAttr}>${customerTrackIcon("send")}</button>
      </form>
      ${assistantTrackFooterControls(task)}
    </section>`;
}

function taskCustomerLine(task = {}) {
  const phone = String(task.customerPhone || "").trim();
  const digits = phone.replace(/\D/g, "");
  const waNumber = digits.startsWith("91") ? digits : digits ? `91${digits}` : "";
  const name = task.customerName || "Customer";
  return `<div class="task-customer-line">
    <div class="task-avatar">${escapeHtml(String(name).slice(0, 1).toUpperCase())}</div>
    <div>
      <b>${escapeHtml(name)}</b>
      <span>${escapeHtml(phone || "-")}</span>
    </div>
    <div class="task-inline-icons">
      ${phone ? `<a href="tel:${escapeHtml(phone)}">Call</a>` : ""}
      ${waNumber ? `<a href="https://wa.me/${escapeHtml(waNumber)}" target="_blank" rel="noreferrer">WhatsApp</a>` : ""}
    </div>
  </div>`;
}

function taskGeoLine(task = {}) {
  const metadata = task.metadata || {};
  const firstLocation = (Array.isArray(task.locations) ? task.locations[0] : null) || {};
  const cluster = task.clusterName || metadata.clusterName || firstLocation.clusterName || "-";
  const zone = metadata.zoneName || firstLocation.zoneName || "-";
  const city = metadata.cityName || firstLocation.cityName || "-";
  const stateName = metadata.stateName || firstLocation.stateName || "-";
  return `<div class="task-geo-line">
    <span>Cluster Name <b>${escapeHtml(cluster)}</b></span>
    <span>Zone Name <b>${escapeHtml(zone)}</b></span>
    <span>City Name <b>${escapeHtml(city)}</b></span>
    <span>State Name <b>${escapeHtml(stateName)}</b></span>
  </div>`;
}

function updateAssistantCountdowns() {
  let needsQueueRefresh = false;
  document.querySelectorAll("[data-task-countdown]").forEach((element) => {
    const startAt = element.getAttribute("data-start-at") ? new Date(element.getAttribute("data-start-at")) : null;
    if (element.hasAttribute("data-task-countdown-ring")) {
      let info;
      if (element.hasAttribute("data-task-working-ring")) {
        const endAt = element.getAttribute("data-end-at") ? new Date(element.getAttribute("data-end-at")) : null;
        const now = Date.now();
        const durationMinutes = Math.max(1, Number(element.getAttribute("data-duration-minutes") || 30));
        const safeEndAt = endAt && !Number.isNaN(endAt.getTime()) ? endAt : null;
        const safeStartAt = startAt && !Number.isNaN(startAt.getTime()) ? startAt : null;
        const remainingMs = safeEndAt ? Math.max(0, safeEndAt.getTime() - now) : 0;
        const totalMs = safeEndAt ? Math.max(1, safeEndAt.getTime() - (safeStartAt ? safeStartAt.getTime() : safeEndAt.getTime() - durationMinutes * 60_000)) : 1;
        const remainingMinutes = Math.ceil(remainingMs / 60_000);
        if (safeEndAt && now >= safeEndAt.getTime()) {
          const bookingId = element.getAttribute("data-booking-id") || "";
          if (bookingId) void syncPortalBookingStatusNow(bookingId, "assistant_working_timer_expired");
        }
        const progress = Math.max(0, Math.min(1, remainingMs / totalMs));
        info = {
          text: remainingMs <= 0 ? "0m" : remainingMinutes < 60 ? `${remainingMinutes}m` : `${Math.floor(remainingMinutes / 60)}h${remainingMinutes % 60 ? ` ${remainingMinutes % 60}m` : ""}`,
          tone: countdownRingTone(progress),
          progress
        };
      } else {
        const createdAt = element.getAttribute("data-created-at") ? new Date(element.getAttribute("data-created-at")) : null;
        info = assistantPendingTimerInfo(startAt, createdAt);
      }
      element.classList.remove("green", "yellow", "red");
      element.classList.add(info.tone);
      element.style.setProperty("--ring-offset", `${(Number(element.style.getPropertyValue("--ring-circumference")) || (2 * Math.PI * 26)) * (1 - info.progress)}`);
      const textTarget = element.querySelector("b");
      if (textTarget) textTarget.textContent = info.text;
      if (element.getAttribute("data-watch-overdue") === "1" && startAt && startAt.getTime() < Date.now()) {
        needsQueueRefresh = true;
        element.setAttribute("data-watch-overdue", "");
      }
      return;
    }
    const info = countdownInfo(startAt);
    element.classList.remove("green", "yellow", "red");
    element.classList.add(info.tone);
    const textTarget = element.matches("b") ? element : element.querySelector("b");
    if (textTarget) textTarget.textContent = info.text;
    if (element.getAttribute("data-watch-overdue") === "1" && startAt && startAt.getTime() < Date.now()) {
      needsQueueRefresh = true;
      element.setAttribute("data-watch-overdue", "");
    }
  });
  if (!needsQueueRefresh) return;
  if (state.assistantTaskConfirm) return;
  if (assistantCountdownRefreshQueued) return;
  assistantCountdownRefreshQueued = true;
  setTimeout(() => {
    assistantCountdownRefreshQueued = false;
    if (actor !== "assistant" || !state.token) return;
    if (!renderAssistantTaskView()) {
      render();
    }
  }, 0);
}

function updateCustomerTrackTotalTimeBadges() {
  document.querySelectorAll("[data-customer-track-total-time]").forEach((element) => {
    if (element.hasAttribute("data-customer-track-ring")) {
      const startAt = element.getAttribute("data-start-at") ? new Date(element.getAttribute("data-start-at")) : null;
      const endAt = element.getAttribute("data-base-end-at") ? new Date(element.getAttribute("data-base-end-at")) : null;
      const info = customerTrackRingInfo({
        startAt: startAt && !Number.isNaN(startAt.getTime()) ? startAt : null,
        endAt: endAt && !Number.isNaN(endAt.getTime()) ? endAt : null,
        waitMinutes: element.getAttribute("data-wait-minutes"),
        staticMinutes: element.getAttribute("data-static-minutes"),
        baseMinutes: element.getAttribute("data-base-minutes")
      });
      element.classList.remove("green", "yellow", "red", "danger");
      element.classList.add(info.tone);
      element.classList.toggle("danger", info.tone === "red");
      const circumference = Number(element.style.getPropertyValue("--ring-circumference") || element.getAttribute("data-ring-circumference") || 0);
      if (circumference) element.style.setProperty("--ring-offset", String((circumference * (1 - info.progress)).toFixed(2)));
      const textTarget = element.querySelector("b");
      if (textTarget) textTarget.textContent = info.text;
      if (endAt && !Number.isNaN(endAt.getTime()) && Date.now() >= endAt.getTime()) {
        const bookingId = element.getAttribute("data-booking-id") || state.confirmedBooking?.id || state.confirmedBooking?.bookingId || "";
        if (bookingId && Date.now() >= customerTrackScrollActiveUntil) void syncPortalBookingStatusNow(bookingId, "customer_track_timer_expired");
      }
      return;
    }
    const baseEndAt = element.getAttribute("data-base-end-at") ? new Date(element.getAttribute("data-base-end-at")) : null;
    const waitMinutes = Math.max(0, Math.round(Number(element.getAttribute("data-wait-minutes") || 0)));
    const staticMinutes = Math.max(0, Math.round(Number(element.getAttribute("data-static-minutes") || 0)));
    let displayMinutes = staticMinutes;
    let danger = displayMinutes < 10;
    if (baseEndAt && !Number.isNaN(baseEndAt.getTime())) {
      const now = Date.now();
      const baseDiff = Math.ceil((baseEndAt.getTime() - now) / 60_000);
      if (baseDiff > 0) {
        displayMinutes = Math.max(1, baseDiff);
        danger = displayMinutes < 10;
      } else {
        const waitEndAt = baseEndAt.getTime() + waitMinutes * 60_000;
        displayMinutes = waitMinutes > 0 ? Math.max(0, Math.ceil((waitEndAt - now) / 60_000)) : 0;
        danger = true;
      }
    }
    element.classList.toggle("danger", danger);
    const textTarget = element.querySelector("span");
    if (textTarget) textTarget.textContent = customerTrackDurationCapsuleText(displayMinutes);
  });
}

function updateCustomerCountdowns() {
  let needsRender = false;
  updateCustomerTrackTotalTimeBadges();
  document.querySelectorAll("[data-customer-cancel-countdown]").forEach((element) => {
    const openAt = element.getAttribute("data-customer-cancel-open") ? new Date(element.getAttribute("data-customer-cancel-open")) : null;
    const autoAt = element.getAttribute("data-customer-cancel-auto") ? new Date(element.getAttribute("data-customer-cancel-auto")) : null;
    if ((openAt && Number.isNaN(openAt.getTime())) || (autoAt && Number.isNaN(autoAt.getTime()))) return;
    const now = Date.now();
    let deadline = autoAt && !Number.isNaN(autoAt.getTime()) ? autoAt : openAt && !Number.isNaN(openAt.getTime()) ? openAt : null;
    if (!deadline) return;

    const diffMs = deadline.getTime() - now;
    const phaseIsOpening = openAt && now < openAt.getTime();
    const available = !(openAt && now < openAt.getTime()) && !(autoAt && now >= autoAt.getTime());
    const totalSeconds = Math.max(0, Math.ceil(Math.abs(diffMs) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const parts = [];
    if (hours) parts.push(`${hours} hr${hours === 1 ? "" : "s"}`);
    if (mins || !parts.length) parts.push(`${mins} min${mins === 1 ? "" : "s"}`);
    if (!hours && !mins) parts.push(`${seconds} sec${seconds === 1 ? "" : "s"}`);
    const tone = autoAt && now >= autoAt.getTime()
      ? "red"
      : !available
        ? (minutes <= 5 ? "red" : minutes <= 15 ? "yellow" : "green")
        : (minutes <= 5 ? "red" : minutes <= 15 ? "yellow" : "green");
    element.classList.remove("green", "yellow", "red");
    element.classList.add(tone);
    if (autoAt && now >= autoAt.getTime()) {
      element.textContent = "Cancel window closed";
    } else if (phaseIsOpening) {
      element.textContent = `${parts.join(" ")} to cancel enable`;
    } else if (autoAt) {
      element.textContent = `${parts.join(" ")} left to cancel`;
    } else {
      element.textContent = "You can cancel this task.";
    }
    if (element.getAttribute("data-customer-cancel-available") !== (available ? "1" : "0")) {
      element.setAttribute("data-customer-cancel-available", available ? "1" : "0");
      needsRender = true;
    }
    if (autoAt && now >= autoAt.getTime()) {
      const bookingId = state.confirmedBooking?.id || state.confirmedBooking?.bookingId || "";
      if (bookingId && Date.now() >= customerTrackScrollActiveUntil) void syncPortalBookingStatusNow(bookingId, "customer_cancel_timer_expired");
    }
  });
  if (needsRender && state.customerView === "track") {
    if (Date.now() < customerTrackScrollActiveUntil) {
      customerTrackPendingRealtimeUpdate = true;
      return;
    }
    renderTrackRealtimeUpdate();
    return;
  }
  if (needsRender && state.customerView === "schedule") render();
}

function assistantTaskConfirmCopy(status, actionLabel = "") {
  if (status === "accepted") return { title: "Accept Task", message: "Do you want to accept the task?", yes: "Yes, Accept" };
  if (status === "rejected" && actionLabel === "cancel") return { title: "Cancel Task", message: "Do you want to cancel the task?", yes: "Yes, Cancel" };
  if (status === "rejected") return { title: "Reject Task", message: "Do you want to reject the task?", yes: "Yes, Reject" };
  if (status === "in_progress") return { title: "Start Task", message: "Ask customer to share 4 digit PIN to start.", yes: "Start" };
  if (status === "completed") return { title: "Finish Task", message: "Ask customer to share 4 digit PIN to finish.", yes: "Finish" };
  return { title: "Complete Task", message: "Do you want to complete the task?", yes: "Yes, Complete" };
}

function assistantTaskConfirmModal() {
  if (!state.assistantTaskConfirm) return "";
  const copy = assistantTaskConfirmCopy(state.assistantTaskConfirm.status, state.assistantTaskConfirm.actionLabel);
  const needsPin = ["in_progress", "completed"].includes(String(state.assistantTaskConfirm.status || ""));
  const error = state.assistantTaskConfirm.error ? `<div class="assistant-confirm-error">${escapeHtml(state.assistantTaskConfirm.error)}</div>` : "";
  const confirmKey = `${state.assistantTaskConfirm.assignmentId || ""}:${state.assistantTaskConfirm.status || ""}:${state.assistantTaskConfirm.actionLabel || ""}:${state.assistantTaskConfirm.error || ""}`;
  return `<div class="assistant-confirm-backdrop" data-confirm-key="${escapeHtml(confirmKey)}" role="dialog" aria-modal="true">
    <div class="assistant-confirm-card">
      <p>Task Confirmation</p>
      <h2>${escapeHtml(copy.title)}</h2>
      <span>${escapeHtml(copy.message)}</span>
      ${needsPin ? `<label class="sr-only" for="assistantTaskPinInput">4 digit PIN</label><input id="assistantTaskPinInput" name="assistantTaskPin" class="assistant-confirm-pin" data-assistant-task-pin-input type="tel" inputmode="numeric" maxlength="4" pattern="\\d{4}" placeholder="4 digit PIN" autocomplete="one-time-code" aria-label="4 digit PIN" autofocus />${error}` : error}
      <div class="assistant-confirm-actions">
        <button class="soft-btn" data-close-assistant-confirm type="button">No</button>
        <button class="${state.assistantTaskConfirm.status === "rejected" ? "danger-btn" : "primary-btn"}" data-confirm-assistant-task type="button">${escapeHtml(copy.yes)}</button>
      </div>
    </div>
  </div>`;
}

function focusAssistantTaskPinInput() {
  requestAnimationFrame(() => {
    const input = root.querySelector("[data-assistant-task-pin-input]");
    if (!input) return;
    input.focus?.({ preventScroll: true });
    const length = String(input.value || "").length;
    input.setSelectionRange?.(length, length);
  });
}

function assistantTaskRows(tasks = assistantFilteredTasks()) {
  if (state.assistantTaskTab === "working") return assistantWorkingChatRows(tasks);
  if (!tasks.length) return assistantNoRecordState();
  return tasks.map((task) => {
    const startAt = assistantTaskStartAt(task);
    const createdAt = task.createdAt ? new Date(task.createdAt) : null;
    const locations = Array.isArray(task.locations) ? task.locations : [];
    const isPendingTask = assistantTaskTabFor(task) === "accepted";
    return `<article class="task-card task-app-card" data-open-task-chat="${assistantTaskOpenId(task)}">
      <div class="task-app-head">
        <div class="task-app-id">
          <span>Booking ID</span>
          <b>${escapeHtml(customerVisibleBookingId(task))}</b>
        </div>
        ${assistantTaskStatusLabel(task)}
      </div>

      <div class="task-app-time ${isPendingTask ? "pending-timer" : ""}">
        ${assistantTaskCountdown(task)}
        <div>
          <span>Start</span>
          <b>${escapeHtml(formatPortalDateOnly(startAt))} - ${escapeHtml(formatPortalTimeOnly(startAt))}</b>
        </div>
      </div>

      <div class="task-app-chips">
        <span>${escapeHtml(taskBookingTypeLabel(task))}</span>
        <span>Booked ${escapeHtml(formatPortalDateTime(createdAt))}</span>
        <span>${Number(task.durationMinutes || 0) || 30} mins</span>
        <span>${money(Number(task.estimatedAmountPaise || 0) / 100)}</span>
      </div>

      <div class="task-app-grid">
        <section class="task-app-section">
          <div class="task-section-title">Service</div>
          ${taskServiceRows(task)}
        </section>
        <section class="task-app-section">
          <div class="task-section-title">Customer</div>
          ${taskCustomerLine(task)}
        </section>
      </div>

      <section class="task-app-section">
        <div class="task-section-title">Locations <span>${locations.length}</span></div>
        ${taskLocationSummary(task)}
        <p class="task-address-line">${escapeHtml(locations[0]?.address || "-")}</p>
      </section>

      <div class="task-app-grid">
        <section class="task-app-section">
          <div class="task-section-title">Uploads</div>
          ${taskUploadThumbs(task)}
        </section>
        <section class="task-app-section">
          <div class="task-section-title">Note</div>
          <p class="task-note-text">${escapeHtml(task.notes || task.metadata?.notes || "-")}</p>
        </section>
      </div>

      <section class="task-app-section task-app-geo">
        ${taskGeoLine(task)}
      </section>

      ${assistantTaskUpdatePanel(task)}
      ${assistantTaskReason(task)}
      <div class="task-record-actions">${assistantTaskActions(task)}</div>
    </article>`;
  }).join("");
}

async function loadMe({ forceRefresh = false } = {}) {
  try {
    const meUrl = `/portal/${actor}/me`;
    const mePayload = await portalCachedGet(meUrl, { cacheKey: meUrl, forceRefresh });
    state.user = mePayload.data.user;
    state.customerId = actor === "customer" ? String(mePayload.data.customerId || state.customerId || "") : "";
    if (actor === "assistant") {
      try {
        const tasksUrl = "/portal/assistant/tasks";
        const tasks = await portalCachedGet(tasksUrl, { cacheKey: tasksUrl, forceRefresh });
        state.tasks = tasks.data || [];
        rebuildAssistantTaskTabIndex();
      } catch (taskError) {
        if (Number(taskError.status) === 401) throw taskError;
        state.tasks = [];
        rebuildAssistantTaskTabIndex();
      }
      startAssistantRealtime();
      writePortalSessionCache();
    } else {
      const configUrl = "/portal/config";
      try {
        const configPayload = await portalCachedGet(configUrl, { cacheKey: configUrl, forceRefresh });
        state.portalConfig = configPayload.data || null;
      } catch (configError) {
        if (Number(configError.status) === 401) throw configError;
        state.portalConfig = state.portalConfig || null;
      }
      state.favorites = normalizeFavorites(mePayload.data.favorites || state.favorites);
      state.cart = normalizeCustomerCartItems(mePayload.data.cart?.cartItems || mePayload.data.cartItems || state.cart);
      state.customerCartNote = String(mePayload.data.cart?.customerNote ?? mePayload.data.customerNote ?? state.customerCartNote ?? "");
      const bookingsUrl = `/portal/customer/bookings?tab=${encodeURIComponent(state.customerBookingsTab || "all")}&page=1&pageSize=${encodeURIComponent(state.customerBookingsPageSize || 10)}`;
      const addressesUrl = "/portal/customer/addresses";
      const previousLocationsUrl = "/portal/customer/previous-used-locations";
      const defaultLocationUrl = "/portal/customer/default-location";
      const [bookingsPayload, addresses, previousLocations, defaultLocation] = await Promise.all([
        portalCachedGet(bookingsUrl, { cacheKey: bookingsUrl, forceRefresh }),
        portalCachedGet(addressesUrl, { cacheKey: addressesUrl, forceRefresh }).catch(() => ({ data: [] })),
        api(previousLocationsUrl).catch(() => ({ data: [] })),
        api(defaultLocationUrl).catch(() => ({ data: null }))
      ]);
      state.bookings = Array.isArray(bookingsPayload?.data) ? bookingsPayload.data : state.bookings;
      state.customerAddresses = Array.isArray(addresses?.data) ? addresses.data : state.customerAddresses;
      state.customerRecentLocations = normalizeArray(previousLocations?.data)
        .map((location) => customerNormalizePersistedLocation(location))
        .filter(Boolean);
      const cachedLocationMatchesCustomer = !cachedSession.customerId || !state.customerId || String(cachedSession.customerId) === String(state.customerId);
      const sessionLocation = cachedLocationMatchesCustomer
        ? customerNormalizePersistedLocation(cachedSession.selectedLocation || cachedSession.locationPicked || null)
        : null;
      const restoredLocation = customerHydratePreferredLocation({
        addresses: state.customerAddresses,
        recentLocations: state.customerRecentLocations,
        defaultLocation: defaultLocation?.data || null,
        sessionLocation
      });
      if (state.customerView === "home") state.customerLocationPickerSheetOpen = !Boolean(restoredLocation);
      const clusterId = selectedCustomerClusterId();
      const catalogUrl = customerCatalogUrl({ clusterId });
      const catalog = await portalCachedGet(catalogUrl, {
        cacheKey: customerCatalogCacheKey(catalogUrl),
        forceRefresh,
        maxAgeMs: customerCatalogCacheMaxAgeMs
      }).catch(() => ({ data: fallbackCatalog() }));
      state.catalog = normalizeCustomerCatalog(catalog.data || fallbackCatalog());
      rememberCustomerPersonalAssistantCatalog(state.catalog, clusterId);
      startCustomerRealtime();
      writePortalSessionCache();
    }
    return true;
  } catch (error) {
    if (Number(error.status) === 401 || (Number(error.status) === 403 && String(error.message || "").toLowerCase().includes("token"))) {
      clearPortalSession();
      return false;
    }
    notify(error.message || "Unable to refresh session.");
    return false;
  }
}

function renderSessionRestoring() {
  root.innerHTML = `<section class="assistant-app">
    <div class="assistant-card assistant-session-card">
      <img src="${assetUrl("/assets/zigo-logo-new.png")}" alt="ZIGO">
      <h1>Restoring ${actor === "assistant" ? "Assistant" : "Customer"}</h1>
      <p class="muted">Loading your ${actor === "assistant" ? "tasks" : "bookings"} and session.</p>
    </div>
  </section>`;
}

function renderConnectionLostPage() {
  root.innerHTML = `<section class="mobile-app connection-lost-screen" role="status" aria-live="polite">
    <div class="connection-lost-content">
      <div class="connection-lost-illustration" aria-hidden="true">
        <img src="${assetUrl("/assets/connection-lost.png")}" alt="">
      </div>
      <h1>No internet connection</h1>
      <p>Please check your network</p>
      <button class="connection-lost-retry" data-connection-retry type="button">Try again</button>
    </div>
  </section>`;
}

async function restoreAfterConnection() {
  state.connectionLost = false;
  if (state.token) {
    await loadMe({ forceRefresh: true }).catch(() => false);
  } else if (actor === "customer") {
    await loadCustomerLoginCategories({ forceRefresh: true }).catch(() => []);
  }
  render();
}

function removeCustomerRippleArtifacts() {
  root.querySelectorAll(".ripple-wave, .ripple-wave-inset, .ripple-wave-out, .touch-ripple").forEach((node) => node.remove());
}

function render() {
  const preserveCustomerScroll = actor === "customer" && Boolean(state.token) && state.customerView !== "location";
  const customerScrollState = preserveCustomerScroll ? customerScrollSnapshot() : null;
  removeCustomerRippleArtifacts();
  if (state.connectionLost || navigator.onLine === false) {
    state.connectionLost = true;
    renderConnectionLostPage();
    return;
  }
  if (!state.splashDone && actor === "customer") {
    renderSplash();
    removeCustomerRippleArtifacts();
    if (customerScrollState) restoreCustomerScroll(customerScrollState);
    return;
  }
  if (state.sessionRestoring) {
    renderSessionRestoring();
    removeCustomerRippleArtifacts();
    if (customerScrollState) restoreCustomerScroll(customerScrollState);
    return;
  }
  if (!state.token) {
    actor === "customer" ? renderCustomerLogin() : renderAssistantLogin();
    removeCustomerRippleArtifacts();
    if (customerScrollState) restoreCustomerScroll(customerScrollState);
    return;
  }
  const isConfirmingPickedLocation = actor === "customer" && state.customerView === "location" && state.locationStep === "confirm" && state.locationPicked;
  if (actor === "customer" && !state.selectedLocation && !state.customerLocationPickerSheetOpen && !isConfirmingPickedLocation && !state.customerLocationPermissionRequesting) {
    state.customerView = "home";
    state.customerLocationPickerSheetOpen = true;
    renderCustomer();
    removeCustomerRippleArtifacts();
    if (customerScrollState) restoreCustomerScroll(customerScrollState);
    return;
  }
  actor === "customer" ? renderCustomer() : renderAssistantHome();
  if (actor === "assistant") syncAssistantTaskConfirmOverlay();
  root.insertAdjacentHTML("beforeend", portalLogoutConfirmHtml());
  removeCustomerRippleArtifacts();
  if (customerScrollState) restoreCustomerScroll(customerScrollState);
}

function customerScrollableElement() {
  return document.querySelector(".portal-customer .customer-bookings-page")
    || document.querySelector(".portal-customer .customer-service-screen")
    || document.querySelector(".portal-customer .zigo-commerce-home")
    || document.querySelector(".portal-customer .mobile-app");
}

function customerScrollSnapshot() {
  const scrollEl = customerScrollableElement();
  return {
    windowX: window.scrollX || 0,
    windowY: window.scrollY || 0,
    elementClass: scrollEl?.classList?.contains("customer-service-screen")
      ? "customer-service-screen"
      : scrollEl?.classList?.contains("customer-bookings-page")
        ? "customer-bookings-page"
        : scrollEl?.classList?.contains("zigo-commerce-home")
          ? "zigo-commerce-home"
          : "mobile-app",
    elementTop: scrollEl ? scrollEl.scrollTop : 0,
    elementLeft: scrollEl ? scrollEl.scrollLeft : 0
  };
}

function restoreCustomerScroll(snapshot) {
  if (!snapshot || actor !== "customer") return;
  const restore = () => {
    const scrollEl = document.querySelector(`.portal-customer .${snapshot.elementClass}`);
    if (scrollEl) {
      scrollEl.scrollTop = snapshot.elementTop || 0;
      scrollEl.scrollLeft = snapshot.elementLeft || 0;
    }
    window.scrollTo(snapshot.windowX || 0, snapshot.windowY || 0);
  };
  requestAnimationFrame(() => {
    restore();
    setTimeout(restore, 0);
    setTimeout(restore, 80);
    setTimeout(restore, 220);
  });
}

async function keepCustomerScroll(callback) {
  const snapshot = customerScrollSnapshot();
  try {
    return await callback();
  } finally {
    restoreCustomerScroll(snapshot);
  }
}

async function initPortal() {
  if (state.token) {
    if (tokenIsExpired(state.token)) {
      clearPortalSession();
      render();
      return;
    }
    const hasCachedHome = actor === "assistant" ? true : Boolean(state.user || state.tasks.length || state.bookings.length);
    state.sessionRestoring = !hasCachedHome && actor !== "assistant";
    render();
    const isValid = await loadMe();
    state.sessionRestoring = false;
    if (!isValid) {
      render();
      return;
    }
    render();
    return;
  }
  render();
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form || !["customerLoginForm", "assistantLoginForm", "assistantPasswordLoginForm", "assistantPasswordResetForm"].includes(form.id)) return;
  const data = Object.fromEntries(new FormData(form));
  if (form.id === "assistantPasswordLoginForm") {
    try {
      state.assistantResetIdentifier = String(data.identifier || "").trim();
      state.loginBusy = true;
      renderAssistantLogin();
      const payload = await api("/portal/assistant/password/login", {
        method: "POST",
        body: JSON.stringify({ identifier: data.identifier, password: data.password })
      });
      state.token = payload.data.token;
      state.loginBusy = false;
      localStorage.setItem(tokenKey, state.token);
      await loadMe({ forceRefresh: true });
      notify("Logged in.");
      render();
    } catch (error) {
      state.loginBusy = false;
      renderAssistantLogin();
      notify(error.message);
    }
    return;
  }
  if (form.id === "assistantPasswordResetForm") {
    const action = event.submitter?.value || String(data.action || "") || (state.assistantResetCodeSent ? "verify" : "send");
    const email = String(data.email || "").trim().toLowerCase();
    const identifier = String(data.identifier || "").trim();
    try {
      state.loginBusy = true;
      state.assistantResetEmail = email;
      state.assistantResetIdentifier = identifier;
      renderAssistantLogin();
      if (action === "send") {
        await api("/portal/assistant/password-reset/send", { method: "POST", body: JSON.stringify({ email, identifier }) });
        state.assistantResetCodeSent = true;
        state.loginBusy = false;
        notify("Verification code sent to email.");
        renderAssistantLogin();
        setTimeout(() => root.querySelector("[name='code']")?.focus(), 0);
        return;
      }
      const payload = await api("/portal/assistant/password-reset/verify", {
        method: "POST",
        body: JSON.stringify({ email, identifier, code: data.code, password: data.password })
      });
      state.token = payload.data.token;
      state.assistantResetOpen = false;
      state.assistantResetCodeSent = false;
      state.assistantResetEmail = "";
      state.assistantResetIdentifier = "";
      state.loginBusy = false;
      localStorage.setItem(tokenKey, state.token);
      await loadMe({ forceRefresh: true });
      notify("Password set. Logged in.");
      render();
    } catch (error) {
      state.loginBusy = false;
      renderAssistantLogin();
      notify(error.message);
    }
    return;
  }
  const phone = String(data.phone || "").replace(/\D/g, "").slice(-10);
  const action = event.submitter?.dataset?.loginAction || event.submitter?.value || String(data.action || "") || (state.codeSent ? "verify" : "send");
  try {
    state.loginBusy = true;
    if (actor === "customer") {
      state.loginPhone = phone;
      renderCustomerLogin();
    }
    if (action === "send") {
      if (actor === "customer" && state.codeSent && customerOtpResendRemainingMs() > 0) {
        state.loginBusy = false;
        renderCustomerLogin();
        return;
      }
      if (actor === "customer" && phone.length !== 10) throw new Error("Enter valid 10 digit mobile number.");
      notify("Sending verification code...");
      await api(`/portal/${actor}/code/send`, { method: "POST", body: JSON.stringify({ phone: phone || data.phone }) });
      if (actor === "customer") {
        state.loginPhone = phone;
        state.codeSent = true;
        state.otpResendAvailableAt = Date.now() + (2 * 60 * 1000);
        state.loginBusy = false;
        renderCustomerLogin();
        setTimeout(() => root.querySelector("[name='code']")?.focus(), 0);
      }
      state.loginBusy = false;
      notify("Verification code sent by SMS.");
      return;
    }
    const otpCode = String(data.code || "").replace(/\D/g, "").slice(0, 6);
    if (otpCode.length !== 6) throw new Error("Enter 6 digit verification code.");
    notify("Verifying code...");
    const payload = await api(`/portal/${actor}/code/verify`, { method: "POST", body: JSON.stringify({ phone: phone || data.phone, code: otpCode }) });
    state.token = payload.data.token;
    state.codeSent = false;
    state.loginPhone = "";
    state.otpResendAvailableAt = 0;
    stopCustomerOtpResendTimer();
    state.loginBusy = false;
    if (actor === "customer") {
      state.customerView = "home";
      state.locationStep = "permission";
      state.customerLocationPickerPurpose = "";
      state.locationConfirmReturnStep = "manual";
    }
    localStorage.setItem(tokenKey, state.token);
    await loadMe({ forceRefresh: true });
    render();
  } catch (error) {
    state.loginBusy = false;
    if (actor === "customer") renderCustomerLogin();
    notify(error.message);
  }
}

async function addCustomerTimeSlotToCart(slot = {}, shouldRender = true) {
  const service = customerServiceById(slot.serviceId) || selectedService();
  if (!service) return;
  if (!customerCartCanAddService(service.id || "")) {
    customerRequestCartReplace({ type: "category", categoryId: slot.id, serviceId: service.id || "", serviceName: service.name || "" });
    return;
  }
  const price = numberValue(slot.sellingPrice || slot.price, 0);
  if (price <= 0) {
    showCustomerCartNotice("Price is not configured for this duration.", "warning");
    if (!shouldRender) refreshCustomerCartUiOnly();
    return;
  }
  const item = {
    categoryId: slot.id,
    sourceCategoryId: slot.categoryId || null,
    ruleId: slot.ruleId || null,
    serviceId: service.id || null,
    bookingType: customerHomeDurationBookingType(slot),
    name: personalAssistantDurationLabel(slot),
    serviceName: service.name || "Service",
    categoryName: slot.categoryName || "Time service",
    price,
    basePrice: numberValue(slot.basePrice, 0),
    durationMinutes: categoryDurationMinutes(slot, 30),
    itemType: "time",
    priceType: "time"
  };
  await setCustomerReviewBookingItem(item);
  if (shouldRender) render();
  else refreshCustomerCartUiOnly();
}

async function addCategoryToCart(categoryId, shouldRender = true, pricingOverride = null) {
  const service = customerServices().find((item) => item.id === state.selectedServiceId) || selectedService();
  const timeSlotServiceIds = [
    service?.id,
    state.selectedServiceId,
    selectedService()?.id,
    customerPersonalAssistantService()?.id,
    ...customerServices().map((item) => item.id)
  ].filter(Boolean);
  const timeSlot = [...new Set(timeSlotServiceIds)]
    .flatMap((serviceId) => customerTimeSlotItems(serviceId))
    .concat(customerPersonalAssistantTimeSlotItems(customerPersonalAssistantService()?.id))
    .find((item) => String(item.id || "") === String(categoryId || ""));
  if (timeSlot) {
    await addCustomerTimeSlotToCart(timeSlot, shouldRender);
    return;
  }
  const category = activeCatalog().categories.find((item) => item.id === categoryId)
    || customerHomeCategoryById(categoryId)
    || customerPersonalAssistantCategories().find((item) => String(item.id || "") === String(categoryId || ""))
    || (service && categoryId === `${service.id}-item`
      ? customerServiceOnlyCategory(service)
      : null);
  if (!category) return;
  const itemService = customerServices().find((item) => String(item.id || "") === categoryServiceId(category))
    || (isPersonalAssistantService(service) ? service : customerPersonalAssistantService())
    || service;
  if (categoryHasDrilldown(category, itemService?.id || service?.id || "")) {
    state.selectedCategoryId = category.id;
    state.selectedServiceId = itemService?.id || service?.id || state.selectedServiceId;
    state.customerCatalogTab = "stores";
    await loadCustomerCatalog({ serviceId: state.selectedServiceId, categoryId: state.selectedCategoryId });
    render();
    return;
  }
  const isDurationSlotAdd = pricingOverride?.source === "category-price";
  const pricing = isDurationSlotAdd
    ? {
        base: numberValue(pricingOverride.basePrice, 0),
        selling: numberValue(pricingOverride.sellingPrice ?? pricingOverride.price, 0),
        durationMinutes: numberValue(pricingOverride.durationMinutes, categoryDurationMinutes(category)),
        allottedTime: pricingOverride.allottedTime || { enabled: true, durationMinutes: numberValue(pricingOverride.durationMinutes, categoryDurationMinutes(category)) },
        waitingCharge: pricingOverride.waitingCharge || { enabled: false, amount: 0, chargePerMinutes: 0 }
      }
    : customerCategoryPricing(category);
  const price = pricing.selling;
  if (price <= 0) {
    showCustomerCartNotice("Price is not configured for this category.", "warning");
    if (!shouldRender) refreshCustomerCartUiOnly();
    return;
  }
  const item = {
    categoryId: category.id,
    categoryName: category.name,
    serviceId: itemService?.id || null,
    bookingType: pricingOverride?.bookingType || pricingOverride?.serviceMasterBookingType || customerHomeDurationBookingType(pricingOverride || {}),
    name: category.name,
    serviceName: itemService?.name || "Service",
    imageUrl: category.imageUrl || "",
    categoryImageUrl: category.imageUrl || "",
    serviceImageUrl: itemService?.imageUrl || "",
    price,
    basePrice: pricing.base || price,
    saveAmount: Math.max(0, numberValue(pricing.base, 0) - numberValue(price, 0)),
    durationMinutes: pricing.durationMinutes || categoryDurationMinutes(category),
    allottedTime: pricing.allottedTime || { enabled: false, durationMinutes: 0 },
    waitingCharge: pricing.waitingCharge || { enabled: false, amount: 0, chargePerMinutes: 0 },
    categoryPriceRuleId: pricingOverride?.categoryPriceRuleId || null,
    durationLabel: pricingOverride?.label || "",
    itemType: "category"
  };
  await setCustomerReviewBookingItem(item);
  if (shouldRender) render();
  else refreshCustomerCartUiOnly();
}

async function addStoreToCart(storeId, categoryId, shouldRender = true) {
  const store = activeCatalog().stores.find((item) => String(item.id) === String(storeId));
  const service = customerServices().find((item) => item.id === state.selectedServiceId) || selectedService();
  const category = activeCatalog().categories.find((item) => String(item.id) === String(categoryId))
    || serviceCategories(service?.id).find((item) => serviceStores(service?.id, item.id).some((storeItem) => String(storeItem.id) === String(storeId)));
  if (!store || !service) return;
  if (!customerStoreIsOnline(store)) {
    showCustomerCartNotice("Store is offline as per working schedule.", "warning");
    if (!shouldRender) refreshCustomerCartUiOnly();
    return;
  }
  const itemService = customerServices().find((item) => String(item.id || "") === categoryServiceId(category || {})) || service;
  if (!customerCartCanAddService(itemService?.id || "")) {
    customerRequestCartReplace({ type: "store", storeId, categoryId: category?.id || categoryId || "", serviceId: itemService?.id || "", serviceName: itemService?.name || "" });
    return;
  }
  if (state.cart.some((item) => String(item.storeId || "") === String(store.id || ""))) {
    showCustomerCartNotice("This store/item is already selected for booking.", "warning");
    if (!shouldRender) refreshCustomerCartUiOnly();
    return;
  }
  const existingCategoryStores = customerCartStoreCountForCategory(category?.id || "");
  const maxStores = customerCategoryMaxStoresLimit(category || {}, itemService?.id || service.id);
  if (maxStores > 0 && existingCategoryStores >= maxStores) {
    showCustomerCartNotice(`Store limit is exceed, only ${maxStores} is allowed for ${category?.name || "this category"}`, "warning");
    if (!shouldRender) refreshCustomerCartUiOnly();
    return;
  }
  const existingServiceStores = customerCartStoreCountForService(itemService?.id || service.id);
  const maxTotalStores = customerServiceMaxStoresLimit(category || {}, itemService?.id || service.id, store.id);
  if (maxTotalStores > 0 && existingServiceStores >= maxTotalStores) {
    showCustomerCartNotice(`Store limit is exceed, only ${maxTotalStores} is allowed for ${category?.name || "this category"}`, "warning");
    if (!shouldRender) refreshCustomerCartUiOnly();
    return;
  }
  const pricing = customerStorePricingForPosition(store, category, existingCategoryStores + 1);
  if (pricing.error) {
    showCustomerCartNotice(pricing.error, "warning");
    if (!shouldRender) refreshCustomerCartUiOnly();
    return;
  }
  if (Number(pricing.selling || 0) <= 0) {
    showCustomerCartNotice("Price is not configured for this store/item.", "warning");
    if (!shouldRender) refreshCustomerCartUiOnly();
    return;
  }
  const item = {
    storeId: store.id,
    storeName: store.name,
    categoryId: category?.id || null,
    serviceId: itemService?.id || service.id,
    name: store.name,
    serviceName: itemService?.name || service.name,
    categoryName: category?.name || "Store / Item",
    imageUrl: store.primaryImageUrl || store.imageUrl || category?.imageUrl || "",
    storeImageUrl: store.primaryImageUrl || store.imageUrl || "",
    categoryImageUrl: category?.imageUrl || "",
    serviceImageUrl: itemService?.imageUrl || service.imageUrl || "",
    price: pricing.selling || categoryPrice(category || {}),
    durationMinutes: pricing.durationMinutes || categoryDurationMinutes(category || {}),
    cartDurationMinutes: pricing.cartDurationMinutes ?? pricing.durationMinutes ?? categoryDurationMinutes(category || {}),
    basePrice: pricing.base || 0,
    saveAmount: Math.max(0, numberValue(pricing.base, 0) - numberValue(pricing.selling, 0)),
    complexityMultiplier: pricing.complexityMultiplier || 0,
    complexityDurationMinutes: pricing.complexityDurationMinutes || 0,
    allottedTime: pricing.allottedTime || { enabled: false, durationMinutes: 0 },
    waitingCharge: pricing.waitingCharge || { enabled: false, amount: 0, chargePerMinutes: 0 },
    storeNumber: pricing.storeNumber || existingCategoryStores + 1,
    address: store.address || "",
    contact: store.contact || "",
    itemType: "store"
  };
  await addCustomerCartItemToServer(item);
  if (shouldRender) render();
  else refreshCustomerCartUiOnly();
}

function currentBrowserLocation() {
  const nativeLocation = () => requestNativeCurrentLocation().then((coords) => {
    state.customerLocationPermissionGranted = true;
    return coords;
  });
  const browserLocation = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location permission is not available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        state.customerLocationPermissionGranted = true;
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
      },
      (error) => {
        state.customerLocationPermissionGranted = false;
        const locationError = new Error(
          error?.code === 1
            ? "Location permission was not allowed. Allow location permission or search manually."
            : error?.code === 2
              ? "Device location is off. Enable location services and try again."
              : "Unable to read current location. Enable location services or search manually."
        );
        locationError.locationCode = error?.code || 0;
        reject(locationError);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
  const requestFromBrowser = async () => {
    if (navigator.permissions?.query) {
      try {
        const status = await navigator.permissions.query({ name: "geolocation" });
        if (status.state === "denied") {
          const denied = new Error("Location permission is blocked. Allow location access in browser or app settings, or search manually.");
          denied.locationCode = 1;
          throw denied;
        }
      } catch (error) {
        if (error?.locationCode === 1) throw error;
        // Permissions API can be unavailable or restricted in WebViews; getCurrentPosition is the source of truth.
      }
    }
    return browserLocation();
  };
  return requestFromBrowser().catch((browserError) => {
    if (browserError?.locationCode === 1) throw browserError;
    return nativeLocation().catch(() => {
      throw browserError;
    });
  });
}

async function refreshCustomerLocationPermissionState() {
  if (!navigator.permissions?.query) return state.customerLocationPermissionGranted;
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    state.customerLocationPermissionGranted = status.state === "granted";
    status.onchange = () => {
      state.customerLocationPermissionGranted = status.state === "granted";
      if (isCustomerLocationPickerSuppressed()) return;
      if (["home", "cart"].includes(state.customerView) && state.customerLocationPickerSheetOpen) syncCustomerHomeLocationPickerSheet();
    };
  } catch (error) {
    // Some WebViews do not expose permission state. The actual location call remains the source of truth.
  }
  return state.customerLocationPermissionGranted;
}

async function validateAndPickCustomerLocation(candidate = {}, options = {}) {
  const latitude = Number(candidate.latitude);
  const longitude = Number(candidate.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Selected location has invalid coordinates.");
  const serviceability = await api("/portal/customer/locations/validate", {
    method: "POST",
    body: JSON.stringify({
      address: candidate.address || candidate.addressText || candidate.label || "Picked location",
      latitude,
      longitude,
      addressId: candidate.addressId || null,
      source: candidate.source || "map"
    })
  });
  const cluster = serviceability.data?.cluster || {};
  state.locationServiceability = serviceability.data;
  state.locationPicked = {
    ...candidate,
    address: candidate.address || candidate.addressText || candidate.label || "Picked location",
    latitude,
    longitude,
    addressId: candidate.addressId || null,
    clusterId: cluster.clusterId || candidate.clusterId || "",
    clusterName: cluster.name || candidate.clusterName || "",
    cityName: cluster.cityName || candidate.cityName || "",
    zoneName: cluster.zoneName || candidate.zoneName || "",
    serviceability: serviceability.data
  };
  customerRememberLocation(state.locationPicked, {
    setPreferred: options.setPreferred !== false,
    rememberRecent: options.rememberRecent === true
  });
  state.locationMessage = serviceability.data?.isServiceable
    ? "Location verified."
    : (serviceability.data?.message || "Service not available at this location.");
  return state.locationPicked;
}

async function useCustomerCurrentLocation(options = {}) {
  const deferUiUntilPermission = options.deferUiUntilPermission === true;
  state.locationBusy = !deferUiUntilPermission;
  state.locationMessage = deferUiUntilPermission ? "" : "Finding your current location...";
  if (!deferUiUntilPermission) {
    if (["home", "cart"].includes(state.customerView) && state.customerLocationPickerSheetOpen) syncCustomerHomeLocationPickerSheet();
    else render();
  }
  try {
    const coords = await currentBrowserLocation();
    state.locationBusy = true;
    state.locationMessage = "Finding your current location...";
    const url = `/portal/customer/locations/reverse?latitude=${encodeURIComponent(coords.latitude)}&longitude=${encodeURIComponent(coords.longitude)}`;
    const reverse = await portalCachedGet(url, { cacheKey: url })
      .catch(() => ({ data: { label: "Current location", address: `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`, ...coords, source: "current" } }));
    const picked = await validateAndPickCustomerLocation({ ...reverse.data, source: "current" }, {
      rememberRecent: options.rememberRecent === true,
      setPreferred: options.setPreferred === true
    });
    state.currentDeviceLocation = {
      ...picked,
      label: customerDisplayLocationLabel(picked) || picked.label || "Current location",
      source: "current"
    };
    if (deferUiUntilPermission && ["home", "cart"].includes(state.customerView) && state.customerLocationPickerSheetOpen) updateCustomerLocationPickerPermissionUi();
    return picked;
  } finally {
    state.locationBusy = false;
  }
}

async function openCustomerCurrentLocationConfirm({ returnStep = "manual" } = {}) {
  const picked = await useCustomerCurrentLocation({ rememberRecent: false, setPreferred: false, deferUiUntilPermission: true });
  state.locationPicked = {
    ...picked,
    label: customerDisplayLocationLabel(picked) || picked.label || "Current location",
    savedAddressId: picked.savedAddressId || null,
    addressId: picked.addressId || null,
    isDefault: Boolean(picked.isDefault)
  };
  state.customerLocationPickerSheetOpen = false;
  state.customerLocationPickerClosing = false;
  state.customerLocationPermissionPopupOpen = false;
  state.customerView = "location";
  state.locationStep = "confirm";
  state.locationConfirmReturnStep = returnStep;
  state.locationBusy = false;
  hydrateConfirmLocationSaveAsState(state.locationPicked);
  renderCustomerLocation();
  return state.locationPicked;
}

async function customerSelectLocationFromHomeSheet(picked = {}, { rememberRecent = true } = {}) {
  const cluster = customerLocationCluster(picked || {});
  if (!picked || !cluster.clusterId) throw new Error(state.locationMessage || "Service not available at this location.");
  state.selectedLocation = {
    ...picked,
    label: customerDisplayLocationLabel(picked) || picked.label || "Selected location",
    landmark: picked.landmark || "",
    personName: picked.personName || picked.metadata?.personName || state.user?.displayName || "",
    contactNumber: picked.contactNumber || picked.metadata?.contactNumber || state.user?.phone || "",
    savedAddressId: picked.savedAddressId || picked.addressId || null,
    clusterId: cluster.clusterId,
    clusterName: cluster.name,
    cityName: cluster.cityName,
    zoneName: cluster.zoneName
  };
  customerRememberLocation(state.selectedLocation, {
    setPreferred: true,
    rememberRecent
  });
  if (rememberRecent && state.selectedLocation.source !== "saved") {
    const previous = await customerSavePreviousUsedLocation(state.selectedLocation);
    if (previous?.addressId) state.selectedLocation.addressId = previous.addressId;
  }
  const selectedAddressId = state.selectedLocation.savedAddressId || state.selectedLocation.addressId || "";
  if (selectedAddressId) {
    await customerSetDefaultLocationAddress(selectedAddressId);
    state.customerAddresses = state.customerAddresses.map((item) => ({
      ...item,
      isDefault: String(item.addressId || "") === String(selectedAddressId || "")
    }));
    state.customerRecentLocations = state.customerRecentLocations.map((item) => ({
      ...item,
      isDefault: String(item.addressId || "") === String(selectedAddressId || "")
    }));
    state.selectedLocation.isDefault = true;
  }
  state.locationPicked = state.selectedLocation;
  state.customerRoutePrimaryStop = null;
  state.customerRoutePrimaryCleared = false;
  state.customerCartRouteEditIndex = -1;
  state.customerCartRouteDeleteIndex = -1;
  state.customerLocationPickerSheetOpen = false;
  state.customerView = "home";
  state.locationStep = "permission";
  state.locationBusy = false;
  await loadCustomerCatalog({ clusterId: cluster.clusterId });
  writePortalSessionCache();
  return state.selectedLocation;
}

function customerStagePickedLocationForHome(picked = {}) {
  if (state.customerLocationPickerPurpose === "cart-stop") return null;
  const cluster = customerLocationCluster(picked || {});
  if (!picked || !cluster.clusterId) return null;
  const selected = {
    ...picked,
    label: customerDisplayLocationLabel(picked) || picked.label || "Selected location",
    landmark: picked.landmark || picked.metadata?.landmark || "",
    personName: picked.personName || picked.metadata?.personName || state.user?.displayName || "",
    contactNumber: picked.contactNumber || picked.metadata?.contactNumber || state.user?.phone || "",
    savedAddressId: picked.savedAddressId || picked.addressId || null,
    addressId: picked.addressId || picked.savedAddressId || null,
    clusterId: cluster.clusterId,
    clusterName: cluster.name,
    cityName: cluster.cityName,
    zoneName: cluster.zoneName
  };
  state.selectedLocation = selected;
  state.locationPicked = selected;
  state.locationServiceability = picked.serviceability || state.locationServiceability;
  customerRememberLocation(selected, { setPreferred: true, rememberRecent: false });
  writePortalSessionCache();
  return selected;
}

async function searchCustomerLocations(query) {
  const text = String(query || "").trim();
  if (text.length < 1) throw new Error("Enter location to search.");
  state.locationBusy = true;
  state.locationSearchQuery = text;
  state.locationMessage = "Searching locations...";
  if (["home", "cart"].includes(state.customerView) && state.customerLocationPickerSheetOpen) updateCustomerHomeLocationPickerSearch({ focusSearch: true });
  else render();
  try {
    const url = `/portal/customer/locations/search?q=${encodeURIComponent(text)}`;
    const results = await portalCachedGet(url, { cacheKey: url });
    state.locationResults = results.data || [];
    state.locationMessage = state.locationResults.length ? "Choose one searched location." : "No matching locations found.";
    state.locationStep = "manual";
  } finally {
    state.locationBusy = false;
  }
}

async function openCustomerSearchLocationConfirm(indexOrButton, event = null) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  event?.stopImmediatePropagation?.();
  const button = indexOrButton?.dataset ? indexOrButton : null;
  if (button?.dataset.locationOpening === "true") return false;
  const index = Number(button ? button.dataset.locationResult : indexOrButton);
  const candidate = state.locationResults[index];
  if (!candidate) return false;
  if (button) button.dataset.locationOpening = "true";
  try {
    state.locationBusy = true;
    state.locationMessage = "Checking serviceability...";
    const picked = await validateAndPickCustomerLocation({ ...candidate, source: candidate.source || "search" });
    state.locationPicked = customerStagePickedLocationForHome(picked) || picked;
    state.customerLocationPickerSheetOpen = false;
    state.customerView = "location";
    state.locationStep = "confirm";
    state.locationConfirmReturnStep = state.customerLocationPickerPurpose === "cart-stop" ? "cart-stop" : "picker";
    hydrateConfirmLocationSaveAsState(picked);
    state.locationBusy = false;
    renderCustomerLocation();
  } catch (error) {
    state.locationBusy = false;
    state.customerView = state.customerLocationPickerPurpose === "cart-stop" ? "cart" : "home";
    state.customerLocationPickerSheetOpen = true;
    state.locationStep = "manual";
    state.locationMessage = error.message || "Unable to validate location.";
    syncCustomerHomeLocationPickerSheet({ focusSearch: true });
  } finally {
    if (button) button.dataset.locationOpening = "false";
  }
  return false;
}

window.zigoCustomerOpenSearchLocation = openCustomerSearchLocationConfirm;

function backFromCustomerConfirmLocation() {
  state.locationBusy = false;
  state.locationMessage = "";
  state.locationSaveAsMessage = "";
  const returnStep = String(state.locationConfirmReturnStep || "manual");
  if (returnStep === "cart-stop") {
    state.customerView = "cart";
    state.customerLocationPickerPurpose = "cart-stop";
    state.customerLocationPickerSheetOpen = true;
    state.customerLocationPickerClosing = false;
    state.locationStep = "manual";
    renderCart();
    setTimeout(focusLocationSearchInput, 80);
    return;
  }
  if (returnStep === "home") {
    state.customerView = "home";
    state.customerLocationPickerSheetOpen = false;
    state.customerLocationPickerClosing = false;
    state.locationStep = "permission";
    render();
    return;
  }
  if (returnStep === "savedLocations") {
    state.customerView = "savedLocations";
    state.customerLocationPickerSheetOpen = false;
    state.customerLocationPickerClosing = false;
    state.locationStep = "permission";
    renderCustomerSavedLocations();
    return;
  }
  if (returnStep === "picker") {
    state.customerView = "home";
    state.customerLocationPickerSheetOpen = true;
    state.customerLocationPickerClosing = false;
    state.locationStep = "manual";
    render();
    setTimeout(focusLocationSearchInput, 80);
    return;
  }
  state.customerView = "home";
  state.customerLocationPickerSheetOpen = true;
  state.customerLocationPickerClosing = false;
  state.locationStep = returnStep === "permission" || returnStep === "options" ? "permission" : "manual";
  if (customerHomeLocationPickerHost()) syncCustomerHomeLocationPickerSheet({ focusSearch: state.locationStep === "manual" });
  else render();
  if (state.locationStep === "manual") setTimeout(focusLocationSearchInput, 80);
}

function focusLocationSearchInput() {
  const input = root.querySelector("[data-location-search-input]");
  if (!(input instanceof HTMLInputElement)) return;
  input.focus();
  const end = input.value.length;
  input.setSelectionRange(end, end);
}

function scheduleCustomerLocationAutocomplete(query) {
  const text = String(query || "").trim();
  state.locationSearchQuery = query;
  if (locationSearchTimer) clearTimeout(locationSearchTimer);
  if (text.length < 1) {
    state.locationResults = [];
    state.locationBusy = false;
    state.locationMessage = "";
    if (["home", "cart"].includes(state.customerView) && state.customerLocationPickerSheetOpen) updateCustomerHomeLocationPickerSearch({ focusSearch: true });
    else {
      render();
      focusLocationSearchInput();
    }
    return;
  }
  const requestId = ++locationSearchRequestId;
  state.locationBusy = true;
  state.locationMessage = "Searching locations...";
  if (["home", "cart"].includes(state.customerView) && state.customerLocationPickerSheetOpen) updateCustomerHomeLocationPickerSearch();
  locationSearchTimer = setTimeout(async () => {
    try {
      const url = `/portal/customer/locations/search?q=${encodeURIComponent(text)}`;
      const results = await portalCachedGet(url, { cacheKey: url });
      if (requestId !== locationSearchRequestId) return;
      state.locationResults = results.data || [];
      state.locationMessage = state.locationResults.length ? "Choose one searched location." : "No matching locations found.";
      state.locationStep = "manual";
    } catch (error) {
      if (requestId !== locationSearchRequestId) return;
      state.locationResults = [];
      state.locationMessage = error.message || "Unable to search location.";
    } finally {
      if (requestId === locationSearchRequestId) {
        state.locationBusy = false;
        if (["home", "cart"].includes(state.customerView) && state.customerLocationPickerSheetOpen) updateCustomerHomeLocationPickerSearch({ focusSearch: true });
        else {
          render();
          focusLocationSearchInput();
        }
      }
    }
  }, 260);
}

async function adjustCustomerLocationPin(offsetLat, offsetLng) {
  const picked = state.locationPicked || state.selectedLocation;
  if (!picked) return;
  const latitude = Number(picked.latitude || 0) + Number(offsetLat || 0);
  const longitude = Number(picked.longitude || 0) + Number(offsetLng || 0);
  state.locationBusy = true;
  state.locationMessage = "Checking moved pin...";
  render();
  try {
    const url = `/portal/customer/locations/reverse?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`;
      const reverse = await portalCachedGet(url, { cacheKey: url })
      .catch(() => ({
        data: {
          label: "Moved pin",
          address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          latitude,
          longitude,
          source: "map"
        }
      }));
    await validateAndPickCustomerLocation({
      ...picked,
      ...reverse.data,
      latitude,
      longitude,
      source: "map"
    }, { rememberRecent: false, setPreferred: true });
    state.locationStep = "confirm";
  } finally {
    state.locationBusy = false;
  }
}

function startCustomerMapDrag(event) {
  const map = event.target instanceof Element ? event.target.closest("[data-location-map-preview]") : null;
  if (!map || event.target.closest("button")) return;
  const layer = map.querySelector("[data-map-pan-layer]");
  if (!layer) return;
  event.preventDefault();
  customerMapDrag = {
    map,
    layer,
    startX: event.clientX,
    startY: event.clientY,
    dx: 0,
    dy: 0
  };
  map.classList.add("is-dragging");
  if (typeof map.setPointerCapture === "function") {
    try {
      map.setPointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture is best-effort across browsers.
    }
  }
}

function startCustomerHomeCategorySheetDrag(event) {
  const dragHandle = event.target instanceof Element ? event.target.closest("[data-home-category-sheet-drag]") : null;
  if (!dragHandle || event.target.closest("button")) return false;
  const sheet = dragHandle.closest(".customer-home-category-sheet");
  if (!sheet) return false;
  event.preventDefault();
  const rect = sheet.getBoundingClientRect();
  const viewportHeight = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0, rect.height);
  customerHomeCategorySheetDrag = {
    sheet,
    startY: event.clientY,
    startHeight: rect.height,
    viewportHeight,
    dy: 0,
    expanded: state.customerHomeCategorySheetExpanded
  };
  sheet.classList.add("dragging");
  if (typeof sheet.setPointerCapture === "function") {
    try {
      sheet.setPointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture is best-effort across browsers.
    }
  }
  return true;
}

function moveCustomerHomeCategorySheetDrag(event) {
  if (!customerHomeCategorySheetDrag) return;
  event.preventDefault();
  const drag = customerHomeCategorySheetDrag;
  drag.dy = event.clientY - drag.startY;
  const collapsedHeight = Math.max(240, drag.startHeight);
  const maxHeight = drag.viewportHeight;
  let nextHeight = drag.expanded
    ? maxHeight - Math.max(0, drag.dy)
    : collapsedHeight + Math.max(0, -drag.dy);
  nextHeight = Math.max(collapsedHeight, Math.min(maxHeight, nextHeight));
  drag.sheet.style.transform = "";
  drag.sheet.style.height = `${nextHeight}px`;
  drag.sheet.style.maxHeight = `${nextHeight}px`;
}

function endCustomerHomeCategorySheetDrag(event) {
  if (!customerHomeCategorySheetDrag) return;
  const drag = customerHomeCategorySheetDrag;
  customerHomeCategorySheetDrag = null;
  drag.sheet.classList.remove("dragging");
  drag.sheet.style.transform = "";
  drag.sheet.style.height = "";
  drag.sheet.style.maxHeight = "";
  if (typeof drag.sheet.releasePointerCapture === "function" && event?.pointerId !== undefined) {
    try {
      drag.sheet.releasePointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture is best-effort across browsers.
    }
  }
  if (drag.dy < -44 && !drag.expanded) {
    state.customerHomeCategorySheetExpanded = true;
    render();
  } else if (drag.dy > 44 && drag.expanded) {
    state.customerHomeCategorySheetExpanded = false;
    render();
  }
}

function moveCustomerMapDrag(event) {
  if (!customerMapDrag) return;
  event.preventDefault();
  customerMapDrag.dx = event.clientX - customerMapDrag.startX;
  customerMapDrag.dy = event.clientY - customerMapDrag.startY;
  customerMapDrag.layer.style.transform = `translate(${customerMapDrag.dx}px, ${customerMapDrag.dy}px)`;
}

async function endCustomerMapDrag(event) {
  if (!customerMapDrag) return;
  const drag = customerMapDrag;
  customerMapDrag = null;
  drag.map.classList.remove("is-dragging");
  if (typeof drag.map.releasePointerCapture === "function" && event?.pointerId !== undefined) {
    try {
      drag.map.releasePointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture is best-effort across browsers.
    }
  }
  const distance = Math.hypot(drag.dx, drag.dy);
  if (distance < 8) {
    drag.layer.style.transform = "";
    return;
  }
  const degreesPerPixel = 0.000012;
  const latOffset = drag.dy * degreesPerPixel;
  const lngOffset = -drag.dx * degreesPerPixel;
  try {
    await adjustCustomerLocationPin(latOffset, lngOffset);
    render();
  } catch (error) {
    state.locationBusy = false;
    notify(error.message || "Unable to update map location.");
    render();
  }
}

function locationFormLabel(data) {
  const label = String(data.label || "Home");
  const customLabel = String(data.customLabel || "").trim();
  return label === "Other" ? (customLabel || "Other") : label;
}

async function completeCustomerLocationSelection(form) {
  const picked = state.locationPicked || state.selectedLocation;
  const cluster = customerLocationCluster(picked || {});
  if (!picked || !cluster.clusterId) throw new Error("Pick a serviceable location first.");
  const data = Object.fromEntries(new FormData(form));
  if (state.locationConfirmReturnStep === "cart-stop" || state.customerLocationPickerPurpose === "cart-stop") {
    const contactNumber = data.useMyMobile ? customerDisplayMobile10(state.user?.phone || "") : customerDisplayMobile10(data.contactNumber || "");
    state.locationBusy = true;
    render();
    try {
      await putCustomerCartLocationStop({
        ...picked,
        label: locationFormLabel(data) || customerCartRouteTitle(picked, "Stop"),
        address: picked.address || picked.addressText || picked.label || "",
        landmark: data.landmark || picked.landmark || "",
        personName: data.personName || picked.personName || state.user?.displayName || "",
        contactNumber,
        source: picked.source || "search"
      });
      state.customerLocationPickerSheetOpen = false;
      state.customerLocationPickerClosing = false;
      state.customerLocationPickerPurpose = "";
      state.customerView = "cart";
      state.locationStep = "permission";
      state.locationConfirmReturnStep = "manual";
      state.locationSaveAsLabel = "";
      state.locationSaveAsOtherOpen = false;
      state.locationSaveAsCustomLabel = "";
      state.locationSaveAsMessage = "";
      state.locationBusy = false;
      renderCart();
      return;
    } catch (error) {
      state.locationBusy = false;
      throw error;
    }
  }
  const saveAddressLabel = String(data.label || "").trim();
  const saveAddress = Boolean(data.saveAddress || (saveAddressLabel && (saveAddressLabel !== "Other" || String(data.customLabel || "").trim())));
  const label = saveAddress ? locationFormLabel(data) : (picked.label || "Selected location");
  const contactNumber = data.useMyMobile ? customerDisplayMobile10(state.user?.phone || "") : customerDisplayMobile10(data.contactNumber || "");
  if (saveAddress && !label) throw new Error("Enter address label name.");
  const addressId = String(picked.savedAddressId || picked.addressId || "");
  const labelOwner = saveAddress ? customerFindSavedLabelOwner(label, "") : null;
  const targetAddressId = String(labelOwner?.addressId || addressId || "");
  const shouldUpdateExistingAddress = saveAddress && Boolean(targetAddressId);
  if (saveAddress) {
    state.locationSaveAsMessage = "";
    if (!shouldUpdateExistingAddress) {
      const duplicate = customerFindDuplicateLocation(picked);
      if (duplicate) throw new Error("Location already used.");
    }
  }
  state.locationBusy = true;
  render();
  try {
    let savedAddress = null;
    if (saveAddress) {
      const payload = {
        label: data.label || "Home",
        customLabel: data.customLabel || null,
        address: picked.address,
        latitude: picked.latitude,
        longitude: picked.longitude,
        landmark: data.landmark || null,
        personName: data.personName || state.user?.displayName || null,
        contactNumber: contactNumber || null,
        source: picked.source || "map",
        isDefault: true
      };
      savedAddress = await api(shouldUpdateExistingAddress ? `/portal/customer/addresses/${encodeURIComponent(targetAddressId)}` : "/portal/customer/addresses", {
        method: shouldUpdateExistingAddress ? "PUT" : "POST",
        body: JSON.stringify({
          ...payload
        })
      });
      const addresses = await api("/portal/customer/addresses").catch(() => ({ data: state.customerAddresses })); 
      state.customerAddresses = addresses.data || [];
      clearPortalResourceCache("/portal/customer/addresses");
      await customerLoadPreviousUsedLocations({ forceRefresh: true }).catch(() => []);
    }
    state.selectedLocation = {
      ...picked,
      label,
      landmark: data.landmark || "",
      personName: data.personName || state.user?.displayName || "",
      contactNumber,
      savedAddressId: savedAddress?.data?.addressId || (customerLocationIsSavedAddress(picked) ? picked.addressId : null),
      addressId: savedAddress?.data?.addressId || (customerLocationIsSavedAddress(picked) ? picked.addressId : picked.addressId || null),
      isDefault: saveAddress ? true : Boolean(picked.isDefault),
      clusterId: cluster.clusterId,
      clusterName: cluster.name,
      cityName: cluster.cityName,
      zoneName: cluster.zoneName
    };
    state.customerRoutePrimaryStop = null;
    state.customerRoutePrimaryCleared = false;
    state.customerCartRouteEditIndex = -1;
    state.customerCartRouteDeleteIndex = -1;
    customerRememberLocation(state.selectedLocation, {
      setPreferred: true,
      rememberRecent: false
    });
    if (!saveAddress && !customerLocationIsSavedAddress(picked) && !customerLocationIsPreviousUsed(picked)) {
      await customerSavePreviousUsedLocation({ ...picked, address: picked.address || state.selectedLocation.address, source: picked.source || "search" }).catch(() => null);
    }
    if (!saveAddress && state.selectedLocation.addressId && customerLocationIsCurrentDefault(state.selectedLocation)) {
      const hiddenDefault = await customerSaveHiddenDefaultLocation(state.selectedLocation).catch(() => null);
      if (hiddenDefault?.addressId) {
        state.selectedLocation = {
          ...state.selectedLocation,
          ...customerNormalizePersistedLocation(hiddenDefault),
          savedAddressId: null,
          addressId: hiddenDefault.addressId,
          isDefault: true
        };
        state.customerAddresses = state.customerAddresses.map((item) => ({ ...item, isDefault: false }));
        state.customerRecentLocations = state.customerRecentLocations.map((item) => ({ ...item, isDefault: false }));
      }
    } else if (!saveAddress && state.selectedLocation.addressId) {
      await customerSetDefaultLocationAddress(state.selectedLocation.addressId);
      state.customerAddresses = state.customerAddresses.map((item) => ({
        ...item,
        isDefault: String(item.addressId || "") === String(state.selectedLocation.addressId || "")
      }));
      state.customerRecentLocations = state.customerRecentLocations.map((item) => ({
        ...item,
        isDefault: String(item.addressId || "") === String(state.selectedLocation.addressId || "")
      }));
      state.selectedLocation.isDefault = true;
    } else if (!saveAddress) {
      const hiddenDefault = await customerSaveHiddenDefaultLocation(state.selectedLocation).catch(() => null);
      if (hiddenDefault?.addressId) {
        state.selectedLocation = {
          ...state.selectedLocation,
          ...customerNormalizePersistedLocation(hiddenDefault),
          savedAddressId: null,
          addressId: hiddenDefault.addressId,
          isDefault: true
        };
        state.customerAddresses = state.customerAddresses.map((item) => ({ ...item, isDefault: false }));
        state.customerRecentLocations = state.customerRecentLocations.map((item) => ({ ...item, isDefault: false }));
      }
    }
    const returnToSavedLocations = state.locationConfirmReturnStep === "savedLocations";
    state.customerLocationPickerSheetOpen = false;
    state.customerView = returnToSavedLocations ? "savedLocations" : "home";
    state.locationStep = "permission";
    state.locationSaveAsLabel = "";
    state.locationSaveAsOtherOpen = false;
    state.locationSaveAsCustomLabel = "";
    state.locationSaveAsDefault = false;
    state.locationSaveAsMessage = "";
    state.locationBusy = false;
    await customerLoadPreviousUsedLocations({ forceRefresh: true }).catch(() => []);
    await loadCustomerCatalog({ clusterId: cluster.clusterId });
    writePortalSessionCache();
    if (returnToSavedLocations) renderCustomerSavedLocations();
    notify("Location selected.");
  } catch (error) {
    state.locationBusy = false;
    throw error;
  }
}

async function completeCustomerPickedLocationDirect(options = {}) {
  const picked = state.locationPicked || state.selectedLocation;
  const cluster = customerLocationCluster(picked || {});
  if (!picked || !cluster.clusterId) throw new Error("Pick a serviceable location first.");
  const label = options.label || customerDisplayLocationLabel(picked) || picked.label || "Selected location";
  const saveAsRecent = false;
  state.locationBusy = true;
  try {
    state.selectedLocation = {
      ...picked,
      label,
      landmark: "",
      personName: state.user?.displayName || "",
      contactNumber: state.user?.phone || "",
      savedAddressId: options.savedAddressId || picked.savedAddressId || picked.addressId || null,
      clusterId: cluster.clusterId,
      clusterName: cluster.name,
      cityName: cluster.cityName,
      zoneName: cluster.zoneName
    };
    state.customerRoutePrimaryStop = null;
    state.customerRoutePrimaryCleared = false;
    state.customerCartRouteEditIndex = -1;
    state.customerCartRouteDeleteIndex = -1;
    customerRememberLocation(state.selectedLocation, {
      setPreferred: true,
      rememberRecent: false
    });
    if (state.selectedLocation.savedAddressId || state.selectedLocation.addressId) {
      await customerSetDefaultLocationAddress(state.selectedLocation.savedAddressId || state.selectedLocation.addressId);
    }
    state.customerLocationPickerSheetOpen = false;
    state.customerView = "home";
    state.locationStep = "permission";
    state.locationBusy = false;
    await loadCustomerCatalog({ clusterId: cluster.clusterId });
    writePortalSessionCache();
  } catch (error) {
    state.locationBusy = false;
    throw error;
  }
}

async function customerSaveBookingLocationAsRecent(location = {}) {
  const normalized = customerNormalizePersistedLocation(location);
  if (!normalized || normalized.savedAddressId || normalized.addressId || normalized.source === "saved") return null;
  return customerSavePreviousUsedLocation({
    ...normalized,
    source: normalized.source || "booking"
  }).catch((error) => {
    if (String(error?.message || "").toLowerCase().includes("already saved")) return null;
    throw error;
  });
}

async function confirmCustomerBooking() {
  if (!state.cart.length) throw new Error("Add at least one service.");
  const selectedLocation = state.selectedLocation;
  if (!selectedLocation?.clusterId) throw new Error("Pick a serviceable location before booking.");
  const locationRequirement = customerCartLocationRequirement();
  const locationStops = customerCartLocationStopsForPayload();
  if (!locationStops.length) throw new Error("Add a start point before booking.");
  if (locationStops.length > locationRequirement.maxLocations) throw new Error(`Maximum ${locationRequirement.maxLocations} locations allowed for this service.`);
  const uniqueClusterIds = [...new Set(locationStops.map((stop) => String(stop.clusterId || "")).filter(Boolean))];
  if (uniqueClusterIds.length > 1) throw new Error("All booking locations must be in the same active cluster.");
  const primaryLocation = locationStops[0];
  ensureCustomerBookingTypeAllowed();
  const plan = customerCartBookingTypePlan();
  if (state.bookingType === "instant" && !plan.hasInstant) throw new Error("Instant booking is not enabled for selected cart services.");
  if (state.bookingType === "schedule" && !plan.hasSchedule) throw new Error("Schedule booking is not enabled for selected cart services.");
  const bookingType = customerEffectiveBookingType(state.bookingType);
  if (bookingType.mode === "instant") {
    await refreshCustomerAvailabilityDecision();
    if (!customerInstantSlaAvailable()) {
      throw new Error("Instant booking is not available right now. Please choose Schedule.");
    }
  }
  if (bookingType.mode === "schedule") {
    await refreshCustomerAvailabilityDecision();
    ensureCustomerScheduleSelection(bookingType);
    if (!customerScheduleSelectionIsValid(bookingType)) {
      state.customerScheduleSheetOpen = true;
      throw new Error("Select a future schedule slot.");
    }
  }
  const assignmentMode = bookingType.instantMode === "automate" ? "automate" : "manual";
  const scheduledAt = bookingType.mode === "schedule" ? customerScheduleDateTime(state.selectedScheduleDate, state.selectedScheduleTime) : null;
  const totals = cartTotals();
  const selectedCartItem = state.cart.find((item) => item?.categoryId && !item?.storeId) || state.cart[0];
  const selectedCategory = customerHomeCategoryById(selectedCartItem?.categoryId || "")
    || customerCategoryById(selectedCartItem?.categoryId || "")
    || {};
  const selectedServiceId = selectedCartItem?.serviceId || categoryServiceId(selectedCategory) || "";
  const selectedService = customerServiceById(selectedServiceId) || customerPersonalAssistantService() || {};
  const bookingDurationMinutes = Math.max(1, Math.round(Number(selectedCartItem?.durationMinutes || selectedCartItem?.cartDurationMinutes || totals.duration || 30)));
  const bookingSellingPrice = Math.max(0, Number(selectedCartItem?.price ?? selectedCartItem?.sellingPrice ?? totals.toPay ?? 0));
  const bookingBasePrice = Math.max(0, Number(selectedCartItem?.basePrice ?? bookingSellingPrice));
  const bookingCartItem = {
    ...selectedCartItem,
    id: selectedCartItem?.id || selectedCartItem?.categoryId || selectedCategory.id || "",
    itemType: "category",
    priceType: selectedCartItem?.priceType || "time",
    categoryId: selectedCartItem?.categoryId || selectedCategory.id || null,
    categoryName: selectedCartItem?.categoryName || selectedCategory.name || selectedCartItem?.name || "Category",
    serviceId: selectedServiceId || null,
    serviceName: selectedCartItem?.serviceName || selectedService.name || "Personal Assistant",
    name: selectedCartItem?.name || selectedCartItem?.categoryName || selectedCategory.name || "Category",
    imageUrl: selectedCartItem?.categoryImageUrl || selectedCartItem?.imageUrl || selectedCategory.imageUrl || "",
    categoryImageUrl: selectedCartItem?.categoryImageUrl || selectedCartItem?.imageUrl || selectedCategory.imageUrl || "",
    serviceImageUrl: selectedCartItem?.serviceImageUrl || selectedService.imageUrl || "",
    durationMinutes: bookingDurationMinutes,
    basePrice: bookingBasePrice,
    sellingPrice: bookingSellingPrice,
    price: bookingSellingPrice,
    saveAmount: Math.max(0, bookingBasePrice - bookingSellingPrice),
    durationLabel: selectedCartItem?.durationLabel || selectedCartItem?.label || personalAssistantDurationLabel({ durationMinutes: bookingDurationMinutes })
  };
  const paymentType = String(state.selectedPayment || "cash").toLowerCase() === "razorpay" ? "razorpay" : "cash";
  const razorpayPayment = state.customerRazorpayPayment && typeof state.customerRazorpayPayment === "object" ? state.customerRazorpayPayment : null;
  if (paymentType === "razorpay" && !razorpayPayment?.verified) throw new Error("Complete online payment before confirming booking.");
  const paymentStatus = paymentType === "cash" ? "due" : String(razorpayPayment?.paymentStatus || "pending").toLowerCase();
  const isPaid = ["paid", "captured", "success", "completed"].includes(paymentStatus);
  const paymentAmountPaise = Math.round(bookingSellingPrice * 100);
  const uploadUrls = [];
  for (const entry of state.cartUploads || []) {
    const url = await uploadPortalTaskFile(entry);
    if (url) uploadUrls.push({ url, name: entry.name || "booking-upload", type: entry.type || entry.file?.type || "application/octet-stream" });
  }
  const booking = await api("/portal/customer/bookings", {
    method: "POST",
    body: JSON.stringify({
      serviceId: isUuid(bookingCartItem.serviceId) ? bookingCartItem.serviceId : null,
      categoryId: isUuid(bookingCartItem.categoryId) ? bookingCartItem.categoryId : null,
      clusterId: primaryLocation.clusterId || selectedLocation.clusterId,
      address: primaryLocation.address,
      latitude: primaryLocation.latitude,
      longitude: primaryLocation.longitude,
      notes: state.customerCartNote?.trim() || `Customer portal ${bookingType.mode} booking`,
        estimatedAmountPaise: paymentAmountPaise,
        durationMinutes: bookingDurationMinutes,
        metadata: {
          requestNumber: state.customerBookingReference || razorpayPayment?.bookingReference || "",
          bookingReference: state.customerBookingReference || razorpayPayment?.bookingReference || "",
          bookingType: bookingType.mode,
          assignmentMode,
          bookingAmountPaise: paymentAmountPaise,
          durationMinutes: bookingDurationMinutes,
          customerNote: state.customerCartNote || "",
          waitWindowMinutes: 0,
          waitWindowNote: "",
        scheduledDate: bookingType.mode === "schedule" ? state.selectedScheduleDate : null,
        scheduledTime: bookingType.mode === "schedule" ? state.selectedScheduleTime : null,
        scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
        schedule: bookingType.mode === "schedule" ? {
          scheduledDate: state.selectedScheduleDate,
          scheduledTime: state.selectedScheduleTime,
          scheduledAt: scheduledAt?.toISOString() || null
        } : null,
          serviceBookingTypes: plan.services.map((service) => ({
            serviceId: service.serviceId,
            serviceName: service.serviceName,
            categoryId: service.categoryId || null,
            categoryName: service.categoryName || null,
            bookingType: service.mode,
            instantMode: service.instantMode,
            waitWindowMinutes: 0
          })),
          paymentType,
          paymentStatus,
          isPaid,
          paymentAmountPaise,
          razorpayPayment: paymentType === "razorpay" ? razorpayPayment : null,
          cartItems: [bookingCartItem],
          categoryBooking: bookingCartItem,
          uploads: uploadUrls,
          selectedLocation: primaryLocation,
        bookingLocations: {
          mode: locationRequirement.mode,
          maxLocations: locationRequirement.maxLocations,
          selectedCount: locationStops.length,
          serviceRules: locationRequirement.serviceRules,
          stops: locationStops
        },
        serviceName: bookingCartItem.serviceName,
        categoryName: bookingCartItem.categoryName,
        categoryId: bookingCartItem.categoryId,
        serviceId: bookingCartItem.serviceId,
        createdFrom: "customer_portal"
      }
    })
  });
  const recentLocation = await customerSaveBookingLocationAsRecent({
    ...primaryLocation,
    source: selectedLocation.source || primaryLocation.source || "booking"
  });
  if (recentLocation?.addressId && !state.selectedLocation.addressId && !state.selectedLocation.savedAddressId) {
    state.selectedLocation.addressId = recentLocation.addressId;
  }
  state.confirmedBooking = booking.data;
  state.cart = [];
  revokeCustomerCartUploadUrls(state.cartUploads);
  state.cartUploads = [];
  state.customerLocationStops = [];
  state.customerRoutePrimaryStop = null;
  state.customerRoutePrimaryCleared = false;
  state.customerCartRouteEditIndex = -1;
  state.customerCartRouteDeleteIndex = -1;
  state.customerCartRouteExpanded = false;
  state.customerCartLocationQuery = "";
  state.customerCartLocationResults = [];
  state.customerCartLocationBusy = false;
  state.customerCartLocationMessage = "";
  state.customerCartReplace = null;
  state.cartUploadPreviewIndex = -1;
  state.cartUploadDeleteIndex = -1;
  state.selectedScheduleDate = "";
  state.selectedScheduleTime = "";
  state.selectedSchedulePeriod = "";
  state.customerScheduleSheetOpen = false;
  state.customerPaymentSheetOpen = false;
  state.customerPaymentBusy = false;
  state.customerRazorpayPayment = null;
  state.customerBookingReference = "";
  state.customerPaymentResult = null;
  if (customerPaymentResultTimer) clearTimeout(customerPaymentResultTimer);
  state.bookingType = "instant";
  state.selectedPayment = "cash";
  clearPortalResourceCache("/portal/customer/bookings");
  clearPortalResourceCache("/portal/customer/cart");
  clearPortalResourceCache("/portal/customer/me");
  syncCustomerCartResourceCache([], "");
  await loadMe({ forceRefresh: true });
  if (state.confirmedBooking?.id) {
    state.confirmedBooking = state.bookings.find((item) => String(item.id || "") === String(state.confirmedBooking.id)) || state.confirmedBooking;
  }
  clearTimeout(customerBookingConfirmedTimer);
  state.customerView = "bookingConfirmed";
  render();
  customerBookingConfirmedTimer = setTimeout(() => {
    if (state.customerView !== "bookingConfirmed") return;
    state.customerView = "track";
    render();
  }, 2000);
}

function fileToDataBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}

async function uploadPortalTaskFile(file) {
  const sourceFile = file?.file || file;
  if (!sourceFile) return null;
  const payload = await api("/portal/task-media", {
    method: "POST",
    body: JSON.stringify({
      originalName: sourceFile?.name || file?.name || "task-file",
      mimeType: sourceFile?.type || file?.type || "application/octet-stream",
      dataBase64: await fileToDataBase64(sourceFile)
    })
  });
  return payload.data.previewUrl || payload.data.imageUrl || payload.data.url;
}

function inferUpdateTypeFromFile(file, fallback = "file") {
  const mimeType = String(file?.type || "");
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "voice";
  return fallback;
}

async function handlePortalTaskUpdateSubmit(event) {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form || !form.matches("[data-task-update-form]")) return;
  event.preventDefault();
  if (form.dataset.chatDisabled === "true" || form.getAttribute("aria-disabled") === "true") return;
  const submitter = event.submitter;
  const action = submitter?.dataset?.taskUpdateAction || "send";
  const data = Object.fromEntries(new FormData(form));
  const files = taskUpdateSelectedFiles(form);
  const isTrackChatForm = form.classList.contains("customer-track-composer");
  const isAssistantChatForm = actor === "assistant" && Boolean(form.closest(".task-chat-window"));
  const submitterHtml = submitter?.innerHTML || "";
  const submitterText = submitter?.textContent || "";
  try {
    if (submitter) {
      submitter.disabled = true;
      if (isTrackChatForm) {
        submitter.setAttribute("aria-busy", "true");
      } else {
        submitter.textContent = action === "more-time" ? "Requesting..." : "Sending...";
      }
    }
    const mediaUrls = [];
    for (const file of files) {
      const url = await uploadPortalTaskFile(file);
      if (url) mediaUrls.push(url);
    }
    const requestedMinutes = Math.max(5, Math.min(240, Math.round(Number(data.requestedMinutes || 15))));
    let updateType = String(data.updateType || "text");
    if (action === "more-time") updateType = "time_extension_request";
    if (action !== "more-time" && files.length && updateType === "text") updateType = inferUpdateTypeFromFile(files[0], "file");
    const message = action === "more-time"
      ? (String(data.message || "").trim() || `Need ${requestedMinutes} extra mins to complete this task.`)
      : String(data.message || "").trim();
    if (!message && !mediaUrls.length) throw new Error("Write an update or attach a file.");
    if (isTrackChatForm) {
      customerTrackSuppressOwnRealtimeUntil = Date.now() + 5000;
      customerTrackSuppressOwnRealtimeBookingId = String(form.dataset.bookingId || "");
    }
    const payload = await api("/portal/task-updates", {
      method: "POST",
      body: JSON.stringify({
        bookingId: form.dataset.bookingId,
        assignmentId: form.dataset.assignmentId || null,
        updateType,
        message,
        mediaUrls,
        metadata: action === "more-time" ? { requestedMinutes, status: "pending" } : {}
      })
    });
    form.reset();
    clearTaskUpdateAttachmentTray(form);
    if (isTrackChatForm) {
      const created = payload.data || {};
      const update = {
        id: created.id || `local-${Date.now()}`,
        actorType: actor || "customer",
        updateType,
        message,
        mediaUrls,
        metadata: action === "more-time" ? { requestedMinutes, status: "pending" } : {},
        createdAt: created.createdAt || new Date().toISOString()
      };
      customerTrackStoreUpdate(form.dataset.bookingId, update);
      customerTrackAppendChatUpdate(form, update);
      if (submitter) {
        submitter.disabled = false;
        submitter.removeAttribute("aria-busy");
        submitter.innerHTML = submitterHtml || customerTrackIcon("send");
      }
      return;
    }
    if (isAssistantChatForm) {
      const created = payload.data || {};
      const update = {
        id: created.id || `local-${Date.now()}`,
        actorType: "assistant",
        actorName: state.user?.displayName || "Assistant",
        updateType,
        message,
        mediaUrls,
        metadata: action === "more-time" ? { requestedMinutes, status: "pending" } : {},
        createdAt: created.createdAt || new Date().toISOString()
      };
      assistantStoreTaskUpdate(form.dataset.bookingId, form.dataset.assignmentId, update);
      assistantRefreshChatTimelineOnly();
      if (submitter) {
        submitter.disabled = false;
        submitter.removeAttribute("aria-busy");
        submitter.innerHTML = submitterHtml;
        if (!submitterHtml) submitter.textContent = submitterText || "Send";
      }
      return;
    }
    await loadMe({ forceRefresh: true });
    notify(action === "more-time" ? "More time requested from customer." : "Update shared.");
    if (!refreshAssistantAfterPopupMutation()) render();
  } catch (error) {
    notify(error.message || "Unable to share update.");
    if (isTrackChatForm && submitter) {
      submitter.disabled = false;
      submitter.removeAttribute("aria-busy");
      submitter.innerHTML = submitterHtml;
      if (!submitterHtml) submitter.textContent = submitterText;
      return;
    }
    if (isAssistantChatForm && submitter) {
      submitter.disabled = false;
      submitter.removeAttribute("aria-busy");
      submitter.innerHTML = submitterHtml;
      if (!submitterHtml) submitter.textContent = submitterText;
      return;
    }
    if (!refreshAssistantAfterPopupMutation()) render();
  }
}

async function handleCustomerCancelSubmit(event) {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form || !form.matches("[data-customer-cancel-form]")) return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const submitter = event.submitter;
  try {
    if (submitter) {
      submitter.disabled = true;
      submitter.textContent = "Cancelling...";
    }
    await api(`/portal/customer/bookings/${form.dataset.bookingId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: data.reason || "Customer cancelled from app" })
    });
    state.customerCancelBookingId = "";
    clearPortalResourceCache("/portal/customer/bookings");
    await loadMe({ forceRefresh: true });
    await loadCustomerTrackedBooking(form.dataset.bookingId || "", { silent: true });
    state.confirmedBooking = state.bookings.find((booking) => booking.id === form.dataset.bookingId) || state.confirmedBooking;
    notify("Booking cancelled.");
    render();
  } catch (error) {
    notify(error.message || "Unable to cancel booking.");
    render();
  }
}

async function handleCustomerTrackReviewSubmit(event) {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form || !form.matches("[data-track-review-form]")) return;
  event.preventDefault();
  const bookingId = form.dataset.bookingId || "";
  const data = Object.fromEntries(new FormData(form));
  const submitter = event.submitter;
  try {
    if (!bookingId) throw new Error("Booking not found for review.");
    const booking = customerTrackCurrentBooking(bookingId);
    if (customerTrackIsPaidCompleted(booking)) throw new Error("Review is closed for paid completed bookings.");
    if (submitter) {
      submitter.disabled = true;
      submitter.textContent = "Saving...";
    }
    const payload = await api(`/portal/customer/bookings/${encodeURIComponent(bookingId)}/review`, {
      method: "POST",
      body: JSON.stringify({
        zigoRating: Number(data.zigoRating || 5),
        assistantRating: Number(data.assistantRating || 5),
        serviceRating: Number(data.serviceRating || 5),
        reviewText: String(data.reviewText || "").trim()
      })
    });
    updateCustomerTrackReviewInState(bookingId, payload.data || {});
    state.customerTrackRatingThanks = {
      bookingId,
      average: customerTrackReviewAverage(state.bookings.find((booking) => String(booking.id || "") === String(bookingId)) || state.confirmedBooking || {})
    };
    render();
  } catch (error) {
    notify(error.message || "Unable to save review.");
    render();
  }
}

async function handleCustomerDisputeSubmit(event) {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form || !form.matches("[data-customer-dispute-form]")) return;
  event.preventDefault();
  const bookingId = form.dataset.bookingId || "";
  const data = Object.fromEntries(new FormData(form));
  const submitter = event.submitter;
  try {
    if (!bookingId) throw new Error("Booking not found for dispute.");
    const description = String(data.description || "").trim();
    if (!description) throw new Error("Enter complaint details.");
    if (submitter) {
      submitter.disabled = true;
      submitter.textContent = "Submitting...";
    }
    await api("/portal/customer/disputes", {
      method: "POST",
      body: JSON.stringify({
        bookingId,
        subject: String(data.subject || "Booking dispute").trim(),
        description,
        requestRefund: data.requestRefund === "true" || data.requestRefund === "on",
        requestedRefundAmountPaise: Math.max(0, Math.round(Number(data.requestedRefundAmount || 0) * 100))
      })
    });
    state.customerDisputeBookingId = "";
    clearPortalResourceCache("/portal/customer/bookings");
    await loadMe({ forceRefresh: true });
    await loadCustomerTrackedBooking(bookingId, { silent: true });
    notify("Dispute submitted to admin.");
    render();
  } catch (error) {
    notify(error.message || "Unable to submit dispute.");
    render();
  }
}

async function handleCustomerPaymentProofSubmit(event) {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form || !form.matches("[data-customer-payment-proof-form]")) return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const submitter = event.submitter;
  try {
    if (submitter) {
      submitter.disabled = true;
      submitter.textContent = "Submitting...";
    }
    const amount = Math.max(0, Number(data.amount || form.dataset.amount || 0));
    if (!amount) throw new Error("Enter payment amount.");
    const mode = String(data.mode || "cash").toLowerCase();
    const proofFiles = [...(form.querySelector('input[name="proof"]')?.files || [])];
    if (mode === "upi" && !proofFiles.length) throw new Error("Upload payment picture for UPI.");
    const mediaUrls = [];
    for (const file of proofFiles) {
      const url = await uploadPortalTaskFile(file);
      if (url) mediaUrls.push(url);
    }
    const referenceId = String(data.referenceId || "").trim();
    const note = String(data.note || "").trim();
    const remarks = [referenceId, note].filter(Boolean).join(" - ");
    const created = await postPortalTaskUpdate({
      bookingId: form.dataset.bookingId,
      assignmentId: form.dataset.assignmentId || null,
      updateType: "payment_response",
      message: mode === "cash"
        ? `Customer selected cash payment for ${money(amount)}. Waiting for assistant confirmation.`
        : `Customer shared UPI payment proof for ${money(amount)}. Waiting for admin confirmation.`,
      mediaUrls,
      metadata: {
        sourceUpdateId: form.dataset.updateId || "",
        amount,
        mode,
        referenceId,
        note,
        remarks,
        transactionId: remarks,
        status: "pending",
        confirmationTarget: mode === "cash" ? "assistant" : "admin",
        submittedAt: new Date().toISOString()
      },
      skipReload: true
    });
    customerTrackStoreUpdate(form.dataset.bookingId, {
      id: created.id || `local-payment-${Date.now()}`,
      actorType: "customer",
      updateType: "payment_response",
      message: mode === "cash"
        ? `Customer selected cash payment for ${money(amount)}. Waiting for assistant confirmation.`
        : `Customer shared UPI payment proof for ${money(amount)}. Waiting for admin confirmation.`,
      mediaUrls,
      metadata: { amount, mode, referenceId, note, remarks, status: "pending", confirmationTarget: mode === "cash" ? "assistant" : "admin" },
      createdAt: created.createdAt || new Date().toISOString()
    });
    const booking = customerTrackCurrentBooking(form.dataset.bookingId);
    if (booking) {
      booking.paymentStatus = "pending";
      booking.paymentType = mode;
      booking.metadata = { ...(booking.metadata || {}), paymentStatus: "pending", paymentType: mode, paymentProofMediaUrls: mediaUrls, lastCustomerPaymentRemarks: remarks };
      booking.paymentDetails = { ...(booking.paymentDetails || {}), status: "pending", mode, amount, referenceId, note, remarks, proofMediaUrls: mediaUrls };
    }
    state.customerPaymentProofRequest = null;
    await refreshCustomerTrackBookingRealtime(form.dataset.bookingId || "");
    notify(mode === "cash" ? "Cash payment is pending assistant confirmation." : "UPI payment is pending admin confirmation.");
    renderTrackRealtimeUpdate();
  } catch (error) {
    notify(error.message || "Unable to submit payment proof.");
    if (submitter) {
      submitter.disabled = false;
      submitter.textContent = "Confirm Payment";
    }
  }
}

async function postPortalTaskUpdate(input = {}) {
  if (!input.bookingId) throw new Error("Booking not found for this update.");
  const payload = await api("/portal/task-updates", {
    method: "POST",
    body: JSON.stringify({
      bookingId: input.bookingId,
      assignmentId: input.assignmentId || null,
      updateType: input.updateType || "text",
      message: input.message || "",
      mediaUrls: input.mediaUrls || [],
      metadata: input.metadata || {}
    })
  });
  if (!input.skipReload) await loadMe({ forceRefresh: true });
  return payload.data || {};
}

function currentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location permission is not available on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
      ...options
    });
  });
}

async function shareAssistantLocation(task = assistantChatTask()) {
  if (!task) throw new Error("Open a task before sharing location.");
  const position = await currentPosition();
  const coords = position.coords || {};
  const taskUpdateInput = {
    bookingId: task.bookingId,
    assignmentId: task.assignmentId,
    updateType: "location",
    message: "Current location shared.",
    metadata: {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      sharedAt: new Date().toISOString()
    }
  };
  const created = await postPortalTaskUpdate({ ...taskUpdateInput, skipReload: actor === "assistant" });
  if (actor === "assistant") assistantApplyLocalTaskUpdate(taskUpdateInput, created);
}

async function handleAssistantChatActionSubmit(event) {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form || !form.matches("[data-chat-action-form]")) return;
  event.preventDefault();
  const action = form.dataset.chatActionForm;
  const data = Object.fromEntries(new FormData(form));
  const submitter = event.submitter;
  try {
    if (submitter) {
      submitter.disabled = true;
      submitter.textContent = "Sending...";
    }
    let taskUpdateInput = null;
    if (action === "payment") {
      const amount = Math.max(0, Number(data.amount || 0));
      if (!amount) throw new Error("Enter payment amount.");
      taskUpdateInput = {
        bookingId: form.dataset.bookingId,
        assignmentId: form.dataset.assignmentId,
        updateType: "payment_request",
        message: String(data.message || "").trim() || "Payment requested.",
        metadata: { amount, status: "pending" }
      };
      const created = await postPortalTaskUpdate({ ...taskUpdateInput, skipReload: actor === "assistant" });
      if (actor === "assistant") assistantApplyLocalTaskUpdate(taskUpdateInput, created);
      notify("Payment request sent.");
    } else if (action === "payment_received") {
      const amount = Math.max(0, Number(data.amount || 0));
      if (!amount) throw new Error("Enter payment amount.");
      const proofFiles = [...(form.querySelector('input[name="proof"]')?.files || [])];
      const mediaUrls = [];
      for (const file of proofFiles) {
        const url = await uploadPortalTaskFile(file);
        if (url) mediaUrls.push(url);
      }
      const mode = String(data.mode || "cash").toLowerCase();
      const remarks = String(data.remarks || "").trim();
      taskUpdateInput = {
        bookingId: form.dataset.bookingId,
        assignmentId: form.dataset.assignmentId,
        updateType: "payment_received",
        message: `Payment received by ${mode.toUpperCase()}${remarks ? ` - ${remarks}` : ""}.`,
        mediaUrls,
        metadata: { amount, mode, remarks, transactionId: remarks, status: "paid" }
      };
      const created = await postPortalTaskUpdate({ ...taskUpdateInput, skipReload: actor === "assistant" });
      if (actor === "assistant") {
        assistantApplyLocalTaskUpdate(taskUpdateInput, created);
        normalizeArray(state.tasks).forEach((task) => {
          if (String(task.bookingId || "") !== String(form.dataset.bookingId || "")) return;
          task.paymentStatus = "paid";
          task.paymentType = mode;
          task.isPaid = true;
          task.metadata = { ...(task.metadata || {}), paymentStatus: "paid", paymentType: mode, isPaid: true, chatLocked: true };
          task.paymentDetails = { ...(task.paymentDetails || {}), status: "paid", mode, amount, remarks, proofMediaUrls: mediaUrls };
        });
        assistantRefreshChatTimelineOnly();
      }
      notify("Payment marked as received.");
      state.assistantChatAction = "";
      if (actor === "assistant") {
        renderAssistantTaskView();
        return;
      }
    } else if (action === "approval") {
      const message = String(data.message || "").trim();
      if (!message) throw new Error("Enter approval question.");
      taskUpdateInput = {
        bookingId: form.dataset.bookingId,
        assignmentId: form.dataset.assignmentId,
        updateType: "approval_request",
        message,
        metadata: { status: "pending", answerType: "yes_no" }
      };
      const created = await postPortalTaskUpdate({ ...taskUpdateInput, skipReload: actor === "assistant" });
      if (actor === "assistant") assistantApplyLocalTaskUpdate(taskUpdateInput, created);
      notify("Approval request sent.");
    } else if (action === "more_time") {
      const requestedMinutes = Math.max(5, Math.min(240, Math.round(Number(data.requestedMinutes || 15))));
      taskUpdateInput = {
        bookingId: form.dataset.bookingId,
        assignmentId: form.dataset.assignmentId,
        updateType: "time_extension_request",
        message: String(data.message || "").trim() || `Need ${requestedMinutes} extra mins to complete this task.`,
        metadata: { requestedMinutes, status: "pending" }
      };
      const created = await postPortalTaskUpdate({ ...taskUpdateInput, skipReload: actor === "assistant" });
      if (actor === "assistant") assistantApplyLocalTaskUpdate(taskUpdateInput, created);
      notify("More time requested from customer.");
    }
    state.assistantChatAction = "";
    if (actor === "assistant") {
      form.remove();
    } else if (!refreshAssistantAfterPopupMutation()) {
      render();
    }
  } catch (error) {
    notify(error.message || "Unable to send request.");
    if (submitter) {
      submitter.disabled = false;
      submitter.textContent = action === "payment_received" ? "Mark Payment Received" : action === "payment" ? "Send Payment Request" : action === "approval" ? "Ask Customer" : "Request More Time";
    }
    if (actor !== "assistant" && !refreshAssistantAfterPopupMutation()) render();
  }
}

async function handleCustomerLocationSubmit(event) {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form) return;
  if (form.matches("[data-location-search-form]")) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      await searchCustomerLocations(data.q);
      if (["home", "cart"].includes(state.customerView) && state.customerLocationPickerSheetOpen) updateCustomerHomeLocationPickerSearch({ focusSearch: true });
      else render();
    } catch (error) {
      state.locationBusy = false;
      notify(error.message || "Unable to search location.");
      if (["home", "cart"].includes(state.customerView) && state.customerLocationPickerSheetOpen) updateCustomerHomeLocationPickerSearch({ focusSearch: true });
      else render();
    }
    return;
  }
  if (form.matches("[data-location-continue-form]")) {
    event.preventDefault();
    try {
      await completeCustomerLocationSelection(form);
      render();
    } catch (error) {
      notify(error.message || "Unable to select location.");
      render();
    }
  }
}

function isCustomerMobileAppEvent(event) {
  const target = event.target;
  return Boolean(target?.closest?.(".portal-customer .mobile-app"));
}

document.addEventListener("contextmenu", (event) => {
  if (!isCustomerMobileAppEvent(event)) return;
  event.preventDefault();
});

document.addEventListener("copy", (event) => {
  if (!isCustomerMobileAppEvent(event)) return;
  event.preventDefault();
});

document.addEventListener("cut", (event) => {
  if (!isCustomerMobileAppEvent(event)) return;
  event.preventDefault();
});

document.addEventListener("dragstart", (event) => {
  if (!isCustomerMobileAppEvent(event)) return;
  event.preventDefault();
});

document.addEventListener("selectstart", (event) => {
  if (!isCustomerMobileAppEvent(event)) return;
  if (event.target?.closest?.("input, textarea")) return;
  event.preventDefault();
});

document.addEventListener("submit", handleLoginSubmit);
document.addEventListener("submit", handleCustomerLocationSubmit);
document.addEventListener("submit", handlePortalTaskUpdateSubmit);
document.addEventListener("submit", handleAssistantChatActionSubmit);
document.addEventListener("submit", handleCustomerCancelSubmit);
document.addEventListener("submit", handleCustomerTrackReviewSubmit);
document.addEventListener("submit", handleCustomerDisputeSubmit);
document.addEventListener("submit", handleCustomerPaymentProofSubmit);

document.addEventListener("input", (event) => {
  const loginPhoneInput = event.target instanceof HTMLInputElement ? event.target.closest("#customerLoginForm input[name='phone']") : null;
  if (loginPhoneInput && actor === "customer" && !state.codeSent) {
    syncCustomerLoginPhoneButton();
    return;
  }
  const otpInput = event.target instanceof HTMLInputElement ? event.target.closest("#customerLoginForm input[name='code']") : null;
  if (otpInput && actor === "customer") {
    const nextValue = String(otpInput.value || "").replace(/\D/g, "").slice(0, 6);
    if (otpInput.value !== nextValue) otpInput.value = nextValue;
    const verifyButton = otpInput.closest("form")?.querySelector("[data-otp-verify-button]");
    if (verifyButton) verifyButton.disabled = Boolean(state.loginBusy || nextValue.length !== 6);
    return;
  }
  const customerSearchInput = event.target instanceof HTMLInputElement ? event.target.closest("[data-customer-search-page-input]") : null;
  if (customerSearchInput) {
    state.customerSearchQuery = customerSearchInput.value;
    const page = root.querySelector(".customer-search-screen");
    const results = page?.querySelector(".customer-search-results");
    if (results) {
      const rows = customerSearchRows();
      results.innerHTML = rows.length
        ? rows.map((category) => `<button class="customer-search-result-card" data-open-home-category-detail="${escapeHtml(category.id || "")}" type="button">
          <span class="customer-search-result-image">${customerHomeTileVisual(category, "CA")}</span>
          <span>
            <b>${escapeHtml(category.name || "Category")}</b>
          </span>
        </button>`).join("")
        : `<div class="customer-search-empty"><b>No result found</b><p>Try searching another category or requirement.</p></div>`;
    }
    const inputWrap = page?.querySelector(".customer-search-input-wrap");
    const clearButton = inputWrap?.querySelector("[data-customer-search-clear]");
    if (customerSearchInput.value && !clearButton) {
      inputWrap?.insertAdjacentHTML("beforeend", `<button data-customer-search-clear type="button" aria-label="Clear search">${customerIcon("x")}</button>`);
    } else if (!customerSearchInput.value && clearButton) {
      clearButton.remove();
    }
    return;
  }
  const input = event.target instanceof HTMLInputElement ? event.target.closest("[data-location-search-input]") : null;
  if (input) {
    scheduleCustomerLocationAutocomplete(input.value);
    return;
  }
  const cartLocationInput = event.target instanceof HTMLInputElement ? event.target.closest("[data-customer-cart-location-search]") : null;
  if (cartLocationInput) {
    scheduleCustomerCartLocationAutocomplete(cartLocationInput.value);
    return;
  }
  const cartNoteInput = event.target instanceof HTMLTextAreaElement ? event.target.closest("[data-cart-note-input]") : null;
  if (cartNoteInput) {
    customerCartSyncNote(cartNoteInput.value);
  }
  const confirmLocationOtherInput = event.target instanceof HTMLInputElement ? event.target.closest("[data-confirm-location-other-input]") : null;
  if (confirmLocationOtherInput) {
    const nextValue = String(confirmLocationOtherInput.value || "").slice(0, 32);
    if (confirmLocationOtherInput.value !== nextValue) confirmLocationOtherInput.value = nextValue;
    state.locationSaveAsCustomLabel = nextValue;
    state.locationSaveAsLabel = "Other";
    state.locationSaveAsMessage = customerSaveAsLabelMessage(nextValue);
    const form = confirmLocationOtherInput.closest("form");
    const hiddenLabel = form?.querySelector('input[name="label"]');
    const hiddenCustomLabel = form?.querySelector('input[name="customLabel"]');
    if (hiddenLabel) hiddenLabel.value = "Other";
    if (hiddenCustomLabel) hiddenCustomLabel.value = nextValue;
    const actionButton = confirmLocationOtherInput.closest(".save-address-other-field")?.querySelector("[data-confirm-location-other-action]");
    if (actionButton) actionButton.textContent = nextValue.trim() ? "Add" : "Close";
    const messageEl = confirmLocationOtherInput.closest("form")?.querySelector("[data-save-address-message]");
    if (messageEl) {
      messageEl.textContent = state.locationSaveAsMessage;
      messageEl.classList.toggle("hidden", !state.locationSaveAsMessage);
    }
    return;
  }
  const trackTipCustomInput = event.target instanceof HTMLInputElement ? event.target.closest("[data-track-tip-custom-input]") : null;
  if (trackTipCustomInput) {
    const nextValue = String(trackTipCustomInput.value || "").replace(/[^\d]/g, "").slice(0, 5);
    if (trackTipCustomInput.value !== nextValue) trackTipCustomInput.value = nextValue;
    state.customerTrackTipCustom = nextValue;
    const actionButton = trackTipCustomInput.closest(".customer-track-tip-inline-custom")?.querySelector("button");
    if (actionButton) {
      actionButton.textContent = nextValue ? "Add" : "Close";
      if (nextValue) {
        actionButton.setAttribute("data-track-tip-custom-add", "");
        actionButton.removeAttribute("data-track-tip-custom-close");
      } else {
        actionButton.setAttribute("data-track-tip-custom-close", "");
        actionButton.removeAttribute("data-track-tip-custom-add");
      }
    }
  }
});

document.addEventListener("pointerdown", (event) => {
  if (event.target?.closest?.(".assistant-confirm-backdrop")) return;
  if (startCustomerCartRouteDrag(event)) return;
  if (startCustomerHomeCategorySheetDrag(event)) return;
  startCustomerMapDrag(event);
}, true);
document.addEventListener("pointermove", (event) => {
  if (event.target?.closest?.(".assistant-confirm-backdrop")) return;
  moveCustomerCartRouteDrag(event);
  moveCustomerHomeCategorySheetDrag(event);
  moveCustomerMapDrag(event);
});
document.addEventListener("pointerup", (event) => {
  if (event.target?.closest?.(".assistant-confirm-backdrop")) return;
  endCustomerCartRouteDrag(event);
  endCustomerHomeCategorySheetDrag(event);
  endCustomerMapDrag(event);
});
document.addEventListener("pointercancel", (event) => {
  if (event.target?.closest?.(".assistant-confirm-backdrop")) return;
  endCustomerCartRouteDrag(event);
  endCustomerHomeCategorySheetDrag(event);
  endCustomerMapDrag(event);
});

document.addEventListener("pointerdown", (event) => {
  const pinInput = event.target instanceof Element ? event.target.closest("[data-assistant-task-pin-input]") : null;
  if (!pinInput) return;
  event.stopPropagation();
  pinInput.focus?.({ preventScroll: true });
}, true);

document.addEventListener("click", (event) => {
  const pinInput = event.target instanceof Element ? event.target.closest("[data-assistant-task-pin-input]") : null;
  if (!pinInput) return;
  event.stopPropagation();
  pinInput.focus?.({ preventScroll: true });
}, true);

document.addEventListener("input", (event) => {
  const pinInput = event.target instanceof HTMLInputElement ? event.target.closest("[data-assistant-task-pin-input]") : null;
  if (!pinInput) return;
  const nextValue = String(pinInput.value || "").replace(/\D/g, "").slice(0, 4);
  if (pinInput.value !== nextValue) pinInput.value = nextValue;
});

document.addEventListener("change", (event) => {
  const useMyMobileInput = event.target instanceof HTMLInputElement ? event.target.closest("input[name='useMyMobile']") : null;
  if (useMyMobileInput) {
    const form = useMyMobileInput.closest("[data-location-continue-form]");
    const contactInput = form?.querySelector("input[name='contactNumber']");
    if (contactInput instanceof HTMLInputElement) {
      contactInput.value = useMyMobileInput.checked ? customerDisplayMobile10(state.user?.phone || "") : "";
    }
    return;
  }
  const paymentProofInput = event.target instanceof HTMLInputElement ? event.target.closest("[data-customer-payment-proof-input]") : null;
  if (paymentProofInput) {
    const fileName = paymentProofInput.files?.[0]?.name || "Upload payment proof";
    const label = paymentProofInput.closest(".customer-payment-upload-control")?.querySelector("[data-customer-payment-proof-name]");
    if (label) label.textContent = fileName;
  }
  const uploadInput = event.target instanceof HTMLInputElement ? event.target.closest("[data-cart-upload]") : null;
  if (uploadInput) {
    const files = Array.from(uploadInput.files || []);
    const current = Array.isArray(state.cartUploads) ? state.cartUploads : [];
    const nextEntries = files.map((file, index) => customerCartUploadEntryFromFile(file, current.length + index));
    const merged = [...current, ...nextEntries].slice(0, 8);
    const discarded = [...current, ...nextEntries].slice(8);
    revokeCustomerCartUploadUrls(discarded);
    state.cartUploads = merged;
    state.cartUploadPreviewIndex = -1;
    state.cartUploadDeleteIndex = -1;
    uploadInput.value = "";
    render();
  }
  const taskUpdateFileInput = event.target instanceof HTMLInputElement && event.target.type === "file" && event.target.closest("[data-task-update-form]")
    ? event.target
    : null;
  if (taskUpdateFileInput) {
    handleTaskUpdateAttachmentInput(taskUpdateFileInput);
  }
  const trackTipFutureInput = event.target instanceof HTMLInputElement ? event.target.closest("[data-track-tip-future]") : null;
  if (trackTipFutureInput) {
    state.customerTrackTipFuture = Boolean(trackTipFutureInput.checked);
  }
});

let lastLocationResultDirectTapAt = 0;
async function handleLocationResultDirectEvent(event) {
  if (actor !== "customer") return;
  const button = event.target instanceof Element ? event.target.closest("[data-location-result]") : null;
  if (!button) return;
  const now = Date.now();
  if (now - lastLocationResultDirectTapAt < 450) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    return;
  }
  lastLocationResultDirectTapAt = now;
  await openCustomerSearchLocationConfirm(button, event);
}

document.addEventListener("pointerup", (event) => {
  handleLocationResultDirectEvent(event);
}, true);

document.addEventListener("click", (event) => {
  handleLocationResultDirectEvent(event);
}, true);

document.addEventListener("click", (event) => {
  const link = event.target instanceof Element ? event.target.closest("[data-open-external]") : null;
  if (!link) return;
  const href = link.getAttribute("href") || "";
  if (!href) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  window.open(href, "_blank", "noopener,noreferrer");
}, true);

document.addEventListener("click", (event) => {
  const retry = event.target instanceof Element ? event.target.closest("[data-connection-retry]") : null;
  if (!retry) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  if (navigator.onLine === false) {
    renderConnectionLostPage();
    return;
  }
  window.location.reload();
}, true);

document.addEventListener("click", async (event) => {
  removeCustomerRippleArtifacts();

  const earlyTaskButton = event.target.closest("[data-task-status]");
  if (earlyTaskButton && actor === "assistant") {
    if (earlyTaskButton.disabled || earlyTaskButton.getAttribute("aria-disabled") === "true") return;
    event.preventDefault();
    event.stopPropagation();
    const nextConfirm = {
      assignmentId: earlyTaskButton.dataset.id,
      status: earlyTaskButton.dataset.taskStatus,
      actionLabel: earlyTaskButton.dataset.taskActionLabel || ""
    };
    if (
      state.assistantTaskConfirm
      && String(state.assistantTaskConfirm.assignmentId || "") === String(nextConfirm.assignmentId || "")
      && String(state.assistantTaskConfirm.status || "") === String(nextConfirm.status || "")
    ) {
      focusAssistantTaskPinInput();
      return;
    }
    state.assistantTaskConfirm = {
      ...nextConfirm
    };
    if (!renderAssistantTaskView()) render();
    focusAssistantTaskPinInput();
    return;
  }

  const taskAttachmentRemove = event.target.closest("[data-task-attachment-remove]");
  if (taskAttachmentRemove) {
    event.preventDefault();
    event.stopPropagation();
    removeTaskUpdateAttachment(taskAttachmentRemove);
    return;
  }

  const taskAttachmentPreview = event.target.closest("[data-task-attachment-preview]");
  if (taskAttachmentPreview) {
    event.preventDefault();
    event.stopPropagation();
    openTaskUpdateAttachmentPreview(taskAttachmentPreview);
    return;
  }

  const closeTrackPreviewButton = event.target.closest("[data-close-track-preview]");
  if (closeTrackPreviewButton) {
    event.preventDefault();
    event.stopPropagation();
    customerTrackClosePreview();
    return;
  }

  const trackPreviewBackdrop = event.target.closest("[data-track-preview-backdrop]");
  if (trackPreviewBackdrop && event.target === trackPreviewBackdrop) {
    event.preventDefault();
    customerTrackClosePreview();
    return;
  }

  const trackPreviewTrigger = event.target.closest("[data-track-preview-url]");
  if (trackPreviewTrigger && root.querySelector(".customer-track-page")) {
    event.preventDefault();
    event.stopPropagation();
    customerTrackOpenPreview({
      url: trackPreviewTrigger.dataset.trackPreviewUrl || "",
      name: trackPreviewTrigger.dataset.trackPreviewName || trackPreviewTrigger.getAttribute("title") || "Attachment",
      kind: trackPreviewTrigger.dataset.trackPreviewKind || ""
    });
    return;
  }

  const trackReviewStar = event.target.closest("[data-review-star]");
  if (trackReviewStar && root.querySelector(".customer-track-page")) {
    event.preventDefault();
    event.stopPropagation();
    const group = trackReviewStar.closest("[data-review-rating-group]");
    const value = Math.max(1, Math.min(5, Math.round(Number(trackReviewStar.dataset.reviewStar || 5))));
    const input = group?.querySelector(`input[name="${trackReviewStar.dataset.reviewName || ""}"]`);
    if (input) input.value = String(value);
    group?.querySelectorAll("[data-review-star]").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.reviewStar || 0) <= value);
      button.setAttribute("aria-checked", Number(button.dataset.reviewStar || 0) === value ? "true" : "false");
    });
    return;
  }

  const closeTrackRatingThanks = event.target.closest("[data-close-track-rating-thanks]");
  if (closeTrackRatingThanks) {
    event.preventDefault();
    event.stopPropagation();
    state.customerTrackRatingThanks = null;
    render();
    return;
  }

  const trackRatingThanksBackdrop = event.target.closest("[data-track-rating-thanks-backdrop]");
  if (trackRatingThanksBackdrop && event.target === trackRatingThanksBackdrop) {
    event.preventDefault();
    state.customerTrackRatingThanks = null;
    render();
    return;
  }

  const trackReviewToggle = event.target.closest("[data-track-review-toggle]");
  if (trackReviewToggle && root.querySelector(".customer-track-page")) {
    event.preventDefault();
    event.stopPropagation();
    const card = trackReviewToggle.closest("[data-track-review-card]");
    if (!card) return;
    const shouldExpand = card.classList.contains("is-collapsed");
    card.classList.toggle("is-collapsed", !shouldExpand);
    card.classList.toggle("is-expanded", shouldExpand);
    trackReviewToggle.setAttribute("aria-expanded", shouldExpand ? "true" : "false");
    trackReviewToggle.setAttribute("aria-label", shouldExpand ? "Collapse review details" : "Expand review details");
    trackReviewToggle.innerHTML = customerTrackIcon(shouldExpand ? "chevronUp" : "chevronDown");
    return;
  }

  const closeTrackMapSheetButton = event.target.closest("[data-close-track-map-sheet]");
  if (closeTrackMapSheetButton) {
    setTimeout(customerTrackCloseMapSheet, closeTrackMapSheetButton.tagName === "A" ? 160 : 0);
    if (closeTrackMapSheetButton.tagName !== "A") {
      event.preventDefault();
      event.stopPropagation();
    }
    return;
  }

  const trackMapSheetBackdrop = event.target.closest("[data-track-map-sheet-backdrop]");
  if (trackMapSheetBackdrop && event.target === trackMapSheetBackdrop) {
    event.preventDefault();
    customerTrackCloseMapSheet();
    return;
  }

  const trackMapLocation = event.target.closest("[data-track-map-location]");
  if (trackMapLocation) {
    event.preventDefault();
    event.stopPropagation();
    customerTrackOpenMapSheet({
      title: trackMapLocation.dataset.trackMapTitle || "Location",
      address: trackMapLocation.dataset.trackMapAddress || "",
      browserUrl: trackMapLocation.dataset.trackMapBrowserUrl || "",
      appUrl: trackMapLocation.dataset.trackMapAppUrl || "",
      appleUrl: trackMapLocation.dataset.trackMapAppleUrl || ""
    });
    return;
  }

  const trackTipAmountButton = event.target.closest("[data-track-tip-amount]");
  if (trackTipAmountButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerTrackTipAmount = Number(trackTipAmountButton.dataset.trackTipAmount || 0);
    state.customerTrackTipCustom = "";
    state.customerTrackTipCustomOpen = false;
    renderTrackPreservingTipScroll(`[data-track-tip-amount="${state.customerTrackTipAmount}"]`);
    return;
  }

  const trackTipCustomButton = event.target.closest("[data-track-tip-custom]");
  if (trackTipCustomButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerTrackTipCustom = state.customerTrackTipCustom || String(state.customerTrackTipAmount && ![20, 30, 50].includes(Number(state.customerTrackTipAmount)) ? state.customerTrackTipAmount : "");
    state.customerTrackTipCustomOpen = true;
    renderTrackPreservingTipScroll(".customer-track-tip-inline-custom");
    requestAnimationFrame(() => {
      const input = root.querySelector("[data-track-tip-custom-input]");
      focusCustomerTrackTipControl(".customer-track-tip-inline-custom");
      input?.focus?.({ preventScroll: true });
      const length = String(input?.value || "").length;
      input?.setSelectionRange?.(length, length);
    });
    return;
  }

  const trackTipClearButton = event.target.closest("[data-track-tip-clear]");
  if (trackTipClearButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerTrackTipAmount = 0;
    state.customerTrackTipCustom = "";
    state.customerTrackTipCustomOpen = false;
    state.customerTrackTipFuture = false;
    renderTrackPreservingTipScroll();
    return;
  }

  const trackTipCustomCloseButton = event.target.closest("[data-track-tip-custom-close]");
  if (trackTipCustomCloseButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerTrackTipCustom = "";
    state.customerTrackTipCustomOpen = false;
    if (![20, 30, 50].includes(Number(state.customerTrackTipAmount || 0))) {
      state.customerTrackTipAmount = 0;
    }
    renderTrackPreservingTipScroll("[data-track-tip-custom]");
    return;
  }

  const trackTipCustomAddButton = event.target.closest("[data-track-tip-custom-add]");
  if (trackTipCustomAddButton) {
    event.preventDefault();
    event.stopPropagation();
    const amount = Math.max(0, Number(state.customerTrackTipCustom || 0));
    if (amount > 0) {
      state.customerTrackTipAmount = amount;
      state.customerTrackTipCustom = "";
      state.customerTrackTipCustomOpen = false;
      renderTrackPreservingTipScroll("[data-track-tip-custom]");
    }
    return;
  }

  const trackBillToggle = event.target.closest("[data-track-bill-toggle]");
  if (trackBillToggle) {
    event.preventDefault();
    event.stopPropagation();
    const billCard = trackBillToggle.closest(".customer-track-bill-card");
    if (!billCard) return;
    const shouldExpand = billCard.classList.contains("is-collapsed");
    state.customerTrackBillExpanded = shouldExpand;
    billCard.classList.toggle("is-collapsed", !state.customerTrackBillExpanded);
    trackBillToggle.setAttribute("aria-expanded", state.customerTrackBillExpanded ? "true" : "false");
    trackBillToggle.setAttribute("aria-label", state.customerTrackBillExpanded ? "Collapse bill details" : "Expand bill details");
    trackBillToggle.innerHTML = customerTrackIcon(state.customerTrackBillExpanded ? "chevronUp" : "chevronDown");
    return;
  }

  const trackExtendDuration = event.target.closest("[data-customer-track-extend-duration]");
  if (trackExtendDuration) {
    event.preventDefault();
    event.stopPropagation();
    const requestedMinutes = Math.max(5, Math.min(240, Math.round(Number(trackExtendDuration.dataset.customerTrackExtendDuration || 0))));
    const bookingId = trackExtendDuration.dataset.customerTrackExtendBookingId || "";
    const assignmentId = trackExtendDuration.dataset.customerTrackExtendAssignmentId || "";
    if (!bookingId || !requestedMinutes) return;
    const originalHtml = trackExtendDuration.innerHTML;
    try {
      trackExtendDuration.disabled = true;
      trackExtendDuration.innerHTML = `<span class="customer-inline-spinner" aria-hidden="true"></span><b>Requesting</b>`;
      const payload = await api("/portal/task-updates", {
        method: "POST",
        body: JSON.stringify({
          bookingId,
          assignmentId: assignmentId || null,
          updateType: "time_extension_request",
          message: `Need ${requestedMinutes} extra mins to complete this task.`,
          mediaUrls: [],
          metadata: { requestedMinutes, status: "pending", source: "customer_track_extend" }
        })
      });
      const created = payload.data || {};
      customerTrackStoreUpdate(bookingId, {
        id: created.id || `local-${Date.now()}`,
        actorType: actor || "customer",
        updateType: "time_extension_request",
        message: created.message || `Need ${requestedMinutes} extra mins to complete this task.`,
        mediaUrls: [],
        metadata: { requestedMinutes, status: "pending", source: "customer_track_extend" },
        createdAt: created.createdAt || new Date().toISOString()
      });
      notify("More duration request sent.");
      renderTrackRealtimeUpdate();
    } catch (error) {
      notify(error.message || "Unable to request more duration.", "error");
      trackExtendDuration.disabled = false;
      trackExtendDuration.innerHTML = originalHtml;
    }
    return;
  }

  const trackMediaToggle = event.target.closest("[data-track-media-toggle]");
  if (trackMediaToggle) {
    event.preventDefault();
    event.stopPropagation();
    const mediaCard = trackMediaToggle.closest(".customer-track-media-card");
    if (!mediaCard) return;
    const shouldExpand = mediaCard.classList.contains("is-collapsed");
    state.customerTrackMediaExpanded = shouldExpand;
    mediaCard.classList.toggle("is-collapsed", !state.customerTrackMediaExpanded);
    trackMediaToggle.setAttribute("aria-expanded", state.customerTrackMediaExpanded ? "true" : "false");
    trackMediaToggle.setAttribute("aria-label", state.customerTrackMediaExpanded ? "Collapse locations and uploads" : "Expand locations and uploads");
    trackMediaToggle.innerHTML = customerTrackIcon(state.customerTrackMediaExpanded ? "chevronUp" : "chevronDown");
    return;
  }

  const trackLocationToggle = event.target.closest("[data-track-location-toggle]");
  if (trackLocationToggle) {
    event.preventDefault();
    event.stopPropagation();
    const locationSection = trackLocationToggle.closest(".customer-track-locations");
    const locationCard = locationSection?.querySelector(".customer-track-location-card");
    if (!locationCard) return;
    const shouldExpand = locationCard.classList.contains("is-collapsed");
    state.customerTrackLocationsExpanded = shouldExpand;
    locationCard.classList.toggle("is-collapsed", !state.customerTrackLocationsExpanded);
    trackLocationToggle.setAttribute("aria-expanded", state.customerTrackLocationsExpanded ? "true" : "false");
    trackLocationToggle.setAttribute("aria-label", state.customerTrackLocationsExpanded ? "Collapse locations" : "Expand locations");
    trackLocationToggle.innerHTML = customerTrackIcon(state.customerTrackLocationsExpanded ? "chevronUp" : "chevronDown");
    return;
  }

  const trackChatToggle = event.target.closest("[data-track-chat-toggle]");
  if (trackChatToggle) {
    event.preventDefault();
    event.stopPropagation();
    const chatSection = trackChatToggle.closest(".customer-track-chat-section");
    if (!chatSection) return;
    const shouldExpand = chatSection.classList.contains("is-collapsed");
    await customerTrackSetChatExpanded(chatSection, shouldExpand);
    return;
  }

  const trackChatOpen = event.target.closest("[data-track-chat-open]");
  if (trackChatOpen) {
    event.preventDefault();
    event.stopPropagation();
    const chatSection = trackChatOpen.closest(".customer-track-chat-section");
    if (!chatSection || chatSection.classList.contains("is-expanded")) return;
    await customerTrackSetChatExpanded(chatSection, true);
    return;
  }

  const scheduleActionButton = event.target.closest("[data-action='booking-master-select-schedule-date'], [data-action='booking-master-select-schedule-period'], [data-action='booking-master-select-schedule-time'], [data-action='booking-master-confirm-schedule-booking']");
  if (scheduleActionButton && actor === "customer") {
    if (typeof window?.zigoCustomerScheduleAction === "function") {
      const handled = await window.zigoCustomerScheduleAction(scheduleActionButton, event);
      if (handled === false) {
        return;
      }
    } else {
      event.preventDefault();
      await handleCustomerScheduleAdminAction(scheduleActionButton.dataset.action || "", scheduleActionButton, event);
    }
    return;
  }

  const bookingTypeButton = event.target.closest("[data-customer-booking-type]");
  if (bookingTypeButton) {
    event.preventDefault();
    const mode = bookingTypeButton.dataset.customerBookingType === "schedule" ? "schedule" : "instant";
    if (mode === "instant") {
      await refreshCustomerAvailabilityDecision();
    }
    const plan = customerCartBookingTypePlan();
    if (mode === "instant" && !plan.hasInstant) {
      if (plan.hasSchedule) {
        state.bookingType = "schedule";
        render();
      }
      return;
    }
    if (mode === "schedule" && !plan.hasSchedule) {
      notify("Schedule booking is not enabled for selected services.");
      return;
    }
    if (mode === "schedule") {
      await openCustomerSchedulePage();
    } else {
      state.bookingType = "instant";
      state.customerScheduleSheetOpen = false;
      state.customerView = "cart";
      render();
    }
    return;
  }

  const openReviewPaymentSheetButton = event.target.closest("[data-open-review-payment-sheet]");
  if (openReviewPaymentSheetButton) {
    event.preventDefault();
    state.customerPaymentSheetOpen = true;
    refreshCustomerCartConfirmBarOnly();
    return;
  }

  const closeReviewPaymentSheetButton = event.target.closest("[data-close-review-payment-sheet]");
  if (closeReviewPaymentSheetButton) {
    event.preventDefault();
    state.customerPaymentSheetOpen = false;
    refreshCustomerCartConfirmBarOnly();
    return;
  }

  const reviewPaymentSheetBackdrop = event.target.closest("[data-review-payment-sheet-backdrop]");
  if (reviewPaymentSheetBackdrop && event.target === reviewPaymentSheetBackdrop) {
    event.preventDefault();
    state.customerPaymentSheetOpen = false;
    refreshCustomerCartConfirmBarOnly();
    return;
  }

  const reviewPaymentModeButton = event.target.closest("[data-select-review-payment-mode]");
  if (reviewPaymentModeButton) {
    event.preventDefault();
    const paymentMode = String(reviewPaymentModeButton.dataset.selectReviewPaymentMode || "").toLowerCase();
    if (reviewPaymentModeButton.disabled) return;
    if (paymentMode === "cash") {
      state.selectedPayment = paymentMode;
      state.customerRazorpayPayment = null;
      state.customerPaymentSheetOpen = false;
      refreshCustomerCartConfirmBarOnly();
      return;
    }
    if (paymentMode === "razorpay") {
      try {
        state.customerPaymentBusy = true;
        refreshCustomerCartConfirmBarOnly();
        const payment = await startCustomerRazorpayCheckout();
        state.selectedPayment = "razorpay";
        state.customerRazorpayPayment = payment;
        state.customerPaymentSheetOpen = false;
        state.customerPaymentBusy = false;
        showCustomerPaymentResult(payment);
      } catch (error) {
        const message = error.message || "Payment failed.";
        state.customerPaymentBusy = false;
        showCustomerPaymentResult({
          status: "failed",
          message,
          razorpayOrderId: error.razorpayOrderId || "",
          amountPaise: error.amountPaise || Math.round(Number(cartTotals().toPay || 0) * 100),
          currency: error.currency || "INR"
        }, { autoReturn: false });
      }
      return;
    }
    return;
  }

  const closePaymentResultButton = event.target.closest("[data-close-customer-payment-result]");
  if (closePaymentResultButton) {
    event.preventDefault();
    state.customerPaymentSheetOpen = state.customerPaymentResult?.status === "failed";
    closeCustomerPaymentResult();
    return;
  }

  const retryPaymentButton = event.target.closest("[data-retry-customer-payment]");
  if (retryPaymentButton) {
    event.preventDefault();
    retryPaymentButton.disabled = true;
    try {
      const payment = await startCustomerRazorpayCheckout();
      state.selectedPayment = "razorpay";
      state.customerRazorpayPayment = payment;
      showCustomerPaymentResult(payment);
    } catch (error) {
      showCustomerPaymentResult({ status: "failed", message: error.message || "Payment failed." }, { autoReturn: false });
    }
    return;
  }

  const openScheduleButton = event.target.closest("[data-f7-open-schedule]");
  if (openScheduleButton) {
    event.preventDefault();
    await openCustomerSchedulePage();
    return;
  }

  const openCartUploadPreviewButton = event.target.closest("[data-open-cart-upload-preview]");
  if (openCartUploadPreviewButton) {
    event.preventDefault();
    event.stopPropagation();
    state.cartUploadPreviewIndex = Number(openCartUploadPreviewButton.dataset.openCartUploadPreview || -1);
    state.cartUploadDeleteIndex = -1;
    render();
    return;
  }

  const openCartUploadDeleteButton = event.target.closest("[data-delete-cart-upload]");
  if (openCartUploadDeleteButton) {
    event.preventDefault();
    event.stopPropagation();
    state.cartUploadDeleteIndex = Number(openCartUploadDeleteButton.dataset.deleteCartUpload || -1);
    state.cartUploadPreviewIndex = -1;
    render();
    return;
  }

  const openCartUploadDeleteDialogButton = event.target.closest("[data-open-cart-upload-delete]");
  if (openCartUploadDeleteDialogButton) {
    event.preventDefault();
    event.stopPropagation();
    state.cartUploadDeleteIndex = Number(openCartUploadDeleteDialogButton.dataset.openCartUploadDelete || -1);
    state.cartUploadPreviewIndex = -1;
    render();
    return;
  }

  const openCartNoteVoiceButton = event.target.closest("[data-open-cart-note-voice]");
  if (openCartNoteVoiceButton) {
    event.preventDefault();
    event.stopPropagation();
    openCustomerCartVoiceSheet();
    return;
  }

  const toggleCartNoteVoiceButton = event.target.closest("[data-cart-note-voice-toggle]");
  if (toggleCartNoteVoiceButton) {
    event.preventDefault();
    event.stopPropagation();
    if (state.customerCartVoiceListening) {
      stopCustomerCartVoiceRecognition(true);
      state.customerCartVoiceStatus = "Recording stopped.";
      render();
    } else {
      state.customerCartVoiceStatus = "Starting recording...";
      render();
      await startCustomerCartVoiceRecognition();
    }
    return;
  }

  const closeCartNoteVoiceButton = event.target.closest("[data-close-cart-note-voice]");
  if (closeCartNoteVoiceButton) {
    event.preventDefault();
    event.stopPropagation();
    closeCustomerCartVoiceSheet();
    return;
  }

  const cartVoiceBackdrop = event.target.closest("[data-cart-voice-backdrop]");
  if (cartVoiceBackdrop && event.target === cartVoiceBackdrop) {
    event.preventDefault();
    closeCustomerCartVoiceSheet();
    return;
  }

  const cartVoiceApplyButton = event.target.closest("[data-cart-voice-apply]");
  if (cartVoiceApplyButton) {
    event.preventDefault();
    event.stopPropagation();
    stopCustomerCartVoiceRecognition(true);
    state.customerCartVoiceOpen = false;
    state.customerCartVoiceTranscript = "";
    state.customerCartVoiceListening = false;
    render();
    return;
  }

  const openCartDeleteButton = event.target.closest("[data-open-cart-delete]");
  if (openCartDeleteButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerCartDeleteIndex = Number(openCartDeleteButton.dataset.openCartDelete || -1);
    state.cartUploadPreviewIndex = -1;
    state.cartUploadDeleteIndex = -1;
    render();
    return;
  }

  const closeCartDeleteButton = event.target.closest("[data-close-cart-delete]");
  if (closeCartDeleteButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerCartDeleteIndex = -1;
    render();
    return;
  }

  const cartDeleteBackdrop = event.target.closest("[data-cart-delete-backdrop]");
  if (cartDeleteBackdrop && event.target === cartDeleteBackdrop) {
    event.preventDefault();
    state.customerCartDeleteIndex = -1;
    render();
    return;
  }

  const confirmCartDeleteButton = event.target.closest("[data-confirm-cart-delete]");
  if (confirmCartDeleteButton) {
    event.preventDefault();
    event.stopPropagation();
    const index = Number(state.customerCartDeleteIndex);
    const item = Number.isInteger(index) && index >= 0 && index < state.cart.length ? state.cart[index] : null;
    if (item) {
      await deleteCustomerCartItemFromServer({
        index,
        id: item.id || null,
        categoryId: item.categoryId || null,
        storeId: item.storeId || null
      });
      resetCustomerEmptyCartDetails();
      showCustomerCartNotice(`${item.name || "Item"} removed from review.`);
    }
    state.customerCartDeleteIndex = -1;
    render();
    return;
  }

  const closeCartUploadPreviewButton = event.target.closest("[data-close-cart-upload-preview]");
  if (closeCartUploadPreviewButton) {
    event.preventDefault();
    event.stopPropagation();
    state.cartUploadPreviewIndex = -1;
    render();
    return;
  }

  const closeCartUploadDeleteButton = event.target.closest("[data-close-cart-upload-delete]");
  if (closeCartUploadDeleteButton) {
    event.preventDefault();
    event.stopPropagation();
    state.cartUploadDeleteIndex = -1;
    render();
    return;
  }

  const cartUploadPreviewBackdrop = event.target.closest("[data-cart-upload-preview-backdrop]");
  if (cartUploadPreviewBackdrop && event.target === cartUploadPreviewBackdrop) {
    event.preventDefault();
    state.cartUploadPreviewIndex = -1;
    render();
    return;
  }

  const cartUploadDeleteBackdrop = event.target.closest("[data-cart-upload-delete-backdrop]");
  if (cartUploadDeleteBackdrop && event.target === cartUploadDeleteBackdrop) {
    event.preventDefault();
    state.cartUploadDeleteIndex = -1;
    render();
    return;
  }

  const confirmCartUploadDeleteButton = event.target.closest("[data-confirm-cart-upload-delete]");
  if (confirmCartUploadDeleteButton) {
    event.preventDefault();
    event.stopPropagation();
    const index = Number(state.cartUploadDeleteIndex);
    const files = Array.isArray(state.cartUploads) ? state.cartUploads : [];
    const entry = Number.isInteger(index) && index >= 0 && index < files.length ? files[index] : null;
    if (entry?.previewUrl) {
      try {
        URL.revokeObjectURL(entry.previewUrl);
      } catch (error) {
        /* noop */
      }
    }
    if (entry) {
      state.cartUploads = files.filter((_, itemIndex) => itemIndex !== index);
    }
    state.cartUploadDeleteIndex = -1;
    state.cartUploadPreviewIndex = -1;
    render();
    return;
  }

  const assistantLoginModeButton = event.target.closest("[data-assistant-login-mode]");
  if (assistantLoginModeButton) {
    state.assistantLoginMode = assistantLoginModeButton.dataset.assistantLoginMode || "code";
    state.loginBusy = false;
    renderAssistantLogin();
    return;
  }

  const assistantResetToggle = event.target.closest("[data-assistant-reset-toggle]");
  if (assistantResetToggle) {
    state.assistantResetOpen = !state.assistantResetOpen;
    state.assistantResetCodeSent = false;
    renderAssistantLogin();
    return;
  }

  const changeCustomerLocation = event.target.closest("[data-change-customer-location]");
  if (changeCustomerLocation) {
    state.locationMessage = "";
    openCustomerLocationPickerSheet();
    return;
  }

  const openSavedLocationsButton = event.target.closest("[data-open-saved-locations]");
  if (openSavedLocationsButton) {
    event.preventDefault();
    event.stopPropagation();
    customerSetReturnTarget("savedLocations", openSavedLocationsButton.dataset.returnView || state.customerView || "home");
    state.customerSavedLocationsPage = 1;
    state.customerLocationPickerSheetOpen = false;
    state.customerLocationPickerClosing = false;
    state.customerLocationPickerPurpose = "";
    state.customerView = "savedLocations";
    renderCustomerSavedLocations();
    return;
  }

  const savedLocationsPageButton = event.target.closest("[data-saved-locations-page]");
  if (savedLocationsPageButton) {
    event.preventDefault();
    event.stopPropagation();
    const nextPage = Number(savedLocationsPageButton.dataset.savedLocationsPage || 1);
    if (!Number.isFinite(nextPage) || savedLocationsPageButton.disabled) return;
    state.customerSavedLocationsPage = nextPage;
    renderCustomerSavedLocations();
    return;
  }

  const editSavedAddressButton = event.target.closest("[data-edit-saved-address]");
  if (editSavedAddressButton) {
    event.preventDefault();
    event.stopPropagation();
    const address = state.customerAddresses[Number(editSavedAddressButton.dataset.editSavedAddress)];
    if (!address) return;
    state.locationPicked = {
      ...customerNormalizePersistedLocation(address),
      label: address.label || "Saved",
      savedAddressId: address.addressId || null,
      addressId: address.addressId || null,
      isDefault: Boolean(address.isDefault)
    };
    state.customerLocationPickerSheetOpen = false;
    state.customerView = "location";
    state.locationStep = "confirm";
    state.locationConfirmReturnStep = "savedLocations";
    hydrateConfirmLocationSaveAsState(state.locationPicked);
    renderCustomerLocation();
    return;
  }

  const deleteSavedAddressButton = event.target.closest("[data-delete-saved-address]");
  if (deleteSavedAddressButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerSavedLocationDeleteId = String(deleteSavedAddressButton.dataset.deleteSavedAddress || "");
    state.customerSavedLocationDeleting = false;
    renderCustomerSavedLocations();
    return;
  }

  const closeSavedLocationDeleteButton = event.target.closest("[data-close-saved-location-delete]");
  if (closeSavedLocationDeleteButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerSavedLocationDeleteId = "";
    state.customerSavedLocationDeleting = false;
    renderCustomerSavedLocations();
    return;
  }

  const savedLocationDeleteBackdrop = event.target.closest("[data-saved-location-delete-backdrop]");
  if (savedLocationDeleteBackdrop && event.target === savedLocationDeleteBackdrop) {
    event.preventDefault();
    state.customerSavedLocationDeleteId = "";
    state.customerSavedLocationDeleting = false;
    renderCustomerSavedLocations();
    return;
  }

  const confirmSavedLocationDeleteButton = event.target.closest("[data-confirm-saved-location-delete]");
  if (confirmSavedLocationDeleteButton) {
    event.preventDefault();
    event.stopPropagation();
    const addressId = String(state.customerSavedLocationDeleteId || "");
    if (!addressId || state.customerSavedLocationDeleting) return;
    state.customerSavedLocationDeleting = true;
    renderCustomerSavedLocations();
    try {
      await api(`/portal/customer/addresses/${encodeURIComponent(addressId)}`, { method: "DELETE" });
      clearPortalResourceCache("/portal/customer/addresses");
      state.customerAddresses = state.customerAddresses.filter((address) => customerLocationAddressId(address) !== addressId);
      if (customerLocationAddressId(state.selectedLocation || {}) === addressId) state.selectedLocation = null;
      state.customerSavedLocationDeleteId = "";
      state.customerSavedLocationDeleting = false;
      renderCustomerSavedLocations();
    } catch (error) {
      state.customerSavedLocationDeleting = false;
      notify(error.message || "Unable to delete saved location.");
      renderCustomerSavedLocations();
    }
    return;
  }

  const openSelectedLocationConfirm = event.target.closest("[data-open-selected-location-confirm]");
  if (openSelectedLocationConfirm) {
    event.preventDefault();
    event.stopPropagation();
    const selected = state.selectedLocation || null;
    if (!selected) {
      state.locationMessage = "";
      openCustomerLocationPickerSheet();
      return;
    }
    state.locationPicked = selected;
    state.customerLocationPickerSheetOpen = false;
    state.customerView = "location";
    state.locationStep = "confirm";
    state.locationConfirmReturnStep = "home";
    hydrateConfirmLocationSaveAsState(selected);
    renderCustomerLocation();
    return;
  }

  const closeLocationPickerButton = event.target.closest("[data-close-location-picker]");
  if (closeLocationPickerButton) {
    event.preventDefault();
    event.stopPropagation();
    closeCustomerLocationPickerSheet();
    return;
  }

  const confirmLocationSaveAsButton = event.target.closest("[data-confirm-location-save-as]");
  if (confirmLocationSaveAsButton) {
    if (confirmLocationSaveAsButton.disabled || confirmLocationSaveAsButton.getAttribute("aria-disabled") === "true") return;
    const value = String(confirmLocationSaveAsButton.dataset.confirmLocationSaveAs || "");
    state.locationSaveAsMessage = "";
    if (state.locationSaveAsLabel === value && !state.locationSaveAsOtherOpen) {
      state.locationSaveAsLabel = "";
      state.locationSaveAsOtherOpen = false;
      state.locationSaveAsCustomLabel = "";
      state.locationSaveAsDefault = false;
    } else if (value === "Other") {
      if (state.locationSaveAsLabel === "Other" && state.locationSaveAsOtherOpen) {
        state.locationSaveAsLabel = "";
        state.locationSaveAsOtherOpen = false;
        state.locationSaveAsCustomLabel = "";
        state.locationSaveAsDefault = false;
      } else {
        state.locationSaveAsLabel = "Other";
        state.locationSaveAsOtherOpen = true;
        state.locationSaveAsDefault = false;
      }
    } else {
      state.locationSaveAsLabel = value;
      state.locationSaveAsOtherOpen = false;
      state.locationSaveAsCustomLabel = "";
      state.locationSaveAsDefault = false;
    }
    refreshConfirmLocationSaveAsOptions({ focusOther: state.locationSaveAsOtherOpen });
    return;
  }

  const confirmLocationOtherAction = event.target.closest("[data-confirm-location-other-action]");
  if (confirmLocationOtherAction) {
    const customLabel = String(state.locationSaveAsCustomLabel || "").trim();
    state.locationSaveAsMessage = "";
    if (customLabel) {
      state.locationSaveAsLabel = "Other";
      state.locationSaveAsOtherOpen = false;
    } else {
      state.locationSaveAsLabel = "";
      state.locationSaveAsOtherOpen = false;
      state.locationSaveAsCustomLabel = "";
      state.locationSaveAsDefault = false;
    }
    refreshConfirmLocationSaveAsOptions();
    return;
  }

  const locationPermissionManualButton = event.target.closest("[data-location-permission-manual]");
  if (locationPermissionManualButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerLocationPermissionPopupOpen = false;
    state.locationMessage = "";
    openCustomerLocationPickerSheet({ step: "manual", focusSearch: true });
    return;
  }

  const locationPermissionEnableButton = event.target.closest("[data-location-permission-enable]");
  if (locationPermissionEnableButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerLocationPermissionPopupOpen = false;
    try {
      await openCustomerCurrentLocationConfirm({ returnStep: "picker" });
    } catch (error) {
      state.locationBusy = false;
      state.customerLocationPermissionPopupOpen = false;
      state.locationMessage = error.message || "Enable device or browser location permission and try again.";
      if (["home", "cart"].includes(state.customerView) && state.customerLocationPickerSheetOpen) syncCustomerHomeLocationPickerSheet();
      else render();
    }
    return;
  }

  const locationMapZoomButton = event.target.closest("[data-location-map-zoom]");
  if (locationMapZoomButton) {
    event.preventDefault();
    event.stopPropagation();
    adjustCustomerLocationMapZoom(locationMapZoomButton.dataset.locationMapZoom === "out" ? -1 : 1);
    return;
  }

  const confirmLocationBackButton = event.target.closest("[data-confirm-location-back]");
  if (confirmLocationBackButton) {
    event.preventDefault();
    event.stopPropagation();
    backFromCustomerConfirmLocation();
    return;
  }

  const locationStepButton = event.target.closest("[data-location-step]");
  if (locationStepButton) {
    event.preventDefault();
    event.stopPropagation();
    const requestedStep = locationStepButton.dataset.locationStep || "permission";
    if (locationStepButton.closest(".location-confirm-screen")) {
      state.customerView = "home";
      state.customerLocationPickerSheetOpen = true;
      state.customerLocationPickerClosing = false;
      state.locationStep = requestedStep === "manual" ? "manual" : "permission";
      renderCustomer();
      if (state.locationStep === "manual") setTimeout(focusLocationSearchInput, 80);
      return;
    }
    state.locationStep = requestedStep === "manual" || requestedStep === "options" || requestedStep === "permission"
      ? (requestedStep === "options" ? "permission" : requestedStep)
      : "permission";
    if (state.locationStep !== "manual") state.locationMessage = "";
    openCustomerLocationPickerSheet({ focusSearch: state.locationStep === "manual" });
    return;
  }

  const useCurrentLocationButton = event.target.closest("[data-use-current-location]");
  if (useCurrentLocationButton) {
    event.preventDefault();
    event.stopPropagation();
    const fromConfirmLocation = Boolean(useCurrentLocationButton.closest(".location-confirm-screen"));
    state.customerLocationPermissionRequesting = true;
    state.locationBusy = true;
    if (!fromConfirmLocation) {
      useCurrentLocationButton.textContent = "Enabling...";
      useCurrentLocationButton.disabled = true;
      updateCustomerLocationPickerPermissionUi();
    }
    try {
      if (fromConfirmLocation) {
        await openCustomerCurrentLocationConfirm({ returnStep: state.locationConfirmReturnStep || "manual" });
      } else {
        await useCustomerCurrentLocation({ rememberRecent: false, setPreferred: false, deferUiUntilPermission: true });
        updateCustomerLocationPickerPermissionUi();
      }
    } catch (error) {
      state.locationBusy = false;
      state.customerLocationPermissionPopupOpen = false;
      state.customerLocationPermissionRequesting = false;
      state.locationMessage = error.message || "Enable device or browser location permission and try again.";
      if (fromConfirmLocation) {
        state.locationStep = "confirm";
        renderCustomerLocation();
      } else {
        state.locationStep = "permission";
        if (["home", "cart"].includes(state.customerView) && state.customerLocationPickerSheetOpen) updateCustomerLocationPickerPermissionUi();
      }
    } finally {
      state.customerLocationPermissionRequesting = false;
    }
    return;
  }

  const changeCurrentLocationButton = event.target.closest("[data-change-current-location]");
  if (changeCurrentLocationButton) {
    event.preventDefault();
    event.stopPropagation();
    const picked = state.currentDeviceLocation || state.locationPicked || state.selectedLocation;
    if (picked && Number.isFinite(Number(picked.latitude)) && Number.isFinite(Number(picked.longitude))) {
      state.locationPicked = {
        ...picked,
        label: customerDisplayLocationLabel(picked) || picked.label || "Current location",
        savedAddressId: picked.savedAddressId || picked.addressId || null,
        addressId: picked.addressId || picked.savedAddressId || null,
        isDefault: Boolean(picked.isDefault)
      };
      state.locationPicked = customerStagePickedLocationForHome(state.locationPicked) || state.locationPicked;
      state.customerLocationPickerSheetOpen = false;
      state.customerLocationPickerClosing = false;
      state.customerView = "location";
      state.locationStep = "confirm";
      state.locationConfirmReturnStep = state.customerLocationPickerPurpose === "cart-stop" ? "cart-stop" : "picker";
      hydrateConfirmLocationSaveAsState(state.locationPicked);
      transitionCustomerLocationPickerToConfirm();
      return;
    }
    state.locationMessage = "Current location is not available. Tap Enable to allow location access.";
    syncCustomerHomeLocationPickerSheet();
    return;
  }

  const clearLocationSearchButton = event.target.closest("[data-clear-location-search]");
  if (clearLocationSearchButton) {
    if (locationSearchTimer) clearTimeout(locationSearchTimer);
    locationSearchRequestId += 1;
    state.locationSearchQuery = "";
    state.locationResults = [];
    state.locationBusy = false;
    state.locationMessage = "";
    if (["home", "cart"].includes(state.customerView) && state.customerLocationPickerSheetOpen) updateCustomerHomeLocationPickerSearch({ focusSearch: true });
    else syncCustomerHomeLocationPickerSheet({ focusSearch: true });
    return;
  }

  const locationResultButton = event.target.closest("[data-location-result]");
  if (locationResultButton) {
    if (state.customerLocationPickerPurpose === "cart-stop") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const candidate = state.locationResults[Number(locationResultButton.dataset.locationResult)];
      if (!candidate) return;
      try {
        await putCustomerCartLocationStop({ ...candidate, source: candidate.source || "search" });
        closeCustomerCartStopPickerToReview();
      } catch (error) {
        notify(error.message || "Unable to add location.");
      }
      return;
    }
    await openCustomerSearchLocationConfirm(locationResultButton, event);
    return;
  }

  const savedAddressButton = event.target.closest("[data-use-saved-address]");
  if (savedAddressButton) {
    event.preventDefault();
    event.stopPropagation();
    const address = state.customerAddresses[Number(savedAddressButton.dataset.useSavedAddress)];
    if (!address) return;
    try {
      const isCartStopLocationPick = state.customerLocationPickerPurpose === "cart-stop";
      const isSavedLocationsPagePick = state.customerView === "savedLocations";
      if (isCartStopLocationPick) {
        await putCustomerCartLocationStop({
          ...address,
          label: address.label || "Saved",
          address: address.address || address.addressText,
          savedAddressId: address.addressId || address.id || null,
          addressId: address.addressId || address.id || null,
          source: "saved"
        });
        closeCustomerCartStopPickerToReview();
        return;
      }
      state.locationBusy = isCartStopLocationPick;
      state.locationMessage = isCartStopLocationPick ? "Checking saved address..." : "";
      if (isCartStopLocationPick) syncCustomerHomeLocationPickerSheet();
      const picked = await validateAndPickCustomerLocation({
        ...address,
        address: address.address || address.addressText,
        latitude: Number(address.latitude),
        longitude: Number(address.longitude),
        source: "saved"
      }, { rememberRecent: false, setPreferred: !isCartStopLocationPick });
      const cluster = customerLocationCluster(picked);
      if (!cluster.clusterId) {
        state.customerView = isCartStopLocationPick ? "cart" : "home";
        state.customerLocationPickerSheetOpen = true;
        state.locationBusy = false;
        syncCustomerHomeLocationPickerSheet();
        return;
      }
      if (isCartStopLocationPick) {
        await putCustomerCartLocationStop({
          ...address,
          ...picked,
          label: address.label || picked.label || "Saved",
          address: address.address || address.addressText || picked.address || picked.addressText,
          savedAddressId: address.addressId || address.id || picked.addressId || null,
          addressId: address.addressId || address.id || picked.addressId || null,
          source: "saved"
        });
        state.locationBusy = false;
        state.locationMessage = "";
        closeCustomerCartStopPickerToReview();
        return;
      }
      state.locationPicked = {
        ...picked,
        label: address.label || "Saved",
        savedAddressId: address.addressId || null,
        addressId: address.addressId || picked.addressId || null,
        isDefault: Boolean(address.isDefault)
      };
      state.locationPicked = customerStagePickedLocationForHome(state.locationPicked) || state.locationPicked;
      if (!isCartStopLocationPick) {
        const selectedAddressId = state.locationPicked.savedAddressId || state.locationPicked.addressId || "";
        if (selectedAddressId) {
          state.selectedLocation.isDefault = true;
          state.customerAddresses = state.customerAddresses.map((item) => ({
            ...item,
            isDefault: String(item.addressId || "") === String(selectedAddressId)
          }));
          state.customerRecentLocations = state.customerRecentLocations.map((item) => ({
            ...item,
            isDefault: String(item.addressId || "") === String(selectedAddressId)
          }));
        }
        state.locationBusy = false;
        state.locationMessage = "";
        closeCustomerLocationPickerSheet();
        updateCustomerHomeLocationHeaderOnly();
        writePortalSessionCache();
        if (isSavedLocationsPagePick) {
          state.customerView = "home";
          render();
        }
        void (async () => {
          if (selectedAddressId) await customerSetDefaultLocationAddress(selectedAddressId);
          const clusterId = customerLocationCluster(state.selectedLocation || {}).clusterId;
          if (clusterId) await loadCustomerCatalog({ clusterId }).catch(() => null);
          writePortalSessionCache();
        })();
        return;
      }
    } catch (error) {
      state.locationBusy = false;
      notify(error.message || "Unable to select saved address.");
      syncCustomerHomeLocationPickerSheet();
    }
    return;
  }

  const recentLocationButton = event.target.closest("[data-use-recent-location]");
  if (recentLocationButton) {
    event.preventDefault();
    event.stopPropagation();
    const location = state.customerRecentLocations[Number(recentLocationButton.dataset.useRecentLocation)];
    if (!location) return;
    try {
      if (state.customerLocationPickerPurpose === "cart-stop") {
        await putCustomerCartLocationStop({
          ...location,
          label: location.label || "Recent",
          address: location.address || location.addressText,
          addressId: location.addressId || location.id || null,
          source: customerLocationValidationSource(location.source || "map")
        });
        closeCustomerCartStopPickerToReview();
        return;
      }
      state.locationBusy = true;
      state.locationMessage = "Checking recent location...";
      syncCustomerHomeLocationPickerSheet();
      const picked = await validateAndPickCustomerLocation({
        ...location,
        source: location.source || "map"
      }, { rememberRecent: false, setPreferred: false });
      const cluster = customerLocationCluster(picked);
      if (!cluster.clusterId) {
        state.customerView = state.customerLocationPickerPurpose === "cart-stop" ? "cart" : "home";
        state.customerLocationPickerSheetOpen = true;
        state.locationBusy = false;
        syncCustomerHomeLocationPickerSheet();
        return;
      }
      state.locationPicked = {
        ...picked,
        label: location.label || picked.label || "Recent",
        addressId: location.addressId || picked.addressId || null,
        savedAddressId: null,
        isDefault: Boolean(location.isDefault)
      };
      state.customerLocationPickerSheetOpen = false;
      state.customerView = "location";
      state.locationStep = "confirm";
      state.locationConfirmReturnStep = state.customerLocationPickerPurpose === "cart-stop" ? "cart-stop" : "picker";
      state.locationBusy = false;
      hydrateConfirmLocationSaveAsState(state.locationPicked);
      renderCustomerLocation();
    } catch (error) {
      state.locationBusy = false;
      notify(error.message || "Unable to select recent location.");
      syncCustomerHomeLocationPickerSheet();
    }
    return;
  }

  const openCustomerSearchButton = event.target.closest("[data-open-customer-search]");
  if (openCustomerSearchButton) {
    event.preventDefault();
    state.customerSearchQuery = "";
    state.customerView = "search";
    state.customerLocationPickerSheetOpen = false;
    render();
    return;
  }

  const customerSearchBackButton = event.target.closest("[data-customer-search-back]");
  if (customerSearchBackButton) {
    event.preventDefault();
    state.customerSearchQuery = "";
    state.customerView = "home";
    render();
    return;
  }

  const customerSearchClearButton = event.target.closest("[data-customer-search-clear]");
  if (customerSearchClearButton) {
    event.preventDefault();
    state.customerSearchQuery = "";
    renderCustomerSearch();
    return;
  }

  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    event.preventDefault();
    const previousCustomerView = state.customerView;
    const nextCustomerView = viewButton.dataset.view || "home";
    const restoreBookingsScroll = actor === "customer" && previousCustomerView === "track" && nextCustomerView === "bookings" && state.customerBookingsReturnScroll;
    if (viewButton.dataset.returnView) {
      customerSetReturnTarget(nextCustomerView, viewButton.dataset.returnView);
    } else if (actor === "customer" && !restoreBookingsScroll && ["bookings", "savedLocations", "cart", "search"].includes(nextCustomerView) && previousCustomerView !== nextCustomerView) {
      customerSetReturnTarget(nextCustomerView, previousCustomerView || "home");
    }
    state.customerView = viewButton.dataset.view || "home";
    state.customerScheduleSheetOpen = false;
    state.customerPaymentSheetOpen = false;
  if (state.customerView === "home") {
      state.customerCatalogTab = "categories";
      state.selectedCategoryId = "";
      state.customerCategorySheetOpen = false;
      state.customerHomeCategorySheetOpen = false;
      state.customerHomeCategorySheetExpanded = false;
      try {
        await loadCustomerCatalog({ clusterId: selectedCustomerClusterId() });
      } catch (error) {
        notify(error.message || "Unable to refresh services.");
      }
    }
    render();
    if (restoreBookingsScroll) {
      restoreCustomerScroll(state.customerBookingsReturnScroll);
      state.customerBookingsReturnScroll = null;
    }
    return;
  }

  const quickReplyButton = event.target.closest("[data-portal-quick-reply-id]");
  if (quickReplyButton) {
    event.preventDefault();
    event.stopPropagation();
    const bookingId = quickReplyButton.dataset.bookingId || "";
    const reply = portalQuickRepliesFor(bookingId).find((item) => item.id === quickReplyButton.dataset.portalQuickReplyId);
    if (!reply) return;
    try {
      quickReplyButton.disabled = true;
      const taskUpdateInput = {
        bookingId,
        assignmentId: quickReplyButton.dataset.assignmentId || null,
        updateType: portalQuickReplyUpdateType(reply.actionType || "message"),
        message: reply.message || reply.title || "",
        metadata: {
          quickReplyId: reply.id,
          quickReplyTitle: reply.title,
          actionType: reply.actionType,
          audience: reply.audience,
          source: "booking_engine_quick_reply"
        }
      };
      const created = await postPortalTaskUpdate({ ...taskUpdateInput, skipReload: actor === "assistant" });
      if (actor === "assistant") assistantApplyLocalTaskUpdate(taskUpdateInput, created);
      notify("Quick reply sent.");
      quickReplyButton.disabled = false;
      if (actor !== "assistant" && !refreshAssistantAfterPopupMutation()) render();
    } catch (error) {
      notify(error.message || "Unable to send quick reply.");
      quickReplyButton.disabled = false;
      if (actor !== "assistant" && !refreshAssistantAfterPopupMutation()) render();
    }
    return;
  }

  const bookingsTabButton = event.target.closest("[data-bookings-tab]");
  if (bookingsTabButton) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const bookingsPage = document.querySelector(".customer-bookings-page");
    const bookingsTabs = bookingsPage?.querySelector(".booking-tabs") || null;
    const tabsScrollLeft = bookingsTabs ? bookingsTabs.scrollLeft : 0;
    state.customerBookingsTab = bookingsTabButton.dataset.bookingsTab || "all";
    state.customerBookingsPage = 1;
    state.customerBookingsHasMore = true;
    await loadCustomerBookings({ reset: true, silent: true });
    if (bookingsTabs) bookingsTabs.scrollLeft = tabsScrollLeft;
    return;
  }

  const bookingsLoadMoreButton = event.target.closest("[data-bookings-load-more]");
  if (bookingsLoadMoreButton) {
    event.preventDefault();
    event.stopPropagation();
    if (state.customerBookingsLoading || !state.customerBookingsHasMore) return;
    await loadCustomerBookings({ append: true, silent: true });
    return;
  }

  const openHomeCategorySheetButton = event.target.closest("[data-open-home-category-detail]");
  if (openHomeCategorySheetButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerHomeCategorySheetId = openHomeCategorySheetButton.dataset.openHomeCategoryDetail || "";
    state.customerHomeCategorySheetExpanded = false;
    state.customerHomeCategorySheetOpen = true;
    invalidateCustomerAvailabilityDecision();
    await refreshCustomerAvailabilityDecision();
    render();
    requestAnimationFrame(customerCenterHomeCategorySheetSelection);
    return;
  }

  const homeExpandDurationButton = event.target.closest("[data-home-expand-duration]");
  if (homeExpandDurationButton) {
    event.preventDefault();
    event.stopPropagation();
    if (homeExpandDurationButton.closest(".customer-home-expand-duration-row")?.dataset.dragging === "true") return;
    focusCustomerHomeDurationCard(homeExpandDurationButton);
    const durationId = homeExpandDurationButton.dataset.homeExpandDuration || "";
    const selectedDuration = customerHomeExpandedDurationOptionById(durationId);
    state.selectedHomeDurationId = durationId;
    state.selectedHomeScheduleDurationId = durationId;
    const categoryId = homeExpandDurationButton.dataset.categoryId || "";
    state.customerHomeDurationSheetCategoryId = categoryId;
    state.customerHomeCategorySheetId = categoryId;
    state.customerHomeCategorySheetExpanded = false;
    document.querySelectorAll(".portal-customer [data-home-expand-duration]").forEach((button) => {
      const isActive = button === homeExpandDurationButton;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    if (!categoryId || !selectedDuration) return;
    const bookingType = customerHomeDurationBookingType(selectedDuration);
    if (bookingType === "instant") {
      state.bookingType = "instant";
      state.customerHomeCategorySheetOpen = false;
      state.customerHomeDurationSheetOpen = false;
      state.customerHomeScheduleSheetOpen = false;
      invalidateCustomerAvailabilityDecision();
      state.customerAvailabilityLoading = true;
      await refreshCustomerAvailabilityDecision();
      if (!customerInstantAvailableForCurrentContext()) {
        notify("Instant booking is not available for this duration.", "warning");
        render();
        return;
      }
      await addCategoryToCart(categoryId, false, selectedDuration);
      state.customerScheduleSheetOpen = false;
      state.customerHomeDurationSheetOpen = false;
      state.customerHomeCategorySheetOpen = false;
      state.customerHomeCategorySheetExpanded = false;
      state.customerView = "cart";
      render();
      return;
    }
    if (bookingType === "schedule") {
      state.bookingType = "schedule";
      state.customerHomeScheduleSheetCategoryId = categoryId;
      state.selectedHomeScheduleDate = customerHomeScheduleDates(customerHomeScheduleConfig())[0]?.value || "";
      state.selectedHomeSchedulePeriod = "";
      state.selectedHomeScheduleTime = "";
      let scheduleDurations = [];
      try {
        scheduleDurations = await refreshCustomerCategoryDurationData(categoryId);
      } catch (error) {
        notify(error.message || "Unable to load category durations.", "error");
        render();
        return;
      }
      if (!scheduleDurations.length) {
        notify("Duration options are not configured yet.");
        render();
        return;
      }
      state.selectedHomeScheduleDurationId = scheduleDurations.some((item) => String(item.id || "") === String(durationId)) ? durationId : scheduleDurations[0]?.id || "";
      state.customerHomeScheduleSheetOpen = false;
      state.customerHomeDurationSheetOpen = false;
      state.customerHomeCategorySheetOpen = false;
      state.customerHomeCategorySheetExpanded = false;
      state.customerView = "homeSchedule";
      invalidateCustomerAvailabilityDecision();
      await refreshCustomerAvailabilityDecision();
      ensureCustomerHomeScheduleSelection();
      render();
      return;
    }
    state.customerHomeCategorySheetOpen = true;
    invalidateCustomerAvailabilityDecision();
    await refreshCustomerAvailabilityDecision();
    render();
    requestAnimationFrame(customerCenterHomeCategorySheetSelection);
    return;
  }

  const selectHomeCategorySheetButton = event.target.closest("[data-select-home-category-detail]");
  if (selectHomeCategorySheetButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerHomeCategorySheetId = selectHomeCategorySheetButton.dataset.selectHomeCategoryDetail || "";
    invalidateCustomerAvailabilityDecision();
    await refreshCustomerAvailabilityDecision();
    if (!refreshCustomerHomeCategorySheetUi()) render();
    return;
  }

  const collapseHomeCategorySheetButton = event.target.closest("[data-home-category-sheet-collapse]");
  if (collapseHomeCategorySheetButton) {
    event.preventDefault();
    event.stopPropagation();
    if (!closeCustomerHomeCategorySheetInPlace()) render();
    return;
  }

  const closeHomeDurationSheetButton = event.target.closest("[data-close-home-duration-sheet]");
  if (closeHomeDurationSheetButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerHomeDurationSheetOpen = false;
    state.customerHomeDurationSheetCategoryId = "";
    render();
    return;
  }

  const selectHomeDurationButton = event.target.closest("[data-select-home-duration]");
  if (selectHomeDurationButton) {
    event.preventDefault();
    event.stopPropagation();
    state.selectedHomeDurationId = selectHomeDurationButton.dataset.selectHomeDuration || "";
    state.customerAvailabilityDecision = null;
    state.customerAvailabilityLoading = true;
    refreshCustomerHomeDurationSheetSelection();
    await refreshCustomerAvailabilityDecision();
    if (!refreshCustomerHomeDurationSheetSelection()) render();
    return;
  }

  const confirmHomeDurationButton = event.target.closest("[data-confirm-home-duration]");
  if (confirmHomeDurationButton) {
    event.preventDefault();
    event.stopPropagation();
    const rows = customerHomeDurationSheetOptions();
    const selected = customerHomeDurationSheetSelectedOption(rows);
    if (!selected?.id) {
      notify("Duration options are not configured yet.");
      return;
    }
    state.customerAvailabilityDecision = null;
    state.customerAvailabilityLoading = true;
    refreshCustomerHomeDurationSheetSelection();
    await refreshCustomerAvailabilityDecision();
    if (!customerInstantSlaAvailable()) {
      if (!refreshCustomerHomeDurationSheetSelection()) render();
      return;
    }
    await addCategoryToCart(selected.categoryId || state.customerHomeDurationSheetCategoryId || selected.id, false, selected);
    if (state.customerCartReplace) {
      state.customerHomeDurationSheetOpen = false;
      render();
      return;
    }
    state.bookingType = "instant";
    state.customerScheduleSheetOpen = false;
    state.customerHomeDurationSheetOpen = false;
    state.customerHomeCategorySheetOpen = false;
    state.customerHomeCategorySheetExpanded = false;
    state.customerView = "cart";
    render();
    return;
  }

  const homeDurationSheetBackdrop = event.target.closest("[data-home-duration-sheet-backdrop]");
  if (homeDurationSheetBackdrop && event.target === homeDurationSheetBackdrop) {
    event.preventDefault();
    state.customerHomeDurationSheetOpen = false;
    state.customerHomeDurationSheetCategoryId = "";
    render();
    return;
  }

  const closeHomeScheduleSheetButton = event.target.closest("[data-close-home-schedule-sheet]");
  if (closeHomeScheduleSheetButton) {
    event.preventDefault();
    event.stopPropagation();
    const scheduleCategoryId = state.customerHomeScheduleSheetCategoryId || state.customerHomeCategorySheetId || "";
    state.customerHomeScheduleSheetOpen = false;
    if (state.customerView === "homeSchedule") {
      state.customerView = "home";
      state.customerHomeCategorySheetId = scheduleCategoryId;
      state.customerHomeScheduleSheetCategoryId = "";
      state.customerHomeCategorySheetOpen = true;
      state.customerHomeCategorySheetExpanded = false;
      state.selectedHomeScheduleDurationId = "";
      state.selectedHomeScheduleTime = "";
    } else {
      state.customerHomeScheduleSheetCategoryId = "";
    }
    render();
    if (state.customerHomeCategorySheetOpen) requestAnimationFrame(customerCenterHomeCategorySheetSelection);
    return;
  }

  const selectHomeScheduleDateButton = event.target.closest("[data-select-home-schedule-date]");
  if (selectHomeScheduleDateButton) {
    event.preventDefault();
    event.stopPropagation();
    if (selectHomeScheduleDateButton.disabled || selectHomeScheduleDateButton.classList.contains("disabled")) {
      notify("No time slots are available for this date.");
      return;
    }
    state.selectedHomeScheduleDate = selectHomeScheduleDateButton.dataset.selectHomeScheduleDate || "";
    state.selectedHomeScheduleTime = "";
    ensureCustomerHomeScheduleSelection();
    if (state.customerView === "homeSchedule" && refreshCustomerHomeSchedulePageUi({ replaceTimePanel: true })) return;
    render();
    return;
  }

  const selectHomeScheduleDurationButton = event.target.closest("[data-select-home-schedule-duration]");
  if (selectHomeScheduleDurationButton) {
    event.preventDefault();
    event.stopPropagation();
    state.selectedHomeScheduleDurationId = selectHomeScheduleDurationButton.dataset.selectHomeScheduleDuration || "";
    ensureCustomerHomeScheduleSelection();
    await refreshCustomerAvailabilityDecision();
    ensureCustomerHomeScheduleSelection();
    if (state.customerView === "homeSchedule" && refreshCustomerHomeSchedulePageUi({ replaceTimePanel: true })) {
      requestAnimationFrame(() => selectHomeScheduleDurationButton.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" }));
      return;
    }
    render();
    requestAnimationFrame(() => selectHomeScheduleDurationButton.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" }));
    return;
  }

  const selectHomeSchedulePeriodButton = event.target.closest("[data-select-home-schedule-period]");
  if (selectHomeSchedulePeriodButton) {
    event.preventDefault();
    event.stopPropagation();
    if (selectHomeSchedulePeriodButton.disabled || selectHomeSchedulePeriodButton.classList.contains("disabled")) {
      notify("No assistants are available in this time category.");
      return;
    }
    state.selectedHomeSchedulePeriod = selectHomeSchedulePeriodButton.dataset.selectHomeSchedulePeriod || "";
    state.selectedHomeScheduleTime = "";
    ensureCustomerHomeScheduleSelection();
    if (state.customerView === "homeSchedule" && refreshCustomerHomeSchedulePageUi({ replaceTimePanel: false, scrollToPeriod: true })) return;
    render();
    requestAnimationFrame(() => document.querySelector(".portal-customer [data-home-schedule-time-grid]")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    return;
  }

  const selectHomeScheduleTimeButton = event.target.closest("[data-select-home-schedule-time]");
  if (selectHomeScheduleTimeButton) {
    event.preventDefault();
    event.stopPropagation();
    if (selectHomeScheduleTimeButton.disabled || selectHomeScheduleTimeButton.classList.contains("disabled")) {
      notify("This time slot is not available.");
      return;
    }
    state.selectedHomeScheduleTime = selectHomeScheduleTimeButton.dataset.selectHomeScheduleTime || "";
    state.selectedHomeSchedulePeriod = selectHomeScheduleTimeButton.dataset.homeScheduleTimePeriod || state.selectedHomeSchedulePeriod || "";
    if (state.customerView === "homeSchedule" && refreshCustomerHomeSchedulePageUi({ replaceTimePanel: false })) return;
    render();
    return;
  }

  const confirmHomeScheduleButton = event.target.closest("[data-confirm-home-schedule]");
  if (confirmHomeScheduleButton) {
    event.preventDefault();
    event.stopPropagation();
    const selected = customerHomeScheduleSelectedDuration();
    if (!selected?.id || !state.selectedHomeScheduleDate || !state.selectedHomeScheduleTime) {
      notify("Select date, duration and start time.");
      return;
    }
    state.selectedScheduleDate = state.selectedHomeScheduleDate;
    state.selectedScheduleTime = state.selectedHomeScheduleTime;
    state.selectedSchedulePeriod = state.selectedHomeSchedulePeriod;
    await addCategoryToCart(selected.categoryId || state.customerHomeScheduleSheetCategoryId || selected.id, false, selected);
    if (state.customerCartReplace) {
      state.customerHomeScheduleSheetOpen = false;
      render();
      return;
    }
    state.bookingType = "schedule";
    state.customerScheduleSheetOpen = false;
    state.customerHomeScheduleSheetOpen = false;
    state.customerHomeDurationSheetOpen = false;
    state.customerHomeCategorySheetOpen = false;
    state.customerHomeCategorySheetExpanded = false;
    state.customerView = "cart";
    render();
    return;
  }

    const homeCategoryBookingButton = event.target.closest("[data-home-category-booking-mode]");
    if (homeCategoryBookingButton) {
      event.preventDefault();
      event.stopPropagation();
      const mode = homeCategoryBookingButton.dataset.homeCategoryBookingMode === "schedule" ? "schedule" : "instant";
      const categoryId = homeCategoryBookingButton.dataset.categoryId || state.customerHomeCategorySheetId || "";
      await refreshCustomerAvailabilityDecision();
    if (mode === "instant") {
      if (!customerAvailabilityServiceOpen()) {
        state.bookingType = "schedule";
        render();
        return;
      }
      state.customerHomeDurationSheetCategoryId = categoryId;
      let rows = [];
      try {
        rows = await refreshCustomerCategoryDurationData(categoryId);
      } catch (error) {
        notify(error.message || "Unable to load category durations.", "error");
        render();
        return;
      }
      if (!rows.length) {
        notify("Duration options are not configured yet.");
        render();
        return;
      }
    if (!rows.some((item) => String(item.id || "") === String(state.selectedHomeDurationId || ""))) {
      state.selectedHomeDurationId = rows[0]?.id || "";
    }
      await refreshCustomerAvailabilityDecision();
      if (!customerInstantSlaAvailable()) {
        state.bookingType = "schedule";
        render();
        return;
      }
      state.customerHomeDurationSheetOpen = true;
      render();
      return;
    }
    state.customerHomeScheduleSheetCategoryId = categoryId;
    state.selectedHomeScheduleDate = customerHomeScheduleDates(customerHomeScheduleConfig())[0]?.value || "";
    let scheduleDurations = [];
    try {
      scheduleDurations = await refreshCustomerCategoryDurationData(categoryId);
    } catch (error) {
      notify(error.message || "Unable to load category durations.", "error");
      render();
      return;
    }
    const preferredScheduleDurationId = state.selectedHomeScheduleDurationId || state.selectedHomeDurationId || "";
    state.selectedHomeScheduleDurationId = scheduleDurations.some((item) => String(item.id || "") === String(preferredScheduleDurationId))
      ? preferredScheduleDurationId
      : scheduleDurations[0]?.id || "";
    state.selectedHomeSchedulePeriod = "";
    state.selectedHomeScheduleTime = "";
    if (!scheduleDurations.length) {
      notify("Duration options are not configured yet.");
      render();
      return;
    }
    state.customerHomeScheduleSheetOpen = false;
    state.customerHomeDurationSheetOpen = false;
    state.customerHomeCategorySheetOpen = false;
    state.customerHomeCategorySheetExpanded = false;
    state.customerView = "homeSchedule";
    await refreshCustomerAvailabilityDecision();
    ensureCustomerHomeScheduleSelection();
    render();
    return;
  }

  const closeHomeCategorySheetButton = event.target.closest("[data-close-home-category-sheet]");
  if (closeHomeCategorySheetButton) {
    event.preventDefault();
    event.stopPropagation();
    if (!closeCustomerHomeCategorySheetInPlace()) render();
    return;
  }

  const homeCategorySheetBackdrop = event.target.closest("[data-home-category-sheet-backdrop]");
  if (homeCategorySheetBackdrop && event.target === homeCategorySheetBackdrop) {
    event.preventDefault();
    if (!closeCustomerHomeCategorySheetInPlace()) render();
    return;
  }

  const openCategorySheetButton = event.target.closest("[data-open-category-sheet]");
  if (openCategorySheetButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerCategorySheetOpen = true;
    render();
    return;
  }

  const closeCategorySheetButton = event.target.closest("[data-close-category-sheet]");
  if (closeCategorySheetButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerCategorySheetOpen = false;
    render();
    return;
  }

  const categorySheetBackdrop = event.target.closest("[data-category-sheet-backdrop]");
  if (categorySheetBackdrop && event.target === categorySheetBackdrop) {
    event.preventDefault();
    state.customerCategorySheetOpen = false;
    render();
    return;
  }

  const selectStoreCategoryButton = event.target.closest("[data-select-store-category]");
  if (selectStoreCategoryButton) {
    event.preventDefault();
    event.stopPropagation();
    const categoryId = selectStoreCategoryButton.dataset.selectStoreCategory || "";
    state.selectedCategoryId = categoryId;
    state.customerCatalogTab = "stores";
    state.customerCategorySheetOpen = false;
    try {
      await loadCustomerCatalog({ serviceId: state.selectedServiceId, categoryId });
    } catch (error) {
      notify(error.message || "Unable to load stores.");
    }
    render();
    return;
  }

  const reorderBookingButton = event.target.closest("[data-reorder-booking]");
  if (reorderBookingButton) {
    event.preventDefault();
    event.stopPropagation();
    const booking = state.bookings.find((item) => item.id === reorderBookingButton.dataset.reorderBooking);
    if (!booking) return;
    const items = normalizeCustomerCartItems(Array.isArray(booking.metadata?.cartItems) ? booking.metadata.cartItems : []);
    if (!items.length) {
      notify("No saved cart items found for reorder.");
      return;
    }
    state.cart = items;
    state.bookingType = String(booking.metadata?.bookingType || "instant") === "schedule" ? "schedule" : "instant";
    state.selectedServiceId = String(items[0]?.serviceId || "");
    state.selectedCategoryId = String(items[0]?.categoryId || "");
    state.customerView = "cart";
    state.customerScheduleSheetOpen = false;
    state.customerPaymentSheetOpen = false;
    invalidateCustomerAvailabilityDecision();
    await saveCustomerCartToServer(state.cart, state.customerCartNote);
    render();
    return;
  }

  const trackBookingButton = event.target.closest("[data-track-booking]");
  if (trackBookingButton) {
    if (state.customerView === "bookings") {
      state.customerBookingsReturnScroll = customerScrollSnapshot();
    }
    const bookingId = trackBookingButton.dataset.trackBooking;
    state.confirmedBooking = state.bookings.find((booking) => booking.id === bookingId) || state.confirmedBooking;
    state.customerView = "track";
    state.customerTrackChatExpanded = false;
    state.customerTrackBillExpanded = false;
    state.customerTrackMediaExpanded = false;
    state.customerTrackLocationsExpanded = false;
    if (bookingId) {
      try {
        await loadPortalQuickReplies(bookingId);
      } catch (error) {
        notify(error.message || "Unable to load quick replies.");
      }
    }
    render();
    return;
  }

  const approveTimeButton = event.target.closest("[data-approve-time-update]");
  if (approveTimeButton) {
    try {
      approveTimeButton.disabled = true;
      approveTimeButton.textContent = "Approving...";
      await api(`/portal/task-updates/${approveTimeButton.dataset.approveTimeUpdate}/approve-time`, { method: "POST", body: JSON.stringify({}) });
      await loadMe({ forceRefresh: true });
      notify("Extra time approved.");
      render();
    } catch (error) {
      notify(error.message || "Unable to approve extra time.");
      render();
    }
    return;
  }

  const approvalResponseButton = event.target.closest("[data-approval-response]");
  if (approvalResponseButton) {
    const response = approvalResponseButton.dataset.approvalResponse === "yes" ? "yes" : "no";
    const purpose = approvalResponseButton.dataset.approvalPurpose || "";
    const isFinishConfirmation = purpose === "finish_confirmation";
    try {
      approvalResponseButton.disabled = true;
      approvalResponseButton.textContent = response === "yes" ? "Approving..." : "Sending...";
      await postPortalTaskUpdate({
        bookingId: approvalResponseButton.dataset.approvalBookingId,
        assignmentId: approvalResponseButton.dataset.approvalAssignmentId || null,
        updateType: "approval_response",
        message: isFinishConfirmation
          ? (response === "yes" ? "Customer confirmed task finish." : "Customer asked assistant to continue.")
          : (response === "yes" ? "Customer approved." : "Customer did not approve."),
        metadata: {
          sourceUpdateId: approvalResponseButton.dataset.approvalUpdateId,
          purpose,
          response,
          respondedAt: new Date().toISOString()
        }
      });
      notify(isFinishConfirmation ? (response === "yes" ? "Task finish confirmed." : "Assistant asked to continue.") : (response === "yes" ? "Approval shared." : "Response shared."));
      render();
    } catch (error) {
      notify(error.message || "Unable to share approval response.");
      render();
    }
    return;
  }

  const paymentResponseButton = event.target.closest("[data-payment-response]");
  if (paymentResponseButton) {
    if (actor === "customer") {
      state.customerPaymentProofRequest = {
        bookingId: paymentResponseButton.dataset.paymentBookingId || "",
        assignmentId: paymentResponseButton.dataset.paymentAssignmentId || "",
        updateId: paymentResponseButton.dataset.paymentUpdateId || "",
        amount: Number(paymentResponseButton.dataset.paymentAmount || 0)
      };
      renderTrackRealtimeUpdate();
      return;
    }
    try {
      const amount = Number(paymentResponseButton.dataset.paymentAmount || 0);
      paymentResponseButton.disabled = true;
      paymentResponseButton.textContent = "Paying...";
      await postPortalTaskUpdate({
        bookingId: paymentResponseButton.dataset.paymentBookingId,
        assignmentId: paymentResponseButton.dataset.paymentAssignmentId || null,
        updateType: "payment_response",
        message: amount > 0 ? `Customer paid ${money(amount)}.` : "Customer completed payment.",
        metadata: {
          sourceUpdateId: paymentResponseButton.dataset.paymentUpdateId,
          amount,
          status: "paid",
          paidAt: new Date().toISOString()
        }
      });
      notify("Payment shared.");
      render();
    } catch (error) {
      notify(error.message || "Unable to complete payment.");
      render();
    }
    return;
  }

  const customerPayNowButton = event.target.closest("[data-customer-pay-now]");
  if (customerPayNowButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerPaymentProofRequest = {
      bookingId: customerPayNowButton.dataset.paymentBookingId || "",
      assignmentId: customerPayNowButton.dataset.paymentAssignmentId || "",
      updateId: "",
      amount: Number(customerPayNowButton.dataset.paymentAmount || 0)
    };
    renderTrackRealtimeUpdate();
    return;
  }

  const assistantCashPaymentConfirmButton = event.target.closest("[data-assistant-cash-payment-confirm]");
  if (assistantCashPaymentConfirmButton) {
    event.preventDefault();
    event.stopPropagation();
    const response = String(assistantCashPaymentConfirmButton.dataset.assistantCashPaymentConfirm || "no").toLowerCase();
    const amount = Number(assistantCashPaymentConfirmButton.dataset.paymentAmount || 0);
    try {
      assistantCashPaymentConfirmButton.disabled = true;
      if (response === "yes") {
        await postPortalTaskUpdate({
          bookingId: assistantCashPaymentConfirmButton.dataset.paymentBookingId,
          assignmentId: assistantCashPaymentConfirmButton.dataset.paymentAssignmentId || null,
          updateType: "payment_received",
          message: amount > 0 ? `Assistant confirmed cash received for ${money(amount)}.` : "Assistant confirmed cash received.",
          metadata: {
            sourceUpdateId: assistantCashPaymentConfirmButton.dataset.paymentUpdateId || "",
            amount,
            mode: "cash",
            status: "paid",
            receivedAt: new Date().toISOString()
          }
        });
        notify("Cash payment marked as paid.");
      } else {
        await postPortalTaskUpdate({
          bookingId: assistantCashPaymentConfirmButton.dataset.paymentBookingId,
          assignmentId: assistantCashPaymentConfirmButton.dataset.paymentAssignmentId || null,
          updateType: "payment_response",
          message: "Assistant did not confirm cash collection. Payment is due.",
          metadata: {
            sourceUpdateId: assistantCashPaymentConfirmButton.dataset.paymentUpdateId || "",
            amount,
            mode: "cash",
            status: "due",
            response: "no",
            respondedAt: new Date().toISOString()
          }
        });
        notify("Payment moved back to Due.");
      }
      render();
    } catch (error) {
      notify(error.message || "Unable to update payment confirmation.");
      render();
    }
    return;
  }

  const logout = event.target.closest("[data-logout]");
  if (logout) {
    event.preventDefault();
    event.stopPropagation();
    state.logoutConfirmOpen = true;
    render();
    return;
  }

  const cancelLogout = event.target.closest("[data-cancel-logout]");
  if (cancelLogout) {
    event.preventDefault();
    event.stopPropagation();
    state.logoutConfirmOpen = false;
    render();
    return;
  }

  const confirmLogout = event.target.closest("[data-confirm-logout]");
  if (confirmLogout) {
    event.preventDefault();
    event.stopPropagation();
    executePortalLogout();
    render();
    return;
  }

  const openCartStopPickerButton = event.target.closest("[data-open-cart-stop-picker]");
  if (openCartStopPickerButton) {
    event.preventDefault();
    event.stopPropagation();
    openCustomerCartStopPicker({ editIndex: -1 });
    return;
  }

  const toggleCartRouteDetailsButton = event.target.closest("[data-toggle-cart-route-details]");
  if (toggleCartRouteDetailsButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerCartRouteExpanded = !state.customerCartRouteExpanded;
    refreshCustomerCartLocationSection();
    return;
  }

  const editCartLocationStopButton = event.target.closest("[data-edit-customer-cart-location-stop]");
  if (editCartLocationStopButton) {
    if (event.target.closest("[data-open-customer-cart-route-delete]")) return;
    if (Date.now() < customerCartRouteSuppressClickUntil) return;
    event.preventDefault();
    event.stopPropagation();
    const index = Number(editCartLocationStopButton.dataset.editCustomerCartLocationStop);
    openCustomerCartStopPicker({ editIndex: index });
    return;
  }

  const cartLocationResultButton = event.target.closest("[data-add-customer-cart-location-result]");
  if (cartLocationResultButton) {
    event.preventDefault();
    event.stopPropagation();
    const candidate = state.customerCartLocationResults[Number(cartLocationResultButton.dataset.addCustomerCartLocationResult)];
    if (!candidate) return;
    try {
      state.customerCartLocationBusy = true;
      state.customerCartLocationMessage = "Checking serviceability...";
      render();
      await putCustomerCartLocationStop({ ...candidate, source: candidate.source || "search" });
      render();
    } catch (error) {
      state.customerCartLocationBusy = false;
      notify(error.message || "Unable to add location.");
      render();
    }
    return;
  }

  const savedCartStopButton = event.target.closest("[data-add-customer-saved-stop]");
  if (savedCartStopButton) {
    event.preventDefault();
    event.stopPropagation();
    const address = state.customerAddresses[Number(savedCartStopButton.dataset.addCustomerSavedStop)];
    if (!address) return;
    try {
      state.customerCartLocationBusy = true;
      state.customerCartLocationMessage = "Checking saved address...";
      refreshCustomerCartLocationSection();
      await putCustomerCartLocationStop({
        ...address,
        label: address.label || "Saved",
        address: address.address || address.addressText,
        savedAddressId: address.addressId || address.id || null,
        source: "saved"
      });
      state.customerCartLocationBusy = false;
      state.customerCartLocationMessage = "";
      closeCustomerCartStopPickerToReview();
    } catch (error) {
      state.customerCartLocationBusy = false;
      notify(error.message || "Unable to add saved address.");
      refreshCustomerCartLocationSection();
    }
    return;
  }

  const openCartRouteDeleteButton = event.target.closest("[data-open-customer-cart-route-delete]");
  if (openCartRouteDeleteButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerCartRouteDeleteIndex = Number(openCartRouteDeleteButton.dataset.openCustomerCartRouteDelete);
    refreshCustomerCartLocationSection();
    return;
  }

  const closeCartRouteDeleteButton = event.target.closest("[data-close-customer-route-delete]");
  if (closeCartRouteDeleteButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerCartRouteDeleteIndex = -1;
    refreshCustomerCartLocationSection();
    return;
  }

  const cartRouteDeleteBackdrop = event.target.closest("[data-customer-route-delete-backdrop]");
  if (cartRouteDeleteBackdrop && event.target === cartRouteDeleteBackdrop) {
    event.preventDefault();
    state.customerCartRouteDeleteIndex = -1;
    refreshCustomerCartLocationSection();
    return;
  }

  const confirmCartRouteDeleteButton = event.target.closest("[data-confirm-customer-route-delete]");
  if (confirmCartRouteDeleteButton) {
    event.preventDefault();
    event.stopPropagation();
    const index = Number(state.customerCartRouteDeleteIndex);
    if (removeCustomerCartRouteStop(index)) {
      showCustomerCartNotice("Location removed from route.");
      refreshCustomerCartLocationSection();
    }
    state.customerCartRouteDeleteIndex = -1;
    return;
  }

  const closeStoreDetailButton = event.target.closest("[data-close-store-detail]");
  if (closeStoreDetailButton) {
    event.preventDefault();
    event.stopPropagation();
    state.customerStoreDetailId = "";
    render();
    return;
  }

  const openStoreDetailButton = event.target.closest("[data-open-store-detail]");
  if (openStoreDetailButton) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    state.customerStoreDetailId = openStoreDetailButton.dataset.openStoreDetail || "";
    render();
    return;
  }

  const favoriteButtonEl = event.target.closest("[data-toggle-favorite]");
  if (favoriteButtonEl) {
    event.preventDefault();
    event.stopPropagation();
    await toggleFavorite(favoriteButtonEl.dataset.favoriteType || "", favoriteButtonEl.dataset.favoriteId || "");
    return;
  }

  const cancelCartReplace = event.target.closest("[data-cancel-cart-replace]");
  if (cancelCartReplace) {
    state.customerCartReplace = null;
    render();
    return;
  }

  const confirmCartReplace = event.target.closest("[data-confirm-cart-replace]");
  if (confirmCartReplace) {
    await customerCompletePendingCartReplace();
    return;
  }

  const catalogTabButton = event.target.closest("[data-customer-catalog-tab]");
  if (catalogTabButton) {
    state.customerCatalogTab = catalogTabButton.dataset.customerCatalogTab || "categories";
    state.customerCategorySheetOpen = false;
    if (state.customerCatalogTab !== "stores") {
      state.selectedCategoryId = "";
      if (state.selectedServiceId) {
        try {
          await loadCustomerCatalog({ serviceId: state.selectedServiceId, forceRefresh: true });
        } catch (error) {
          notify(error.message || "Unable to load categories.");
        }
      }
    }
    render();
    return;
  }

  const favoriteTabButton = event.target.closest("[data-favorite-tab]");
  if (favoriteTabButton) {
    state.favoriteTab = favoriteTabButton.dataset.favoriteTab || "services";
    render();
    return;
  }

  const serviceButton = event.target.closest("[data-service-id]");
  if (serviceButton) {
    state.selectedServiceId = serviceButton.dataset.serviceId;
    state.customerCatalogTab = "categories";
    state.selectedCategoryId = "";
    state.customerCategorySheetOpen = false;
    try {
      await loadCustomerCatalog({ serviceId: state.selectedServiceId, forceRefresh: true });
      const singleCategory = customerSingleDirectCategoryForService(state.selectedServiceId);
      if (singleCategory) {
        await addCategoryToCart(singleCategory.id, false);
        if (!state.customerCartReplace) state.customerView = "cart";
        render();
        return;
      }
      if (!customerServiceHasCatalogChoices(state.selectedServiceId)) {
        await addCategoryToCart(`${state.selectedServiceId}-item`, false);
        if (!state.customerCartReplace) state.customerView = "cart";
        render();
        return;
      }
      state.customerView = "service";
    } catch (error) {
      notify(error.message || "Unable to load service categories.");
    }
    render();
    return;
  }

  const removeCategoryButton = event.target.closest("[data-remove-cart-category]");
  if (removeCategoryButton) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    await keepCustomerScroll(async () => {
        const index = customerCartCategoryIndex(removeCategoryButton.dataset.removeCartCategory || "");
        if (index >= 0) {
          const removed = state.cart[index];
          await deleteCustomerCartItemFromServer({
            index,
            id: removed?.id || null,
            categoryId: removed?.categoryId || removeCategoryButton.dataset.removeCartCategory || null
          });
          resetCustomerEmptyCartDetails();
          showCustomerCartNotice(`${removed?.name || "Category"} removed from review.`);
        }
        refreshCustomerCartUiOnly();
    });
    return;
  }

  const removeStoreButton = event.target.closest("[data-remove-cart-store]");
  if (removeStoreButton) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    await keepCustomerScroll(async () => {
        const index = customerCartStoreIndex(removeStoreButton.dataset.removeCartStore || "");
        if (index >= 0) {
          const removed = state.cart[index];
          await deleteCustomerCartItemFromServer({
            index,
            id: removed?.id || null,
            storeId: removed?.storeId || removeStoreButton.dataset.removeCartStore || null
          });
          resetCustomerEmptyCartDetails();
          showCustomerCartNotice(`${removed?.name || "Store"} removed from review.`);
        }
        refreshCustomerCartUiOnly();
    });
    return;
  }

  const favoriteCategoryButton = event.target.closest("[data-open-favorite-category]");
  if (favoriteCategoryButton) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    state.selectedCategoryId = favoriteCategoryButton.dataset.openFavoriteCategory || "";
    state.customerCatalogTab = "fav";
    render();
    return;
  }

  const categoryStoresButton = event.target.closest("[data-open-category-stores]");
  if (categoryStoresButton) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    state.selectedCategoryId = categoryStoresButton.dataset.openCategoryStores || "";
    const category = activeCatalog().categories.find((item) => String(item.id || "") === String(state.selectedCategoryId || ""));
    state.selectedServiceId = categoryStoresButton.dataset.categoryServiceId || categoryServiceId(category || {}) || state.selectedServiceId;
    state.customerCatalogTab = "stores";
    state.customerCategorySheetOpen = false;
    try {
      await loadCustomerCatalog({ serviceId: state.selectedServiceId, categoryId: state.selectedCategoryId });
    } catch (error) {
      notify(error.message || "Unable to load stores.");
    }
    render();
    return;
  }

  const addButton = event.target.closest("[data-add-category]");
  if (addButton) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    await keepCustomerScroll(async () => {
      try {
        await addCategoryToCart(addButton.dataset.addCategory, false);
      } catch (error) {
        notify(error.message || "Unable to add category.");
        refreshCustomerCartUiOnly();
      }
    });
    return;
  }

  const addStoreButton = event.target.closest("[data-add-store]");
  if (addStoreButton) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    await keepCustomerScroll(async () => {
      await addStoreToCart(addStoreButton.dataset.addStore, addStoreButton.dataset.storeCategory || "", false);
    });
    return;
  }

  const confirmButton = event.target.closest("[data-confirm-booking]");
  if (confirmButton) {
    try {
      confirmButton.disabled = true;
      confirmButton.textContent = "Confirming...";
      await confirmCustomerBooking();
    } catch (error) {
      notify(error.message);
      render();
    }
    return;
  }

  const cancelBookingButton = event.target.closest("[data-cancel-booking]");
  if (cancelBookingButton) {
    state.customerCancelBookingId = cancelBookingButton.dataset.cancelBooking || "";
    render();
    return;
  }

  const disputeBookingButton = event.target.closest("[data-open-customer-dispute]");
  if (disputeBookingButton) {
    state.customerDisputeBookingId = disputeBookingButton.dataset.openCustomerDispute || "";
    render();
    return;
  }

  const closeCustomerCancelButton = event.target.closest("[data-close-customer-cancel]");
  if (closeCustomerCancelButton) {
    state.customerCancelBookingId = "";
    render();
    return;
  }

  const closeCustomerDisputeButton = event.target.closest("[data-close-customer-dispute]");
  if (closeCustomerDisputeButton) {
    state.customerDisputeBookingId = "";
    render();
    return;
  }

  const closeCustomerPaymentProofButton = event.target.closest("[data-close-customer-payment-proof]");
  if (closeCustomerPaymentProofButton) {
    state.customerPaymentProofRequest = null;
    renderTrackRealtimeUpdate();
    return;
  }

  const online = event.target.closest("[data-online]");
  if (online) {
    try {
      await api("/portal/assistant/availability", { method: "PATCH", body: JSON.stringify({ isOnline: online.dataset.online === "true" }) });
      notify(online.dataset.online === "true" ? "You are online." : "You are offline.");
    } catch (error) {
      notify(error.message);
    }
    return;
  }

  const assistantTaskTabButton = event.target.closest("[data-assistant-task-tab]");
  if (assistantTaskTabButton) {
    const targetTab = assistantTaskTabButton.dataset.assistantTaskTab || "accepted";
    const switchingTab = state.assistantTaskTab !== targetTab;
    const hadOverlay = Boolean(state.assistantChatTaskId || state.assistantChatAction || state.assistantTaskConfirm);
    if (switchingTab) {
      state.assistantTaskTab = targetTab;
    }
    state.assistantChatTaskId = "";
    state.assistantChatAction = "";
    state.assistantTaskConfirm = null;
    if (!switchingTab && !hadOverlay) return;
    if (!renderAssistantTaskView()) render();
    return;
  }

  const openTaskChatButton = event.target.closest("[data-open-task-chat]");
  if (openTaskChatButton) {
    const interactiveChild = event.target.closest("a, input, select, textarea, label, button");
    if (interactiveChild && interactiveChild !== openTaskChatButton) return;
    event.preventDefault();
    event.stopPropagation();
    state.assistantChatTaskId = openTaskChatButton.dataset.openTaskChat || "";
    state.assistantChatAction = "";
    const task = assistantChatTask();
    if (task?.bookingId) {
      try {
        await loadPortalQuickReplies(task.bookingId);
      } catch (error) {
        notify(error.message || "Unable to load quick replies.");
      }
    }
    render();
    return;
  }

  const closeTaskChatButton = event.target.closest("[data-close-task-chat]");
  if (closeTaskChatButton) {
    state.assistantChatTaskId = "";
    state.assistantChatAction = "";
    render();
    return;
  }

  const closeChatActionButton = event.target.closest("[data-close-chat-action]");
  if (closeChatActionButton) {
    state.assistantChatAction = "";
    if (!refreshAssistantAfterPopupMutation()) render();
    return;
  }

  const chatQuickActionButton = event.target.closest("[data-chat-quick-action]");
  if (chatQuickActionButton) {
    const action = chatQuickActionButton.dataset.chatQuickAction || "";
    if (action === "location") {
      try {
        chatQuickActionButton.disabled = true;
        chatQuickActionButton.textContent = "Sharing...";
        await shareAssistantLocation();
        notify("Current location shared.");
        chatQuickActionButton.disabled = false;
        chatQuickActionButton.textContent = "Location";
      } catch (error) {
        notify(error.message || "Unable to share location.");
        chatQuickActionButton.disabled = false;
        chatQuickActionButton.textContent = "Location";
      }
      return;
    }
    state.assistantChatAction = action;
    if (!refreshAssistantAfterPopupMutation()) render();
    return;
  }

  const sharePaymentQrButton = event.target.closest("[data-share-payment-qr]");
  if (sharePaymentQrButton) {
    try {
      sharePaymentQrButton.disabled = true;
      sharePaymentQrButton.textContent = "Sharing...";
      const amount = Math.max(0, Number(sharePaymentQrButton.dataset.paymentAmount || 0));
      const qrImageUrl = sharePaymentQrButton.dataset.paymentQr || upiQrImageUrl(amount, "ZIGO payment");
      const upiUri = sharePaymentQrButton.dataset.paymentUri || upiPaymentUri(amount, "ZIGO payment");
      const taskUpdateInput = {
        bookingId: sharePaymentQrButton.dataset.bookingId || "",
        assignmentId: sharePaymentQrButton.dataset.assignmentId || "",
        updateType: "payment_request",
        message: `Please pay ${money(amount)} using this UPI QR.`,
        mediaUrls: [qrImageUrl],
        metadata: {
          amount,
          status: "pending",
          mode: "upi",
          upiId: zigoPaymentUpiId,
          upiUri,
          qrImageUrl
        }
      };
      const created = await postPortalTaskUpdate({ ...taskUpdateInput, skipReload: actor === "assistant" });
      if (actor === "assistant") assistantApplyLocalTaskUpdate(taskUpdateInput, created);
      notify("Payment QR shared in chat.");
      sharePaymentQrButton.disabled = false;
      sharePaymentQrButton.textContent = "Share QR in Chat";
    } catch (error) {
      notify(error.message || "Unable to share payment QR.");
      sharePaymentQrButton.disabled = false;
      sharePaymentQrButton.textContent = "Share QR in Chat";
    }
    return;
  }

  const closeAssistantConfirm = event.target.closest("[data-close-assistant-confirm]");
  if (closeAssistantConfirm) {
    state.assistantTaskConfirm = null;
    if (!refreshAssistantAfterPopupMutation()) render();
    return;
  }

  const confirmAssistantTask = event.target.closest("[data-confirm-assistant-task]");
  if (confirmAssistantTask && state.assistantTaskConfirm) {
    try {
      const pending = state.assistantTaskConfirm;
      const needsPin = ["in_progress", "completed"].includes(String(pending.status || ""));
      const pin = String(root.querySelector("[data-assistant-task-pin-input]")?.value || "").replace(/\D/g, "").slice(0, 4);
      if (needsPin && !/^\d{4}$/.test(pin)) {
        state.assistantTaskConfirm = { ...pending, error: "Enter 4 digit PIN shared by customer." };
        if (!refreshAssistantAfterPopupMutation()) render();
        focusAssistantTaskPinInput();
        return;
      }
      confirmAssistantTask.disabled = true;
      const payload = await api(`/portal/assistant/tasks/${pending.assignmentId}/status`, { method: "PATCH", body: JSON.stringify({ status: pending.status, ...(needsPin ? { pin } : {}) }) });
      const nextStatus = String(payload.data?.status || pending.status);
      state.assistantTaskConfirm = null;
      await loadMe({ forceRefresh: true });
      state.assistantTaskTab = nextStatus === "accepted" ? "accepted" : ["in_progress", "approval_pending"].includes(nextStatus) ? "working" : nextStatus === "completed" ? "success" : "rejected";
      state.assistantChatTaskId = ["in_progress", "approval_pending"].includes(nextStatus) ? String(pending.assignmentId || "") : "";
      state.assistantChatAction = "";
      render();
    } catch (error) {
      const pending = state.assistantTaskConfirm;
      notify(error.message);
      if (pending && ["in_progress", "completed"].includes(String(pending.status || ""))) {
        state.assistantTaskConfirm = { ...pending, error: error.message || "Invalid PIN." };
        if (!refreshAssistantAfterPopupMutation()) render();
        focusAssistantTaskPinInput();
        return;
      } else {
        state.assistantTaskConfirm = null;
      }
      if (!refreshAssistantAfterPopupMutation()) render();
    }
    return;
  }

  const clearPhone = event.target.closest("[data-clear-phone]");
  if (clearPhone) {
    event.preventDefault();
    event.stopPropagation();
    const input = clearPhone.closest(".phone-field")?.querySelector("input");
    if (input) input.value = "";
    state.loginPhone = "";
    state.codeSent = false;
    state.otpResendAvailableAt = 0;
    stopCustomerOtpResendTimer();
    if (actor === "customer") {
      if (clearPhone.closest(".phone-field")) syncCustomerLoginPhoneButton();
      renderCustomerLogin();
    }
  }
});

setInterval(updateAssistantCountdowns, 1000);
setInterval(updateCustomerCountdowns, 1000);

initPortal();
