import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import { requireAdminAuth, requireSuperAdmin } from "./http/auth.js";
import { HttpError, notFoundHandler } from "./http/errors.js";
import { metricsMiddleware, metricsRouter } from "./http/metrics.js";
import { rateLimit } from "./http/rateLimit.js";
import { customerCacheInvalidationMiddleware } from "./infra/cacheInvalidation.js";
import {
  applySecurityHeaders,
  attachRequestId,
  corsOrigin,
  rejectSuspiciousRequests,
  requireJsonContentType
} from "./http/security.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { accessRouter } from "./modules/access/access.routes.js";
import { assistantMasterRouter } from "./modules/assistant-master/assistantMaster.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { verificationRouter } from "./modules/verification/verification.routes.js";
import { mastersRouter } from "./modules/masters/masters.routes.js";
import { operationsRouter, reportsRouter } from "./modules/operations/operations.routes.js";
import { adminCustomersRouter } from "./modules/customers/customers.routes.js";
import { storesRouter } from "./modules/stores/stores.routes.js";
import { settingsRouter } from "./modules/settings/settings.routes.js";
import { vehiclesRouter } from "./modules/vehicles/vehicles.routes.js";
import { portalRouter } from "./modules/portal/portal.routes.js";
import { healthRouter } from "./routes/health.js";

export function createApp() {
  const app = express();
  const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
  const assetsFontsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/fonts");
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
  app.use(applySecurityHeaders);
  app.use(cors({ origin: corsOrigin(env.CORS_ORIGIN), credentials: true }));
  app.use(requireJsonContentType);
  app.use(express.json({ limit: "15mb", strict: true }));
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(metricsMiddleware);
  app.use(globalLimiter);
  app.use(customerCacheInvalidationMiddleware);
  app.use(
    "/assets/fonts",
    express.static(assetsFontsDir, {
      setHeaders(res, filePath) {
        if (/\.(ttf|otf|woff2?)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      }
    })
  );
  app.use(
    express.static(publicDir, {
      setHeaders(res, filePath) {
        if (/\.(html|js|css)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "no-store");
        }
      }
    })
  );

  app.use("/health", healthRouter);
  app.use("/metrics", metricsRouter);
  app.get("/config/maps", requireAdminAuth, (_req, res) => {
    res.json({
      data: {
        olaMapsApiKey: env.OLA_MAPS_API_KEY ?? null,
        olaMapsStyleUrl: env.OLA_MAPS_STYLE_URL
      }
    });
  });
  app.use("/auth", authRouter);
  app.get(["/customer", "/assistant"], (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(publicDir, "portal.html"));
  });
  app.use("/portal", portalRouter);
  app.use("/users", requireAdminAuth, usersRouter);
  app.use("/admin", requireAdminAuth, adminRouter);
  app.use("/access", requireAdminAuth, requireSuperAdmin, accessRouter);
  app.use("/verification", requireAdminAuth, verificationRouter);
  app.use("/masters", requireAdminAuth, mastersRouter);
  app.use("/admin-customers", requireAdminAuth, adminCustomersRouter);
  app.use("/assistant-master", requireAdminAuth, assistantMasterRouter);
  app.use("/stores", requireAdminAuth, storesRouter);
  app.use("/vehicle-master", requireAdminAuth, vehiclesRouter);
  app.use("/settings", requireAdminAuth, settingsRouter);
  app.use("/operations", requireAdminAuth, operationsRouter);
  app.use("/reports", requireAdminAuth, reportsRouter);

  app.use((req, _res, next) => {
    next(new HttpError(404, `Route not found: ${req.method} ${req.path}`));
  });

  app.use(notFoundHandler);

  return app;
}
