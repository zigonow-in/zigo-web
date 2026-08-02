import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";

type VehicleMasterInput = {
  vehicleName: string;
  clusterId?: string | null;
  company?: string | null;
  vehicleNumber?: string | null;
  model?: string | null;
  fuelType: "EV" | "Petrol" | "Diesel";
  color?: string | null;
  pictureUrls?: string[];
  ownerType: "Own" | "Rent" | "ZIGO" | "Self" | "Rented";
  rentalCompanyName?: string | null;
  rentalCompanyAddress?: string | null;
  rentalCompanyNumber?: string | null;
  rentSlab?: "Hourly" | "Daily" | "Weekly" | "Monthly" | null;
  rentCharges?: number | null;
  zigoSlab?: "Hourly" | "Daily" | "Weekly" | "Monthly" | null;
  zigoCharges?: number | null;
  isActive?: boolean;
  actorUserId: string;
};

async function ensureVehicleMasterSchema() {
  await pool.query(`
    create table if not exists zigo.vehicle_master (
      id uuid primary key default gen_random_uuid(),
      vehicle_name text not null,
      cluster_id uuid references zigo.clusters(id),
      company text,
      vehicle_number text,
      model text,
      fuel_type text not null,
      color text,
      picture_urls jsonb not null default '[]'::jsonb,
      owner_type text not null default 'Self',
      rental_company_name text,
      rental_company_address text,
      rental_company_number text,
      rent_slab text,
      rent_charges numeric(12,2),
      zigo_slab text,
      zigo_charges numeric(12,2),
      is_active boolean not null default true,
      is_deleted boolean not null default false,
      created_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      updated_by uuid references zigo.users(id),
      updated_at timestamptz not null default now(),
      deleted_by uuid references zigo.users(id),
      deleted_at timestamptz
    );

    create index if not exists idx_vehicle_master_active
      on zigo.vehicle_master(is_deleted, is_active, created_at desc);
    alter table zigo.vehicle_master
      add column if not exists zigo_slab text,
      add column if not exists zigo_charges numeric(12,2),
      add column if not exists cluster_id uuid references zigo.clusters(id);
    alter table zigo.vehicle_master
      alter column owner_type set default 'Own';
    create unique index if not exists uq_vehicle_master_number_active
      on zigo.vehicle_master(lower(vehicle_number))
      where vehicle_number is not null and is_deleted = false;

    create index if not exists idx_vehicle_master_cluster_active
      on zigo.vehicle_master(cluster_id, is_deleted, is_active);

    create table if not exists zigo.assistant_vehicle_assignments (
      id uuid primary key default gen_random_uuid(),
      assistant_id uuid not null references zigo.assistants(id) on delete cascade,
      vehicle_master_id uuid not null references zigo.vehicle_master(id),
      is_active boolean not null default true,
      assigned_by uuid references zigo.users(id),
      assigned_at timestamptz not null default now(),
      removed_by uuid references zigo.users(id),
      removed_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create unique index if not exists uq_assistant_vehicle_assignment_active_assistant
      on zigo.assistant_vehicle_assignments(assistant_id)
      where is_active = true;

    create unique index if not exists uq_assistant_vehicle_assignment_active_vehicle
      on zigo.assistant_vehicle_assignments(vehicle_master_id)
      where is_active = true;
  `);
}

function normalizeVehicle(input: VehicleMasterInput) {
  const ownerType = input.ownerType === "Self" ? "Own" : input.ownerType === "Rented" ? "Rent" : input.ownerType;
  if (ownerType === "Rent" && (!input.rentalCompanyName || !input.rentSlab || input.rentCharges == null)) {
    throw new HttpError(400, "Rental company name, rent slab, and rent charges are required for rent vehicles.");
  }
  if (ownerType === "ZIGO" && (!input.zigoSlab || input.zigoCharges == null)) {
    throw new HttpError(400, "ZIGO slab and ZIGO charges are required for ZIGO vehicles.");
  }

  return {
    vehicleName: input.vehicleName.trim(),
    clusterId: input.clusterId || null,
    company: input.company?.trim() || null,
    vehicleNumber: input.vehicleNumber?.trim() || null,
    model: input.model?.trim() || null,
    fuelType: input.fuelType,
    color: input.color?.trim() || null,
    pictureUrls: input.pictureUrls ?? [],
    ownerType,
    rentalCompanyName: ownerType === "Rent" ? input.rentalCompanyName?.trim() || null : null,
    rentalCompanyAddress: ownerType === "Rent" ? input.rentalCompanyAddress?.trim() || null : null,
    rentalCompanyNumber: ownerType === "Rent" ? input.rentalCompanyNumber?.trim() || null : null,
    rentSlab: ownerType === "Rent" ? input.rentSlab ?? null : null,
    rentCharges: ownerType === "Rent" ? input.rentCharges ?? null : null,
    zigoSlab: ownerType === "ZIGO" ? input.zigoSlab ?? null : null,
    zigoCharges: ownerType === "ZIGO" ? input.zigoCharges ?? null : null,
    isActive: input.isActive ?? true
  };
}

