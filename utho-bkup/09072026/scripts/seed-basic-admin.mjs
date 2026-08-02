import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

const superAdmin = {
  email: process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@zigo.local",
  phone: process.env.SEED_SUPER_ADMIN_PHONE ?? "9999999999",
  password: process.env.SEED_SUPER_ADMIN_PASSWORD ?? "SuperAdmin@123",
  displayName: process.env.SEED_SUPER_ADMIN_NAME ?? "Zigo Super Admin"
};

const roles = [
  {
    code: "super_admin",
    name: "Super Admin",
    description: "Full platform administration access"
  },
  {
    code: "admin",
    name: "Admin",
    description: "General platform administration access"
  }
];

const permissions = [
  {
    code: "modules.view",
    name: "View Modules",
    description: "Can view system modules",
    module: "access"
  },
  {
    code: "modules.create",
    name: "Create Modules",
    description: "Can create system modules",
    module: "access"
  },
  {
    code: "modules.edit",
    name: "Edit Modules",
    description: "Can edit system modules",
    module: "access"
  },
  {
    code: "modules.delete",
    name: "Delete Modules",
    description: "Can delete system modules",
    module: "access"
  },
  {
    code: "module_permissions.view",
    name: "View Module Permissions",
    description: "Can view module-permission mapping",
    module: "access"
  },
  {
    code: "module_permissions.create",
    name: "Assign Permissions To Modules",
    description: "Can assign permissions to modules",
    module: "access"
  },
  {
    code: "module_permissions.delete",
    name: "Remove Permissions From Modules",
    description: "Can remove permissions from modules",
    module: "access"
  },
  {
    code: "roles.view",
    name: "View Roles",
    description: "Can view roles",
    module: "access"
  },
  {
    code: "roles.create",
    name: "Create Roles",
    description: "Can create roles",
    module: "access"
  },
  {
    code: "roles.edit",
    name: "Edit Roles",
    description: "Can edit roles",
    module: "access"
  },
  {
    code: "roles.delete",
    name: "Delete Roles",
    description: "Can delete non-system roles",
    module: "access"
  },
  {
    code: "permissions.view",
    name: "View Permissions",
    description: "Can view permissions",
    module: "access"
  },
  {
    code: "permissions.create",
    name: "Create Permissions",
    description: "Can create permissions",
    module: "access"
  },
  {
    code: "permissions.edit",
    name: "Edit Permissions",
    description: "Can edit permissions",
    module: "access"
  },
  {
    code: "permissions.delete",
    name: "Delete Permissions",
    description: "Can delete permissions",
    module: "access"
  },
  {
    code: "role_permissions.view",
    name: "View Role Permissions",
    description: "Can view role-permission mapping",
    module: "access"
  },
  {
    code: "role_permissions.create",
    name: "Assign Permissions To Roles",
    description: "Can assign permissions to roles",
    module: "access"
  },
  {
    code: "role_permissions.delete",
    name: "Remove Permissions From Roles",
    description: "Can remove permissions from roles",
    module: "access"
  },
  {
    code: "user_roles.view",
    name: "View User Roles",
    description: "Can view user-role mapping",
    module: "access"
  },
  {
    code: "user_roles.create",
    name: "Assign Roles To Users",
    description: "Can assign roles to users",
    module: "access"
  },
  {
    code: "user_roles.delete",
    name: "Remove Roles From Users",
    description: "Can remove roles from users",
    module: "access"
  },
  {
    code: "users.view",
    name: "View Users",
    description: "Can view users",
    module: "users"
  },
  {
    code: "admin.dashboard.view",
    name: "View Admin Dashboard",
    description: "Can view admin dashboard metrics",
    module: "admin"
  },
  {
    code: "admin.actions.read",
    name: "Read Admin Actions",
    description: "Can read admin audit actions",
    module: "admin"
  },
  {
    code: "roles.manage",
    name: "Manage Roles",
    description: "Can create and update roles",
    module: "access"
  },
  {
    code: "permissions.manage",
    name: "Manage Permissions",
    description: "Can create and update permissions",
    module: "access"
  }
];

