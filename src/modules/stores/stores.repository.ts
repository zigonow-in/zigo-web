import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";
import { isPointInPolygon, parseWktPolygon } from "../../utils/geofence.js";

type Queryable = Pick<typeof pool, "query">;

type WeeklySchedule = Record<string, { enabled?: boolean; openTime?: string | null; closeTime?: string | null }>;

let storeCategoryParentSchemaReady: Promise<void> | null = null;
let storeKeywordSchemaReady: Promise<void> | null = null;

type StoreInput = {
  code?: string | null;
  name: string;
  description?: string | null;
  address?: string | null;
  contact?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  priority?: number;
  operatingHours?: WeeklySchedule;
  serviceCategoryIds?: string[];
  storeCategoryIds?: string[];
  storeKeywordIds?: string[];
  clusterIds?: string[];
  imageUrls?: string[];
  isActive?: boolean;
  userId: string;
};

function ensureStoreCategoryParentSchema() {
  if (!storeCategoryParentSchemaReady) {
    storeCategoryParentSchemaReady = pool
      .query(`
        alter table zigo.store_categories
          add column if not exists service_id uuid references zigo.services(id),
          add column if not exists service_category_id uuid references zigo.categories(id);

        create index if not exists idx_store_categories_parent_active
          on zigo.store_categories(service_id, service_category_id, is_deleted, is_active);
      `)
      .then(() => undefined)
      .catch((error) => {
        storeCategoryParentSchemaReady = null;
        throw error;
      });
  }
  return storeCategoryParentSchemaReady;
}

function ensureStoreKeywordSchema() {
  if (!storeKeywordSchemaReady) {
    storeKeywordSchemaReady = ensureStoreCategoryParentSchema()
      .then(() =>
        pool.query(`
          create table if not exists zigo.store_keywords (
            id uuid primary key default gen_random_uuid(),
            service_id uuid not null references zigo.services(id),
            service_category_id uuid not null references zigo.categories(id),
            code text not null unique,
            name text not null,
            description text,
            priority integer not null default 0,
            is_active boolean not null default true,
            metadata jsonb not null default '{}'::jsonb,
            created_by uuid references zigo.users(id),
            created_at timestamptz not null default now(),
            updated_by uuid references zigo.users(id),
            updated_at timestamptz not null default now(),
            deleted_by uuid references zigo.users(id),
            deleted_at timestamptz,
            is_deleted boolean not null default false
          );

          create table if not exists zigo.store_keyword_map (
            id uuid primary key default gen_random_uuid(),
            store_keyword_id uuid not null references zigo.store_keywords(id) on delete cascade,
            store_id uuid not null references zigo.stores(id) on delete cascade,
            is_active boolean not null default true,
            created_by uuid references zigo.users(id),
            created_at timestamptz not null default now(),
            deleted_by uuid references zigo.users(id),
            deleted_at timestamptz,
            is_deleted boolean not null default false,
            unique(store_keyword_id, store_id)
          );

          create index if not exists idx_store_keywords_parent_active
            on zigo.store_keywords(service_id, service_category_id, is_deleted, is_active, priority, name);
          create index if not exists idx_store_keyword_map_store
            on zigo.store_keyword_map(store_id, is_deleted, is_active);
        `)
      )
      .then(() => undefined)
      .catch((error) => {
        storeKeywordSchemaReady = null;
        throw error;
      });
  }
  return storeKeywordSchemaReady;
}

export async function listStores() {
  await ensureStoreKeywordSchema();
  const result = await pool.query(`
    select
      s.id,
      s.code,
      s.name,
      s.description,
      s.address,
      s.contact,
      s.website,
      s.latitude,
      s.longitude,
      s.priority,
      s.operating_hours as "operatingHours",
      s.is_active as "isActive",
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', si.id,
          'fileId', si.file_id,
          'imageUrl', si.image_url,
          'isPrimary', si.is_primary,
          'priority', si.priority
        ) order by si.is_primary desc, si.priority, si.created_at)
        from zigo.store_images si
        where si.store_id = s.id and coalesce(si.is_deleted, false) = false and si.is_active = true
      ), '[]'::jsonb) as images,
      (
        select si.image_url
        from zigo.store_images si
        where si.store_id = s.id and coalesce(si.is_deleted, false) = false and si.is_active = true
        order by si.is_primary desc, si.priority, si.created_at
        limit 1
      ) as "primaryImageUrl",
      coalesce((
        select array_agg(m.category_id)
        from zigo.category_store_map m
        where m.store_id = s.id and coalesce(m.is_deleted, false) = false and m.is_active = true
      ), '{}'::uuid[]) as "serviceCategoryIds",
      coalesce((
        select array_agg(m.store_category_id)
        from zigo.store_category_map m
        where m.store_id = s.id and coalesce(m.is_deleted, false) = false and m.is_active = true
      ), '{}'::uuid[]) as "storeCategoryIds",
      coalesce((
        select array_agg(m.store_keyword_id)
        from zigo.store_keyword_map m
        where m.store_id = s.id and coalesce(m.is_deleted, false) = false and m.is_active = true
      ), '{}'::uuid[]) as "storeKeywordIds",
      coalesce((
        select array_agg(m.cluster_id)
        from zigo.cluster_store_map m
        where m.store_id = s.id and coalesce(m.is_deleted, false) = false and m.is_active = true
      ), '{}'::uuid[]) as "clusterIds",
      s.created_at as "createdAt",
      s.updated_at as "updatedAt"
    from zigo.stores s
    where coalesce(s.is_deleted, false) = false
    order by s.priority, s.name
  `);
  return result.rows;
}