async function assertUsableCluster(clusterId: string | null | undefined) {
  if (!clusterId) return;
  const result = await pool.query(
    `
      select cl.id
      from zigo.clusters cl
      join zigo.cities ci on ci.id = cl.city_id
      join zigo.states st on st.id = ci.state_id
      left join zigo.zones zn on zn.id = cl.zone_id
      where cl.id = $1
        and coalesce(cl.is_deleted, false) = false
        and coalesce(cl.is_booking_enabled, true) = true
        and coalesce(ci.is_deleted, false) = false
        and ci.is_active = true
        and coalesce(st.is_deleted, false) = false
        and st.is_active = true
        and (zn.id is null or (coalesce(zn.is_deleted, false) = false and zn.is_active = true))
      limit 1
    `,
    [clusterId]
  );
  if (!result.rows[0]) {
    throw new HttpError(400, "Selected Cluster is inactive, deleted, or belongs to an inactive City/State/Zone. Please select an active cluster.");
  }
}

function toVehicleWriteError(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505") {
    return new HttpError(409, "Vehicle number already exists. Please use another vehicle number.");
  }
  return error;
}

export async function listVehicleMasters() {
  await ensureVehicleMasterSchema();
  const result = await pool.query(`
    select
      vm.id,
      vm.vehicle_name as "vehicleName",
      vm.cluster_id as "clusterId",
      cl.name as "clusterName",
      cl.city_id as "cityId",
      ci.name as "cityName",
      cl.zone_id as "zoneId",
      zn.name as "zoneName",
      ci.state_id as "stateId",
      st.name as "stateName",
      vm.company,
      vm.vehicle_number as "vehicleNumber",
      vm.model,
      vm.fuel_type as "fuelType",
      vm.color,
      vm.picture_urls as "pictureUrls",
      vm.owner_type as "ownerType",
      vm.rental_company_name as "rentalCompanyName",
      vm.rental_company_address as "rentalCompanyAddress",
      vm.rental_company_number as "rentalCompanyNumber",
      vm.rent_slab as "rentSlab",
      vm.rent_charges as "rentCharges",
      vm.zigo_slab as "zigoSlab",
      vm.zigo_charges as "zigoCharges",
      vm.is_active as "isActive",
      assignment.assistant_id as "assignedAssistantId",
      assignment.assistant_code as "assignedAssistantCode",
      assignment.assistant_name as "assignedAssistantName",
      assignment.assistant_phone as "assignedAssistantPhone",
      assignment.assistant_profile_picture_url as "assignedAssistantProfilePictureUrl",
      vm.created_at as "createdAt",
      vm.updated_at as "updatedAt"
    from zigo.vehicle_master vm
    left join zigo.clusters cl on cl.id = vm.cluster_id
    left join zigo.cities ci on ci.id = cl.city_id
    left join zigo.states st on st.id = ci.state_id
    left join zigo.zones zn on zn.id = cl.zone_id
    left join lateral (
      select
        ava.assistant_id,
        a.assistant_code,
        u.display_name as assistant_name,
        u.phone as assistant_phone,
        u.metadata->>'profilePictureUrl' as assistant_profile_picture_url
      from zigo.assistant_vehicle_assignments ava
      join zigo.assistants a on a.id = ava.assistant_id
      join zigo.users u on u.id = a.user_id
      where ava.vehicle_master_id = vm.id
        and ava.is_active = true
      order by ava.assigned_at desc
      limit 1
    ) assignment on true
    where vm.is_deleted = false
    order by vm.created_at desc
  `);
  return result.rows;
}

export async function createVehicleMaster(input: VehicleMasterInput) {
  await ensureVehicleMasterSchema();
  const vehicle = normalizeVehicle(input);
  await assertUsableCluster(vehicle.clusterId);
  try {
    const result = await pool.query(
      `
        insert into zigo.vehicle_master (
          vehicle_name, cluster_id, company, vehicle_number, model, fuel_type, color, picture_urls, owner_type,
          rental_company_name, rental_company_address, rental_company_number, rent_slab, rent_charges, zigo_slab, zigo_charges,
          is_active, created_by, updated_by
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18)
        returning id
      `,
      [
        vehicle.vehicleName,
        vehicle.clusterId,
        vehicle.company,
        vehicle.vehicleNumber,
        vehicle.model,
        vehicle.fuelType,
        vehicle.color,
        JSON.stringify(vehicle.pictureUrls),
        vehicle.ownerType,
        vehicle.rentalCompanyName,
        vehicle.rentalCompanyAddress,
        vehicle.rentalCompanyNumber,
        vehicle.rentSlab,
        vehicle.rentCharges,
        vehicle.zigoSlab,
        vehicle.zigoCharges,
        vehicle.isActive,
        input.actorUserId
      ]
    );
    return (await getVehicleMaster(result.rows[0].id))!;
  } catch (error) {
    throw toVehicleWriteError(error);
  }
}

