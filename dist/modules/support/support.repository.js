import { randomInt } from "node:crypto";
import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";
function ticketNumber(now = new Date()) {
    const parts = [
        String(now.getFullYear()).slice(-2),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0")
    ].join("");
    return `TKZUI${parts}${String(randomInt(0, 100_000_000)).padStart(8, "0")}`;
}
async function customerIdForUser(userId, client = pool) {
    const result = await client.query("select id from zigo.customers where user_id = $1::uuid limit 1", [userId]);
    if (!result.rows[0])
        throw new HttpError(404, "Customer profile not found.");
    return result.rows[0].id;
}
function normalizePage(page = 1, pageSize = 20) {
    return {
        page: Math.max(1, Math.trunc(page)),
        pageSize: Math.max(5, Math.min(100, Math.trunc(pageSize)))
    };
}
const ticketSelect = `
  select t.id,
    t.ticket_number as "ticketNumber",
    t.customer_id as "customerId",
    t.booking_id as "bookingId",
    sr.request_number as "bookingNumber",
    t.subject,
    t.category,
    t.status_code as "statusCode",
    t.priority_code as "priorityCode",
    t.assigned_admin_user_id as "assignedAdminUserId",
    au.display_name as "assignedAdminName",
    cu.user_id as "customerUserId",
    u.display_name as "customerName",
    u.phone as "customerPhone",
    coalesce(lm.created_at, t.last_message_at, t.created_at) as "lastMessageAt",
    t.closed_at as "closedAt",
    t.metadata,
    t.created_at as "createdAt",
    t.updated_at as "updatedAt",
    lm.message as "lastMessage",
    (select count(*)::int from zigo.customer_support_messages m where m.ticket_id = t.id) as "messageCount"
  from zigo.customer_support_tickets t
  join zigo.customers cu on cu.id = t.customer_id
  join zigo.users u on u.id = cu.user_id
  left join zigo.users au on au.id = t.assigned_admin_user_id
  left join zigo.service_requests sr on sr.id = t.booking_id
  left join lateral (
    select m.message, m.created_at
    from zigo.customer_support_messages m
    where m.ticket_id = t.id
    order by m.created_at desc, m.id desc
    limit 1
  ) lm on true
`;
async function getTicket(ticketId, customerUserId, client = pool) {
    const params = [ticketId];
    let ownership = "";
    if (customerUserId) {
        params.push(customerUserId);
        ownership = `and cu.user_id = $${params.length}::uuid`;
    }
    const result = await client.query(`${ticketSelect} where t.id = $1::uuid ${ownership} limit 1`, params);
    if (!result.rows[0])
        throw new HttpError(404, "Support ticket not found.");
    return result.rows[0];
}
async function listMessages(ticketId, client = pool) {
    const result = await client.query(`select m.id,
       m.ticket_id as "ticketId",
       m.sender_type as "senderType",
       m.sender_user_id as "senderUserId",
       coalesce(u.display_name, case when m.sender_type = 'system' then 'ZIGO Support' else initcap(m.sender_type) end) as "senderName",
       m.message,
       m.metadata,
       m.created_at as "createdAt"
     from zigo.customer_support_messages m
     left join zigo.users u on u.id = m.sender_user_id
     where m.ticket_id = $1::uuid
     order by m.created_at asc, m.id asc`, [ticketId]);
    return result.rows;
}
export async function listCustomerSupportTickets(userId, input) {
    const customerId = await customerIdForUser(userId);
    const { page, pageSize } = normalizePage(input.page, input.pageSize);
    const params = [customerId];
    const conditions = ["t.customer_id = $1::uuid"];
    if (input.bookingId) {
        params.push(input.bookingId);
        conditions.push(`t.booking_id = $${params.length}::uuid`);
    }
    const where = `where ${conditions.join(" and ")}`;
    const count = await pool.query(`select count(*)::int as total from zigo.customer_support_tickets t ${where}`, params);
    params.push(pageSize, (page - 1) * pageSize);
    const rows = await pool.query(`${ticketSelect} ${where}
     order by coalesce(lm.created_at, t.last_message_at, t.created_at) desc, t.created_at desc, t.id desc
     limit $${params.length - 1} offset $${params.length}`, params);
    const total = Number(count.rows[0]?.total || 0);
    return { rows: rows.rows, pagination: { page, pageSize, totalRecords: total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
}
export async function getCustomerSupportTicket(userId, ticketId) {
    const ticket = await getTicket(ticketId, userId);
    return { ticket, messages: await listMessages(ticketId) };
}
async function insertUniqueTicket(client, input) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            const result = await client.query(`insert into zigo.customer_support_tickets
          (ticket_number, customer_id, booking_id, subject, category, metadata)
         values ($1, $2::uuid, $3::uuid, $4, $5, $6::jsonb)
         returning id`, [ticketNumber(), input.customerId, input.bookingId || null, input.subject, input.category, JSON.stringify(input.metadata || {})]);
            return result.rows[0].id;
        }
        catch (error) {
            if (error.code !== "23505" || attempt === 4)
                throw error;
        }
    }
    throw new HttpError(500, "Unable to generate a unique ticket number.");
}
export async function createCustomerSupportTicket(userId, input) {
    const client = await pool.connect();
    try {
        await client.query("begin");
        const customerId = await customerIdForUser(userId, client);
        const message = input.message.trim();
        if (input.bookingId) {
            const booking = await client.query(`select 1 from zigo.service_requests sr join zigo.customers c on c.id = sr.customer_id
         where sr.id = $1::uuid and c.user_id = $2::uuid`, [input.bookingId, userId]);
            if (!booking.rows[0])
                throw new HttpError(400, "Selected booking does not belong to this customer.");
        }
        const conversationKey = `${customerId}:${input.bookingId || `${input.category}:${input.subject.trim().toLowerCase()}`}`;
        await client.query("select pg_advisory_xact_lock(hashtext($1))", [conversationKey]);
        const existing = await client.query(`select t.id
       from zigo.customer_support_tickets t
       where t.customer_id = $1::uuid
         and t.status_code not in ('closed', 'resolved')
         and (
           ($2::uuid is not null and t.booking_id = $2::uuid)
           or
           ($2::uuid is null and t.booking_id is null and t.category = $3 and lower(t.subject) = lower($4))
         )
       order by coalesce(t.last_message_at, t.created_at) desc, t.created_at desc
       limit 1`, [customerId, input.bookingId || null, input.category, input.subject]);
        if (existing.rows[0]) {
            const existingId = existing.rows[0].id;
            if (message) {
                await client.query(`with inserted_message as (
             insert into zigo.customer_support_messages (ticket_id, sender_type, sender_user_id, message)
             values ($1::uuid, 'customer', $2::uuid, $3)
             returning created_at
           )
           update zigo.customer_support_tickets
           set status_code = case when status_code = 'waiting_customer' then 'open' else status_code end,
               last_message_at = (select created_at from inserted_message), updated_at = now()
           where id = $1::uuid`, [existingId, userId, message]);
            }
            await client.query("commit");
            return { ...(await getCustomerSupportTicket(userId, existingId)), created: false, messageAdded: Boolean(message) };
        }
        const id = await insertUniqueTicket(client, { customerId, bookingId: input.bookingId, subject: input.subject, category: input.category });
        if (message) {
            await client.query(`with inserted_message as (
           insert into zigo.customer_support_messages (ticket_id, sender_type, sender_user_id, message)
           values ($1::uuid, 'customer', $2::uuid, $3)
           returning created_at
         )
         update zigo.customer_support_tickets
         set last_message_at = (select created_at from inserted_message), updated_at = now()
         where id = $1::uuid`, [id, userId, message]);
        }
        await client.query("commit");
        return { ...(await getCustomerSupportTicket(userId, id)), created: true, messageAdded: Boolean(message) };
    }
    catch (error) {
        await client.query("rollback");
        throw error;
    }
    finally {
        client.release();
    }
}
export async function addCustomerSupportMessage(userId, ticketId, input) {
    const ticket = await getTicket(ticketId, userId);
    if (["closed", "resolved"].includes(String(ticket.statusCode)))
        throw new HttpError(409, "This ticket is closed.");
    const attachments = input.attachments || [];
    await pool.query(`with inserted_message as (
       insert into zigo.customer_support_messages (ticket_id, sender_type, sender_user_id, message, metadata)
       values ($1::uuid, 'customer', $2::uuid, $3, $4::jsonb)
       returning ticket_id
     )
     update zigo.customer_support_tickets
     set status_code = case when status_code = 'waiting_customer' then 'open' else status_code end,
         last_message_at = now(), updated_at = now()
     where id = (select ticket_id from inserted_message)`, [ticketId, userId, input.message, JSON.stringify({ attachments })]);
    return getCustomerSupportTicket(userId, ticketId);
}
export async function listAdminSupportTickets(input) {
    const { page, pageSize } = normalizePage(input.page, input.pageSize);
    const params = [];
    const conditions = [];
    const search = String(input.search || "").trim();
    const status = String(input.status || "all").trim().toLowerCase();
    if (status && status !== "all") {
        params.push(status);
        conditions.push(`t.status_code = $${params.length}`);
    }
    if (search) {
        params.push(`%${search}%`);
        conditions.push(`(t.ticket_number ilike $${params.length} or t.subject ilike $${params.length} or u.display_name ilike $${params.length} or u.phone ilike $${params.length})`);
    }
    const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
    const count = await pool.query(`select count(*)::int as total from zigo.customer_support_tickets t join zigo.customers cu on cu.id=t.customer_id join zigo.users u on u.id=cu.user_id ${where}`, params);
    params.push(pageSize, (page - 1) * pageSize);
    const rows = await pool.query(`${ticketSelect} ${where}
    order by case t.priority_code when 'urgent' then 1 when 'high' then 2 else 3 end,
      coalesce(lm.created_at, t.last_message_at, t.created_at) desc, t.created_at desc, t.id desc
    limit $${params.length - 1} offset $${params.length}`, params);
    const total = Number(count.rows[0]?.total || 0);
    return { rows: rows.rows, pagination: { page, pageSize, totalRecords: total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
}
export async function getAdminSupportTicket(ticketId) {
    return { ticket: await getTicket(ticketId), messages: await listMessages(ticketId) };
}
export async function addAdminSupportMessage(adminUserId, ticketId, message) {
    await getTicket(ticketId);
    await pool.query(`with inserted_message as (
       insert into zigo.customer_support_messages (ticket_id, sender_type, sender_user_id, message)
       values ($1::uuid, 'admin', $2::uuid, $3)
       returning ticket_id
     )
     update zigo.customer_support_tickets
     set assigned_admin_user_id = coalesce(assigned_admin_user_id, $2::uuid), status_code = 'waiting_customer',
         last_message_at = now(), updated_at = now()
     where id = (select ticket_id from inserted_message)`, [ticketId, adminUserId, message]);
    return getAdminSupportTicket(ticketId);
}
export async function updateAdminSupportTicket(adminUserId, ticketId, input) {
    await getTicket(ticketId);
    const result = await pool.query(`update zigo.customer_support_tickets
     set status_code = coalesce($2, status_code),
         priority_code = coalesce($3, priority_code),
         assigned_admin_user_id = case when $4::boolean then $1::uuid else assigned_admin_user_id end,
         closed_at = case when coalesce($2, status_code) in ('closed','resolved') then coalesce(closed_at, now()) else null end,
         updated_at = now()
     where id = $5::uuid
     returning id`, [adminUserId, input.statusCode || null, input.priorityCode || null, Boolean(input.assignToMe), ticketId]);
    if (!result.rows[0])
        throw new HttpError(404, "Support ticket not found.");
    return getAdminSupportTicket(ticketId);
}
