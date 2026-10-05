import { pool } from '../../db/pool.js';
import { HttpError } from '../../http/errors.js';
export async function listMarketTypes() {
    const result = await pool.query(`select id, name, code, description, color, is_active as "isActive"
    from zigo.market_types where is_deleted = false order by lower(name), name, id`);
    return result.rows;
}
async function save(id, input) {
    try {
        const values = [input.name, input.code, input.description ?? '', input.color, input.isActive, input.userId];
        const result = id
            ? await pool.query(`update zigo.market_types set name=$1, code=$2, description=$3, color=$4,
          is_active=$5, updated_by=$6, updated_at=now() where id=$7 and is_deleted=false returning id`, [...values, id])
            : await pool.query(`insert into zigo.market_types (name,code,description,color,is_active,created_by,updated_by)
          values ($1,$2,$3,$4,$5,$6,$6) returning id`, values);
        return result.rows[0] ?? null;
    }
    catch (error) {
        if (error.code === '23505')
            throw new HttpError(409, 'A Market Type with this code already exists.');
        throw error;
    }
}
export const createMarketType = (input) => save(null, input);
export const updateMarketType = (id, input) => save(id, input);
export async function deleteMarketType(id, userId) {
    const result = await pool.query(`update zigo.market_types set is_deleted=true, is_active=false,
    updated_by=$2, updated_at=now() where id=$1 and is_deleted=false returning id`, [id, userId]);
    return result.rows[0] ?? null;
}