export async function createStore(input: StoreInput) {
  await ensureStoreKeywordSchema();
  assertLikelyIndiaCoordinateOrder(input.latitude, input.longitude);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const code = await generateUniqueCode(client, "zigo.stores", input.code, input.name);
    const result = await client.query(
      `
        insert into zigo.stores
          (code, name, description, address, contact, website, latitude, longitude, priority, operating_hours, is_active, created_by, updated_by)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $12)
        returning id
      `,
      [
        code,
        input.name,
        input.description ?? null,
        input.address ?? null,
        input.contact ?? null,
        input.website ?? null,
        input.latitude ?? null,
        input.longitude ?? null,
        input.priority ?? 0,
        JSON.stringify(input.operatingHours ?? {}),
        input.isActive ?? true,
        input.userId
      ]
    );
    const storeId = result.rows[0].id;
    await syncStoreMappings(client, storeId, input);
    await syncStoreImages(client, storeId, input.imageUrls ?? [], input.userId);
    await client.query("commit");
    return { id: storeId };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateStore(id: string, input: StoreInput) {
  await ensureStoreKeywordSchema();
  assertLikelyIndiaCoordinateOrder(input.latitude, input.longitude);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const code = await generateUniqueCode(client, "zigo.stores", input.code, input.name, id);
    const result = await client.query(
      `
        update zigo.stores
        set code = $2,
            name = $3,
            description = $4,
            address = $5,
            contact = $6,
            website = $7,
            latitude = $8,
            longitude = $9,
            priority = $10,
            operating_hours = $11::jsonb,
            is_active = $12,
            updated_by = $13,
            updated_at = now()
        where id = $1 and coalesce(is_deleted, false) = false
        returning id
      `,
      [
        id,
        code,
        input.name,
        input.description ?? null,
        input.address ?? null,
        input.contact ?? null,
        input.website ?? null,
        input.latitude ?? null,
        input.longitude ?? null,
        input.priority ?? 0,
        JSON.stringify(input.operatingHours ?? {}),
        input.isActive ?? true,
        input.userId
      ]
    );
    if (!result.rows[0]) {
      await client.query("rollback");
      return null;
    }
    await syncStoreMappings(client, id, input);
    await syncStoreImages(client, id, input.imageUrls ?? [], input.userId);
    await client.query("commit");
    return { id };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteStore(id: string, userId: string) {
  const result = await pool.query(
    `
      update zigo.stores
      set is_deleted = true, is_active = false, deleted_by = $2, deleted_at = now(), updated_by = $2, updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
      returning id
    `,
    [id, userId]
  );
  return result.rows[0] ?? null;
}

export async function listStoreCategories() {
  await ensureStoreCategoryParentSchema();
  const result = await pool.query(`
    select
      sc.id,
      sc.code,
      sc.name,
      sc.service_id as "serviceId",
      s.name as "serviceName",
      sc.service_category_id as "serviceCategoryId",
      c.name as "serviceCategoryName",
      sc.image_url as "imageUrl",
      sc.description,
      sc.priority,
      sc.is_active as "isActive",
      (
        sc.is_active = true
        and coalesce(sc.is_deleted, false) = false
        and coalesce(s.is_active, true) = true
        and coalesce(s.is_enabled, true) = true
        and coalesce(s.is_deleted, false) = false
        and coalesce(c.is_active, true) = true
        and coalesce(c.is_enabled, true) = true
        and coalesce(c.is_deleted, false) = false
      ) as "isUsable",
      sc.created_at as "createdAt",
      sc.updated_at as "updatedAt"
    from zigo.store_categories sc
    left join zigo.services s on s.id = sc.service_id
    left join zigo.categories c on c.id = sc.service_category_id
    where coalesce(sc.is_deleted, false) = false
    order by sc.priority, sc.name
  `);
  return result.rows;
}

export async function createStoreCategory(input: {
  code: string;
  name: string;
  serviceId: string;
  serviceCategoryId: string;
  imageUrl?: string | null;
  description?: string | null;
  priority?: number;
  isActive?: boolean;
  userId: string;
}) {
  await ensureStoreCategoryParentSchema();
  await assertUsableServiceCategoryParent(input.serviceId, input.serviceCategoryId);
  const result = await pool.query(
    `
      insert into zigo.store_categories (code, name, service_id, service_category_id, image_url, description, priority, is_active, created_by, updated_by)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
      returning id
    `,
    [
      input.code,
      input.name,
      input.serviceId,
      input.serviceCategoryId,
      input.imageUrl ?? null,
      input.description ?? null,
      input.priority ?? 0,
      input.isActive ?? true,
      input.userId
    ]
  );
  return result.rows[0];
}

export async function updateStoreCategory(
  id: string,
  input: {
    code: string;
    name: string;
    serviceId: string;
    serviceCategoryId: string;
    imageUrl?: string | null;
    description?: string | null;
    priority?: number;
    isActive?: boolean;
    userId: string;
  }
) {
  await ensureStoreCategoryParentSchema();
  await assertUsableServiceCategoryParent(input.serviceId, input.serviceCategoryId);
  const result = await pool.query(
    `
      update zigo.store_categories
      set code = $2,
          name = $3,
          service_id = $4,
          service_category_id = $5,
          image_url = $6,
          description = $7,
          priority = $8,
          is_active = $9,
          updated_by = $10,
          updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
      returning id
    `,
    [
      id,
      input.code,
      input.name,
      input.serviceId,
      input.serviceCategoryId,
      input.imageUrl ?? null,
      input.description ?? null,
      input.priority ?? 0,
      input.isActive ?? true,
      input.userId
    ]
  );
  return result.rows[0] ?? null;
}

export async function deleteStoreCategory(id: string, userId: string) {
  return softDeleteWithAudit("zigo.store_categories", id, userId);
}

export async function listStoreKeywords() {
  await ensureStoreKeywordSchema();
  const result = await pool.query(`
    select
      sk.id,
      sk.code,
      sk.name,
      sk.service_id as "serviceId",
      s.name as "serviceName",
      sk.service_category_id as "serviceCategoryId",
      c.name as "serviceCategoryName",
      sk.description,
      sk.priority,
      sk.is_active as "isActive",
      (
        sk.is_active = true
        and coalesce(sk.is_deleted, false) = false
        and coalesce(s.is_active, true) = true
        and coalesce(s.is_enabled, true) = true
        and coalesce(s.is_deleted, false) = false
        and coalesce(c.is_active, true) = true
        and coalesce(c.is_enabled, true) = true
        and coalesce(c.is_deleted, false) = false
      ) as "isUsable",
      sk.created_at as "createdAt",
      sk.updated_at as "updatedAt"
    from zigo.store_keywords sk
    join zigo.services s on s.id = sk.service_id
    join zigo.categories c on c.id = sk.service_category_id
    where coalesce(sk.is_deleted, false) = false
    order by sk.priority, sk.name
  `);
  return result.rows;
}

export async function createStoreKeyword(input: {
  code?: string | null;
  name: string;
  serviceId: string;
  serviceCategoryId: string;
  description?: string | null;
  priority?: number;
  isActive?: boolean;
  userId: string;
}) {
  await ensureStoreKeywordSchema();
  await assertUsableServiceCategoryParent(input.serviceId, input.serviceCategoryId);
  const code = await generateUniqueCode(pool, "zigo.store_keywords", input.code, input.name);
  const result = await pool.query(
    `
      insert into zigo.store_keywords
        (code, name, service_id, service_category_id, description, priority, is_active, created_by, updated_by)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      returning id
    `,
    [code, input.name, input.serviceId, input.serviceCategoryId, input.description ?? null, input.priority ?? 0, input.isActive ?? true, input.userId]
  );
  return result.rows[0];
}

export async function updateStoreKeyword(
  id: string,
  input: {
    code?: string | null;
    name: string;
    serviceId: string;
    serviceCategoryId: string;
    description?: string | null;
    priority?: number;
    isActive?: boolean;
    userId: string;
  }
) {
  await ensureStoreKeywordSchema();
  await assertUsableServiceCategoryParent(input.serviceId, input.serviceCategoryId);
  const code = await generateUniqueCode(pool, "zigo.store_keywords", input.code, input.name, id);
  const result = await pool.query(
    `
      update zigo.store_keywords
      set code = $2,
          name = $3,
          service_id = $4,
          service_category_id = $5,
          description = $6,
          priority = $7,
          is_active = $8,
          updated_by = $9,
          updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
      returning id
    `,
    [id, code, input.name, input.serviceId, input.serviceCategoryId, input.description ?? null, input.priority ?? 0, input.isActive ?? true, input.userId]
  );
  return result.rows[0] ?? null;
}

export async function deleteStoreKeyword(id: string, userId: string) {
  return softDeleteWithAudit("zigo.store_keywords", id, userId);
}

export async function addStoreImage(input: {
  storeId: string;
  fileId?: string | null;
  imageUrl: string;
  isPrimary?: boolean;
  priority?: number;
  userId: string;
}) {
  await assertActiveRecord("zigo.stores", input.storeId, "Store");
  const primary = input.isPrimary ?? !(await storeHasActiveImages(input.storeId));
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (primary) await client.query("update zigo.store_images set is_primary = false where store_id = $1", [input.storeId]);
    const result = await client.query(
      `
        insert into zigo.store_images (store_id, file_id, image_url, is_primary, priority, created_by, updated_by)
        values ($1, $2, $3, $4, $5, $6, $6)
        returning id
      `,
      [input.storeId, input.fileId ?? null, input.imageUrl, primary, input.priority ?? 0, input.userId]
    );
    await client.query("commit");
    return result.rows[0];
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteStoreImage(storeId: string, imageId: string, userId: string) {
  const result = await pool.query(
    `
      update zigo.store_images
      set is_deleted = true,
          is_active = false,
          deleted_by = $3,
          deleted_at = now(),
          updated_by = $3,
          updated_at = now()
      where id = $2 and store_id = $1 and coalesce(is_deleted, false) = false
      returning id
    `,
    [storeId, imageId, userId]
  );
  return result.rows[0] ?? null;
}

export async function setStoreImagePrimary(storeId: string, imageId: string, userId: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const existing = await client.query(
      "select id from zigo.store_images where id = $1 and store_id = $2 and coalesce(is_deleted, false) = false",
      [imageId, storeId]
    );
    if (!existing.rows[0]) {
      await client.query("rollback");
      return null;
    }
    await client.query("update zigo.store_images set is_primary = false, updated_by = $2, updated_at = now() where store_id = $1", [
      storeId,
      userId
    ]);
    const result = await client.query(
      "update zigo.store_images set is_primary = true, is_active = true, updated_by = $3, updated_at = now() where id = $2 and store_id = $1 returning id",
      [storeId, imageId, userId]
    );
    await client.query("commit");
    return result.rows[0] ?? null;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listCategoryStores() {
  const result = await pool.query(`
    select m.id, m.category_id as "categoryId", c.name as "categoryName", m.store_id as "storeId", s.name as "storeName", m.is_active as "isActive", m.created_at as "createdAt"
    from zigo.category_store_map m
    join zigo.categories c on c.id = m.category_id
    join zigo.stores s on s.id = m.store_id
    where coalesce(m.is_deleted, false) = false
    order by c.name, s.name
  `);
  return result.rows;
}

export async function createCategoryStore(input: { categoryId: string; storeId: string; userId: string }) {
  await assertUsableCategory(input.categoryId);
  await assertActiveRecord("zigo.stores", input.storeId, "Store");
  const result = await upsertMap("zigo.category_store_map", "category_id", input.categoryId, input.storeId, input.userId);
  return result;
}

export async function deleteCategoryStore(id: string, userId: string) {
  return softDeleteMap("zigo.category_store_map", id, userId);
}

export async function listStoreCategoryMaps() {
  const result = await pool.query(`
    select m.id, m.store_category_id as "storeCategoryId", c.name as "storeCategoryName", m.store_id as "storeId", s.name as "storeName", m.is_active as "isActive", m.created_at as "createdAt"
    from zigo.store_category_map m
    join zigo.store_categories c on c.id = m.store_category_id
    join zigo.stores s on s.id = m.store_id
    where coalesce(m.is_deleted, false) = false
    order by c.name, s.name
  `);
  return result.rows;
}

export async function createStoreCategoryMap(input: { storeCategoryId: string; storeId: string; userId: string }) {
  await assertUsableStoreCategory(input.storeCategoryId);
  await assertActiveRecord("zigo.stores", input.storeId, "Store");
  return upsertMap("zigo.store_category_map", "store_category_id", input.storeCategoryId, input.storeId, input.userId);
}

export async function deleteStoreCategoryMap(id: string, userId: string) {
  return softDeleteMap("zigo.store_category_map", id, userId);
}

export async function listClusterStores() {
  const result = await pool.query(`
    select m.id, m.cluster_id as "clusterId", c.name as "clusterName", m.store_id as "storeId", s.name as "storeName", m.is_active as "isActive", m.created_at as "createdAt"
    from zigo.cluster_store_map m
    join zigo.clusters c on c.id = m.cluster_id
    join zigo.stores s on s.id = m.store_id
    where coalesce(m.is_deleted, false) = false
    order by c.name, s.name
  `);
  return result.rows;
}

export async function createClusterStore(input: { clusterId: string; storeId: string; userId: string }) {
  await assertUsableCluster(input.clusterId);
  await assertStoreInsideCluster(input.storeId, input.clusterId);
  await assertActiveRecord("zigo.stores", input.storeId, "Store");
  return upsertMap("zigo.cluster_store_map", "cluster_id", input.clusterId, input.storeId, input.userId);
}

export async function deleteClusterStore(id: string, userId: string) {
  return softDeleteMap("zigo.cluster_store_map", id, userId);
}

async function syncStoreMappings(client: Queryable, storeId: string, input: StoreInput) {
  await syncServiceCategoryMaps(client, storeId, input.serviceCategoryIds ?? [], input.userId);
  await syncStoreCategoryMaps(client, storeId, input.storeCategoryIds ?? [], input.userId);
  await syncStoreKeywordMaps(client, storeId, input.storeKeywordIds ?? [], input.userId);
  await syncClusterMaps(client, storeId, input.clusterIds ?? [], input.userId);
}

async function syncServiceCategoryMaps(client: Queryable, storeId: string, ids: string[], userId: string) {
  await client.query("update zigo.category_store_map set is_deleted = true, is_active = false, deleted_by = $2, deleted_at = now() where store_id = $1", [storeId, userId]);
  for (const id of uniqueIds(ids)) {
    await assertUsableCategory(id);
    await upsertMap("zigo.category_store_map", "category_id", id, storeId, userId, client);
  }
}

async function syncStoreCategoryMaps(client: Queryable, storeId: string, ids: string[], userId: string) {
  await client.query("update zigo.store_category_map set is_deleted = true, is_active = false, deleted_by = $2, deleted_at = now() where store_id = $1", [storeId, userId]);
  for (const id of uniqueIds(ids)) {
    await assertUsableStoreCategory(id);
    await upsertMap("zigo.store_category_map", "store_category_id", id, storeId, userId, client);
  }
}

async function syncStoreKeywordMaps(client: Queryable, storeId: string, ids: string[], userId: string) {
  await client.query("update zigo.store_keyword_map set is_deleted = true, is_active = false, deleted_by = $2, deleted_at = now() where store_id = $1", [storeId, userId]);
  for (const id of uniqueIds(ids)) {
    await assertUsableStoreKeyword(id);
    await upsertMap("zigo.store_keyword_map", "store_keyword_id", id, storeId, userId, client);
  }
}

async function syncClusterMaps(client: Queryable, storeId: string, ids: string[], userId: string) {
  await client.query("update zigo.cluster_store_map set is_deleted = true, is_active = false, deleted_by = $2, deleted_at = now() where store_id = $1", [storeId, userId]);
  for (const id of uniqueIds(ids)) {
    await assertUsableCluster(id);
    await assertStoreInsideCluster(storeId, id, client);
    await upsertMap("zigo.cluster_store_map", "cluster_id", id, storeId, userId, client);
  }
}

async function syncStoreImages(client: Queryable, storeId: string, imageUrls: string[], userId: string) {
  const urls = uniqueIds(imageUrls);
  if (!urls.length) {
    await client.query(
      "update zigo.store_images set is_deleted = true, is_active = false, deleted_by = $2, deleted_at = now(), updated_by = $2, updated_at = now() where store_id = $1 and coalesce(is_deleted, false) = false",
      [storeId, userId]
    );
    return;
  }
  await client.query(
    `
      update zigo.store_images
      set is_deleted = true,
          is_active = false,
          deleted_by = $3,
          deleted_at = now(),
          updated_by = $3,
          updated_at = now()
      where store_id = $1
        and coalesce(is_deleted, false) = false
        and not (image_url = any($2::text[]))
    `,
    [storeId, urls, userId]
  );
  const existing = await client.query<{ imageUrl: string }>(
    "select image_url as \"imageUrl\" from zigo.store_images where store_id = $1",
    [storeId]
  );
  const existingUrls = new Set(existing.rows.map((row) => row.imageUrl));
  let priority = 0;
  for (const imageUrl of urls) {
    if (existingUrls.has(imageUrl)) {
      await client.query(
        `
          update zigo.store_images
          set is_deleted = false,
              is_active = true,
              deleted_by = null,
              deleted_at = null,
              priority = $3,
              updated_by = $4,
              updated_at = now()
          where store_id = $1 and image_url = $2
        `,
        [storeId, imageUrl, priority++, userId]
      );
    } else {
      await client.query(
        `
          insert into zigo.store_images (store_id, image_url, is_primary, priority, created_by, updated_by)
          values ($1, $2, not exists(select 1 from zigo.store_images where store_id = $1 and coalesce(is_deleted, false) = false), $3, $4, $4)
        `,
        [storeId, imageUrl, priority++, userId]
      );
    }
  }
}

async function storeHasActiveImages(storeId: string) {
  const result = await pool.query(
    "select 1 from zigo.store_images where store_id = $1 and coalesce(is_deleted, false) = false and is_active = true limit 1",
    [storeId]
  );
  return Boolean(result.rows[0]);
}

function uniqueIds(ids: string[]) {
  return [...new Set((ids ?? []).filter(Boolean))];
}

function normalizeCode(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

async function generateUniqueCode(client: Queryable, tableName: "zigo.stores" | "zigo.store_keywords", requestedCode: string | null | undefined, name: string, excludeId?: string) {
  const base = normalizeCode(requestedCode || name) || "CODE";
  let candidate = base;
  for (let suffix = 2; suffix < 1000; suffix++) {
    const result = await client.query(
      `
        select id
        from ${tableName}
        where lower(code) = lower($1)
          and coalesce(is_deleted, false) = false
          and ($2::uuid is null or id <> $2::uuid)
        limit 1
      `,
      [candidate, excludeId ?? null]
    );
    if (!result.rows[0]) return candidate;
    candidate = `${base}_${suffix}`;
  }
  throw new HttpError(409, `Could not generate a unique code for "${name}". Please enter a user-defined code.`);
}

function assertLikelyIndiaCoordinateOrder(latitude?: number | null, longitude?: number | null) {
  if (latitude == null || longitude == null) return;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const looksLikeIndiaLongitude = lat >= 68 && lat <= 98;
  const looksLikeIndiaLatitude = lng >= 6 && lng <= 38;
  if (looksLikeIndiaLongitude && looksLikeIndiaLatitude) {
    throw new HttpError(400, "Coordinates look reversed. Enter Longitude first and Latitude second. Example: Longitude 77.1013675, Latitude 28.4291950.");
  }
}

async function upsertMap(tableName: string, columnName: string, mappedId: string, storeId: string, userId: string, client: Queryable = pool) {
  const result = await client.query(
    `
      insert into ${tableName} (${columnName}, store_id, created_by, is_active, is_deleted)
      values ($1, $2, $3, true, false)
      on conflict (${columnName}, store_id) do update
        set is_active = true, is_deleted = false, deleted_by = null, deleted_at = null
      returning id
    `,
    [mappedId, storeId, userId]
  );
  return result.rows[0];
}

async function softDeleteMap(tableName: string, id: string, userId: string) {
  const result = await pool.query(
    `
      update ${tableName}
      set is_deleted = true, is_active = false, deleted_by = $2, deleted_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
      returning id
    `,
    [id, userId]
  );
  return result.rows[0] ?? null;
}

async function softDeleteWithAudit(tableName: string, id: string, userId: string) {
  const result = await pool.query(
    `
      update ${tableName}
      set is_deleted = true,
          is_active = false,
          deleted_by = $2,
          deleted_at = now(),
          updated_by = $2,
          updated_at = now()
      where id = $1 and coalesce(is_deleted, false) = false
      returning id
    `,
    [id, userId]
  );
  return result.rows[0] ?? null;
}

async function assertActiveRecord(tableName: string, id: string, label: string) {
  const result = await pool.query(
    `
      select id
      from ${tableName}
      where id = $1
        and coalesce(is_deleted, false) = false
        and coalesce(is_active, true) = true
    `,
    [id]
  );
  if (!result.rowCount) throw new HttpError(400, `${label} is inactive or deleted. Activate it before using it.`);
}

async function assertUsableStoreCategory(id: string) {
  const result = await pool.query(
    `
      select
        sc.name,
        coalesce(sc.is_active, true) as "isActive",
        coalesce(sc.is_deleted, false) as "isDeleted",
        s.name as "serviceName",
        coalesce(s.is_active, true) as "serviceActive",
        coalesce(s.is_enabled, true) as "serviceEnabled",
        coalesce(s.is_deleted, false) as "serviceDeleted",
        c.name as "categoryName",
        coalesce(c.is_active, true) as "categoryActive",
        coalesce(c.is_enabled, true) as "categoryEnabled",
        coalesce(c.is_deleted, false) as "categoryDeleted"
      from zigo.store_categories sc
      left join zigo.services s on s.id = sc.service_id
      left join zigo.categories c on c.id = sc.service_category_id
      where sc.id = $1
    `,
    [id]
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(400, "Selected Store Category was not found.");
  if (row.isDeleted || !row.isActive) throw new HttpError(400, `Selected Store Category "${row.name}" is inactive or deleted. Activate it before mapping it to a Store.`);
  if (row.serviceDeleted || !row.serviceActive || !row.serviceEnabled) {
    throw new HttpError(400, `Parent Service "${row.serviceName}" is inactive, disabled, or deleted. Activate it before using Store Category "${row.name}".`);
  }
  if (row.categoryDeleted || !row.categoryActive || !row.categoryEnabled) {
    throw new HttpError(400, `Parent Service Category "${row.categoryName}" is inactive, disabled, or deleted. Activate it before using Store Category "${row.name}".`);
  }
}

async function assertUsableStoreKeyword(id: string) {
  const result = await pool.query(
    `
      select
        sk.name,
        coalesce(sk.is_active, true) as "isActive",
        coalesce(sk.is_deleted, false) as "isDeleted",
        s.name as "serviceName",
        coalesce(s.is_active, true) as "serviceActive",
        coalesce(s.is_enabled, true) as "serviceEnabled",
        coalesce(s.is_deleted, false) as "serviceDeleted",
        c.name as "categoryName",
        coalesce(c.is_active, true) as "categoryActive",
        coalesce(c.is_enabled, true) as "categoryEnabled",
        coalesce(c.is_deleted, false) as "categoryDeleted"
      from zigo.store_keywords sk
      join zigo.services s on s.id = sk.service_id
      join zigo.categories c on c.id = sk.service_category_id
      where sk.id = $1
    `,
    [id]
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(400, "Selected Store Keyword was not found.");
  if (row.isDeleted || !row.isActive) throw new HttpError(400, `Selected Store Keyword "${row.name}" is inactive or deleted. Activate it before mapping it to a Store.`);
  if (row.serviceDeleted || !row.serviceActive || !row.serviceEnabled) {
    throw new HttpError(400, `Parent Service "${row.serviceName}" is inactive, disabled, or deleted. Activate it before using Store Keyword "${row.name}".`);
  }
  if (row.categoryDeleted || !row.categoryActive || !row.categoryEnabled) {
    throw new HttpError(400, `Parent Service Category "${row.categoryName}" is inactive, disabled, or deleted. Activate it before using Store Keyword "${row.name}".`);
  }
}

async function assertUsableServiceCategoryParent(serviceId: string, serviceCategoryId: string) {
  const result = await pool.query(
    `
      select
        s.name as "serviceName",
        coalesce(s.is_active, true) as "serviceActive",
        coalesce(s.is_enabled, true) as "serviceEnabled",
        coalesce(s.is_deleted, false) as "serviceDeleted",
        c.name as "categoryName",
        c.service_id as "categoryServiceId",
        coalesce(c.is_active, true) as "categoryActive",
        coalesce(c.is_enabled, true) as "categoryEnabled",
        coalesce(c.is_deleted, false) as "categoryDeleted"
      from zigo.services s
      left join zigo.categories c on c.id = $2
      where s.id = $1
      limit 1
    `,
    [serviceId, serviceCategoryId]
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(400, "Selected Service was not found.");
  if (row.serviceDeleted || !row.serviceActive || !row.serviceEnabled) {
    throw new HttpError(400, `Selected Service "${row.serviceName}" is inactive, disabled, or deleted. Activate it before creating a Store Category.`);
  }
  if (!row.categoryName) throw new HttpError(400, "Selected Service Category was not found.");
  if (row.categoryServiceId !== serviceId) {
    throw new HttpError(400, `Selected Service Category "${row.categoryName}" does not belong to Service "${row.serviceName}".`);
  }
  if (row.categoryDeleted || !row.categoryActive || !row.categoryEnabled) {
    throw new HttpError(400, `Selected Service Category "${row.categoryName}" is inactive, disabled, or deleted. Activate it before creating a Store Category.`);
  }
}

async function assertUsableCategory(id: string) {
  const result = await pool.query(
    `
      select
        c.id,
        c.name as "categoryName",
        c.is_active as "categoryActive",
        coalesce(c.is_enabled, true) as "categoryEnabled",
        coalesce(c.is_deleted, false) as "categoryDeleted",
        s.name as "serviceName",
        coalesce(s.is_active, true) as "serviceActive",
        coalesce(s.is_enabled, true) as "serviceEnabled",
        coalesce(s.is_deleted, false) as "serviceDeleted",
        p.name as "parentCategoryName",
        coalesce(p.is_active, true) as "parentCategoryActive",
        coalesce(p.is_enabled, true) as "parentCategoryEnabled",
        coalesce(p.is_deleted, false) as "parentCategoryDeleted"
      from zigo.categories c
      left join zigo.services s on s.id = c.service_id
      left join zigo.categories p on p.id = c.parent_category_id
      where c.id = $1
    `,
    [id]
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(400, "Selected Service Category was not found.");
  if (row.categoryDeleted || !row.categoryActive) throw new HttpError(400, `Selected Service Category "${row.categoryName}" is inactive or deleted. Activate it before mapping it to a Store.`);
  if (!row.categoryEnabled) throw new HttpError(400, `Selected Service Category "${row.categoryName}" is disabled. Enable it before mapping it to a Store.`);
  if (row.serviceDeleted || !row.serviceActive) throw new HttpError(400, `Selected Service Category "${row.categoryName}" cannot be mapped because its Service "${row.serviceName || "unknown"}" is inactive or deleted. Activate the Service first.`);
  if (!row.serviceEnabled) throw new HttpError(400, `Selected Service Category "${row.categoryName}" cannot be mapped because its Service "${row.serviceName || "unknown"}" is disabled. Enable the Service first.`);
  if (row.parentCategoryDeleted || !row.parentCategoryActive) throw new HttpError(400, `Selected Service Category "${row.categoryName}" cannot be mapped because its parent Category "${row.parentCategoryName || "unknown"}" is inactive or deleted. Activate the parent Category first.`);
  if (!row.parentCategoryEnabled) throw new HttpError(400, `Selected Service Category "${row.categoryName}" cannot be mapped because its parent Category "${row.parentCategoryName || "unknown"}" is disabled. Enable the parent Category first.`);
}

async function assertUsableCluster(id: string) {
  const result = await pool.query(
    `
      select
        cl.id,
        cl.name as "clusterName",
        coalesce(cl.is_deleted, false) as "clusterDeleted",
        coalesce(cl.is_booking_enabled, false) as "bookingEnabled",
        city.name as "cityName",
        city.is_active as "cityActive",
        coalesce(city.is_deleted, false) as "cityDeleted",
        state.name as "stateName",
        coalesce(state.is_active, true) as "stateActive",
        coalesce(state.is_deleted, false) as "stateDeleted",
        z.name as "zoneName",
        coalesce(z.is_active, true) as "zoneActive",
        coalesce(z.is_deleted, false) as "zoneDeleted"
      from zigo.clusters cl
      left join zigo.cities city on city.id = cl.city_id
      left join zigo.states state on state.id = city.state_id
      left join zigo.zones z on z.id = cl.zone_id
      where cl.id = $1
    `,
    [id]
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(400, "Selected Cluster was not found.");
  if (row.clusterDeleted) throw new HttpError(400, `Selected Cluster "${row.clusterName}" is deleted. Restore the Cluster before mapping it to a Store.`);
  if (!row.bookingEnabled) throw new HttpError(400, `Selected Cluster "${row.clusterName}" is deactive. Activate the Cluster before mapping it to a Store.`);
  if (row.cityDeleted || !row.cityActive) throw new HttpError(400, `Selected Cluster "${row.clusterName}" cannot be mapped because its City "${row.cityName || "unknown"}" is inactive or deleted. Activate the City first.`);
  if (row.stateDeleted || !row.stateActive) throw new HttpError(400, `Selected Cluster "${row.clusterName}" cannot be mapped because its State "${row.stateName || "unknown"}" is inactive or deleted. Activate the State first.`);
  if (row.zoneDeleted || !row.zoneActive) throw new HttpError(400, `Selected Cluster "${row.clusterName}" cannot be mapped because its Zone "${row.zoneName || "unknown"}" is inactive or deleted. Activate the Zone first.`);
}

async function assertStoreInsideCluster(storeId: string, clusterId: string, client: Queryable = pool) {
  const result = await client.query<{
    storeName: string;
    latitude: string | number | null;
    longitude: string | number | null;
    clusterName: string;
    polygonDescription: string | null;
  }>(
    `
      select
        s.name as "storeName",
        s.latitude,
        s.longitude,
        c.name as "clusterName",
        c.polygon_description as "polygonDescription"
      from zigo.stores s
      cross join zigo.clusters c
      where s.id = $1 and c.id = $2
    `,
    [storeId, clusterId]
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(400, "Selected Store or Cluster was not found.");
  if (row.latitude == null || row.longitude == null) {
    throw new HttpError(400, `Store "${row.storeName}" must have latitude and longitude before mapping it to Cluster "${row.clusterName}".`);
  }
  const polygon = parseWktPolygon(row.polygonDescription);
  if (!polygon.length) {
    throw new HttpError(400, `Cluster "${row.clusterName}" does not have a valid polygon boundary. Add Polygon Description in POLYGON((lng lat,...)) format before mapping stores.`);
  }
  if (!isPointInPolygon(Number(row.latitude), Number(row.longitude), polygon)) {
    throw new HttpError(400, `Store "${row.storeName}" is outside Cluster "${row.clusterName}" polygon. Update the store coordinates or select the correct cluster.`);
  }
}
