import { pool } from "../../db/pool.js";

export type AdminActionSummary = {
  id: string;
  actorUserId: string;
  entityType: string;
  entityId: string;
  actionTypeId: string | null;
  reasonId: string | null;
  notes: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  createdAt: Date;
};

export async function getDashboardCounts() {
  const result = await pool.query<{
    users: string;
    customers: string;
    assistants: string;
    serviceRequests: string;
    payments: string;
  }>(`
    select
      (select count(*) from zigo.users where deleted_at is null) as users,
      (select count(*) from zigo.customers) as customers,
      (select count(*) from zigo.assistants) as assistants,
      (select count(*) from zigo.service_requests) as "serviceRequests",
      (select count(*) from zigo.payments) as payments
  `);

  return result.rows[0];
}

export async function listAdminActions(limit: number, offset: number) {
  const result = await pool.query<AdminActionSummary>(
    `
      select
        id,
        actor_user_id as "actorUserId",
        entity_type as "entityType",
        entity_id as "entityId",
        action_type_id as "actionTypeId",
        reason_id as "reasonId",
        notes,
        before_data as "beforeData",
        after_data as "afterData",
        created_at as "createdAt"
      from zigo.admin_actions
      order by created_at desc
      limit $1 offset $2
    `,
    [limit, offset]
  );

  return result.rows;
}
