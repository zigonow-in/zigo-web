import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";

type ServiceCategoryInput = {
  pillarIds: string[];
  code: string;
  name: string;
  description?: string | null;
  mediaUrls: Array<{
    url: string;
    type: "image" | "video";
    originalName?: string;
    mimeType?: string;
  }>;
  serviceIds: string[];
  displayOrder: number;
  isActive: boolean;
  userId: string;
};

let schemaReady: Promise<void> | null = null;

export async function ensureServiceCategorySchema() {
  if (!schemaReady) {
    schemaReady = pool.query(`
      create table if not exists zigo.service_category_masters (
        id uuid primary key default gen_random_uuid(),
        pillar_id uuid references zigo.service_pillars(id),
        code text not null unique,
        name text not null,
        description text,
        media_urls jsonb not null default '[]'::jsonb,
        display_order integer not null default 0,
        status zigo.lifecycle_status not null default 'draft',
        is_active boolean not null default true,
        created_by uuid references zigo.users(id),
        created_at timestamptz not null default now(),
        updated_by uuid references zigo.users(id),
        updated_at timestamptz not null default now(),
        deleted_by uuid references zigo.users(id),
        deleted_at timestamptz,
        is_deleted boolean not null default false
      );
      alter table zigo.service_category_masters
        alter column pillar_id drop not null,
        add column if not exists pillar_id uuid references zigo.service_pillars(id),
        add column if not exists code text,
        add column if not exists name text,
        add column if not exists description text,
        add column if not exists media_urls jsonb not null default '[]'::jsonb,
        add column if not exists display_order integer not null default 0,
        add column if not exists status zigo.lifecycle_status not null default 'draft',
        add column if not exists is_active boolean not null default true,
        add column if not exists created_by uuid references zigo.users(id),
        add column if not exists created_at timestamptz not null default now(),
        add column if not exists updated_by uuid references zigo.users(id),
        add column if not exists updated_at timestamptz not null default now(),
        add column if not exists deleted_by uuid references zigo.users(id),
        add column if not exists deleted_at timestamptz,
        add column if not exists is_deleted boolean not null default false;
      create table if not exists zigo.service_category_service_mappings (
        service_category_id uuid not null references zigo.service_category_masters(id) on delete cascade,
        service_id uuid not null references zigo.services(id) on delete cascade,
        display_order integer not null default 0,
        primary key (service_category_id, service_id)
      );
      create table if not exists zigo.service_category_pillar_mappings (
        service_category_id uuid not null references zigo.service_category_masters(id) on delete cascade,
        pillar_id uuid not null references zigo.service_pillars(id) on delete cascade,
        display_order integer not null default 0,
        primary key (service_category_id, pillar_id)
      );
      insert into zigo.service_category_pillar_mappings (service_category_id, pillar_id, display_order)
      select id, pillar_id, 1
      from zigo.service_category_masters
      where pillar_id is not null
      on conflict (service_category_id, pillar_id) do nothing;
      create index if not exists idx_service_category_masters_pillar_order
        on zigo.service_category_masters(pillar_id, is_deleted, display_order, name);
      create index if not exists idx_service_category_service_mappings_service
        on zigo.service_category_service_mappings(service_id, service_category_id);
      create index if not exists idx_service_category_pillar_mappings_pillar
        on zigo.service_category_pillar_mappings(pillar_id, service_category_id);
    `).then(() => undefined).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

const categorySelect = `
  select
    category.id,
    coalesce(array_agg(distinct category_pillar.pillar_id) filter (where category_pillar.pillar_id is not null), '{}'::uuid[]) as "pillarIds",
    coalesce(string_agg(distinct pillar.code, ', ' order by pillar.code) filter (where pillar.code is not null), '') as "pillarCodes",
    coalesce(string_agg(distinct pillar.name, ', ' order by pillar.name) filter (where pillar.name is not null), '') as "pillarNames",
    category.code,
    category.name,
    category.description,
    category.media_urls as "mediaUrls",
    category.display_order as "displayOrder",
    category.status,
    category.is_active as "isActive",
    count(distinct mapping.service_id)::int as "serviceCount",
    coalesce(array_agg(distinct service.id) filter (where service.id is not null), '{}'::uuid[]) as "serviceIds",
    coalesce(string_agg(distinct service.name, ', ' order by service.name) filter (where service.name is not null), '') as "serviceNames"
  from zigo.service_category_masters category
  join zigo.service_category_pillar_mappings category_pillar on category_pillar.service_category_id = category.id
  join zigo.service_pillars pillar on pillar.id = category_pillar.pillar_id
  left join zigo.service_category_service_mappings mapping on mapping.service_category_id = category.id
  left join zigo.services service on service.id = mapping.service_id
    and service.is_deleted = false
  where category.is_deleted = false
`;

export async function listServiceCategories() {
  await ensureServiceCategorySchema();
  const result = await pool.query(`${categorySelect}
    group by category.id
    order by min(pillar.display_order), category.display_order, lower(category.name), category.id`);
  return result.rows;
}

async function validateCategoryRelations(client: { query: typeof pool.query }, pillarIds: string[], serviceIds: string[]) {
  const pillarResult = await client.query(`
    select count(*)::int as count
    from zigo.service_pillars
    where id = any($1::uuid[])
      and status <> 'retired'::zigo.lifecycle_status
  `, [pillarIds]);
  if (Number(pillarResult.rows[0]?.count || 0) !== pillarIds.length) {
    throw new HttpError(400, "One or more selected Pillars are not available.");
  }

  if (!serviceIds.length) return;
  const serviceResult = await client.query(`
    select count(distinct service.id)::int as count
    from zigo.services service
    join zigo.service_pillar_mappings pillar_mapping on pillar_mapping.service_id = service.id
    where service.id = any($1::uuid[])
      and pillar_mapping.pillar_id = any($2::uuid[])
      and service.is_deleted = false
      and service.metadata ->> 'catalogSource' = 'zigo_personal_assistant_v2'
      and service.status <> 'retired'::zigo.lifecycle_status
  `, [serviceIds, pillarIds]);
  if (Number(serviceResult.rows[0]?.count || 0) !== serviceIds.length) {
    throw new HttpError(400, "Every selected service must belong to the selected Pillar and be available.");
  }
}

async function saveServiceCategory(id: string | null, input: ServiceCategoryInput) {
  await ensureServiceCategorySchema();
  const pillarIds = [...new Set(input.pillarIds)];
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  const description = input.description?.trim() || null;
  const serviceIds = [...new Set(input.serviceIds)];
  const mediaUrls = input.mediaUrls
    .filter((media) => media?.url)
    .map((media) => ({
      url: media.url.trim(),
      type: media.type === "video" ? "video" : "image",
      originalName: media.originalName?.trim() || undefined,
      mimeType: media.mimeType?.trim() || undefined
    }));
  if (!pillarIds.length) throw new HttpError(400, "Select at least one Pillar.");
  if (!serviceIds.length) throw new HttpError(400, "Map at least one Service Master record to the category.");
  const client = await pool.connect();
  try {
    await client.query("begin");
    await validateCategoryRelations(client, pillarIds, serviceIds);

    const values = [code, name, description, JSON.stringify(mediaUrls), pillarIds[0], input.displayOrder, input.isActive, input.userId];
    const result = id
      ? await client.query(`
      update zigo.service_category_masters
          set code = $1,
              name = $2,
              description = $3,
              media_urls = $4::jsonb,
              pillar_id = $5,
              display_order = $6,
              is_active = $7,
              status = case when $7 then 'active'::zigo.lifecycle_status else 'inactive'::zigo.lifecycle_status end,
              updated_by = $8,
              updated_at = now()
          where id = $9
            and is_deleted = false
          returning id
        `, [...values, id])
      : await client.query(`
          insert into zigo.service_category_masters (
            code, name, description, media_urls, pillar_id, display_order, is_active, status, created_by, updated_by
          )
          values ($1, $2, $3, $4::jsonb, $5, $6, $7, case when $7 then 'active'::zigo.lifecycle_status else 'inactive'::zigo.lifecycle_status end, $8, $8)
          returning id
        `, values);

    if (!result.rows[0]) {
      await client.query("rollback");
      return null;
    }

    const categoryId = result.rows[0].id as string;
    await client.query("delete from zigo.service_category_pillar_mappings where service_category_id = $1", [categoryId]);
    await client.query(`
      insert into zigo.service_category_pillar_mappings (service_category_id, pillar_id, display_order)
      select $1, pillar_id, ordinality::int
      from unnest($2::uuid[]) with ordinality as mapped(pillar_id, ordinality)
    `, [categoryId, pillarIds]);
    await client.query("delete from zigo.service_category_service_mappings where service_category_id = $1", [categoryId]);
    if (serviceIds.length) {
      await client.query(`
        insert into zigo.service_category_service_mappings (service_category_id, service_id, display_order)
        select $1, service_id, ordinality::int
        from unnest($2::uuid[]) with ordinality as mapped(service_id, ordinality)
      `, [categoryId, serviceIds]);
    }
    await client.query("commit");

    const saved = await pool.query(`${categorySelect}
      and category.id = $1
      group by category.id`, [categoryId]);
    return saved.rows[0] ?? null;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if ((error as { code?: string }).code === "23505") {
      throw new HttpError(409, "A Service Category with this code already exists.");
    }
    throw error;
  } finally {
    client.release();
  }
}

export const createServiceCategory = (input: ServiceCategoryInput) => saveServiceCategory(null, input);

export const updateServiceCategory = (id: string, input: ServiceCategoryInput) => saveServiceCategory(id, input);

export async function deleteServiceCategory(id: string, userId: string) {
  await ensureServiceCategorySchema();
  const result = await pool.query(`
    update zigo.service_category_masters
    set is_deleted = true,
        status = 'retired'::zigo.lifecycle_status,
        deleted_by = $2,
        deleted_at = now(),
        updated_by = $2,
        updated_at = now()
    where id = $1
      and is_deleted = false
    returning id
  `, [id, userId]);
  return result.rows[0] ?? null;
}
