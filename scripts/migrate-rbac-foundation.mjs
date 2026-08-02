import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(`
    alter table zigo.roles
      add column if not exists is_active boolean not null default true,
      add column if not exists created_by uuid references zigo.users(id),
      add column if not exists updated_by uuid references zigo.users(id),
      add column if not exists updated_at timestamptz not null default now(),
      add column if not exists deleted_by uuid references zigo.users(id),
      add column if not exists deleted_at timestamptz,
      add column if not exists is_deleted boolean not null default false;

    alter table zigo.permissions
      add column if not exists is_active boolean not null default true,
      add column if not exists created_by uuid references zigo.users(id),
      add column if not exists updated_by uuid references zigo.users(id),
      add column if not exists updated_at timestamptz not null default now(),
      add column if not exists deleted_by uuid references zigo.users(id),
      add column if not exists deleted_at timestamptz,
      add column if not exists is_deleted boolean not null default false;

    alter table zigo.user_roles
      add column if not exists is_active boolean not null default true,
      add column if not exists is_primary boolean not null default false,
      add column if not exists created_by uuid references zigo.users(id),
      add column if not exists updated_by uuid references zigo.users(id),
      add column if not exists updated_at timestamptz not null default now(),
      add column if not exists deleted_by uuid references zigo.users(id),
      add column if not exists deleted_at timestamptz,
      add column if not exists is_deleted boolean not null default false;

    alter table zigo.users
      add column if not exists created_by uuid references zigo.users(id),
      add column if not exists updated_by uuid references zigo.users(id),
      add column if not exists deleted_by uuid references zigo.users(id);

    alter table zigo.assistant_documents
      add column if not exists verified_by_user_id uuid references zigo.users(id),
      add column if not exists verified_at timestamptz,
      add column if not exists updated_at timestamptz not null default now();

    create table if not exists zigo.assistant_document_verification_events (
      id uuid primary key default gen_random_uuid(),
      assistant_document_id uuid references zigo.assistant_documents(id) on delete cascade,
      assistant_id uuid not null references zigo.assistants(id) on delete cascade,
      document_type_id uuid references zigo.document_types(id),
      old_status text,
      new_status text not null,
      remarks text,
      actor_user_id uuid references zigo.users(id),
      created_at timestamptz not null default now()
    );

    create index if not exists idx_users_created_at on zigo.users(created_at desc);
    create index if not exists idx_users_account_status on zigo.users((metadata->>'accountStatus'));
    create index if not exists idx_user_roles_user_active on zigo.user_roles(user_id, is_deleted, is_active);
    create index if not exists idx_assistant_doc_events_assistant on zigo.assistant_document_verification_events(assistant_id, created_at desc);
  `);

  await pool.query(`
    create unique index if not exists idx_roles_code_active_unique
      on zigo.roles(lower(code))
      where is_deleted = false;
    create unique index if not exists idx_permissions_code_active_unique
      on zigo.permissions(lower(code))
      where is_deleted = false;
    create unique index if not exists idx_modules_code_active_unique
      on zigo.modules(lower(code))
      where is_deleted = false;
  `);

  console.log("RBAC foundation migration completed.");
} finally {
  await pool.end();
}
