import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

try {
  await pool.query(`
    create table if not exists zigo.document_types (
      id uuid primary key default gen_random_uuid(),
      code text not null unique,
      name text not null,
      entity_type text not null,
      description text,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists zigo.role_verification_requirements (
      role_id uuid not null references zigo.roles(id) on delete cascade,
      document_type_id uuid not null references zigo.document_types(id) on delete cascade,
      is_required boolean not null default true,
      created_at timestamptz not null default now(),
      primary key (role_id, document_type_id)
    );

    create table if not exists zigo.assistant_vehicles (
      id uuid primary key default gen_random_uuid(),
      assistant_id uuid not null references zigo.assistants(id) on delete cascade,
      vehicle_type text not null,
      registration_number text not null,
      make text,
      model text,
      color text,
      verification_status text not null default 'pending',
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (assistant_id, registration_number)
    );

    create table if not exists zigo.assistant_vehicle_documents (
      id uuid primary key default gen_random_uuid(),
      vehicle_id uuid not null references zigo.assistant_vehicles(id) on delete cascade,
      document_type_id uuid not null references zigo.document_types(id),
      file_id uuid references zigo.files(id),
      verification_status text not null default 'pending',
      verified_by_user_id uuid references zigo.users(id),
      verified_at timestamptz,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      unique (vehicle_id, document_type_id)
    );
  `);

  console.log("Verification structure migration completed.");
} finally {
  await pool.end();
}
