import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";

async function ensureCustomerAddressSchema() {
  await pool.query(`
    create table if not exists zigo.customer_addresses (
      id uuid primary key default gen_random_uuid(),
      customer_id uuid not null references zigo.customers(id),
      label text,
      address_text text not null,
      latitude numeric(10,7),
      longitude numeric(10,7),
      cluster_id uuid references zigo.clusters(id),
      is_default boolean not null default false,
      metadata jsonb not null default '{}'::jsonb,
      created_by uuid references zigo.users(id),
      updated_by uuid references zigo.users(id),
      deleted_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz
    );
    alter table zigo.customer_addresses add column if not exists metadata jsonb not null default '{}'::jsonb;
    alter table zigo.customer_addresses add column if not exists created_by uuid references zigo.users(id);
    alter table zigo.customer_addresses add column if not exists updated_by uuid references zigo.users(id);
    alter table zigo.customer_addresses add column if not exists deleted_by uuid references zigo.users(id);
    alter table zigo.customer_addresses add column if not exists updated_at timestamptz not null default now();
    create index if not exists idx_customer_addresses_customer_active on zigo.customer_addresses(customer_id, deleted_at, is_default);
  `);
}

async function assertAdminCustomer(id: string) {
  const result = await pool.query(
    `
      select c.id
      from zigo.customers c
      join zigo.users u on u.id = c.user_id
      where c.id = $1 and u.deleted_at is null
      limit 1
    `,
    [id]
  );
  if (!result.rows[0]) throw new HttpError(404, "Customer not found");
}

export async function listAdminCustomers() {
  await ensureCustomerAddressSchema();
  const result = await pool.query(`
    select
      c.id,
      c.user_id as "userId",
      c.customer_code as "customerCode",
      u.display_name as "displayName",
      u.email::text as email,
      u.phone,
      u.metadata->>'profilePictureUrl' as "profilePictureUrl",
      coalesce(u.metadata->>'accountStatus', 'active') as status,
      coalesce(u.metadata->>'otpVerificationStatus', 'not_required') as "otpVerificationStatus",
      u.metadata->'otpChannelStatus' as "otpChannelStatus",
      ca.id as "addressId",
      ca.label as "addressLabel",
      ca.address_text as address,
      ca.latitude,
      ca.longitude,
      ca.cluster_id as "clusterId",
      cl.name as "clusterName",
      z.name as "zoneName",
      city.name as "cityName",
      ca.is_default as "isDefaultAddress",
      c.rating_avg as "ratingAvg",
      c.rating_count as "ratingCount",
      c.created_at as "createdAt"
    from zigo.customers c
    join zigo.users u on u.id = c.user_id
    left join lateral (
      select *
      from zigo.customer_addresses ca
      where ca.customer_id = c.id
        and ca.deleted_at is null
        and coalesce(ca.metadata->>'addressKind', 'saved') <> 'previous_used'
      order by ca.is_default desc, ca.created_at desc
      limit 1
    ) ca on true
    left join zigo.clusters cl on cl.id = ca.cluster_id
    left join zigo.zones z on z.id = cl.zone_id
    left join zigo.cities city on city.id = cl.city_id
    where u.deleted_at is null
    order by c.created_at desc
  `);
  return result.rows;
}

