import { enqueueScaleJob, requeueScaleJob, takeScaleJob, type ScaleJob } from "../infra/jobQueue.js";

const handlers: Record<ScaleJob["name"], (job: ScaleJob) => Promise<void>> = {
  async "booking.assignment"(job) {
    console.info("booking.assignment job received", job.payload);
  },
  async "notification.dispatch"(job) {
    console.info("notification.dispatch job received", job.payload);
  },
  async "payment.reconcile"(job) {
    console.info("payment.reconcile job received", job.payload);
  },
  async "payment.retry"(job) {
    console.info("payment.retry job received", job.payload);
  },
  async "booking.retry"(job) {
    console.info("booking.retry job received", job.payload);
  }
};

async function main() {
  console.info("ZIGO scale worker started");
  await enqueueScaleJob("payment.reconcile", { bootCheck: true });

  while (true) {
    const job = await takeScaleJob();
    if (!job) continue;
    try {
      await handlers[job.name](job);
    } catch (error) {
      console.error("Scale job failed", { job, error });
      await requeueScaleJob(job);
    }
  }
}

void main().catch((error) => {
  console.error("ZIGO scale worker crashed", error);
  process.exitCode = 1;
});
