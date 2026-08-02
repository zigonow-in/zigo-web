import { createServer } from "node:http";
import { createApp } from "./app.js";
import { pool } from "./db/pool.js";
import { env } from "./config/env.js";
import { startBookingOrchestrationWorker, stopBookingOrchestrationWorker } from "./modules/operations/bookingOrchestrator.js";
import { startBookingInvoiceEmailWorker, stopBookingInvoiceEmailWorker } from "./modules/portal/bookingInvoice.worker.js";

const app = createApp();
const server = createServer(app);
server.keepAliveTimeout = 70_000;
server.headersTimeout = 75_000;
server.requestTimeout = 0;
server.setTimeout(0);

server.listen(env.PORT, () => {
  console.log(`Zigo backend listening on port ${env.PORT}`);
  startBookingOrchestrationWorker();
  startBookingInvoiceEmailWorker();
});

async function shutdown(signal: NodeJS.Signals) {
  console.log(`${signal} received, shutting down`);

  server.close(async () => {
    stopBookingOrchestrationWorker();
    stopBookingInvoiceEmailWorker();
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
