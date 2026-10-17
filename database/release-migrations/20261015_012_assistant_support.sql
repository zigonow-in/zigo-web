do $migration$
begin
  if to_regclass('zigo.assistants') is null
    or to_regclass('zigo.users') is null
    or to_regclass('zigo.service_requests') is null
    or to_regclass('zigo.task_assignments') is null then
    raise exception 'Required assistant and booking schema is missing. Apply the existing release migrations first.';
  end if;
end
$migration$;

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
