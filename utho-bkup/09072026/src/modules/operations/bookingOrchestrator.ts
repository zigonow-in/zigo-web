import { emitBookingRealtimeEvent } from "./bookingRealtime.js";
import { runBookingOrchestrationCycle } from "./bookingEngine.js";
import { getBookingEngineSetting } from "../settings/settings.repository.js";

let orchestrationTimer: NodeJS.Timeout | null = null;
let orchestrationBusy = false;
let orchestrationFailureCount = 0;

function isTransientDatabaseError(error: unknown) {
  const message = error instanceof Error ? `${error.message} ${(error as Error & { cause?: unknown }).cause instanceof Error ? (error as Error & { cause?: Error }).cause?.message : ""}` : String(error || "");
  return /connection terminated|connection timeout|terminat(?:ed|ing) connection|timeout|econnreset|etimedout|57P01|57P02|08006|08003/i.test(message);
}

function nextFailureDelaySeconds(baseDelaySeconds: number) {
  const exponent = Math.min(orchestrationFailureCount, 6);
  return Math.max(15, Math.min(300, baseDelaySeconds * (2 ** exponent)));
}

export function startBookingOrchestrationWorker() {
  if (orchestrationTimer) return;
  const run = async () => {
    let nextDelaySeconds = 30;
    if (orchestrationBusy) {
      orchestrationTimer = setTimeout(run, nextDelaySeconds * 1000);
      return;
    }
    orchestrationBusy = true;
    try {
      const settings = await getBookingEngineSetting();
      nextDelaySeconds = settings.orchestrationIntervalSeconds || nextDelaySeconds;
      if (!settings.isEnabled || !settings.orchestrationWorkerEnabled) return;
      const changes = await runBookingOrchestrationCycle(undefined, settings.batchSize || 100, {
        riskLookaheadMinutes: settings.riskLookaheadMinutes,
        slaGraceMinutes: settings.slaGraceMinutes
      });
      for (const change of changes) {
        if (settings.notifyOnRiskChange === false) continue;
        await emitBookingRealtimeEvent({
          type: "booking.risk.changed",
          bookingId: change.serviceRequestId,
          assistantId: change.assistantId ?? undefined,
          clusterId: change.clusterId,
          message: change.message,
          payload: change
        });
      }
      orchestrationFailureCount = 0;
    } catch (error) {
      orchestrationFailureCount += 1;
      nextDelaySeconds = nextFailureDelaySeconds(nextDelaySeconds);
      if (isTransientDatabaseError(error)) {
        const message = error instanceof Error ? error.message : String(error || "Unknown database error");
        console.warn(`Booking orchestration delayed: database connection is not ready (${message}). Retrying in ${nextDelaySeconds}s.`);
      } else {
        console.error("Booking orchestration cycle failed", error);
      }
    } finally {
      orchestrationBusy = false;
      orchestrationTimer = setTimeout(run, Math.max(5, nextDelaySeconds) * 1000);
    }
  };
  run();
}

export function stopBookingOrchestrationWorker() {
  if (orchestrationTimer) clearTimeout(orchestrationTimer);
  orchestrationTimer = null;
}