async function getOrCreateRole(client, role) {
  const existing = await client.query("select id from zigo.roles where code = $1", [role.code]);

  if (existing.rows[0]) {
    await client.query(
      `
        update zigo.roles
        set name = $2, description = $3, is_system = true
        where code = $1
      `,
      [role.code, role.name, role.description]
    );

    return existing.rows[0].id;
  }

  const created = await client.query(
    `
      insert into zigo.roles (code, name, description, is_system)
      values ($1, $2, $3, true)
      returning id
    `,
    [role.code, role.name, role.description]
  );

  return created.rows[0].id;
}

async function getOrCreatePermission(client, permission) {
  const existing = await client.query("select id from zigo.permissions where code = $1", [
    permission.code
  ]);

  if (existing.rows[0]) {
    await client.query(
      `
        update zigo.permissions
        set name = $2, description = $3, module = $4
        where code = $1
      `,
      [permission.code, permission.name, permission.description, permission.module]
    );

    return existing.rows[0].id;
  }

  const created = await client.query(
    `
      insert into zigo.permissions (code, name, description, module)
      values ($1, $2, $3, $4)
      returning id
    `,
    [permission.code, permission.name, permission.description, permission.module]
  );

  return created.rows[0].id;
}

async function getOrCreateSuperAdminUser(client) {
  const passwordHash = await bcrypt.hash(superAdmin.password, 12);
  const existing = await client.query("select id from zigo.users where lower(email::text) = lower($1)", [
    superAdmin.email
  ]);

  if (existing.rows[0]) {
    await client.query(
      `
        update zigo.users
        set
          phone = $2,
          password_hash = $3,
          display_name = $4,
          metadata = metadata || '{"seeded": true, "app": "admin"}'::jsonb,
          updated_at = now(),
          deleted_at = null
        where id = $1
      `,
      [existing.rows[0].id, superAdmin.phone, passwordHash, superAdmin.displayName]
    );

    return existing.rows[0].id;
  }

  const created = await client.query(
    `
      insert into zigo.users (email, phone, password_hash, display_name, metadata)
      values ($1, $2, $3, $4, '{"seeded": true, "app": "admin"}'::jsonb)
      returning id
    `,
    [superAdmin.email, superAdmin.phone, passwordHash, superAdmin.displayName]
  );

  return created.rows[0].id;
}

async function linkRolePermission(client, roleId, permissionId) {
  const existing = await client.query(
    "select 1 from zigo.role_permissions where role_id = $1 and permission_id = $2",
    [roleId, permissionId]
  );

  if (!existing.rows[0]) {
    await client.query(
      "insert into zigo.role_permissions (role_id, permission_id) values ($1, $2)",
      [roleId, permissionId]
    );
  }
}

async function linkUserRole(client, userId, roleId) {
  const existing = await client.query(
    "select 1 from zigo.user_roles where user_id = $1 and role_id = $2",
    [userId, roleId]
  );

  if (!existing.rows[0]) {
    await client.query("insert into zigo.user_roles (user_id, role_id) values ($1, $2)", [
      userId,
      roleId
    ]);
  }
}

const client = await pool.connect();

try {
  await client.query("begin");

  const roleIds = new Map();
  for (const role of roles) {
    roleIds.set(role.code, await getOrCreateRole(client, role));
  }

  const permissionIds = [];
  for (const permission of permissions) {
    permissionIds.push(await getOrCreatePermission(client, permission));
  }

  for (const permissionId of permissionIds) {
    await linkRolePermission(client, roleIds.get("super_admin"), permissionId);
  }

  for (const permission of ["admin.dashboard.view", "admin.actions.read", "users.view"]) {
    const permissionIndex = permissions.findIndex((item) => item.code === permission);
    await linkRolePermission(client, roleIds.get("admin"), permissionIds[permissionIndex]);
  }

  const superAdminUserId = await getOrCreateSuperAdminUser(client);
  await linkUserRole(client, superAdminUserId, roleIds.get("super_admin"));

  await client.query("commit");

  console.log("Basic admin seed completed.");
  console.table([
    {
      email: superAdmin.email,
      phone: superAdmin.phone,
      password: superAdmin.password,
      role: "super_admin"
    }
  ]);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
