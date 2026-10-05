import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import { requireAdminAuth, requireSuperAdmin } from "./http/auth.js";
import { HttpError, notFoundHandler } from "./http/errors.js";
import { metricsMiddleware, metricsRouter } from "./http/metrics.js";
import { rateLimit } from "./http/rateLimit.js";
import { customerCacheInvalidationMiddleware } from "./infra/cacheInvalidation.js";
import { applySecurityHeaders, attachRequestId, corsOrigin, rejectSuspiciousRequests, requireJsonContentType } from "./http/security.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { accessRouter } from "./modules/access/access.routes.js";
import { assistantMasterRouter } from "./modules/assistant-master/assistantMaster.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { verificationRouter } from "./modules/verification/verification.routes.js";
import { mastersRouter } from "./modules/masters/masters.routes.js";
import { operationsRouter, reportsRouter } from "./modules/operations/operations.routes.js";
import { adminCustomersRouter } from "./modules/customers/customers.routes.js";
import { offersRouter } from "./modules/offers/offers.routes.js";
import { storesRouter } from "./modules/stores/stores.routes.js";
import { settingsRouter } from "./modules/settings/settings.routes.js";
import { vehiclesRouter } from "./modules/vehicles/vehicles.routes.js";
import { portalRouter } from "./modules/portal/portal.routes.js";
import { finalizePaidCustomerPortalBookingAddOnByProviderOrder } from "./modules/portal/portal.repository.js";
import { emitBookingRealtimeEvent } from "./modules/operations/bookingRealtime.js";
import { supportRouter } from "./modules/support/support.routes.js";
import { walletsRouter } from "./modules/wallets/wallet.routes.js";
import { processRazorpayWebhook } from "./modules/payments/payments.repository.js";
import { healthRouter } from "./routes/health.js";
import { mapsRouter } from "./modules/maps/maps.routes.js";
import { olaBrowserConfig } from "./modules/maps/olaMaps.service.js";
export function createApp() {
    const app = express();
    const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
    const assetsFontsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/fonts");
    const basePath = normalizeBasePath(env.APP_BASE_PATH);
    const globalLimiter = rateLimit({
        keyPrefix: "admin-api",
        windowMs: 60 * 1000,
        max: 300,
        message: "Too many requests. Slow down and try again."
    });
    app.disable("x-powered-by");
    app.set("trust proxy", env.NODE_ENV === "production" ? 1 : false);
    app.use(attachRequestId);
    app.use(rejectSuspiciousRequests);
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://api.olamaps.io", "https://*.olamaps.io", "https://maps.olakrutrim.com", "https://*.olakrutrim.com"],
                "script-src": ["'self'", "https://www.unpkg.com", "https://unpkg.com", "https://cdn.jsdelivr.net", "https://checkout.razorpay.com", "https://cdn.razorpay.com"],
                "img-src": ["'self'", "data:", "blob:", "https://api.qrserver.com", "https://api.olamaps.io", "https://*.olamaps.io", "https://maps.olakrutrim.com", "https://*.olakrutrim.com", "https://a.tile.openstreetmap.org", "https://b.tile.openstreetmap.org", "https://c.tile.openstreetmap.org", "https://*.razorpay.com"],
                "media-src": ["'self'", "data:", "blob:"],
                "connect-src": ["'self'", "https://cdn.jsdelivr.net", "https://api.olamaps.io", "https://*.olamaps.io", "https://maps.olakrutrim.com", "https://*.olakrutrim.com", "https://a.tile.openstreetmap.org", "https://b.tile.openstreetmap.org", "https://c.tile.openstreetmap.org", "https://api.razorpay.com", "https://checkout.razorpay.com", "https://cdn.razorpay.com", "https://*.razorpay.com", "http://localhost:5100"],
                "worker-src": ["'self'", "blob:"],
                "child-src": ["'self'", "blob:", "https://api.razorpay.com", "https://checkout.razorpay.com", "https://*.razorpay.com"],
                "frame-src": ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com", "https://*.razorpay.com"],
                "form-action": ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com", "https://*.razorpay.com"]
            }
        }
    }));
    app.use(applySecurityHeaders);
    app.use(cors({ origin: corsOrigin(env.CORS_ORIGIN), credentials: true }));
    mountRazorpayWebhookRoutes(app, basePath);
    if (basePath)
        mountRazorpayWebhookRoutes(app, "");
    app.use(requireJsonContentType);
    app.use(express.json({ limit: "15mb", strict: true }));
    app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
    app.use(metricsMiddleware);
    app.use(joinBasePath(basePath, "/maps"), mapsRouter);
    if (basePath)
        app.use("/maps", mapsRouter);
    app.use(globalLimiter);
    app.use(customerCacheInvalidationMiddleware);
    mountAppRoutes(app, { basePath, publicDir, assetsFontsDir });
    if (basePath)
        mountAppRoutes(app, { basePath: "", publicDir, assetsFontsDir });
    app.use((req, _res, next) => {
        next(new HttpError(404, `Route not found: ${req.method} ${req.path}`));
    });
    app.use(notFoundHandler);
    return app;
}
function mountRazorpayWebhookRoutes(app, basePath) {
    app.post(joinBasePath(basePath, "/portal/webhooks/razorpay"), express.raw({ type: "application/json", limit: "2mb" }), async (req, res, next) => {
        try {
            const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
            const signature = String(req.header("x-razorpay-signature") || "");
            const result = await processRazorpayWebhook(rawBody, signature);
            let finalizedExtension = null;
            if (["payment.captured", "order.paid"].includes(String(result.event || "").toLowerCase()) && result.orderId) {
                finalizedExtension = await finalizePaidCustomerPortalBookingAddOnByProviderOrder(result.orderId);
                if (finalizedExtension?.bookingId) {
                    await emitBookingRealtimeEvent({
                        type: "booking.updated",
                        bookingId: String(finalizedExtension.bookingId),
                        message: "Service extension paid",
                        payload: { bookingId: String(finalizedExtension.bookingId), addOn: finalizedExtension }
                    });
                }
            }
            console.info("Razorpay webhook processed", {
                requestId: res.locals.requestId,
                event: result.event,
                orderId: result.orderId,
                paymentId: result.paymentId,
                duplicate: Boolean(result.duplicate)
            });
            res.json({ data: result });
        }
        catch (error) {
            console.error("Razorpay webhook failed", {
                requestId: res.locals.requestId,
                message: error instanceof Error ? error.message : "Unknown webhook error"
            });
            next(error);
        }
    });
}
function normalizeBasePath(value = "") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "/")
        return "";
    return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}
