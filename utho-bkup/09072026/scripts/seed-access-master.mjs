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

const modules = [
  { code: "system_control", name: "System Control", description: "Access control, modules, roles, and permissions", sortOrder: 10 },
  { code: "users", name: "Users", description: "Platform user management", sortOrder: 20 },
  { code: "customers", name: "Customers", description: "Customer profile and customer operations", sortOrder: 30 },
  { code: "assistants", name: "Assistants", description: "Assistant profile, verification, and operations", sortOrder: 40 },
  { code: "verification", name: "Verification", description: "Role verification rules, document types, assistant vehicle verification", sortOrder: 45 },
  { code: "locations", name: "Locations", description: "States, cities, clusters, zones, and service geography", sortOrder: 50 },
  { code: "stores", name: "Stores", description: "Store setup, store clusters, and store activation", sortOrder: 60 },
  { code: "services", name: "Services", description: "Services, categories, duration, price, and active cluster mapping", sortOrder: 70 },
  { code: "service_requests", name: "Service Requests", description: "Customer requests and workflow state", sortOrder: 80 },
  { code: "tasks", name: "Tasks", description: "Task generation, assignment, switching, closing, review, and issue resolution", sortOrder: 90 },
  { code: "orders", name: "Orders", description: "Orders and customer order view", sortOrder: 100 },
  { code: "payments", name: "Payments", description: "Payments, refunds, invoices, and settlements", sortOrder: 110 },
  { code: "discounts", name: "Discounts", description: "Discounts, compensation, and customer issue resolution credits", sortOrder: 120 },
  { code: "reports", name: "Reports", description: "Customer, assistant, admin-created roles, and user reports", sortOrder: 130 },
  { code: "wallets", name: "Wallets", description: "Wallets and wallet ledger", sortOrder: 140 },
  { code: "notifications", name: "Notifications", description: "Notifications, templates, and delivery logs", sortOrder: 150 },
  { code: "settings", name: "Settings", description: "Configuration, feature flags, and policy setup", sortOrder: 160 },
  { code: "audit_logs", name: "Audit Logs", description: "Admin actions and event history", sortOrder: 170 }
];

const moduleActions = {
  system_control: ["view", "create", "edit", "delete", "assign"],
  users: ["view", "create", "edit", "delete", "activate", "deactivate", "assign_role", "assign_permission"],
  customers: ["view", "create", "edit", "delete", "block"],
  assistants: ["view", "create", "edit", "delete", "verify"],
  verification: ["view", "create", "edit", "delete", "approve", "reject"],
  locations: ["view", "create", "edit", "delete", "activate", "deactivate"],
  stores: ["view", "create", "edit", "delete", "activate", "deactivate"],
  services: ["view", "create", "edit", "delete", "activate", "deactivate", "map_cluster", "price", "duration"],
  service_requests: ["view", "create", "edit", "delete", "assign", "cancel"],
  tasks: ["view", "create", "edit", "delete", "generate", "assign", "switch", "close", "review", "resolve_issue"],
  orders: ["view"],
  payments: ["view", "create", "edit", "delete", "refund"],
  discounts: ["view", "create", "edit", "delete", "compensate"],
  wallets: ["view", "create", "edit", "delete"],
  notifications: ["view", "create", "edit", "delete", "send"],
  reports: ["view", "export", "customers", "assistants", "admin_roles", "admin_users"],
  settings: ["view", "create", "edit", "delete"],
  audit_logs: ["view", "export"]
};

const roles = [
  {
    code: "super_admin",
    name: "Super Admin",
    description: "Full platform access across all modules and permissions",
    isSystem: true
  },
  {
    code: "admin",
    name: "Admin",
    description: "Operations admin access without system-control deletion rights",
    isSystem: true
  },
  {
    code: "customer",
    name: "Customer",
    description: "Customer app role; access should be ownership-scoped",
    isSystem: true
  },
  {
    code: "assistant",
    name: "Assistant",
    description: "Assistant app role; access should be assignment-scoped",
    isSystem: true
  },
  {
    code: "manager",
    name: "Manager",
    description: "Manager role for operational supervision",
    isSystem: false
  },
  {
    code: "staff",
    name: "Staff",
    description: "Staff role for limited operational work",
    isSystem: false
  }
];

