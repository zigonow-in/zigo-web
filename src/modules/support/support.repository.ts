import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../../db/pool.js";
import { HttpError } from "../../http/errors.js";

type Queryable = Pick<typeof pool, "query">;

export type SupportActor = "customer" | "assistant" | "admin" | "system";
export type SupportAttachment = { url: string; name?: string; type?: string; size?: number; latitude?: number; longitude?: number };

let assistantSupportSchemaReady: Promise<void> | null = null;
let supportReadSchemaReady: Promise<void> | null = null;

function ensureSupportReadSchema() {
  if (supportReadSchemaReady) return supportReadSchemaReady;
  supportReadSchemaReady = pool.query(`
    alter table if exists zigo.customer_support_tickets
      add column if not exists admin_read_at timestamptz;
    alter table if exists zigo.assistant_support_tickets
      add column if not exists admin_read_at timestamptz;
    create table if not exists zigo.support_reply_templates (
      id uuid primary key default gen_random_uuid(),
      channel_code varchar(20) not null check (channel_code in ('customer', 'assistant')),
      reply_type varchar(20) not null check (reply_type in ('quick', 'auto')),
      title varchar(160) not null,
      description text not null,
      icon_url text,
      is_active boolean not null default true,
      deleted_at timestamptz,
      created_by uuid references zigo.users(id),
      updated_by uuid references zigo.users(id),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists idx_support_reply_templates_channel_type
      on zigo.support_reply_templates (channel_code, reply_type, is_active, created_at);
  `).then(() => undefined).catch((error) => {
    supportReadSchemaReady = null;
    throw error;
  });
  return supportReadSchemaReady;
}

export type SupportReplyChannel = "customer" | "assistant";
export type SupportReplyType = "quick" | "auto";

type SupportReplyTemplateInput = {
  channelCode: SupportReplyChannel;
  replyType: SupportReplyType;
  title: string;
  description: string;
  iconUrl?: string | null;
  isActive?: boolean;
};

const supportReplyTemplateSelect = `
  select t.id,
    t.channel_code as "channelCode",
    t.reply_type as "replyType",
    t.title,
    t.description,
    t.icon_url as "iconUrl",
    t.is_active as "isActive",
    t.created_by as "createdBy",
    t.updated_by as "updatedBy",
    t.created_at as "createdAt",
    t.updated_at as "updatedAt"
  from zigo.support_reply_templates t
`;

function supportReplyTemplateInput(input: SupportReplyTemplateInput) {
  const title = String(input.title || "").trim();
  const description = String(input.description || "").trim();
  if (!title) throw new HttpError(400, "Reply title is required.");
  if (!description) throw new HttpError(400, "Reply description is required.");
  if (title.length > 160) throw new HttpError(400, "Reply title must be 160 characters or fewer.");
  if (description.length > 4000) throw new HttpError(400, "Reply description must be 4000 characters or fewer.");
  return {
    channelCode: input.channelCode,
    replyType: input.replyType,
    title,
    description,
    iconUrl: String(input.iconUrl || "").trim() || null,
    isActive: input.isActive !== false
  };
}

export async function listAdminSupportReplyTemplates(channelCode: SupportReplyChannel) {
  await ensureSupportReadSchema();
  const result = await pool.query(
    `${supportReplyTemplateSelect}
     where t.channel_code = $1 and t.deleted_at is null
     order by case when t.reply_type = 'quick' then 1 else 2 end, t.created_at asc, t.id asc`,
    [channelCode]
  );
  return result.rows;
}

export async function createAdminSupportReplyTemplate(adminUserId: string, input: SupportReplyTemplateInput) {
  await ensureSupportReadSchema();
  const value = supportReplyTemplateInput(input);
  const result = await pool.query(
    `insert into zigo.support_reply_templates
      (channel_code, reply_type, title, description, icon_url, is_active, created_by, updated_by)
     values ($1, $2, $3, $4, $5, $6, $7::uuid, $7::uuid)
     returning id`,
    [value.channelCode, value.replyType, value.title, value.description, value.iconUrl, value.isActive, adminUserId]
  );
  const created = await pool.query(`${supportReplyTemplateSelect} where t.id = $1::uuid`, [result.rows[0].id]);
  return created.rows[0];
}

