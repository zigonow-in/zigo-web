import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { HttpError } from "../../http/errors.js";
const ADMIN_TOKEN_ISSUER = "zigo-admin-api";
const ADMIN_TOKEN_AUDIENCE = "zigo-admin-panel";
export function signAdminAccessToken(input) {
    const payload = {
        sub: input.userId,
        app: "admin",
        roles: input.roles,
        tokenUse: "access"
    };
    const options = {
        algorithm: "HS256",
        expiresIn: env.ADMIN_ACCESS_TOKEN_TTL_SECONDS,
        issuer: ADMIN_TOKEN_ISSUER,
        audience: ADMIN_TOKEN_AUDIENCE
    };
    return {
        token: jwt.sign(payload, env.JWT_SECRET, options),
        tokenType: "Bearer",
        expiresIn: env.ADMIN_ACCESS_TOKEN_TTL_SECONDS
    };
}
export function signAdminRefreshToken(input) {
    const payload = {
        sub: input.userId,
        app: "admin",
        tokenUse: "refresh"
    };
    const options = {
        algorithm: "HS256",
        expiresIn: env.ADMIN_REFRESH_TOKEN_TTL_SECONDS,
        issuer: ADMIN_TOKEN_ISSUER,
        audience: ADMIN_TOKEN_AUDIENCE
    };
    return {
        token: jwt.sign(payload, env.JWT_SECRET, options),
        tokenType: "Bearer",
        expiresIn: env.ADMIN_REFRESH_TOKEN_TTL_SECONDS
    };
}
export function verifyAdminAccessToken(token) {
    let payload;
    try {
        payload = jwt.verify(token, env.JWT_SECRET, {
            algorithms: ["HS256"],
            issuer: ADMIN_TOKEN_ISSUER,
            audience: ADMIN_TOKEN_AUDIENCE
        });
    }
    catch {
        throw new HttpError(401, "Invalid authorization token");
    }
    if (!payload || typeof payload !== "object") {
        throw new HttpError(401, "Invalid authorization token");
    }
    const parsed = payload;
    if (parsed.app !== "admin" || parsed.tokenUse !== "access" || !parsed.sub || !Array.isArray(parsed.roles)) {
        throw new HttpError(401, "Invalid authorization token");
    }
    return parsed;
}
export function verifyAdminRefreshToken(token) {
    let payload;
    try {
        payload = jwt.verify(token, env.JWT_SECRET, {
            algorithms: ["HS256"],
            issuer: ADMIN_TOKEN_ISSUER,
            audience: ADMIN_TOKEN_AUDIENCE
        });
    }
    catch {
        throw new HttpError(401, "Invalid refresh token");
    }
    if (!payload || typeof payload !== "object") {
        throw new HttpError(401, "Invalid refresh token");
    }
    const parsed = payload;
    if (parsed.app !== "admin" || parsed.tokenUse !== "refresh" || !parsed.sub) {
        throw new HttpError(401, "Invalid refresh token");
    }
    return parsed;
}