const adminPermissionCodes = [
  "admin.dashboard.view",
  "users.view",
  "users.create",
  "users.activate",
  "users.deactivate",
  "users.delete",
  "users.assign_permission",
  "tasks.view",
  "tasks.generate",
  "tasks.assign",
  "tasks.switch",
  "tasks.close",
  "tasks.resolve_issue",
  "tasks.review",
  "locations.view",
  "locations.create",
  "locations.edit",
  "locations.activate",
  "locations.deactivate",
  "stores.view",
  "stores.create",
  "stores.edit",
  "stores.activate",
  "stores.deactivate",
  "service_requests.view",
  "service_requests.create",
  "service_requests.edit",
  "service_requests.assign",
  "orders.view",
  "payments.view",
  "services.view",
  "services.create",
  "services.edit",
  "services.activate",
  "services.deactivate",
  "services.map_cluster",
  "services.price",
  "services.duration",
  "customers.view",
  "customers.edit",
  "assistants.view",
  "assistants.edit",
  "assistants.verify",
  "verification.view",
  "verification.edit",
  "verification.approve",
  "verification.reject",
  "discounts.view",
  "discounts.create",
  "discounts.edit",
  "discounts.compensate",
  "reports.view",
  "reports.export",
  "reports.customers",
  "reports.assistants",
  "reports.admin_roles",
  "reports.admin_users",
  "settings.view",
  "settings.edit"
];

const compatibilityPermissions = [
  { code: "modules.view", name: "View Modules", module: "system_control" },
  { code: "modules.create", name: "Create Modules", module: "system_control" },
  { code: "modules.edit", name: "Edit Modules", module: "system_control" },
  { code: "modules.delete", name: "Delete Modules", module: "system_control" },
  { code: "permissions.view", name: "View Permissions", module: "system_control" },
  { code: "permissions.create", name: "Create Permissions", module: "system_control" },
  { code: "permissions.edit", name: "Edit Permissions", module: "system_control" },
  { code: "permissions.delete", name: "Delete Permissions", module: "system_control" },
  { code: "module_permissions.view", name: "View Module Permissions", module: "system_control" },
  { code: "module_permissions.create", name: "Assign Permissions To Modules", module: "system_control" },
  { code: "module_permissions.delete", name: "Remove Permissions From Modules", module: "system_control" },
  { code: "roles.view", name: "View Roles", module: "system_control" },
  { code: "roles.create", name: "Create Roles", module: "system_control" },
  { code: "roles.edit", name: "Edit Roles", module: "system_control" },
  { code: "roles.delete", name: "Delete Roles", module: "system_control" },
  { code: "role_permissions.view", name: "View Role Permissions", module: "system_control" },
  { code: "role_permissions.create", name: "Assign Permissions To Roles", module: "system_control" },
  { code: "role_permissions.delete", name: "Remove Permissions From Roles", module: "system_control" },
  { code: "user_roles.view", name: "View User Roles", module: "system_control" },
  { code: "user_roles.create", name: "Assign Roles To Users", module: "system_control" },
  { code: "user_roles.delete", name: "Remove Roles From Users", module: "system_control" },
  { code: "users.view", name: "View Users", module: "users" },
  { code: "admin.dashboard.view", name: "View Admin Dashboard", module: "reports" },
  { code: "admin.actions.read", name: "Read Admin Actions", module: "audit_logs" }
];