export async function updateAdminSupportReplyTemplate(adminUserId: string, id: string, input: SupportReplyTemplateInput) {
  await ensureSupportReadSchema();
  const value = supportReplyTemplateInput(input);
  const result = await pool.query(
    `update zigo.support_reply_templates
     set channel_code = $2,
         reply_type = $3,
         title = $4,
         description = $5,
         icon_url = $6,
         is_active = $7,
         updated_by = $8::uuid,
         updated_at = now()
     where id = $1::uuid and deleted_at is null
     returning id`,
    [id, value.channelCode, value.replyType, value.title, value.description, value.iconUrl, value.isActive, adminUserId]
  );
  if (!result.rows[0]) throw new HttpError(404, "Reply template not found.");
  const updated = await pool.query(`${supportReplyTemplateSelect} where t.id = $1::uuid`, [id]);
  return updated.rows[0];
}

export async function deleteAdminSupportReplyTemplate(adminUserId: string, id: string) {
  await ensureSupportReadSchema();
  const result = await pool.query(
    `update zigo.support_reply_templates
     set deleted_at = now(), is_active = false, updated_by = $2::uuid, updated_at = now()
     where id = $1::uuid and deleted_at is null
     returning id`,
    [id, adminUserId]
  );
  if (!result.rows[0]) throw new HttpError(404, "Reply template not found.");
  return { id: result.rows[0].id, deleted: true };
}

async function applyActiveAutoReply(client: Queryable, channelCode: SupportReplyChannel, ticketId: string) {
  const table = channelCode === "assistant" ? "assistant_support" : "customer_support";
  const template = await client.query<{ id: string; title: string; description: string; iconUrl: string | null }>(
    `select id, title, description, icon_url as "iconUrl"
     from zigo.support_reply_templates
     where channel_code = $1 and reply_type = 'auto' and is_active and deleted_at is null
     order by created_at asc, id asc
     limit 1`,
    [channelCode]
  );
  if (!template.rows[0]) return false;
  const existingAdminMessage = await client.query(
    `select 1 from zigo.${table}_messages where ticket_id = $1::uuid and sender_type = 'admin' limit 1`,
    [ticketId]
  );
  if (existingAdminMessage.rows[0]) return false;
  const value = template.rows[0];
  const attachments = value.iconUrl ? [{ url: value.iconUrl, name: `${value.title} icon`, type: "image/png" }] : [];
  await client.query(
    `insert into zigo.${table}_messages (ticket_id, sender_type, message, metadata)
     values ($1::uuid, 'admin', $2, $3::jsonb)`,
    [ticketId, value.description, JSON.stringify({ source: "support_auto_reply", templateId: value.id, templateTitle: value.title, iconUrl: value.iconUrl, attachments })]
  );
  await client.query(
    `update zigo.${table}_tickets
     set status_code = $2, last_message_at = now(), admin_read_at = now(), updated_at = now()
     where id = $1::uuid`,
    [ticketId, channelCode === "assistant" ? "waiting_assistant" : "waiting_customer"]
  );
  return true;
}

async function supportMessageAttachments(channelCode: SupportReplyChannel, input: { attachments?: SupportAttachment[]; replyTemplateId?: string | null }) {
  const attachments = Array.isArray(input.attachments) ? [...input.attachments] : [];
  const templateId = String(input.replyTemplateId || "").trim();
  if (!templateId) return attachments;
  await ensureSupportReadSchema();
  const template = await pool.query<{ title: string; iconUrl: string | null }>(
    `select title, icon_url as "iconUrl"
     from zigo.support_reply_templates
     where id = $1::uuid and channel_code = $2 and reply_type = 'quick' and is_active and deleted_at is null
     limit 1`,
    [templateId, channelCode]
  );
  const iconUrl = template.rows[0]?.iconUrl;
  if (iconUrl && !attachments.some((attachment) => String(attachment.url || "") === iconUrl)) {
    attachments.push({ url: iconUrl, name: `${template.rows[0].title} icon`, type: "image/png" });
  }
  return attachments;
}

