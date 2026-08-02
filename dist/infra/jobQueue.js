import { redisCommand } from "./redis.js";
const queueKey = "zigo:jobs:scale";
export async function enqueueScaleJob(name, payload, attempts = 0) {
    const job = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        name,
        payload,
        attempts,
        createdAt: new Date().toISOString()
    };
    const result = await redisCommand(["LPUSH", queueKey, JSON.stringify(job)]);
    return result == null ? null : job;
}
export async function takeScaleJob(timeoutSeconds = 5) {
    const result = await redisCommand(["BRPOP", queueKey, String(timeoutSeconds)], (timeoutSeconds + 1) * 1000);
    if (!Array.isArray(result) || typeof result[1] !== "string")
        return null;
    try {
        return JSON.parse(result[1]);
    }
    catch {
        return null;
    }
}
export async function requeueScaleJob(job) {
    if (job.attempts >= 5) {
        await redisCommand(["LPUSH", `${queueKey}:dead`, JSON.stringify({ ...job, failedAt: new Date().toISOString() })]);
        return;
    }
    await enqueueScaleJob(job.name, job.payload, job.attempts + 1);
}