function titleize(value) {
  return value
    .split(/[._]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function generatedPermissions() {
  const permissions = [];
  for (const [moduleCode, actions] of Object.entries(moduleActions)) {
    for (const action of actions) {
      permissions.push({
        code: `${moduleCode}.${action}`,
        name: `${titleize(action)} ${titleize(moduleCode)}`,
        module: moduleCode
      });
    }
  }
  return permissions;
}

async function upsertModule(client, input) {
  const result = await client.query(
    `
      insert into zigo.modules (code, name, description, sort_order, is_active)
      values ($1, $2, $3, $4, true)
      on conflict (code) do update
        set name = excluded.name,
            description = excluded.description,
            sort_order = excluded.sort_order,
            is_active = true,
            updated_at = now()
      returning id
    `,
    [input.code, input.name, input.description, input.sortOrder]
  );
  return result.rows[0].id;
}

async function upsertPermission(client, input) {
  const result = await client.query(
    `
      insert into zigo.permissions (code, name, description, module)
      values ($1, $2, $3, $4)
      on conflict (code) do update
        set name = excluded.name,
            description = excluded.description,
            module = excluded.module
      returning id
    `,
    [input.code, input.name, input.description ?? `${input.name} permission`, input.module]
  );
  return result.rows[0].id;
}

async function upsertRole(client, role) {
  const result = await client.query(
    `
      insert into zigo.roles (code, name, description, is_system)
      values ($1, $2, $3, $4)
      on conflict (code) do update
        set name = excluded.name,
            description = excluded.description,
            is_system = excluded.is_system
      returning id
    `,
    [role.code, role.name, role.description, role.isSystem]
  );
  return result.rows[0].id;
}

async function upsertSuperAdminUser(client) {
  const passwordHash = await bcrypt.hash(superAdmin.password, 12);
  const existing = await client.query("select id from zigo.users where lower(email::text) = lower($1)", [
    superAdmin.email
  ]);

  if (existing.rows[0]) {
    await client.query(
      `
        update zigo.users
        set phone = $2,
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

const client = await pool.connect();

try {
  await client.query("begin");

  const moduleIds = new Map();
  for (const module of modules) {
    moduleIds.set(module.code, await upsertModule(client, module));
  }

  const permissionIds = new Map();
  const allPermissions = [...generatedPermissions(), ...compatibilityPermissions];
  for (const permission of allPermissions) {
    permissionIds.set(permission.code, await upsertPermission(client, permission));
    const moduleId = moduleIds.get(permission.module);
    const permissionId = permissionIds.get(permission.code);
    if (moduleId && permissionId) {
      await client.query(
        `
          insert into zigo.module_permissions (module_id, permission_id)
          values ($1, $2)
          on conflict do nothing
        `,
        [moduleId, permissionId]
      );
    }
  }

  const roleIds = new Map();
  for (const role of roles) {
    roleIds.set(role.code, await upsertRole(client, role));
  }

  const superAdminRoleId = roleIds.get("super_admin");
  const adminRoleId = roleIds.get("admin");
  const superAdminUserId = await upsertSuperAdminUser(client);

  await client.query(
    `
      insert into zigo.user_roles (user_id, role_id)
      select $1, $2
      where not exists (
        select 1 from zigo.user_roles where user_id = $1 and role_id = $2
      )
    `,
    [superAdminUserId, superAdminRoleId]
  );

  for (const moduleId of moduleIds.values()) {
    await client.query(
      `
        insert into zigo.role_modules (role_id, module_id)
        values ($1, $2)
        on conflict do nothing
      `,
      [superAdminRoleId, moduleId]
    );
  }

  for (const permissionId of permissionIds.values()) {
    await client.query(
      `
        insert into zigo.role_permissions (role_id, permission_id)
        values ($1, $2)
        on conflict do nothing
      `,
      [superAdminRoleId, permissionId]
    );
  }

  for (const permissionCode of adminPermissionCodes) {
    const permissionId = permissionIds.get(permissionCode);
    if (!permissionId || !adminRoleId) continue;

    await client.query(
      `
        insert into zigo.role_permissions (role_id, permission_id)
        values ($1, $2)
        on conflict do nothing
      `,
      [adminRoleId, permissionId]
    );
  }

  const adminModuleCodes = new Set(
    adminPermissionCodes
      .map((code) => allPermissions.find((permission) => permission.code === code)?.module)
      .filter(Boolean)
  );

  for (const moduleCode of adminModuleCodes) {
    const moduleId = moduleIds.get(moduleCode);
    if (!moduleId || !adminRoleId) continue;
    await client.query(
      `
        insert into zigo.role_modules (role_id, module_id)
        values ($1, $2)
        on conflict do nothing
      `,
      [adminRoleId, moduleId]
    );
  }

  await client.query("commit");

  console.log("Access master seed completed.");
  console.table([
    {
      modules: moduleIds.size,
      permissions: permissionIds.size,
      roles: roles.length,
      superAdmin: "all permissions",
      adminPermissions: adminPermissionCodes.length,
      email: superAdmin.email,
      password: superAdmin.password
    }
  ]);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
