import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(`
    create extension if not exists pgcrypto;
    create schema if not exists zigo;

    create table if not exists zigo.app_settings (
      id uuid primary key default gen_random_uuid(),
      "key" text not null unique,
      value text not null,
      description text,
      is_active boolean not null default true,
      created_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      updated_by uuid references zigo.users(id),
      updated_at timestamptz not null default now(),
      deleted_by uuid references zigo.users(id),
      deleted_at timestamptz,
      is_deleted boolean not null default false
    );

    alter table zigo.app_settings
      add column if not exists value text,
      add column if not exists description text,
      add column if not exists is_active boolean not null default true,
      add column if not exists created_by uuid references zigo.users(id),
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_by uuid references zigo.users(id),
      add column if not exists updated_at timestamptz not null default now(),
      add column if not exists deleted_by uuid references zigo.users(id),
      add column if not exists deleted_at timestamptz,
      add column if not exists is_deleted boolean not null default false;

    create index if not exists idx_app_settings_active_key on zigo.app_settings("key", is_active, is_deleted);

    insert into zigo.app_settings ("key", value, description, is_active)
    values
      ('media.image_save_path', '/uploads/images', 'Base save path for image metadata', true),
      ('media.document_save_path', '/uploads/documents', 'Base save path for document metadata', true)
    on conflict ("key") do update
      set description = excluded.description,
          is_active = true,
          is_deleted = false,
          deleted_by = null,
          deleted_at = null,
          updated_at = now();
  `);

  console.log("Settings migration completed.");
} finally {
  await pool.end();
}
