import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

const roles = ["super_admin", "admin", "staff", "assistant", "customer"];
const actions = ["allowed", "add", "update", "delete", "view"];

const features = [
  { code: "admin_panel_login", name: "Admin Panel Login", module: "admin" },
  { code: "master_role", name: "Master - Role", module: "system_control" },
  { code: "master_module", name: "Master - Module", module: "system_control" },
  { code: "master_permission", name: "Master - Permission", module: "system_control" },
  { code: "master_user", name: "Master - User", module: "users" },
  { code: "master_user_role", name: "Master - UserRole", module: "users" },
  { code: "master_module_permission", name: "Master - ModulePermission", module: "system_control" },
  { code: "verify_assistant", name: "Verify Assistant", module: "verification" },
  { code: "country", name: "Country", module: "locations" },
  { code: "state", name: "State", module: "locations" },
  { code: "city", name: "City", module: "locations" },
  { code: "zone", name: "Zone", module: "locations" },
  { code: "cluster", name: "Cluster", module: "locations" },
  { code: "service_master", name: "Service Master", module: "services" },
  { code: "category_master", name: "Category Master", module: "services" },
  { code: "delivery_type_master", name: "Delivery Type Master", module: "services" },
  { code: "map_service_cluster", name: "MapServiceCluster", module: "services" },
  { code: "map_category_cluster", name: "MapCategoryCluster", module: "services" },
  { code: "verify_assistant_vehicle", name: "Verify Assistant Vehicle", module: "verification" },
  { code: "book_order", name: "Book Order", module: "orders" },
  { code: "approve_order", name: "Approve Order", module: "orders" },
  { code: "reject_order", name: "Reject Order", module: "orders" },
  { code: "assign_order", name: "Assign Order", module: "orders" },
  { code: "cancel_order", name: "Cancel Order", module: "orders" },
  { code: "issue_resolve", name: "Issue Resolve", module: "tasks" },
  { code: "category_store_map", name: "CategoryStoreMap", module: "stores" }
];

const T = true;
const F = false;

// Values are [Allowed, Add, Update, Delete, View].
const matrix = {
  super_admin: Object.fromEntries(features.map((feature) => [feature.code, [T, T, T, T, T]])),
  admin: {
    admin_panel_login: [T, F, F, F, F],
    master_role: [F, F, F, F, T],
    master_module: [F, F, F, F, T],
    master_permission: [F, F, F, F, T],
    master_user: [T, T, T, F, T],
    master_user_role: [F, F, F, F, T],
    master_module_permission: [F, F, F, F, T],
    verify_assistant: [T, T, T, F, T],
    country: [T, F, F, F, T],
    state: [T, T, T, F, T],
    city: [T, T, T, F, T],
    zone: [T, T, T, F, T],
    cluster: [T, T, T, F, T],
    service_master: [T, T, T, F, T],
    category_master: [T, T, T, F, T],
    delivery_type_master: [T, T, T, F, T],
    map_service_cluster: [T, T, T, F, T],
    map_category_cluster: [T, T, T, F, T],
    verify_assistant_vehicle: [T, T, T, F, T],
    book_order: [T, T, T, F, T],
    approve_order: [T, F, T, F, T],
    reject_order: [T, F, T, F, T],
    assign_order: [T, F, T, F, T],
    cancel_order: [T, T, T, F, F],
    issue_resolve: [T, T, T, F, T],
    category_store_map: [T, T, T, F, T]
  },
  staff: {
    admin_panel_login: [T, F, F, F, F],
    master_role: [F, F, F, F, T],
    master_module: [F, F, F, F, T],
    master_permission: [F, F, F, F, T],
    master_user: [T, T, F, F, T],
    master_user_role: [F, F, F, F, T],
    master_module_permission: [F, F, F, F, T],
    verify_assistant: [F, T, T, F, T],
    country: [F, F, F, F, T],
    state: [F, F, F, F, T],
    city: [F, F, F, F, T],
    zone: [F, F, F, F, T],
    cluster: [F, F, F, F, T],
    service_master: [F, F, F, F, T],
    category_master: [F, F, F, F, T],
    delivery_type_master: [F, F, F, F, T],
    map_service_cluster: [F, F, F, F, T],
    map_category_cluster: [F, F, F, F, F],
    verify_assistant_vehicle: [F, F, F, F, T],
    book_order: [F, F, F, F, T],
    approve_order: [F, F, F, F, T],
    reject_order: [F, F, F, F, F],
    assign_order: [F, F, T, F, T],
    cancel_order: [F, F, F, F, F],
    issue_resolve: [F, F, F, F, T],
    category_store_map: [T, T, T, F, T]
  },
  assistant: {
    category_store_map: [T, T, F, F, T]
  },
  customer: {
    category_store_map: [T, T, F, F, T],
    book_order: [F, T, F, F, T],
    cancel_order: [F, F, T, F, T]
  }
};

function roleValue(role, featureCode) {
  return matrix[role]?.[featureCode] ?? [F, F, F, F, F];
}

async function ensureModule(client, feature) {
  const result = await client.query(
    `
      insert into zigo.modules (code, name, description, is_active)
      values ($1, $2, $3, true)
      on conflict (code) do update
        set name = excluded.name,
            description = excluded.description,
            is_active = true,
            updated_at = now()
      returning id
    `,
    [feature.module, feature.module.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()), `Feature group for ${feature.module}`]
  );
  return result.rows[0].id;
}

async function ensurePermission(client, feature, action) {
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
    [
      `${feature.code}.${action}`,
      `${feature.name} - ${action}`,
      `${action} permission for ${feature.name}`,
      feature.module
    ]
  );
  return result.rows[0].id;
}

const client = await pool.connect();

try {
  await client.query("begin");

  const roleIds = new Map();
  for (const roleCode of roles) {
    const role = await client.query("select id from zigo.roles where code = $1", [roleCode]);
    if (role.rows[0]) roleIds.set(roleCode, role.rows[0].id);
  }

  for (const feature of features) {
    const moduleId = await ensureModule(client, feature);

    for (const action of actions) {
      const permissionId = await ensurePermission(client, feature, action);
      await client.query(
        `
          insert into zigo.module_permissions (module_id, permission_id)
          values ($1, $2)
          on conflict do nothing
        `,
        [moduleId, permissionId]
      );

      for (const roleCode of roles) {
        const values = roleValue(roleCode, feature.code);
        const shouldAssign = values[actions.indexOf(action)];
        const roleId = roleIds.get(roleCode);
        if (!shouldAssign || !roleId) continue;

        await client.query(
          `
            insert into zigo.role_permissions (role_id, permission_id)
            values ($1, $2)
            on conflict do nothing
          `,
          [roleId, permissionId]
        );

        await client.query(
          `
            insert into zigo.role_modules (role_id, module_id)
            values ($1, $2)
            on conflict do nothing
          `,
          [roleId, moduleId]
        );
      }
    }
  }

  await client.query("commit");
  console.log("Feature permission matrix seed completed.");
  console.table([{ features: features.length, roles: roles.length, actions: actions.length }]);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
