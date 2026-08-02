import {
  getNextCustomerBookingInvoiceDueAt,
  processCustomerBookingInvoiceQueue
} from "./bookingInvoice.service.js";

let timer: NodeJS.Timeout | null = null;
let running = false;
let runWorker: (() => void) | null = null;

export function startBookingInvoiceEmailWorker() {
  if (timer || runWorker) return;
  const run = async () => {
    if (running) return;
    running = true;
    let nextDelayMs = 300_000;
    try {
      const processed = await processCustomerBookingInvoiceQueue(5);
      if (processed > 0) {
        nextDelayMs = 100;
      } else {
        const nextDueAt = await getNextCustomerBookingInvoiceDueAt();
        if (nextDueAt) nextDelayMs = Math.max(1000, Math.min(300_000, nextDueAt.getTime() - Date.now()));
      }
    } catch (error) {
      console.error("Booking invoice email worker failed", error);
      nextDelayMs = 60_000;
    } finally {
      running = false;
      timer = setTimeout(run, nextDelayMs);
    }
  };
  runWorker = run;
  run();
}

export function stopBookingInvoiceEmailWorker() {
  if (timer) clearTimeout(timer);
  timer = null;
  runWorker = null;
}

export function pokeBookingInvoiceEmailWorker() {
  if (!runWorker) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(runWorker, running ? 250 : 0);
}
