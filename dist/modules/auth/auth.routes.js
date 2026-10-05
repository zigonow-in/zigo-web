import bcrypt from "bcryptjs";
import { requireAdminAuth } from "../../http/auth.js";
import { isAccountAccessBlocked } from "./accountAccess.js";
import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../http/errors.js";
import { rateLimit } from "../../http/rateLimit.js";
import { findUserById, findUsersForLogin, listUserRoles } from "./auth.repository.js";
import { signAdminAccessToken, signAdminRefreshToken, verifyAdminRefreshToken } from "./token.service.js";
export const authRouter = Router();
authRouter.get('/session', requireAdminAuth, (_req, res) => { res.status(204).send(); });
const adminRoleCodes = new Set(["admin", "super_admin", "manager", "staff"]);
const loginBodySchema = z.object({
    identifier: z.string().min(3),
    password: z.string().min(1)
});
const refreshBodySchema = z.object({
    refreshToken: z.string().min(20)
});
const loginLimiter = rateLimit({
    keyPrefix: "admin-login",
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many login attempts. Try again later.",
    key: (req) => {
        const body = typeof req.body === "object" && req.body ? req.body : {};
        const identifier = typeof body.identifier === "string" ? body.identifier.toLowerCase().trim() : "unknown";
        return `${req.ip ?? req.socket.remoteAddress ?? "unknown"}:${identifier}`;
    }
});
function isDisabledAccount(user) {
    return !user || isAccountAccessBlocked({ ...user.metadata, accountStatus: user.accountStatus });
}
function adminRolesOnly(roles) {
    return roles.filter((role) => adminRoleCodes.has(role.code));
}
function adminSessionPayload(user, roles) {
    const adminRoles = adminRolesOnly(roles);
    if (!adminRoles.length) {
        throw new HttpError(403, "Admin role required");
    }
    const access = signAdminAccessToken({
        userId: user.id,
        roles: adminRoles.map((role) => role.code)
    });
    const refresh = signAdminRefreshToken({ userId: user.id });
    return {
        token: access.token,
        tokenType: access.tokenType,
        expiresIn: access.expiresIn,
        refreshToken: refresh.token,
        refreshExpiresIn: refresh.expiresIn,
        user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            displayName: user.displayName,
            profilePictureUrl: user.profilePictureUrl
        },
        roles: adminRoles
    };
}
authRouter.post("/login", loginLimiter, async (req, res, next) => {
    try {
        const body = loginBodySchema.parse(req.body);
        const users = await findUsersForLogin(body.identifier);
        let authenticatedUser = null;
        let authenticatedRoles = [];
        for (const user of users) {
            if (isDisabledAccount(user))
                continue;
            if (!user.passwordHash)
                continue;
            const passwordMatches = await bcrypt.compare(body.password, user.passwordHash);
            if (!passwordMatches)
                continue;
            const roles = await listUserRoles(user.id);
            if (!adminRolesOnly(roles).length)
                continue;
            authenticatedUser = user;
            authenticatedRoles = roles;
            break;
        }
        if (!authenticatedUser) {
            throw new HttpError(401, "Invalid login credentials");
        }
        const liveUser = await findUserById(authenticatedUser.id);
        if (isDisabledAccount(liveUser))
            throw new HttpError(401, "Invalid login credentials");
        authenticatedRoles = await listUserRoles(liveUser.id);
        res.json({ data: adminSessionPayload(liveUser, authenticatedRoles) });
    }
    catch (error) {
        next(error);
    }
});
authRouter.post("/refresh", async (req, res, next) => {
    try {
        const body = refreshBodySchema.parse(req.body);
        const refreshPayload = verifyAdminRefreshToken(body.refreshToken);
        const user = await findUserById(refreshPayload.sub);
        if (isDisabledAccount(user)) {
            throw new HttpError(401, "Refresh token expired or account is not active");
        }
        const roles = await listUserRoles(refreshPayload.sub);
        res.json({ data: adminSessionPayload(user, roles) });
    }
    catch (error) {
        next(error);
    }
});