export async function getAdminCustomer(id: string) {
  await ensureCustomerAddressSchema();
  const result = await pool.query(
    `
      select
        c.id,
        c.user_id as "userId",
        c.customer_code as "customerCode",
        u.display_name as "displayName",
        u.email::text as email,
        u.phone,
        u.metadata->>'profilePictureUrl' as "profilePictureUrl",
        coalesce(u.metadata->>'accountStatus', 'active') as status,
        coalesce(u.metadata->>'otpVerificationStatus', 'not_required') as "otpVerificationStatus",
        u.metadata->'otpChannelStatus' as "otpChannelStatus",
        ca.id as "addressId",
        ca.label as "addressLabel",
        ca.address_text as address,
        ca.latitude,
        ca.longitude,
        ca.cluster_id as "clusterId",
        cl.name as "clusterName",
        z.name as "zoneName",
        city.name as "cityName",
        ca.is_default as "isDefaultAddress",
        c.preferences,
        c.created_at as "createdAt",
        c.updated_at as "updatedAt"
      from zigo.customers c
      join zigo.users u on u.id = c.user_id
      left join lateral (
        select *
      from zigo.customer_addresses ca
      where ca.customer_id = c.id
        and ca.deleted_at is null
        and coalesce(ca.metadata->>'addressKind', 'saved') <> 'previous_used'
      order by ca.is_default desc, ca.created_at desc
      limit 1
      ) ca on true
      left join zigo.clusters cl on cl.id = ca.cluster_id
      left join zigo.zones z on z.id = cl.zone_id
      left join zigo.cities city on city.id = cl.city_id
      where c.id = $1 and u.deleted_at is null
      limit 1
    `,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function updateAdminCustomer(
  id: string,
  input: { displayName?: string | null; email?: string | null; phone?: string | null; status?: string | null; userId: string }
) {
  const result = await pool.query(
    `
      update zigo.users u
      set display_name = coalesce($2, display_name),
          email = coalesce($3, email),
          phone = coalesce($4, phone),
          metadata = jsonb_set(metadata, '{accountStatus}', to_jsonb(coalesce($5::text, metadata->>'accountStatus', 'active')), true),
          updated_by = $6,
          updated_at = now()
      from zigo.customers c
      where c.id = $1 and u.id = c.user_id and u.deleted_at is null
      returning c.id
    `,
    [id, input.displayName ?? null, input.email ?? null, input.phone ?? null, input.status ?? null, input.userId]
  );
  return result.rows[0] ?? null;
}

export async function deleteAdminCustomer(id: string, userId: string) {
  const result = await pool.query(
    `
      update zigo.users u
      set deleted_at = now(),
          deleted_by = $2,
          metadata = jsonb_set(metadata, '{accountStatus}', '"inactive"'::jsonb, true),
          updated_by = $2,
          updated_at = now()
      from zigo.customers c
      where c.id = $1 and u.id = c.user_id and u.deleted_at is null
      returning c.id
    `,
    [id, userId]
  );
  return result.rows[0] ?? null;
}

export async function listAdminCustomerAddresses(customerId: string) {
  await ensureCustomerAddressSchema();
  await assertAdminCustomer(customerId);
  const result = await pool.query(
    `
      select
        ca.id as "addressId",
        ca.customer_id as "customerId",
        ca.label,
        ca.address_text as address,
        ca.latitude,
        ca.longitude,
        ca.cluster_id as "clusterId",
        cl.name as "clusterName",
        z.name as "zoneName",
        city.name as "cityName",
        ca.is_default as "isDefault",
        ca.metadata,
        ca.created_at as "createdAt",
        ca.updated_at as "updatedAt"
      from zigo.customer_addresses ca
      left join zigo.clusters cl on cl.id = ca.cluster_id
      left join zigo.zones z on z.id = cl.zone_id
      left join zigo.cities city on city.id = cl.city_id
      where ca.customer_id = $1
        and ca.deleted_at is null
        and coalesce(ca.metadata->>'addressKind', 'saved') <> 'previous_used'
      order by ca.is_default desc, ca.created_at desc
    `,
    [customerId]
  );
  return result.rows;
}

export async function listAdminCustomerPreviousUsedLocations(customerId: string) {
  await ensureCustomerAddressSchema();
  await assertAdminCustomer(customerId);
  const result = await pool.query(
    `
      select
        ca.id as "addressId",
        ca.customer_id as "customerId",
        ca.label,
        ca.address_text as address,
        ca.latitude,
        ca.longitude,
        ca.cluster_id as "clusterId",
        cl.name as "clusterName",
        z.name as "zoneName",
        city.name as "cityName",
        false as "isDefault",
        ca.metadata,
        ca.created_at as "createdAt",
        ca.updated_at as "updatedAt"
      from zigo.customer_addresses ca
      left join zigo.clusters cl on cl.id = ca.cluster_id
      left join zigo.zones z on z.id = cl.zone_id
      left join zigo.cities city on city.id = cl.city_id
      where ca.customer_id = $1
        and ca.deleted_at is null
        and ca.metadata->>'addressKind' = 'previous_used'
      order by ca.created_at desc
      limit 25
    `,
    [customerId]
  );
  return result.rows;
}

export async function createAdminCustomerAddress(
  customerId: string,
  input: {
    label?: string | null;
    address: string;
    latitude: number;
    longitude: number;
    clusterId?: string | null;
    isDefault?: boolean;
    metadata?: Record<string, unknown>;
    userId: string;
  }
) {
  await ensureCustomerAddressSchema();
  await assertAdminCustomer(customerId);
  const duplicate = await pool.query(
    `
      select id
      from zigo.customer_addresses
      where customer_id = $1
        and deleted_at is null
        and coalesce(metadata->>'addressKind', 'saved') <> 'previous_used'
        and lower(label) = lower($2)
      limit 1
    `,
    [customerId, input.label ?? "Home"]
  );
  if (duplicate.rows[0]) throw new HttpError(400, "Address label already exists, try different.");
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (input.isDefault) {
      await client.query("update zigo.customer_addresses set is_default = false, updated_by = $2, updated_at = now() where customer_id = $1 and deleted_at is null and coalesce(metadata->>'addressKind', 'saved') <> 'previous_used'", [
        customerId,
        input.userId
      ]);
    }
    const result = await client.query(
      `
        insert into zigo.customer_addresses
          (customer_id, label, address_text, latitude, longitude, cluster_id, is_default, metadata, created_by, updated_by)
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $9)
        returning id as "addressId"
      `,
      [
        customerId,
        input.label ?? "Home",
        input.address,
        input.latitude,
        input.longitude,
        input.clusterId ?? null,
        input.isDefault ?? false,
        JSON.stringify({ ...(input.metadata ?? {}), addressKind: "saved" }),
        input.userId
      ]
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

export async function createAdminCustomerPreviousUsedLocation(
  customerId: string,
  input: {
    label?: string | null;
    address: string;
    latitude: number;
    longitude: number;
    clusterId?: string | null;
    metadata?: Record<string, unknown>;
    userId: string;
  }
) {
  await ensureCustomerAddressSchema();
  await assertAdminCustomer(customerId);
  const result = await pool.query(
    `
      insert into zigo.customer_addresses
        (customer_id, label, address_text, latitude, longitude, cluster_id, is_default, metadata, created_by, updated_by)
      values ($1, $2, $3, $4, $5, $6, false, $7::jsonb, $8, $8)
      returning id as "addressId"
    `,
    [
      customerId,
      input.label ?? "Previous used",
      input.address,
      input.latitude,
      input.longitude,
      input.clusterId ?? null,
      JSON.stringify({ ...(input.metadata ?? {}), addressKind: "previous_used" }),
      input.userId
    ]
  );
  return result.rows[0];
}

export async function saveAdminCustomerPreviousUsedLocationAsAddress(
  customerId: string,
  addressId: string,
  input: {
    label?: string | null;
    address: string;
    latitude: number;
    longitude: number;
    clusterId?: string | null;
    isDefault?: boolean;
    metadata?: Record<string, unknown>;
    userId: string;
  }
) {
  await ensureCustomerAddressSchema();
  await assertAdminCustomer(customerId);
  const duplicate = await pool.query(
    `
      select id
      from zigo.customer_addresses
      where customer_id = $1
        and id <> $2
        and deleted_at is null
        and coalesce(metadata->>'addressKind', 'saved') <> 'previous_used'
        and lower(label) = lower($3)
      limit 1
    `,
    [customerId, addressId, input.label ?? "Home"]
  );
  if (duplicate.rows[0]) throw new HttpError(400, "Address label already exists, try different.");
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (input.isDefault) {
      await client.query("update zigo.customer_addresses set is_default = false, updated_by = $2, updated_at = now() where customer_id = $1 and id <> $3 and deleted_at is null and coalesce(metadata->>'addressKind', 'saved') <> 'previous_used'", [
        customerId,
        input.userId,
        addressId
      ]);
    }
    const result = await client.query(
      `
        update zigo.customer_addresses
        set label = $3,
            address_text = $4,
            latitude = $5,
            longitude = $6,
            cluster_id = $7,
            is_default = $8,
            metadata = $9::jsonb,
            updated_by = $10,
            updated_at = now()
        where customer_id = $1
          and id = $2
          and deleted_at is null
          and metadata->>'addressKind' = 'previous_used'
        returning id as "addressId"
      `,
      [
        customerId,
        addressId,
        input.label ?? "Home",
        input.address,
        input.latitude,
        input.longitude,
        input.clusterId ?? null,
        input.isDefault ?? false,
        JSON.stringify({ ...(input.metadata ?? {}), addressKind: "saved", savedFrom: "previous_used" }),
        input.userId
      ]
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

export async function updateAdminCustomerAddress(
  customerId: string,
  addressId: string,
  input: {
    label?: string | null;
    address: string;
    latitude: number;
    longitude: number;
    clusterId?: string | null;
    isDefault?: boolean;
    metadata?: Record<string, unknown>;
    userId: string;
  }
) {
  await ensureCustomerAddressSchema();
  await assertAdminCustomer(customerId);
  const duplicate = await pool.query(
    `
      select id
      from zigo.customer_addresses
      where customer_id = $1
        and id <> $2
        and deleted_at is null
        and coalesce(metadata->>'addressKind', 'saved') <> 'previous_used'
        and lower(label) = lower($3)
      limit 1
    `,
    [customerId, addressId, input.label ?? "Home"]
  );
  if (duplicate.rows[0]) throw new HttpError(400, "Address label already exists, try different.");
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (input.isDefault) {
      await client.query("update zigo.customer_addresses set is_default = false, updated_by = $2, updated_at = now() where customer_id = $1 and id <> $3 and deleted_at is null and coalesce(metadata->>'addressKind', 'saved') <> 'previous_used'", [
        customerId,
        input.userId,
        addressId
      ]);
    }
    const result = await client.query(
      `
        update zigo.customer_addresses
        set label = $3,
            address_text = $4,
            latitude = $5,
            longitude = $6,
            cluster_id = $7,
            is_default = $8,
            metadata = $9::jsonb,
            updated_by = $10,
            updated_at = now()
        where customer_id = $1
          and id = $2
          and deleted_at is null
        returning id as "addressId"
      `,
      [
        customerId,
        addressId,
        input.label ?? "Home",
        input.address,
        input.latitude,
        input.longitude,
        input.clusterId ?? null,
        input.isDefault ?? false,
        JSON.stringify({ ...(input.metadata ?? {}), addressKind: "saved" }),
        input.userId
      ]
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

export async function deleteAdminCustomerAddress(customerId: string, addressId: string, userId: string) {
  await ensureCustomerAddressSchema();
  await assertAdminCustomer(customerId);
  const result = await pool.query(
    `
      update zigo.customer_addresses
      set deleted_at = now(),
          deleted_by = $3,
          updated_by = $3,
          updated_at = now(),
          is_default = false
      where id = $2
        and customer_id = $1
        and deleted_at is null
      returning id as "addressId"
    `,
    [customerId, addressId, userId]
  );
  return result.rows[0] ?? null;
}
