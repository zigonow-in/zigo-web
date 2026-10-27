import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";

export type ServicePillarStatus = "draft" | "active" | "inactive" | "retired";

type ServicePillarInput = {
  code: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  status: ServicePillarStatus;
};

const selectServicePillars = `
  select
    pillar.id,
    pillar.code,
    pillar.name,
    pillar.description,
    pillar.display_order as "displayOrder",
    pillar.status,
    count(mapping.service_id)::int as "serviceCount"
  from zigo.service_pillars pillar
  left join zigo.service_pillar_mappings mapping on mapping.pillar_id = pillar.id
`;

export async function listServicePillars() {
  const result = await pool.query(`${selectServicePillars}
    group by pillar.id
    order by pillar.display_order, lower(pillar.name), pillar.id`);
  return result.rows;
}

async function saveServicePillar(id: string | null, input: ServicePillarInput) {
  const values = [
    input.code.trim().toUpperCase(),
    input.name.trim(),
    input.description?.trim() || null,
    input.displayOrder,
    input.status
  ];

  try {
    const result = id
      ? await pool.query(`
          update zigo.service_pillars
          set code = $1,
              name = $2,
              description = $3,
              display_order = $4,
              status = $5::zigo.lifecycle_status
          where id = $6
          returning id
        `, [...values, id])
      : await pool.query(`
          insert into zigo.service_pillars (code, name, description, display_order, status)
          values ($1, $2, $3, $4, $5::zigo.lifecycle_status)
          returning id
        `, values);

    if (!result.rows[0]) return null;
    const saved = await pool.query(`${selectServicePillars}
      where pillar.id = $1
      group by pillar.id`, [result.rows[0].id]);
    return saved.rows[0] ?? null;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new HttpError(409, "A pillar with this code already exists.");
    }
    throw error;
  }
}

export const createServicePillar = (input: ServicePillarInput) => saveServicePillar(null, input);

export const updateServicePillar = (id: string, input: ServicePillarInput) => saveServicePillar(id, input);

export async function deleteServicePillar(id: string, _userId: string) {
  const result = await pool.query(`
    delete from zigo.service_pillars pillar
    where pillar.id = $1
      and not exists (
        select 1
        from zigo.service_pillar_mappings mapping
        where mapping.pillar_id = pillar.id
      )
    returning pillar.id
  `, [id]);
  if (result.rows[0]) return result.rows[0];

  const existing = await pool.query(`
    select exists(select 1 from zigo.service_pillars where id = $1) as exists,
      (select count(*)::int from zigo.service_pillar_mappings where pillar_id = $1) as "serviceCount"
  `, [id]);
  if (!existing.rows[0]?.exists) return null;
  if (existing.rows[0].serviceCount > 0) {
    throw new HttpError(409, "This pillar is assigned to services. Retire it or remove its service mappings before deletion.");
  }
  return null;
}
