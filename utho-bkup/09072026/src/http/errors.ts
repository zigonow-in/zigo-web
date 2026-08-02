import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

function statusCodeFromError(err: unknown) {
  if (err instanceof HttpError) return err.statusCode;
  if (err instanceof ZodError) return 400;
  if (typeof err === "object" && err !== null) {
    const candidate = "statusCode" in err ? err.statusCode : "status" in err ? err.status : undefined;
    if (typeof candidate === "number" && candidate >= 400 && candidate < 600) return candidate;
  }
  return 500;
}

function messageFromError(err: unknown, statusCode: number) {
  if (err instanceof ZodError) return "Validation failed";
  if (err instanceof Error && "type" in err && err.type === "entity.too.large") {
    return "Uploaded file is too large. Please upload a smaller PDF or image.";
  }
  if (err instanceof Error && statusCode !== 500) return err.message;
  return statusCode === 500 ? "Internal server error" : "Request failed";
}

export const notFoundHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const statusCode = statusCodeFromError(err);
  const message = messageFromError(err, statusCode);
  if (statusCode === 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      details: err instanceof ZodError ? err.flatten() : undefined
    }
  });
};
