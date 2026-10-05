import crypto from "node:crypto";
import { HttpError } from "./errors.js";
const writeMethods = new Set(["POST", "PUT", "PATCH"]);
const suspiciousPathPatterns = [
    /\0/,
    /%00/i,
    /\.\./,
    /<script/i,
    /\/\.git/i,
    /\/\.env/i,
    /\/wp-admin/i,
    /\/phpmyadmin/i
];
export function corsOrigin(originConfig) {
    if (originConfig.trim() === "*")
        return true;
    return originConfig
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
}
export const attachRequestId = (req, res, next) => {
    const incoming = req.get("x-request-id");
    const requestId = incoming && /^[a-zA-Z0-9._:-]{8,128}$/.test(incoming) ? incoming : crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
};
export const applySecurityHeaders = (_req, res, next) => {
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), payment=*, usb=(), geolocation=(self)");
    res.setHeader("Cache-Control", "no-store");
    next();
};
export const rejectSuspiciousRequests = (req, _res, next) => {
    const target = safeDecode(req.originalUrl || req.url || "");
    if (target.length > 2048) {
        next(new HttpError(414, "Request URL is too long."));
        return;
    }
    if (suspiciousPathPatterns.some((pattern) => pattern.test(target))) {
        next(new HttpError(400, "Suspicious request rejected."));
        return;
    }
    next();
};
export const requireJsonContentType = (req, _res, next) => {
    if (writeMethods.has(req.method) && !req.is("application/json")) {
        next(new HttpError(415, "Content-Type application/json is required."));
        return;
    }
    next();
};
function safeDecode(value) {
    try {
        return decodeURIComponent(value);
    }
    catch {
        return value;
    }
}