export async function getVehicleMaster(id: string) {
  await ensureVehicleMasterSchema();
  const result = await pool.query(
    `
      select
        vm.id,
        vm.vehicle_name as "vehicleName",
        vm.cluster_id as "clusterId",
        cl.name as "clusterName",
        cl.city_id as "cityId",
        ci.name as "cityName",
        cl.zone_id as "zoneId",
        zn.name as "zoneName",
        ci.state_id as "stateId",
        st.name as "stateName",
        vm.company,
        vm.vehicle_number as "vehicleNumber",
        vm.model,
        vm.fuel_type as "fuelType",
        vm.color,
        vm.picture_urls as "pictureUrls",
        vm.owner_type as "ownerType",
        vm.rental_company_name as "rentalCompanyName",
        vm.rental_company_address as "rentalCompanyAddress",
        vm.rental_company_number as "rentalCompanyNumber",
        vm.rent_slab as "rentSlab",
        vm.rent_charges as "rentCharges",
        vm.zigo_slab as "zigoSlab",
        vm.zigo_charges as "zigoCharges",
        vm.is_active as "isActive",
        assignment.assistant_id as "assignedAssistantId",
        assignment.assistant_code as "assignedAssistantCode",
        assignment.assistant_name as "assignedAssistantName",
        assignment.assistant_phone as "assignedAssistantPhone",
        assignment.assistant_profile_picture_url as "assignedAssistantProfilePictureUrl",
        vm.created_at as "createdAt",
        vm.updated_at as "updatedAt"
      from zigo.vehicle_master vm
      left join zigo.clusters cl on cl.id = vm.cluster_id
      left join zigo.cities ci on ci.id = cl.city_id
      left join zigo.states st on st.id = ci.state_id
      left join zigo.zones zn on zn.id = cl.zone_id
      left join lateral (
        select
          ava.assistant_id,
          a.assistant_code,
          u.display_name as assistant_name,
          u.phone as assistant_phone,
          u.metadata->>'profilePictureUrl' as assistant_profile_picture_url
        from zigo.assistant_vehicle_assignments ava
        join zigo.assistants a on a.id = ava.assistant_id
        join zigo.users u on u.id = a.user_id
        where ava.vehicle_master_id = vm.id
          and ava.is_active = true
        order by ava.assigned_at desc
        limit 1
      ) assignment on true
      where vm.id = $1 and vm.is_deleted = false
      limit 1
    `,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function updateVehicleMaster(id: string, input: VehicleMasterInput) {
  await ensureVehicleMasterSchema();
  const vehicle = normalizeVehicle(input);
  await assertUsableCluster(vehicle.clusterId);
  try {
    const result = await pool.query(
      `
        update zigo.vehicle_master
        set vehicle_name = $2,
            cluster_id = $3,
            company = $4,
            vehicle_number = $5,
            model = $6,
            fuel_type = $7,
            color = $8,
            picture_urls = $9::jsonb,
            owner_type = $10,
            rental_company_name = $11,
            rental_company_address = $12,
            rental_company_number = $13,
            rent_slab = $14,
            rent_charges = $15,
            zigo_slab = $16,
            zigo_charges = $17,
            is_active = $18,
            updated_by = $19,
            updated_at = now()
        where id = $1 and is_deleted = false
        returning id
      `,
      [
        id,
        vehicle.vehicleName,
        vehicle.clusterId,
        vehicle.company,
        vehicle.vehicleNumber,
        vehicle.model,
        vehicle.fuelType,
        vehicle.color,
        JSON.stringify(vehicle.pictureUrls),
        vehicle.ownerType,
        vehicle.rentalCompanyName,
        vehicle.rentalCompanyAddress,
        vehicle.rentalCompanyNumber,
        vehicle.rentSlab,
        vehicle.rentCharges,
        vehicle.zigoSlab,
        vehicle.zigoCharges,
        vehicle.isActive,
        input.actorUserId
      ]
    );
    return result.rows[0] ? getVehicleMaster(id) : null;
  } catch (error) {
    throw toVehicleWriteError(error);
  }
}

export async function deleteVehicleMaster(id: string, actorUserId: string) {
  await ensureVehicleMasterSchema();
  const result = await pool.query(
    `
      update zigo.vehicle_master
      set is_deleted = true,
          is_active = false,
          deleted_by = $2,
          deleted_at = now(),
          updated_by = $2,
          updated_at = now()
      where id = $1 and is_deleted = false
    `,
    [id, actorUserId]
  );
  return (result.rowCount ?? 0) > 0;
}