function ensureAssistantSupportSchema() {
  if (assistantSupportSchemaReady) return assistantSupportSchemaReady;
  assistantSupportSchemaReady = pool.query(`
    create table if not exists zigo.assistant_support_tickets (
      id uuid primary key default gen_random_uuid(),
      ticket_number varchar(32) not null unique,
      assistant_id uuid not null references zigo.assistants(id),
      booking_id uuid references zigo.service_requests(id) on delete set null,
      task_assignment_id uuid references zigo.task_assignments(id) on delete set null,
      subject varchar(200) not null,
      category varchar(60) not null default 'task_help',
      status_code varchar(30) not null default 'open',
      priority_code varchar(20) not null default 'normal',
      assigned_admin_user_id uuid references zigo.users(id),
      last_message_at timestamptz not null default now(),
      admin_read_at timestamptz,
      closed_at timestamptz,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table if not exists zigo.assistant_support_messages (
      id uuid primary key default gen_random_uuid(),
      ticket_id uuid not null references zigo.assistant_support_tickets(id) on delete cascade,
      sender_type varchar(20) not null,
      sender_user_id uuid references zigo.users(id),
      message text not null,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create index if not exists idx_assistant_support_tickets_assistant
      on zigo.assistant_support_tickets (assistant_id, last_message_at desc);
    create index if not exists idx_assistant_support_tickets_status
      on zigo.assistant_support_tickets (status_code, priority_code, last_message_at desc);
    create index if not exists idx_assistant_support_messages_ticket
      on zigo.assistant_support_messages (ticket_id, created_at);
  `).then(async () => {
    await ensureSupportReadSchema();
  }).catch((error) => {
    assistantSupportSchemaReady = null;
    throw error;
  });
  return assistantSupportSchemaReady;
}

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

function assistantTicketNumber(now = new Date()) {
  return ticketNumber(now).replace(/^TKZUI/, "ATZUI");
}

async function customerIdForUser(userId: string, client: Queryable = pool) {
  const result = await client.query<{ id: string }>(
    "select id from zigo.customers where user_id = $1::uuid limit 1",
    [userId]
  );
  if (!result.rows[0]) throw new HttpError(404, "Customer profile not found.");
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
    lm.sender_type as "lastMessageSenderType",
    t.admin_read_at as "adminReadAt",
    (lm.sender_type = 'customer' and (t.admin_read_at is null or lm.created_at > t.admin_read_at)) as "isUnread",
    (select count(*)::int from zigo.customer_support_messages m where m.ticket_id = t.id and m.sender_type = 'customer' and (t.admin_read_at is null or m.created_at > t.admin_read_at)) as "unreadCount",
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
    select m.message, m.sender_type, m.created_at
    from zigo.customer_support_messages m
    where m.ticket_id = t.id
    order by m.created_at desc, m.id desc
    limit 1
  ) lm on true
