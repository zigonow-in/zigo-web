import type { NextFunction, Request, Response } from "express";
import { pool } from "../db/pool.js";
import { verifyAdminAccessToken, type AdminAccessTokenPayload } from "../modules/auth/token.service.js";
import { HttpError } from "./errors.js";

const adminRoleCodes = new Set(["admin", "super_admin", "manager", "staff", "owner"]);

declare global {
  namespace Express {
    interface Request {
      auth?: AdminAccessTokenPayload;
    }
  }
}

export async function requireAdminAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authorization = req.header("authorization");
    const isSseBookingEventPath =
      req.path.endsWith("/bookings/events") || req.originalUrl.split("?")[0]?.endsWith("/operations/bookings/events");
    const queryToken = typeof req.query.access_token === "string" && isSseBookingEventPath ? req.query.access_token : null;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : queryToken;

    if (!token) {
      throw new HttpError(401, "Authorization token required");
    }

    const payload = verifyAdminAccessToken(token);
    await assertActiveAdminUser(payload.sub);

    const liveRoles = await getUserRoleCodes(payload.sub);
    const adminRoles = liveRoles.filter((role) => adminRoleCodes.has(role));
    if (!adminRoles.length) {
      throw new HttpError(403, "Admin role required");
    }

    req.auth = { ...payload, roles: adminRoles };
    next();
  } catch (error) {
    if (error instanceof HttpError) {
      next(error);
      return;
    }

    next(new HttpError(401, "Invalid authorization token"));
  }
}

async function assertActiveAdminUser(userId: string) {
  const result = await pool.query<{ id: string; accountStatus: string | null }>(
    `
      select id, metadata->>'accountStatus' as "accountStatus"
      from zigo.users
      where id = $1
        and deleted_at is null
      limit 1
    `,
    [userId]
  );
  const user = result.rows[0];
  if (!user) throw new HttpError(401, "Invalid authorization token");
  if (["disabled", "suspended", "blocked", "inactive"].includes(String(user.accountStatus || "").toLowerCase())) {
    throw new HttpError(403, "User account is not active.");
  }
}

export function requirePermission(permissionCode: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.auth) {
        throw new HttpError(401, "Authorization token required");
      }

      if (req.auth.roles?.includes("super_admin")) {
        next();
        return;
      }

      const result = await pool.query<{ allowed: boolean }>(
        `
          select exists (
          select 1
          from zigo.user_roles ur
          join zigo.roles r on r.id = ur.role_id
          join zigo.role_permissions rp on rp.role_id = r.id
          join zigo.permissions p on p.id = rp.permission_id
          where ur.user_id = $1
              and p.code = $2
            union
            select 1
            from zigo.user_permissions up
            join zigo.permissions p on p.id = up.permission_id
            where up.user_id = $1
              and p.code = $2
          ) as allowed
        `,
        [req.auth.sub, permissionCode]
      );

      if (!result.rows[0]?.allowed) {
        throw new HttpError(403, `Permission required: ${permissionCode}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function isSuperAdmin(req: Request) {
  return req.auth?.roles?.includes("super_admin") === true;
}

export function isAdmin(req: Request) {
  return req.auth?.roles?.includes("admin") === true;
}

export const roleHierarchy = {
  super_admin: 1,
  admin: 2,
  manager: 3,
  staff: 4,
  assistant: 5,
  customer: 6
} as const;

type RoleCode = keyof typeof roleHierarchy;

export function roleRank(roleCode: string) {
  return roleHierarchy[roleCode as RoleCode] ?? 99;
}

export function bestRoleRank(roleCodes: string[] = []) {
  return Math.min(...roleCodes.map(roleRank), 99);
}

export function blockedRoleCodesForActor(roleCodes: string[] = []) {
  const actorRank = bestRoleRank(roleCodes);
  if (actorRank === roleHierarchy.super_admin) return [];
  return Object.entries(roleHierarchy)
    .filter(([, rank]) => rank <= actorRank)
    .map(([code]) => code);
}

async function getRoleCodeById(roleId: string) {
  const role = await pool.query<{ code: string }>(
    "select code from zigo.roles where id = $1 and coalesce(is_deleted, false) = false",
    [roleId]
  );
  return role.rows[0]?.code ?? null;
}

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.auth) {
      throw new HttpError(401, "Authorization token required");
    }

    if (!req.auth.roles?.includes("super_admin")) {
      throw new HttpError(403, "Super admin access required");
    }

    next();
  } catch (error) {
    next(error);
  }
}

export async function getUserRoleCodes(userId: string) {
  const result = await pool.query<{ code: string }>(
    `
      select r.code
      from zigo.user_roles ur
      join zigo.roles r on r.id = ur.role_id
      where ur.user_id = $1
        and coalesce(ur.is_deleted, false) = false
        and coalesce(ur.is_active, true) = true
        and coalesce(r.is_deleted, false) = false
    `,
    [userId]
  );
  return result.rows.map((row) => row.code);
}

export async function assertCanManageUser(req: Request, targetUserId: string) {
  if (isSuperAdmin(req)) return;

  if (!req.auth?.roles?.length) {
    throw new HttpError(403, "Admin role required");
  }

  const roles = await getUserRoleCodes(targetUserId);
  if (bestRoleRank(roles) <= bestRoleRank(req.auth.roles)) {
    throw new HttpError(403, "You cannot manage users with the same or higher role.");
  }
}

export async function assertCanAssignRole(req: Request, roleId: string, targetUserId?: string) {
  const roleCode = await getRoleCodeById(roleId);
  if (!roleCode) throw new HttpError(404, "Role not found");

  if (roleCode === "super_admin") {
    throw new HttpError(403, "Only Super Admin can assign Super Admin role");
  }

  if (!isSuperAdmin(req)) {
    if (!req.auth?.roles?.length) {
      throw new HttpError(403, "Admin role required");
    }
    if (roleRank(roleCode) <= bestRoleRank(req.auth.roles)) {
      throw new HttpError(403, "You can assign only roles lower than your own role.");
    }
  }

  if (targetUserId) {
    await assertCanManageUser(req, targetUserId);
  }
}
