import { Router, type RequestHandler } from "express";

const startedAt = Date.now();
let totalRequests = 0;
let inFlightRequests = 0;
const statusCounts = new Map<string, number>();
const latencyBuckets = [50, 100, 250, 500, 1000, 2500, 5000];
const latencyCounts = new Map<number, number>(latencyBuckets.map((bucket) => [bucket, 0]));

export const metricsMiddleware: RequestHandler = (req, res, next) => {
  if (req.path === "/metrics") {
    next();
    return;
  }
  const started = Date.now();
  totalRequests += 1;
  inFlightRequests += 1;
  res.once("finish", () => {
    inFlightRequests = Math.max(0, inFlightRequests - 1);
    const key = `${req.method}:${res.statusCode}`;
    statusCounts.set(key, (statusCounts.get(key) || 0) + 1);
    const elapsed = Date.now() - started;
    const bucket = latencyBuckets.find((value) => elapsed <= value) ?? latencyBuckets[latencyBuckets.length - 1];
    latencyCounts.set(bucket, (latencyCounts.get(bucket) || 0) + 1);
  });
  next();
};

export const metricsRouter = Router();

metricsRouter.get("/", (_req, res) => {
  res.type("text/plain").send(renderMetrics("zigo_admin"));
});

function renderMetrics(prefix: string) {
  const lines = [
    "# HELP zigo_process_uptime_seconds Process uptime in seconds.",
    "# TYPE zigo_process_uptime_seconds gauge",
    `${prefix}_process_uptime_seconds ${Math.round((Date.now() - startedAt) / 1000)}`,
    "# HELP zigo_http_requests_total Total HTTP requests.",
    "# TYPE zigo_http_requests_total counter",
    `${prefix}_http_requests_total ${totalRequests}`,
    "# HELP zigo_http_in_flight_requests In-flight HTTP requests.",
    "# TYPE zigo_http_in_flight_requests gauge",
    `${prefix}_http_in_flight_requests ${inFlightRequests}`
  ];
  for (const [key, count] of statusCounts.entries()) {
    const [method, status] = key.split(":");
    lines.push(`${prefix}_http_requests_by_status_total{method="${method}",status="${status}"} ${count}`);
  }
  for (const [bucket, count] of latencyCounts.entries()) {
    lines.push(`${prefix}_http_request_latency_bucket{le="${bucket}"} ${count}`);
  }
  return `${lines.join("\n")}\n`;
}
