import { pool } from "../../db/pool.js";

export type Role = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
};

export type Permission = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  module: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
};

export type Module = {
  ModuleId: string;
  Name: string;
  Description: string | null;
  IsActive: boolean;
  CreatedBy: string | null;
  CreatedOn: Date;
  UpdatedBy: string | null;
  UpdatedOn: Date;
  DeletedBy?: string | null;
  DeletedOn?: Date | null;
  IsDeleted?: boolean;
};

const moduleSelect = `
  id as "ModuleId",
  name as "Name",
  description as "Description",
  is_active as "IsActive",
  created_by as "CreatedBy",
  created_at as "CreatedOn",
  updated_by as "UpdatedBy",
  updated_at as "UpdatedOn",
  deleted_by as "DeletedBy",
  deleted_at as "DeletedOn",
  is_deleted as "IsDeleted"
`;

function moduleCodeFromName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 56);
  return `${slug || "module"}_${Date.now().toString(36)}`;
}

export async function listModules() {
  const result = await pool.query<Module>(`
    select
      ${moduleSelect}
    from zigo.modules
    where is_deleted = false
    order by sort_order, code
  `);
  return result.rows;
}

export async function getModuleById(id: string) {
  const result = await pool.query<Module>(
    `
      select ${moduleSelect}
      from zigo.modules
      where id = $1 and is_deleted = false
      limit 1
    `,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function createModule(input: {
  Name: string;
  Description?: string | null;
  IsActive: boolean;
  userId: string;
}) {
  const result = await pool.query<Module>(
    `
      insert into zigo.modules (code, name, description, is_active, created_by, created_at, is_deleted)
      values ($1, $2, $3, $4, $5, now(), false)
      returning
        ${moduleSelect}
    `,
    [moduleCodeFromName(input.Name), input.Name, input.Description ?? null, input.IsActive, input.userId]
  );
  return result.rows[0];
}

export async function updateModule(
  id: string,
  input: {
    Name: string;
    Description?: string | null;
    IsActive: boolean;
    userId: string;
  }
) {
  const result = await pool.query<Module>(
    `
      update zigo.modules
      set name = $2,
          description = $3,
          is_active = $4,
          updated_by = $5,
          updated_at = now()
      where id = $1
        and is_deleted = false
      returning
        ${moduleSelect}
    `,
    [id, input.Name, input.Description ?? null, input.IsActive, input.userId]
  );
  return result.rows[0] ?? null;
}

export async function deleteModule(id: string, userId: string) {
  const result = await pool.query<Module>(
    `
      update zigo.modules
      set is_deleted = true,
          is_active = false,
          deleted_by = $2,
          deleted_at = now(),
          updated_by = $2,
          updated_at = now()
      where id = $1
        and is_deleted = false
      returning ${moduleSelect}
    `,
    [id, userId]
  );
  return result.rows[0] ?? null;
}

export async function updateModuleStatus(id: string, input: { IsActive: boolean; userId: string }) {
  const result = await pool.query<Module>(
    `
      update zigo.modules
      set is_active = $2,
          updated_by = $3,
          updated_at = now()
      where id = $1
        and is_deleted = false
      returning ${moduleSelect}
    `,
    [id, input.IsActive, input.userId]
  );
  return result.rows[0] ?? null;
}

export async function listRoles() {
  const result = await pool.query<Role>(`
    select id, code, name, description, is_system as "isSystem",
      is_active as "isActive", is_deleted as "isDeleted", created_at as "createdAt"
    from zigo.roles
    where coalesce(is_deleted, false) = false
    order by code
  `);
  return result.rows;
}

export async function getRoleById(id: string) {
  const result = await pool.query<Role>(
    `
      select id, code, name, description, is_system as "isSystem",
        is_active as "isActive", is_deleted as "isDeleted", created_at as "createdAt"
      from zigo.roles
      where id = $1 and coalesce(is_deleted, false) = false
      limit 1
    `,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function createRole(input: { code: string; name: string; description?: string | null; userId: string }) {
  const result = await pool.query<Role>(
    `
      insert into zigo.roles (code, name, description, created_by, is_active, is_deleted)
      values ($1, $2, $3, $4, true, false)
      returning id, code, name, description, is_system as "isSystem",
        is_active as "isActive", is_deleted as "isDeleted", created_at as "createdAt"
    `,
    [input.code, input.name, input.description ?? null, input.userId]
  );
  return result.rows[0];
}

export async function updateRole(
  id: string,
  input: { code: string; name: string; description?: string | null; userId: string }
) {
  const result = await pool.query<Role>(
    `
      update zigo.roles
      set code = $2, name = $3, description = $4, updated_by = $5, updated_at = now()
      where id = $1
        and coalesce(is_deleted, false) = false
      returning id, code, name, description, is_system as "isSystem",
        is_active as "isActive", is_deleted as "isDeleted", created_at as "createdAt"
    `,
    [id, input.code, input.name, input.description ?? null, input.userId]
  );
  return result.rows[0] ?? null;
}

export async function deleteRole(id: string, userId: string) {
  const result = await pool.query(
    `
      update zigo.roles
      set is_deleted = true,
          is_active = false,
          deleted_by = $2,
          deleted_at = now(),
          updated_by = $2,
          updated_at = now()
      where id = $1
        and code <> 'super_admin'
        and is_system = false
        and coalesce(is_deleted, false) = false
    `,
    [id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listPermissions() {
  const result = await pool.query<Permission>(`
    select id, code, name, description, module, is_active as "isActive",
      is_deleted as "isDeleted", created_at as "createdAt"
    from zigo.permissions
    where coalesce(is_deleted, false) = false
    order by module, code
  `);
  return result.rows;
}

export async function getPermissionById(id: string) {
  const result = await pool.query<Permission>(
    `
      select id, code, name, description, module, is_active as "isActive",
        is_deleted as "isDeleted", created_at as "createdAt"
      from zigo.permissions
      where id = $1 and coalesce(is_deleted, false) = false
      limit 1
    `,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function createPermission(input: {
  code: string;
  name: string;
  description?: string | null;
  module: string;
  userId: string;
}) {
  const result = await pool.query<Permission>(
    `
      insert into zigo.permissions (code, name, description, module, created_by, is_active, is_deleted)
      values ($1, $2, $3, $4, $5, true, false)
      returning id, code, name, description, module, is_active as "isActive",
        is_deleted as "isDeleted", created_at as "createdAt"
    `,
    [input.code, input.name, input.description ?? null, input.module, input.userId]
  );
  return result.rows[0];
}

export async function updatePermission(
  id: string,
  input: { code: string; name: string; description?: string | null; module: string; userId: string }
) {
  const result = await pool.query<Permission>(
    `
      update zigo.permissions
      set code = $2, name = $3, description = $4, module = $5, updated_by = $6, updated_at = now()
      where id = $1
        and coalesce(is_deleted, false) = false
      returning id, code, name, description, module, is_active as "isActive",
        is_deleted as "isDeleted", created_at as "createdAt"
    `,
    [id, input.code, input.name, input.description ?? null, input.module, input.userId]
  );
  return result.rows[0] ?? null;
}

export async function deletePermission(id: string, userId: string) {
  const result = await pool.query(
    `
      update zigo.permissions
      set is_deleted = true,
          is_active = false,
          deleted_by = $2,
          deleted_at = now(),
          updated_by = $2,
          updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
    `,
    [id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listRolePermissions(roleId?: string) {
  const result = await pool.query(
    `
      select
        r.id as "roleId",
        r.code as "roleCode",
        r.name as "roleName",
        p.id as "permissionId",
        p.code as "permissionCode",
        p.name as "permissionName",
        p.module
      from zigo.role_permissions rp
      join zigo.roles r on r.id = rp.role_id
      join zigo.permissions p on p.id = rp.permission_id
      where ($1::uuid is null or r.id = $1)
        and coalesce(r.is_deleted, false) = false
        and coalesce(p.is_deleted, false) = false
      order by r.code, p.module, p.code
    `,
    [roleId ?? null]
  );
  return result.rows;
}

export async function assignPermissionToRole(roleId: string, permissionId: string) {
  await pool.query(
    `
      insert into zigo.role_permissions (role_id, permission_id)
      values ($1, $2)
      on conflict do nothing
    `,
    [roleId, permissionId]
  );
}

export async function removePermissionFromRole(roleId: string, permissionId: string) {
  const result = await pool.query(
    "delete from zigo.role_permissions where role_id = $1 and permission_id = $2",
    [roleId, permissionId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listModulePermissions(moduleId?: string) {
  const result = await pool.query(
    `
      select
        m.id as "moduleId",
        m.code as "moduleCode",
        m.name as "moduleName",
        p.id as "permissionId",
        p.code as "permissionCode",
        p.name as "permissionName",
        p.module as "legacyModule"
      from zigo.module_permissions mp
      join zigo.modules m on m.id = mp.module_id
      join zigo.permissions p on p.id = mp.permission_id
      where ($1::uuid is null or m.id = $1)
        and coalesce(m.is_deleted, false) = false
        and coalesce(p.is_deleted, false) = false
      order by m.sort_order, m.code, p.code
    `,
    [moduleId ?? null]
  );
  return result.rows;
}

export async function assignPermissionToModule(moduleId: string, permissionId: string) {
  await pool.query(
    `
      insert into zigo.module_permissions (module_id, permission_id)
      values ($1, $2)
      on conflict do nothing
    `,
    [moduleId, permissionId]
  );
}

export async function removePermissionFromModule(moduleId: string, permissionId: string) {
  const result = await pool.query(
    "delete from zigo.module_permissions where module_id = $1 and permission_id = $2",
    [moduleId, permissionId]
  );
  return (result.rowCount ?? 0) > 0;
}

export type UserRoleFilters = {
  page: number;
  pageSize: number;
  userId?: string;
  role?: string;
  name?: string;
  mobileNo?: string;
  email?: string;
  status?: string;
  createdFrom?: string;
  createdTo?: string;
};

export async function listUserRoles(filters: UserRoleFilters) {
  const conditions = ["coalesce(ur.is_deleted, false) = false", "u.deleted_at is null"];
  const values: unknown[] = [];
  const add = (condition: string, value: unknown) => {
    values.push(value);
    conditions.push(condition.replace("?", `$${values.length}`));
  };

  if (filters.userId) add("u.id = ?::uuid", filters.userId);
  if (filters.role) add("r.code = ?", filters.role);
  if (filters.name) add("u.display_name ilike '%' || ? || '%'", filters.name);
  if (filters.mobileNo) add("u.phone ilike '%' || ? || '%'", filters.mobileNo);
  if (filters.email) add("u.email::text ilike '%' || ? || '%'", filters.email);
  if (filters.status) add("coalesce(u.metadata->>'accountStatus', 'active') = ?", filters.status);
  if (filters.createdFrom) add("ur.created_at >= ?::timestamptz", filters.createdFrom);
  if (filters.createdTo) add("ur.created_at <= ?::timestamptz", filters.createdTo);

  const where = conditions.join(" and ");
  const count = await pool.query<{ total: string }>(
    `
      select count(*) as total
      from zigo.user_roles ur
      join zigo.users u on u.id = ur.user_id
      join zigo.roles r on r.id = ur.role_id
      where ${where}
    `,
    values
  );

  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;
  const result = await pool.query(
    `
      select
        ur.id,
        u.id as "userId",
        u.email::text as email,
        u.phone,
        u.display_name as "displayName",
        r.id as "roleId",
        r.code as "roleCode",
        r.name as "roleName",
        ur.is_active as "isActive",
        ur.is_primary as "isPrimary",
        ur.scope_type as "scopeType",
        ur.scope_id as "scopeId",
        ur.created_at as "createdAt"
      from zigo.user_roles ur
      join zigo.users u on u.id = ur.user_id
      join zigo.roles r on r.id = ur.role_id
      where ${where}
      order by ur.created_at desc
      limit $${limitIndex} offset $${offsetIndex}
    `,
    [...values, filters.pageSize, (filters.page - 1) * filters.pageSize]
  );
  const totalRecords = Number(count.rows[0]?.total ?? 0);
  return {
    data: result.rows,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      totalRecords,
      totalPages: Math.ceil(totalRecords / filters.pageSize)
    }
  };
}

export async function assignRoleToUser(input: {
  userId: string;
  roleId: string;
  scopeType?: string | null;
  scopeId?: string | null;
  actorUserId: string;
  isPrimary?: boolean;
}) {
  const existing = await pool.query(
    `
      select id
      from zigo.user_roles
      where user_id = $1
        and role_id = $2
        and scope_type is not distinct from $3
        and scope_id is not distinct from $4
        and coalesce(is_deleted, false) = false
      limit 1
    `,
    [input.userId, input.roleId, input.scopeType ?? null, input.scopeId ?? null]
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const result = await pool.query(
    `
      insert into zigo.user_roles (user_id, role_id, scope_type, scope_id)
      values ($1, $2, $3, $4)
      returning id
    `,
    [input.userId, input.roleId, input.scopeType ?? null, input.scopeId ?? null]
  );
  return result.rows[0];
}

export async function updateUserRole(
  id: string,
  input: { roleId: string; scopeType?: string | null; scopeId?: string | null; actorUserId: string; isPrimary?: boolean }
) {
  const result = await pool.query(
    `
      update zigo.user_roles
      set role_id = $2,
          scope_type = $3,
          scope_id = $4,
          is_primary = $5,
          updated_by = $6,
          updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
      returning id, user_id as "userId", role_id as "roleId"
    `,
    [id, input.roleId, input.scopeType ?? null, input.scopeId ?? null, input.isPrimary ?? false, input.actorUserId]
  );
  return result.rows[0] ?? null;
}

export async function removeRoleFromUser(userRoleId: string, actorUserId: string) {
  const result = await pool.query(
    `
      update zigo.user_roles
      set is_deleted = true,
          is_active = false,
          deleted_by = $2,
          deleted_at = now(),
          updated_by = $2,
          updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
    `,
    [userRoleId, actorUserId]
  );
  return (result.rowCount ?? 0) > 0;
}
