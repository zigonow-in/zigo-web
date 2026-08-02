import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().default("*"),
  APP_BASE_PATH: z.string().default(""),
  JWT_SECRET: z.string().min(16).default("zigo-development-secret"),
  REDIS_URL: z.string().url().optional(),
  DB_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),
  ADMIN_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().max(86_400).default(3600),
  ADMIN_REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().max(2_592_000).default(604_800),
  OLA_MAPS_PROJECT_ID: z.string().optional(),
  OLA_MAPS_API_KEY: z.string().optional(),
  OLA_MAPS_CLIENT_ID: z.string().optional(),
  OLA_MAPS_CLIENT_SECRET: z.string().optional(),
  OLA_MAPS_TOKEN_URL: z.string().url().default("https://account.olamaps.io/realms/olamaps/protocol/openid-connect/token"),
  OLA_MAPS_STYLE_URL: z.string().url().default("https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_RECONCILE_AFTER_MINUTES: z.coerce.number().int().positive().max(1440).default(10)
});

export const env = envSchema.parse(process.env);

if (
  env.NODE_ENV === "production" &&
  (env.JWT_SECRET === "zigo-development-secret" || env.JWT_SECRET.length < 32)
) {
  throw new Error("Production Admin API requires a strong JWT_SECRET with at least 32 characters.");
}

if (env.NODE_ENV === "production" && env.CORS_ORIGIN.trim() === "*") {
  throw new Error("Production Admin API requires explicit CORS_ORIGIN values.");
}