function joinBasePath(basePath, routePath) {
    if (!basePath)
        return routePath || "/";
    if (!routePath || routePath === "/")
        return basePath;
    return `${basePath}${routePath.startsWith("/") ? routePath : `/${routePath}`}`;
}
function staticNoStoreHeaders(res, filePath) {
    if (/\.(html|js|css)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-store");
    }
}
function staticFontHeaders(res, filePath) {
    if (/\.(ttf|otf|woff2?)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
}
function staticMediaHeaders(res, filePath) {
    if (/\.(avif|gif|jpe?g|png|svg|webp|mp4|webm|mov|mp3|m4a|ogg|wav|pdf|docx?|xlsx?|pptx?)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=86400");
    }
}
function htmlWithBasePath(publicDir, fileName, basePath) {
    const html = fs.readFileSync(path.join(publicDir, fileName), "utf8");
    const baseHref = `${basePath || ""}/`;
    const withMeta = html.replace("<head>", `<head>\n    <meta name="zigo-base-path" content="${escapeHtmlAttribute(basePath)}" />\n    <base href="${escapeHtmlAttribute(baseHref)}" />`);
    if (!basePath)
        return withMeta;
    return withMeta
        .replaceAll('href="/styles.css', `href="${basePath}/styles.css`)
        .replaceAll('src="/app.js', `src="${basePath}/app.js`)
        .replaceAll('href="/portal.css', `href="${basePath}/portal.css`)
        .replaceAll('src="/portal.js', `src="${basePath}/portal.js`)
        .replaceAll('src="/assets/', `src="${basePath}/assets/`)
        .replaceAll('href="./', `href="`)
        .replaceAll('src="./', `src="`);
}
function escapeHtmlAttribute(value) {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function sendHtml(publicDir, fileName, basePath) {
    return (_req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.type("html").send(htmlWithBasePath(publicDir, fileName, basePath));
    };
}
function mountAppRoutes(app, { basePath, publicDir, assetsFontsDir }) {
    const uploadsDir = path.join(publicDir, "uploads");
    app.use(joinBasePath(basePath, "/assets/fonts"), express.static(assetsFontsDir, { setHeaders: staticFontHeaders }));
    app.use(joinBasePath(basePath, "/uploads"), express.static(uploadsDir, { setHeaders: staticMediaHeaders }));
    app.get(joinBasePath(basePath, "/"), sendHtml(publicDir, "index.html", basePath));
    app.get(joinBasePath(basePath, "/customer"), sendHtml(publicDir, "portal.html", basePath));
    app.get(joinBasePath(basePath, "/assistant"), sendHtml(publicDir, "portal.html", basePath));
    app.use(basePath || "/", express.static(publicDir, { setHeaders: staticNoStoreHeaders }));
    app.use(joinBasePath(basePath, "/health"), healthRouter);
    app.use(joinBasePath(basePath, "/metrics"), metricsRouter);
    app.get(joinBasePath(basePath, "/config/maps"), requireAdminAuth, (_req, res) => {
        res.json({
            data: olaBrowserConfig()
        });
    });
    app.use(joinBasePath(basePath, "/auth"), authRouter);
    app.use(joinBasePath(basePath, "/portal"), portalRouter);
    app.use(joinBasePath(basePath, "/users"), requireAdminAuth, usersRouter);
    app.use(joinBasePath(basePath, "/admin"), requireAdminAuth, adminRouter);
    app.use(joinBasePath(basePath, "/access"), requireAdminAuth, requireSuperAdmin, accessRouter);
    app.use(joinBasePath(basePath, "/verification"), requireAdminAuth, verificationRouter);
    app.use(joinBasePath(basePath, "/masters"), requireAdminAuth, mastersRouter);
    app.use(joinBasePath(basePath, "/offers"), requireAdminAuth, offersRouter);
    app.use(joinBasePath(basePath, "/admin-customers"), requireAdminAuth, adminCustomersRouter);
    app.use(joinBasePath(basePath, "/assistant-master"), requireAdminAuth, assistantMasterRouter);
    app.use(joinBasePath(basePath, "/stores"), requireAdminAuth, storesRouter);
    app.use(joinBasePath(basePath, "/vehicle-master"), requireAdminAuth, vehiclesRouter);
    app.use(joinBasePath(basePath, "/settings"), requireAdminAuth, settingsRouter);
    app.use(joinBasePath(basePath, "/operations"), requireAdminAuth, operationsRouter);
    app.use(joinBasePath(basePath, "/reports"), requireAdminAuth, reportsRouter);
    app.use(joinBasePath(basePath, "/support"), requireAdminAuth, supportRouter);
    app.use(joinBasePath(basePath, "/wallets"), requireAdminAuth, walletsRouter);
}
