import { redisCommand } from "./redis.js";

export type ScaleJobName =
  | "booking.assignment"
  | "notification.dispatch"
  | "payment.reconcile"
  | "payment.retry"
  | "booking.retry";

export type ScaleJob = {
  id: string;
  name: ScaleJobName;
  payload: Record<string, unknown>;
  attempts: number;
  createdAt: string;
};

const queueKey = "zigo:jobs:scale";

export async function enqueueScaleJob(name: ScaleJobName, payload: Record<string, unknown>, attempts = 0) {
  const job: ScaleJob = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    name,
    payload,
    attempts,
    createdAt: new Date().toISOString()
  };
  const result = await redisCommand(["LPUSH", queueKey, JSON.stringify(job)]);
  return result == null ? null : job;
}

export async function takeScaleJob(timeoutSeconds = 5): Promise<ScaleJob | null> {
  const result = await redisCommand(["BRPOP", queueKey, String(timeoutSeconds)], (timeoutSeconds + 1) * 1000);
  if (!Array.isArray(result) || typeof result[1] !== "string") return null;
  try {
    return JSON.parse(result[1]) as ScaleJob;
  } catch {
    return null;
  }
}

export async function requeueScaleJob(job: ScaleJob) {
  if (job.attempts >= 5) {
    await redisCommand(["LPUSH", `${queueKey}:dead`, JSON.stringify({ ...job, failedAt: new Date().toISOString() })]);
    return;
  }
  await enqueueScaleJob(job.name, job.payload, job.attempts + 1);
}
