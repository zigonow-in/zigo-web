import type { Request, RequestHandler } from "express";
import { redisCommand } from "../infra/redis.js";
import { HttpError } from "./errors.js";

type RateLimitOptions = {
  keyPrefix: string;
  windowMs: number;
  max: number;
  message?: string;
  key?: (req: Request) => string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const rateLimitScript = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`;

function cleanup(now: number) {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  return async (req, res, next) => {
    const now = Date.now();
    cleanup(now);

    const subject = options.key?.(req) ?? req.ip ?? req.socket.remoteAddress ?? "unknown";
    const key = `${options.keyPrefix}:${subject}`;
    const redisBucket = await incrementRedisBucket(key, options.windowMs);
    if (redisBucket) {
      res.setHeader("X-RateLimit-Limit", String(options.max));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, options.max - redisBucket.count)));
      if (redisBucket.count > options.max) {
        const retryAfterSeconds = Math.ceil(Math.max(redisBucket.ttlMs, 1000) / 1000);
        res.setHeader("Retry-After", retryAfterSeconds.toString());
        next(new HttpError(429, options.message ?? "Too many requests. Try again later."));
        return;
      }
      next();
      return;
    }

    const existing = buckets.get(key);
    const bucket =
      existing && existing.resetAt > now
        ? existing
        : {
            count: 0,
            resetAt: now + options.windowMs
          };

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > options.max) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", retryAfterSeconds.toString());
      next(new HttpError(429, options.message ?? "Too many requests. Try again later."));
      return;
    }

    next();
  };
}

async function incrementRedisBucket(key: string, windowMs: number) {
  const value = await redisCommand(["EVAL", rateLimitScript, "1", `rate-limit:${key}`, String(windowMs)]);
  if (!Array.isArray(value)) return null;
  const count = Number(value[0]);
  const ttlMs = Number(value[1]);
  if (!Number.isFinite(count)) return null;
  return { count, ttlMs: Number.isFinite(ttlMs) ? ttlMs : windowMs };
}
