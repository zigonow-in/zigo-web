import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

try {
  await pool.query(`
    create table if not exists zigo.modules (
      id uuid primary key default gen_random_uuid(),
      code text not null unique,
      name text not null,
      description text,
      is_active boolean not null default true,
      sort_order integer not null default 0,
      created_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      updated_by uuid references zigo.users(id),
      updated_at timestamptz not null default now()
    );

    alter table zigo.modules
      add column if not exists created_by uuid references zigo.users(id),
      add column if not exists updated_by uuid references zigo.users(id),
      add column if not exists deleted_by uuid references zigo.users(id),
      add column if not exists deleted_at timestamptz,
      add column if not exists is_deleted boolean not null default false;

    create table if not exists zigo.module_permissions (
      module_id uuid not null references zigo.modules(id) on delete cascade,
      permission_id uuid not null references zigo.permissions(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (module_id, permission_id)
    );

    create table if not exists zigo.role_modules (
      role_id uuid not null references zigo.roles(id) on delete cascade,
      module_id uuid not null references zigo.modules(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (role_id, module_id)
    );

    create table if not exists zigo.user_permissions (
      user_id uuid not null references zigo.users(id) on delete cascade,
      permission_id uuid not null references zigo.permissions(id) on delete cascade,
      granted_by_user_id uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      primary key (user_id, permission_id)
    );

    create table if not exists zigo.user_modules (
      user_id uuid not null references zigo.users(id) on delete cascade,
      module_id uuid not null references zigo.modules(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (user_id, module_id)
    );
  `);

  await pool.query(`
    insert into zigo.modules (code, name, description, sort_order)
    select distinct
      module,
      initcap(replace(module, '_', ' ')),
      'Auto-created from existing permissions',
      0
    from zigo.permissions
    where module is not null
    on conflict (code) do update
      set name = excluded.name,
          updated_at = now();

    insert into zigo.module_permissions (module_id, permission_id)
    select m.id, p.id
    from zigo.permissions p
    join zigo.modules m on m.code = p.module
    on conflict do nothing;
  `);

  console.log("Access structure migration completed.");
} finally {
  await pool.end();
}
