import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const seedUser = {
  email: "gourav@zigonow.in",
  phone: process.env.SEED_SUPER_ADMIN_PHONE ?? "9999999999",
  password: "Zigo@10",
  displayName: "Gourav Super Admin"
};

const roles = [
  { code: "super_admin", name: "Super Admin", description: "Full ZIGO admin access", isSystem: true },
  { code: "admin", name: "Admin", description: "Admin access without system-control deletion", isSystem: true },
  { code: "assistant", name: "Assistant", description: "Assistant mobile app role", isSystem: true },
  { code: "customer", name: "Customer", description: "Customer mobile app role", isSystem: true }
];

const modules = [
  { code: "modules", name: "Modules", description: "Admin Panel module management", sortOrder: 10 },
  { code: "permissions", name: "Permissions", description: "Permission master management", sortOrder: 20 },
  { code: "roles", name: "Roles", description: "Role master management", sortOrder: 30 },
  { code: "users", name: "Users", description: "User management", sortOrder: 40 },
  { code: "user_roles", name: "User Roles", description: "User-role mapping", sortOrder: 50 },
  { code: "verification", name: "Assistant Documents", description: "Assistant document verification", sortOrder: 60 },
  { code: "admin", name: "Admin Dashboard", description: "Dashboard and admin audit", sortOrder: 70 }
];

const actionNames = {
  create: "Create",
  update: "Update",
  edit: "Update",
  delete: "Delete",
  view: "View",
  approve: "Approve",
  reject: "Reject"
};

const permissionCodes = [
  "modules.view",
  "modules.create",
  "modules.edit",
  "modules.delete",
  "permissions.view",
  "permissions.create",
  "permissions.edit",
  "permissions.delete",
  "roles.view",
  "roles.create",
  "roles.edit",
  "roles.delete",
  "users.view",
  "users.create",
  "users.edit",
  "users.delete",
  "users.activate",
  "users.deactivate",
  "users.assign_permission",
  "user_roles.view",
  "user_roles.create",
  "user_roles.edit",
  "user_roles.delete",
  "verification.view",
  "verification.edit",
  "verification.approve",
  "verification.reject",
  "admin.dashboard.view",
  "admin.actions.read"
];

const adminPermissionCodes = [
  "users.view",
  "users.create",
  "users.edit",
  "users.activate",
  "users.deactivate",
  "user_roles.view",
  "user_roles.create",
  "user_roles.edit",
  "verification.view",
  "verification.edit",
  "admin.dashboard.view"
];

const assistantDocuments = [
  ["aadhaar_front", "Aadhaar Card Front Image"],
  ["aadhaar_back", "Aadhaar Card Back Image"],
  ["pan_front", "PAN Card Front Image"],
  ["pan_back", "PAN Card Back Image"],
  ["bank_details", "Bank Details"],
  ["profile_picture", "Profile Picture"],
  ["education_certificate", "Education Certificate"],
  ["driving_licence_front", "Driving Licence Front Image"],
  ["driving_licence_back", "Driving Licence Back Image"]
];

function permissionName(code) {
  const [module, action] = code.split(".");
  return `${actionNames[action] ?? action} ${module.replace(/_/g, " ")}`;
}

async function upsertRole(client, role) {
  const result = await client.query(
    `
      insert into zigo.roles (code, name, description, is_system, is_active, is_deleted)
      values ($1, $2, $3, $4, true, false)
      on conflict (code) do update
        set name = excluded.name,
            description = excluded.description,
            is_system = excluded.is_system,
            is_active = true,
            is_deleted = false,
            deleted_at = null,
            updated_at = now()
      returning id
    `,
    [role.code, role.name, role.description, role.isSystem]
  );
  return result.rows[0].id;
}

async function upsertModule(client, module) {
  const result = await client.query(
    `
      insert into zigo.modules (code, name, description, sort_order, is_active, is_deleted)
      values ($1, $2, $3, $4, true, false)
      on conflict (code) do update
        set name = excluded.name,
            description = excluded.description,
            sort_order = excluded.sort_order,
            is_active = true,
            is_deleted = false,
            deleted_at = null,
            updated_at = now()
      returning id
    `,
    [module.code, module.name, module.description, module.sortOrder]
  );
  return result.rows[0].id;
}