`;

async function getTicket(ticketId: string, customerUserId?: string, client: Queryable = pool) {
  await ensureSupportReadSchema();
  const params: unknown[] = [ticketId];
  let ownership = "";
  if (customerUserId) {
    params.push(customerUserId);
    ownership = `and cu.user_id = $${params.length}::uuid`;
  }
  const result = await client.query(`${ticketSelect} where t.id = $1::uuid ${ownership} limit 1`, params);
  if (!result.rows[0]) throw new HttpError(404, "Support ticket not found.");
  return result.rows[0];
}

async function listMessages(ticketId: string, client: Queryable = pool) {
  const result = await client.query(
    `select m.id,
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
     order by m.created_at asc, m.id asc`,
    [ticketId]
  );
  return result.rows;
}

export async function listCustomerSupportTickets(userId: string, input: { page?: number; pageSize?: number; bookingId?: string }) {
  await ensureSupportReadSchema();
  const customerId = await customerIdForUser(userId);
  const { page, pageSize } = normalizePage(input.page, input.pageSize);
  const params: unknown[] = [customerId];
  const conditions = ["t.customer_id = $1::uuid"];
  conditions.push("exists (select 1 from zigo.customer_support_messages m where m.ticket_id = t.id)");
  if (input.bookingId) {
    params.push(input.bookingId);
    conditions.push(`t.booking_id = $${params.length}::uuid`);
  }
  const where = `where ${conditions.join(" and ")}`;
  const count = await pool.query<{ total: number }>(
    `select count(*)::int as total from zigo.customer_support_tickets t ${where}`,
    params
  );
  params.push(pageSize, (page - 1) * pageSize);
  const rows = await pool.query(
    `${ticketSelect} ${where}
     order by coalesce(lm.created_at, t.last_message_at, t.created_at) desc, t.created_at desc, t.id desc
     limit $${params.length - 1} offset $${params.length}`,
    params
  );
  const total = Number(count.rows[0]?.total || 0);
  return { rows: rows.rows, pagination: { page, pageSize, totalRecords: total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
}

export async function getCustomerSupportTicket(userId: string, ticketId: string) {
  const ticket = await getTicket(ticketId, userId);
  return { ticket, messages: await listMessages(ticketId) };
}

async function insertUniqueTicket(client: PoolClient, input: { customerId: string; bookingId?: string | null; subject: string; category: string; metadata?: Record<string, unknown> }) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const result = await client.query<{ id: string }>(
        `insert into zigo.customer_support_tickets
          (ticket_number, customer_id, booking_id, subject, category, metadata)
         values ($1, $2::uuid, $3::uuid, $4, $5, $6::jsonb)
         returning id`,
        [ticketNumber(), input.customerId, input.bookingId || null, input.subject, input.category, JSON.stringify(input.metadata || {})]
      );
      return result.rows[0].id;
    } catch (error) {
      if ((error as { code?: string }).code !== "23505" || attempt === 4) throw error;
    }
  }
  throw new HttpError(500, "Unable to generate a unique ticket number.");
}

export async function createCustomerSupportTicket(userId: string, input: { subject: string; category: string; message: string; attachments?: SupportAttachment[]; bookingId?: string | null }) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const customerId = await customerIdForUser(userId, client);
    const message = input.message.trim();
    const attachments = Array.isArray(input.attachments) ? input.attachments : [];
    if (!message && !attachments.length) throw new HttpError(400, "Type a message or attach a file.");
    if (input.bookingId) {
      const booking = await client.query(
        `select 1 from zigo.service_requests sr join zigo.customers c on c.id = sr.customer_id
         where sr.id = $1::uuid and c.user_id = $2::uuid`,
        [input.bookingId, userId]
      );
      if (!booking.rows[0]) throw new HttpError(400, "Selected booking does not belong to this customer.");
    }
    const conversationKey = `${customerId}:${input.bookingId || `${input.category}:${input.subject.trim().toLowerCase()}`}`;
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [conversationKey]);
    const existing = await client.query<{ id: string }>(
      `select t.id
       from zigo.customer_support_tickets t
       where t.customer_id = $1::uuid
         and t.status_code not in ('closed', 'resolved')
         and (
           ($2::uuid is not null and t.booking_id = $2::uuid)
           or
           ($2::uuid is null and t.booking_id is null and t.category = $3 and lower(t.subject) = lower($4))
         )
       order by coalesce(t.last_message_at, t.created_at) desc, t.created_at desc
       limit 1`,
      [customerId, input.bookingId || null, input.category, input.subject]
    );
    if (existing.rows[0]) {
      const existingId = existing.rows[0].id;
      let autoReplyApplied = false;
      if (message || attachments.length) {
        await client.query(
          `with inserted_message as (
             insert into zigo.customer_support_messages (ticket_id, sender_type, sender_user_id, message, metadata)
             values ($1::uuid, 'customer', $2::uuid, $3, $4::jsonb)
             returning created_at
           )
           update zigo.customer_support_tickets
           set status_code = case when status_code = 'waiting_customer' then 'open' else status_code end,
               last_message_at = (select created_at from inserted_message), updated_at = now()
           where id = $1::uuid`,
          [existingId, userId, message, JSON.stringify({ attachments })]
        );
        autoReplyApplied = await applyActiveAutoReply(client, "customer", existingId);
      }
      await client.query("commit");
      return { ...(await getCustomerSupportTicket(userId, existingId)), created: false, messageAdded: Boolean(message || attachments.length), autoReplyApplied };
    }
    const id = await insertUniqueTicket(client, { customerId, bookingId: input.bookingId, subject: input.subject, category: input.category });
    let autoReplyApplied = false;
    if (message || attachments.length) {
      await client.query(
        `with inserted_message as (
           insert into zigo.customer_support_messages (ticket_id, sender_type, sender_user_id, message, metadata)
           values ($1::uuid, 'customer', $2::uuid, $3, $4::jsonb)
           returning created_at
         )
         update zigo.customer_support_tickets
         set last_message_at = (select created_at from inserted_message), updated_at = now()
         where id = $1::uuid`,
        [id, userId, message, JSON.stringify({ attachments })]
      );
      autoReplyApplied = await applyActiveAutoReply(client, "customer", id);
    }
    await client.query("commit");
    return { ...(await getCustomerSupportTicket(userId, id)), created: true, messageAdded: Boolean(message || attachments.length), autoReplyApplied };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function addCustomerSupportMessage(userId: string, ticketId: string, input: { message: string; attachments?: SupportAttachment[] }) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const ticket = await getTicket(ticketId, userId, client);
    if (["closed", "resolved"].includes(String(ticket.statusCode))) throw new HttpError(409, "This ticket is closed.");
    const attachments = input.attachments || [];
    await client.query(
      `with inserted_message as (
         insert into zigo.customer_support_messages (ticket_id, sender_type, sender_user_id, message, metadata)
         values ($1::uuid, 'customer', $2::uuid, $3, $4::jsonb)
         returning ticket_id
       )
       update zigo.customer_support_tickets
       set status_code = case when status_code = 'waiting_customer' then 'open' else status_code end,
           last_message_at = now(), updated_at = now()
       where id = (select ticket_id from inserted_message)`,
      [ticketId, userId, input.message, JSON.stringify({ attachments })]
    );
    const autoReplyApplied = await applyActiveAutoReply(client, "customer", ticketId);
    await client.query("commit");
    return { ...(await getCustomerSupportTicket(userId, ticketId)), autoReplyApplied };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listAdminSupportTickets(input: { search?: string; status?: string; page?: number; pageSize?: number }) {
  await ensureSupportReadSchema();
  const { page, pageSize } = normalizePage(input.page, input.pageSize);
  const params: unknown[] = [];
  const conditions: string[] = [];
  const search = String(input.search || "").trim();
  const status = String(input.status || "all").trim().toLowerCase();
  if (status && status !== "all") { params.push(status); conditions.push(`t.status_code = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(t.ticket_number ilike $${params.length} or t.subject ilike $${params.length} or u.display_name ilike $${params.length} or u.phone ilike $${params.length})`);
  }
  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const count = await pool.query<{ total: number }>(
    `select count(*)::int as total from zigo.customer_support_tickets t join zigo.customers cu on cu.id=t.customer_id join zigo.users u on u.id=cu.user_id ${where}`,
    params
  );
  const unreadCount = await pool.query<{ total: number }>(
    `select count(*)::int as total
       from zigo.customer_support_tickets t
       join zigo.customers cu on cu.id=t.customer_id
       join zigo.users u on u.id=cu.user_id
       left join lateral (
         select m.sender_type, m.created_at
         from zigo.customer_support_messages m
         where m.ticket_id = t.id
         order by m.created_at desc, m.id desc
         limit 1
       ) lm on true
       ${where}${where ? " and" : "where"}
         lm.sender_type = 'customer'
         and (t.admin_read_at is null or lm.created_at > t.admin_read_at)`,
    params
  );
  params.push(pageSize, (page - 1) * pageSize);
  const rows = await pool.query(`${ticketSelect} ${where}
    order by lower(coalesce(u.display_name, '')) asc,
      coalesce(lm.created_at, t.last_message_at, t.created_at) desc, t.id desc
    limit $${params.length - 1} offset $${params.length}`, params);
  const total = Number(count.rows[0]?.total || 0);
  return {
    rows: rows.rows,
    unreadCount: Number(unreadCount.rows[0]?.total || 0),
    pagination: { page, pageSize, totalRecords: total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
  };
}

export async function getAdminSupportTicket(ticketId: string) {
  await ensureSupportReadSchema();
  await pool.query("update zigo.customer_support_tickets set admin_read_at = now() where id = $1::uuid", [ticketId]);
  return { ticket: await getTicket(ticketId), messages: await listMessages(ticketId) };
}

export async function addAdminSupportMessage(adminUserId: string, ticketId: string, input: { message?: string; attachments?: SupportAttachment[]; replyTemplateId?: string | null }) {
  await getTicket(ticketId);
  const message = String(input.message || "").trim();
  const attachments = await supportMessageAttachments("customer", input);
  if (!message && !attachments.length) throw new HttpError(400, "Type a message or attach a file.");
  await pool.query(
    `with inserted_message as (
       insert into zigo.customer_support_messages (ticket_id, sender_type, sender_user_id, message, metadata)
       values ($1::uuid, 'admin', $2::uuid, $3, $4::jsonb)
       returning ticket_id
     )
     update zigo.customer_support_tickets
     set assigned_admin_user_id = coalesce(assigned_admin_user_id, $2::uuid), status_code = 'waiting_customer',
         last_message_at = now(), updated_at = now()
     where id = (select ticket_id from inserted_message)`,
    [ticketId, adminUserId, message, JSON.stringify({ attachments, replyTemplateId: input.replyTemplateId || null })]
  );
  return getAdminSupportTicket(ticketId);
}

export async function updateAdminSupportTicket(adminUserId: string, ticketId: string, input: { statusCode?: string; priorityCode?: string; assignToMe?: boolean }) {
  await getTicket(ticketId);
  const result = await pool.query(
    `update zigo.customer_support_tickets
     set status_code = coalesce($2, status_code),
         priority_code = coalesce($3, priority_code),
         assigned_admin_user_id = case when $4::boolean then $1::uuid else assigned_admin_user_id end,
         closed_at = case when coalesce($2, status_code) in ('closed','resolved') then coalesce(closed_at, now()) else null end,
         updated_at = now()
     where id = $5::uuid
     returning id`,
    [adminUserId, input.statusCode || null, input.priorityCode || null, Boolean(input.assignToMe), ticketId]
  );
  if (!result.rows[0]) throw new HttpError(404, "Support ticket not found.");
  return getAdminSupportTicket(ticketId);
}

async function assistantIdForUser(userId: string, client: Queryable = pool) {
  const result = await client.query<{ id: string }>(
    "select id from zigo.assistants where user_id = $1::uuid limit 1",
    [userId]
  );
  if (!result.rows[0]) throw new HttpError(404, "Assistant profile not found.");
  return result.rows[0].id;
}

const assistantTicketSelect = `
  select t.id,
    t.ticket_number as "ticketNumber",
    t.assistant_id as "assistantId",
    t.booking_id as "bookingId",
    t.task_assignment_id as "assignmentId",
    sr.request_number as "bookingNumber",
    t.subject,
    t.category,
    t.status_code as "statusCode",
    t.priority_code as "priorityCode",
    t.assigned_admin_user_id as "assignedAdminUserId",
    au.display_name as "assignedAdminName",
    a.user_id as "assistantUserId",
    u.display_name as "assistantName",
    u.phone as "assistantPhone",
    u.metadata->>'profilePictureUrl' as "assistantProfilePictureUrl",
    coalesce(lm.created_at, t.last_message_at, t.created_at) as "lastMessageAt",
    lm.sender_type as "lastMessageSenderType",
    t.admin_read_at as "adminReadAt",
    (lm.sender_type = 'assistant' and (t.admin_read_at is null or lm.created_at > t.admin_read_at)) as "isUnread",
    (select count(*)::int from zigo.assistant_support_messages m where m.ticket_id = t.id and m.sender_type = 'assistant' and (t.admin_read_at is null or m.created_at > t.admin_read_at)) as "unreadCount",
    t.closed_at as "closedAt",
    t.metadata,
    t.created_at as "createdAt",
    t.updated_at as "updatedAt",
    lm.message as "lastMessage",
    (select count(*)::int from zigo.assistant_support_messages m where m.ticket_id = t.id) as "messageCount"
  from zigo.assistant_support_tickets t
  join zigo.assistants a on a.id = t.assistant_id
  join zigo.users u on u.id = a.user_id
  left join zigo.users au on au.id = t.assigned_admin_user_id
  left join zigo.service_requests sr on sr.id = t.booking_id
  left join lateral (
    select m.message, m.sender_type, m.created_at
    from zigo.assistant_support_messages m
    where m.ticket_id = t.id
    order by m.created_at desc, m.id desc
    limit 1
  ) lm on true
