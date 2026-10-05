import { pool } from "../../db/pool.js";

export type LoginUser = {
  id: string;
  email: string | null;
  phone: string | null;
  passwordHash: string | null;
  displayName: string | null;
  profilePictureUrl: string | null;
  accountStatus: string | null;
  metadata: Record<string, unknown> | null;
};

export type RoleSummary = {
  id: string;
  code: string;
  name: string;
};

export async function findUserForLogin(identifier: string) {
  const users = await findUsersForLogin(identifier);
  return users[0] ?? null;
}

export async function findUserById(userId: string) {
  const result = await pool.query<LoginUser>(
    `
      select
        id,
        email::text as email,
        phone,
        password_hash as "passwordHash",
        display_name as "displayName",
        metadata->>'profilePictureUrl' as "profilePictureUrl",
        metadata->>'accountStatus' as "accountStatus", metadata
      from zigo.users
      where id = $1
        and deleted_at is null
      limit 1
    `,
    [userId]
  );

  return result.rows[0] ?? null;
}

export async function findUsersForLogin(identifier: string) {
  const result = await pool.query<LoginUser>(
    `
      select
        id,
        email::text as email,
        phone,
        password_hash as "passwordHash",
        display_name as "displayName",
        metadata->>'profilePictureUrl' as "profilePictureUrl",
        metadata->>'accountStatus' as "accountStatus", metadata
      from zigo.users
      where deleted_at is null
        and (lower(email::text) = lower($1) or phone = $1)
      order by created_at desc
    `,
    [identifier]
  );

  return result.rows;
}

export async function listUserRoles(userId: string) {
  const result = await pool.query<RoleSummary>(
    `
      select r.id, r.code, r.name
      from zigo.user_roles ur
      join zigo.roles r on r.id = ur.role_id
      where ur.user_id = $1
        and coalesce(ur.is_deleted, false) = false
        and coalesce(ur.is_active, true) = true
        and coalesce(r.is_deleted, false) = false
        and coalesce(r.is_active, true) = true
      order by r.code
    `,
    [userId]
  );

  return result.rows;
}