async function upsertPermission(client, code) {
  const [moduleCode] = code.split(".");
  const result = await client.query(
    `
      insert into zigo.permissions (code, name, description, module, is_active, is_deleted)
      values ($1, $2, $3, $4, true, false)
      on conflict (code) do update
        set name = excluded.name,
            description = excluded.description,
            module = excluded.module,
            is_active = true,
            is_deleted = false,
            deleted_at = null,
            updated_at = now()
      returning id
    `,
    [code, permissionName(code), `${permissionName(code)} permission`, moduleCode]
  );
  return result.rows[0].id;
}

const client = await pool.connect();

try {
  await client.query("begin");

  const roleIds = new Map();
  for (const role of roles) roleIds.set(role.code, await upsertRole(client, role));

  const moduleIds = new Map();
  for (const module of modules) moduleIds.set(module.code, await upsertModule(client, module));

  const permissionIds = new Map();
  for (const code of permissionCodes) {
    const permissionId = await upsertPermission(client, code);
    permissionIds.set(code, permissionId);
    const moduleId = moduleIds.get(code.split(".")[0]);
    if (moduleId) {
      await client.query(
        "insert into zigo.module_permissions (module_id, permission_id) values ($1, $2) on conflict do nothing",
        [moduleId, permissionId]
      );
    }
  }

  for (const permissionId of permissionIds.values()) {
    await client.query(
      "insert into zigo.role_permissions (role_id, permission_id) values ($1, $2) on conflict do nothing",
      [roleIds.get("super_admin"), permissionId]
    );
  }

  for (const code of adminPermissionCodes) {
    await client.query(
      "insert into zigo.role_permissions (role_id, permission_id) values ($1, $2) on conflict do nothing",
      [roleIds.get("admin"), permissionIds.get(code)]
    );
  }

  const passwordHash = await bcrypt.hash(seedUser.password, 12);
  const existingUser = await client.query("select id from zigo.users where lower(email::text) = lower($1) limit 1", [
    seedUser.email
  ]);
  const user = existingUser.rows[0]
    ? await client.query(
        `
          update zigo.users
          set phone = $2,
              password_hash = $3,
              display_name = $4,
              metadata = metadata || '{"accountStatus": "active", "app": "admin", "seeded": true}'::jsonb,
              deleted_at = null,
              updated_at = now()
          where id = $1
          returning id
        `,
        [existingUser.rows[0].id, seedUser.phone, passwordHash, seedUser.displayName]
      )
    : await client.query(
        `
          insert into zigo.users (email, phone, password_hash, display_name, metadata, deleted_at)
          values ($1, $2, $3, $4, '{"accountStatus": "active", "app": "admin", "seeded": true}'::jsonb, null)
          returning id
        `,
        [seedUser.email, seedUser.phone, passwordHash, seedUser.displayName]
      );

  const existingUserRole = await client.query(
    "select id from zigo.user_roles where user_id = $1 and role_id = $2 and coalesce(is_deleted, false) = false limit 1",
    [user.rows[0].id, roleIds.get("super_admin")]
  );
  if (!existingUserRole.rows[0]) {
    await client.query(
      `
        insert into zigo.user_roles (user_id, role_id, is_active, is_primary, is_deleted, created_by)
        values ($1, $2, true, true, false, $1)
      `,
      [user.rows[0].id, roleIds.get("super_admin")]
    );
  }

  const assistantRoleId = roleIds.get("assistant");
  for (const [code, name] of assistantDocuments) {
    const documentType = await client.query(
      `
        insert into zigo.document_types (code, name, entity_type, description, is_active)
        values ($1, $2, 'assistant', $3, true)
        on conflict (code) do update
          set name = excluded.name,
              entity_type = excluded.entity_type,
              description = excluded.description,
              is_active = true,
              updated_at = now()
        returning id
      `,
      [code, name, `${name} is required for assistant verification`]
    );
    await client.query(
      `
        insert into zigo.role_verification_requirements (role_id, document_type_id, is_required)
        values ($1, $2, true)
        on conflict (role_id, document_type_id) do update set is_required = true
      `,
      [assistantRoleId, documentType.rows[0].id]
    );
  }

  await client.query("commit");
  console.log("RBAC foundation seed completed.");
  console.table([{ email: seedUser.email, password: seedUser.password, role: "Super Admin" }]);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