`;

async function getAssistantTicket(ticketId: string, assistantUserId?: string, client: Queryable = pool) {
  await ensureAssistantSupportSchema();
  const params: unknown[] = [ticketId];
  let ownership = "";
  if (assistantUserId) {
    params.push(assistantUserId);
    ownership = `and a.user_id = $${params.length}::uuid`;
  }
  const result = await client.query(`${assistantTicketSelect} where t.id = $1::uuid ${ownership} limit 1`, params);
  if (!result.rows[0]) throw new HttpError(404, "Assistant support chat not found.");
  return result.rows[0];
}

async function listAssistantSupportMessages(ticketId: string, client: Queryable = pool) {
  const result = await client.query(
    `select m.id,
       m.ticket_id as "ticketId",
       m.sender_type as "senderType",
       m.sender_user_id as "senderUserId",
       coalesce(u.display_name, case when m.sender_type = 'system' then 'ZIGO Support' else initcap(m.sender_type) end) as "senderName",
       m.message,
       m.metadata,
       m.created_at as "createdAt"
     from zigo.assistant_support_messages m
     left join zigo.users u on u.id = m.sender_user_id
     where m.ticket_id = $1::uuid
     order by m.created_at asc, m.id asc`,
    [ticketId]
  );
  return result.rows;
}

export async function getAssistantSupportTicket(userId: string, ticketId: string) {
  const ticket = await getAssistantTicket(ticketId, userId);
  return { ticket, messages: await listAssistantSupportMessages(ticketId) };
}

export async function createAssistantSupportTicket(userId: string, input: { assignmentId: string; message?: string }) {
  await ensureAssistantSupportSchema();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const assistantId = await assistantIdForUser(userId, client);
    const assignment = await client.query<{ bookingId: string; bookingNumber: string | null }>(
      `select sr.id as "bookingId", sr.request_number as "bookingNumber"
       from zigo.task_assignments ta
       join zigo.service_requests sr on sr.id = coalesce(ta.service_request_id, ta.request_id)
       where ta.id = $1::uuid and ta.assistant_id = $2::uuid
       limit 1`,
      [input.assignmentId, assistantId]
    );
    if (!assignment.rows[0]) throw new HttpError(404, "Task not found for this assistant.");
    const bookingId = assignment.rows[0].bookingId;
    const bookingNumber = assignment.rows[0].bookingNumber || bookingId;
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [`assistant-support:${assistantId}:${input.assignmentId}`]);
    const existing = await client.query<{ id: string }>(
      `select id
       from zigo.assistant_support_tickets
       where assistant_id = $1::uuid and task_assignment_id = $2::uuid
         and status_code not in ('closed', 'resolved')
       order by coalesce(last_message_at, created_at) desc
       limit 1`,
      [assistantId, input.assignmentId]
    );
    let ticketId = existing.rows[0]?.id || "";
    let created = false;
    if (!ticketId) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const inserted = await client.query<{ id: string }>(
            `insert into zigo.assistant_support_tickets
              (ticket_number, assistant_id, booking_id, task_assignment_id, subject, category, metadata)
             values ($1, $2::uuid, $3::uuid, $4::uuid, $5, 'task_help', $6::jsonb)
             returning id`,
            [assistantTicketNumber(), assistantId, bookingId, input.assignmentId, `Help with booking ${bookingNumber}`, JSON.stringify({ source: "assistant_task_help" })]
          );
          ticketId = inserted.rows[0].id;
          created = true;
          break;
        } catch (error) {
          if ((error as { code?: string }).code !== "23505" || attempt === 4) throw error;
        }
      }
    }
    if (!ticketId) throw new HttpError(500, "Unable to start assistant support chat.");
    const message = String(input.message || "").trim();
    let autoReplyApplied = false;
    if (message) {
      await client.query(
        `with inserted_message as (
           insert into zigo.assistant_support_messages (ticket_id, sender_type, sender_user_id, message)
           values ($1::uuid, 'assistant', $2::uuid, $3)
           returning created_at
         )
         update zigo.assistant_support_tickets
         set status_code = case when status_code = 'waiting_assistant' then 'open' else status_code end,
             last_message_at = (select created_at from inserted_message), updated_at = now()
         where id = $1::uuid`,
        [ticketId, userId, message]
      );
      autoReplyApplied = await applyActiveAutoReply(client, "assistant", ticketId);
    }
    await client.query("commit");
    return { ...(await getAssistantSupportTicket(userId, ticketId)), created, messageAdded: Boolean(message), autoReplyApplied };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function addAssistantSupportMessage(userId: string, ticketId: string, input: { message: string; attachments?: SupportAttachment[] }) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const ticket = await getAssistantTicket(ticketId, userId, client);
    if (["closed", "resolved"].includes(String(ticket.statusCode))) throw new HttpError(409, "This support chat is closed.");
    const attachments = input.attachments || [];
    await client.query(
      `with inserted_message as (
         insert into zigo.assistant_support_messages (ticket_id, sender_type, sender_user_id, message, metadata)
         values ($1::uuid, 'assistant', $2::uuid, $3, $4::jsonb)
         returning created_at
       )
       update zigo.assistant_support_tickets
       set status_code = case when status_code = 'waiting_assistant' then 'open' else status_code end,
           last_message_at = (select created_at from inserted_message), updated_at = now()
       where id = $1::uuid`,
      [ticketId, userId, input.message, JSON.stringify({ attachments })]
    );
    const autoReplyApplied = await applyActiveAutoReply(client, "assistant", ticketId);
    await client.query("commit");
    return { ...(await getAssistantSupportTicket(userId, ticketId)), autoReplyApplied };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listAdminAssistantSupportTickets(input: { search?: string; status?: string; page?: number; pageSize?: number }) {
  await ensureAssistantSupportSchema();
  const { page, pageSize } = normalizePage(input.page, input.pageSize);
  const params: unknown[] = [];
  const conditions: string[] = [];
  const search = String(input.search || "").trim();
  const status = String(input.status || "all").trim().toLowerCase();
  if (status && status !== "all") { params.push(status); conditions.push(`t.status_code = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(t.ticket_number ilike $${params.length} or t.subject ilike $${params.length} or u.display_name ilike $${params.length} or u.phone ilike $${params.length} or sr.request_number ilike $${params.length})`);
  }
  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const count = await pool.query<{ total: number }>(
    `select count(*)::int as total
     from zigo.assistant_support_tickets t
     join zigo.assistants a on a.id = t.assistant_id
     join zigo.users u on u.id = a.user_id
     left join zigo.service_requests sr on sr.id = t.booking_id
     ${where}`,
    params
  );
  const unreadCount = await pool.query<{ total: number }>(
    `select count(*)::int as total
       from zigo.assistant_support_tickets t
       join zigo.assistants a on a.id = t.assistant_id
       join zigo.users u on u.id = a.user_id
       left join zigo.service_requests sr on sr.id = t.booking_id
       left join lateral (
         select m.sender_type, m.created_at
         from zigo.assistant_support_messages m
         where m.ticket_id = t.id
         order by m.created_at desc, m.id desc
         limit 1
       ) lm on true
       ${where}${where ? " and" : "where"}
         lm.sender_type = 'assistant'
         and (t.admin_read_at is null or lm.created_at > t.admin_read_at)`,
    params
  );
  params.push(pageSize, (page - 1) * pageSize);
  const rows = await pool.query(
    `${assistantTicketSelect} ${where}
     order by lower(coalesce(u.display_name, '')) asc,
       coalesce(lm.created_at, t.last_message_at, t.created_at) desc, t.id desc
     limit $${params.length - 1} offset $${params.length}`,
    params
  );
  const total = Number(count.rows[0]?.total || 0);
  return {
    rows: rows.rows,
    unreadCount: Number(unreadCount.rows[0]?.total || 0),
    pagination: { page, pageSize, totalRecords: total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
  };
}

export async function getAdminAssistantSupportTicket(ticketId: string) {
  await ensureAssistantSupportSchema();
  await pool.query("update zigo.assistant_support_tickets set admin_read_at = now() where id = $1::uuid", [ticketId]);
  return { ticket: await getAssistantTicket(ticketId), messages: await listAssistantSupportMessages(ticketId) };
}

export async function addAdminAssistantSupportMessage(adminUserId: string, ticketId: string, input: { message?: string; attachments?: SupportAttachment[]; replyTemplateId?: string | null }) {
  await getAssistantTicket(ticketId);
  const message = String(input.message || "").trim();
  const attachments = await supportMessageAttachments("assistant", input);
  if (!message && !attachments.length) throw new HttpError(400, "Type a message or attach a file.");
  await pool.query(
    `with inserted_message as (
       insert into zigo.assistant_support_messages (ticket_id, sender_type, sender_user_id, message, metadata)
       values ($1::uuid, 'admin', $2::uuid, $3, $4::jsonb)
       returning created_at
     )
     update zigo.assistant_support_tickets
     set assigned_admin_user_id = coalesce(assigned_admin_user_id, $2::uuid), status_code = 'waiting_assistant',
         last_message_at = (select created_at from inserted_message), updated_at = now()
     where id = $1::uuid`,
    [ticketId, adminUserId, message, JSON.stringify({ attachments, replyTemplateId: input.replyTemplateId || null })]
  );
  return getAdminAssistantSupportTicket(ticketId);
}

export async function updateAdminAssistantSupportTicket(adminUserId: string, ticketId: string, input: { statusCode?: string; priorityCode?: string; assignToMe?: boolean }) {
  await getAssistantTicket(ticketId);
  const result = await pool.query(
    `update zigo.assistant_support_tickets
     set status_code = coalesce($2, status_code),
         priority_code = coalesce($3, priority_code),
         assigned_admin_user_id = case when $4::boolean then $1::uuid else assigned_admin_user_id end,
         closed_at = case when coalesce($2, status_code) in ('closed','resolved') then coalesce(closed_at, now()) else null end,
         updated_at = now()
     where id = $5::uuid
     returning id`,
    [adminUserId, input.statusCode || null, input.priorityCode || null, Boolean(input.assignToMe), ticketId]
  );
  if (!result.rows[0]) throw new HttpError(404, "Assistant support chat not found.");
  return getAdminAssistantSupportTicket(ticketId);
}
