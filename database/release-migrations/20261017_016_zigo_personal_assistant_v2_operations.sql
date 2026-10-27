create table if not exists zigo.assistant_capabilities (
  assistant_id uuid not null references zigo.assistants(id) on delete cascade,
  capability_id uuid not null references zigo.capabilities(id) on delete cascade,
  verification_status zigo.review_status not null default 'pending',
  valid_until timestamptz,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  primary key (assistant_id, capability_id)
);

-- The existing assistant_availability table is the live GPS/presence lease.
-- V2 schedule windows are stored separately to preserve that runtime contract.
create table if not exists zigo.assistant_availability_windows (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null references zigo.assistants(id) on delete cascade,
  zone_id uuid references zigo.service_zones(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  availability_status text not null default 'available',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists zigo.customer_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references zigo.customers(id) on delete restrict,
  raw_request text not null,
  source_channel text not null,
  language_code text,
  status text not null default 'received',
  created_at timestamptz not null default now()
);

create table if not exists zigo.bookings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references zigo.customer_requests(id) on delete restrict,
  customer_id uuid not null references zigo.customers(id) on delete restrict,
  booking_mode_id uuid references zigo.booking_modes(id) on delete set null,
  service_request_id uuid unique references zigo.service_requests(id) on delete set null,
  status zigo.booking_status not null default 'draft',
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  confirmed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end is null or scheduled_start is null or scheduled_end > scheduled_start)
);

create table if not exists zigo.booking_tasks (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references zigo.bookings(id) on delete cascade,
  task_definition_id uuid not null references zigo.task_definitions(id) on delete restrict,
  workflow_template_id uuid references zigo.workflow_templates(id) on delete set null,
  task_order integer not null default 1 check (task_order > 0),
  status zigo.task_status not null default 'pending',
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  actual_minutes integer check (actual_minutes is null or actual_minutes >= 0),
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, task_order)
);

create table if not exists zigo.booking_task_inputs (
  id uuid primary key default gen_random_uuid(),
  booking_task_id uuid not null references zigo.booking_tasks(id) on delete cascade,
  input_definition_id uuid not null references zigo.task_input_definitions(id) on delete restrict,
  value_json jsonb not null,
  source text not null default 'customer',
  confirmed boolean not null default false,
  unique (booking_task_id, input_definition_id)
);

create table if not exists zigo.booking_task_dependencies (
  task_id uuid not null references zigo.booking_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references zigo.booking_tasks(id) on delete cascade,
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table if not exists zigo.quotes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references zigo.bookings(id) on delete cascade,
  currency char(3) not null default 'INR',
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  taxes numeric(12, 2) not null default 0 check (taxes >= 0),
  total numeric(12, 2) not null check (total >= 0),
  expires_at timestamptz not null,
  status text not null default 'proposed',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists zigo.quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references zigo.quotes(id) on delete cascade,
  booking_task_id uuid references zigo.booking_tasks(id) on delete set null,
  pricing_rule_id uuid references zigo.task_pricing_rules(id) on delete set null,
  label text not null,
  quantity numeric(12, 3) not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null,
  line_total numeric(12, 2) not null,
  calculation_snapshot jsonb not null default '{}'::jsonb
);

create table if not exists zigo.assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references zigo.bookings(id) on delete cascade,
  assistant_id uuid not null references zigo.assistants(id) on delete restrict,
  task_assignment_id uuid unique references zigo.task_assignments(id) on delete set null,
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  released_at timestamptz,
  status text not null default 'offered',
  metadata jsonb not null default '{}'::jsonb
);

-- The existing task_events table tracks the production service-request flow.
-- This table records events for V2 booking tasks without changing that contract.
create table if not exists zigo.booking_task_events (
  id uuid primary key default gen_random_uuid(),
  booking_task_id uuid not null references zigo.booking_tasks(id) on delete cascade,
  assignment_id uuid references zigo.assignments(id) on delete set null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  actor_type text not null,
  actor_id uuid,
  occurred_at timestamptz not null default now()
);

create table if not exists zigo.completion_evidence (
  id uuid primary key default gen_random_uuid(),
  booking_task_id uuid not null references zigo.booking_tasks(id) on delete cascade,
  evidence_type text not null,
  object_storage_key text,
  notes text,
  captured_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid references zigo.users(id) on delete set null
);

alter table zigo.payments
  add column if not exists booking_id uuid references zigo.bookings(id) on delete set null,
  add column if not exists quote_id uuid references zigo.quotes(id) on delete set null,
  add column if not exists provider text,
  add column if not exists provider_reference text,
  add column if not exists payment_status text;

create unique index if not exists idx_payments_provider_reference_unique
  on zigo.payments(provider_reference)
  where provider_reference is not null;

create table if not exists zigo.expense_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references zigo.bookings(id) on delete cascade,
  booking_task_id uuid references zigo.booking_tasks(id) on delete set null,
  expense_type text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency char(3) not null default 'INR',
  approved boolean not null default false,
  receipt_storage_key text,
  created_at timestamptz not null default now()
);

create table if not exists zigo.operational_exceptions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references zigo.bookings(id) on delete cascade,
  booking_task_id uuid references zigo.booking_tasks(id) on delete set null,
  exception_type_id uuid not null references zigo.exception_types(id) on delete restrict,
  status text not null default 'open',
  details text,
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table zigo.refunds
  add column if not exists reason text,
  add column if not exists status text not null default 'requested',
  add column if not exists provider_refund_reference text;

create unique index if not exists idx_refunds_provider_reference_unique
  on zigo.refunds(provider_refund_reference)
  where provider_refund_reference is not null;

create table if not exists zigo.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references zigo.customers(id) on delete restrict,
  request_id uuid references zigo.customer_requests(id) on delete set null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists zigo.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references zigo.ai_conversations(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant', 'tool')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists zigo.ai_interpretations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references zigo.customer_requests(id) on delete cascade,
  model_name text not null,
  schema_version text not null,
  structured_output jsonb not null,
  confidence numeric(5, 4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  validation_status text not null,
  created_at timestamptz not null default now()
);

create table if not exists zigo.clarification_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references zigo.customer_requests(id) on delete cascade,
  input_definition_id uuid references zigo.task_input_definitions(id) on delete set null,
  question_text text not null,
  answer_json jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create table if not exists zigo.validation_results (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references zigo.customer_requests(id) on delete cascade,
  booking_task_id uuid references zigo.booking_tasks(id) on delete cascade,
  validation_rule_id uuid references zigo.validation_rules(id) on delete set null,
  outcome text not null,
  reason_code text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (request_id is not null or booking_task_id is not null)
);

create table if not exists zigo.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null,
  actor_id uuid,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists zigo.system_settings (
  setting_key text primary key,
  setting_value jsonb not null,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

create table if not exists zigo.task_primitives (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  parameter_schema jsonb not null default '{}'::jsonb,
  status zigo.lifecycle_status not null default 'draft',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now()
);

create table if not exists zigo.task_primitive_mappings (
  task_id uuid not null references zigo.task_definitions(id) on delete cascade,
  primitive_id uuid not null references zigo.task_primitives(id) on delete cascade,
  sequence_no integer not null check (sequence_no > 0),
  configuration jsonb not null default '{}'::jsonb,
  primary key (task_id, primitive_id, sequence_no)
);

create table if not exists zigo.task_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version integer not null check (version > 0),
  name text not null,
  description text,
  input_schema jsonb not null default '{}'::jsonb,
  execution_policy jsonb not null default '{}'::jsonb,
  status zigo.lifecycle_status not null default 'draft',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (code, version)
);

create table if not exists zigo.task_template_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references zigo.task_templates(id) on delete cascade,
  step_key text not null,
  sequence_no integer not null check (sequence_no > 0),
  task_id uuid references zigo.task_definitions(id) on delete restrict,
  primitive_id uuid references zigo.task_primitives(id) on delete restrict,
  depends_on_keys text[] not null default '{}',
  configuration jsonb not null default '{}'::jsonb,
  check ((task_id is not null) <> (primitive_id is not null)),
  unique (template_id, step_key),
  unique (template_id, sequence_no)
);

create table if not exists zigo.intent_catalogue (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  description text,
  status zigo.lifecycle_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists zigo.intent_task_mappings (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references zigo.intent_catalogue(id) on delete cascade,
  task_id uuid references zigo.task_definitions(id) on delete cascade,
  template_id uuid references zigo.task_templates(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  status zigo.lifecycle_status not null default 'draft',
  mapping_conditions jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  check ((task_id is not null) <> (template_id is not null))
);

create table if not exists zigo.intent_examples (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references zigo.intent_catalogue(id) on delete cascade,
  example_text text not null,
  language_code text not null default 'en',
  review_status zigo.review_status not null default 'pending',
  source_request_id uuid references zigo.customer_requests(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists zigo.unmatched_request_queue (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references zigo.customer_requests(id) on delete cascade,
  ai_interpretation_id uuid references zigo.ai_interpretations(id) on delete set null,
  review_reason text not null,
  proposed_matches jsonb not null default '[]'::jsonb,
  status text not null default 'open',
  assigned_reviewer text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (status in ('open', 'triaged', 'awaiting_customer', 'escalated', 'resolved', 'declined'))
);

create table if not exists zigo.support_decisions (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references zigo.unmatched_request_queue(id) on delete cascade,
  decision text not null check (
    decision in (
      'reuse_task',
      'combine_tasks',
      'new_template_proposal',
      'new_primitive_proposal',
      'request_information',
      'decline'
    )
  ),
  selected_task_ids uuid[] not null default '{}',
  selected_template_id uuid references zigo.task_templates(id) on delete set null,
  rationale text not null,
  reviewer_id text not null,
  decided_at timestamptz not null default now()
);

create table if not exists zigo.master_change_proposals (
  id uuid primary key default gen_random_uuid(),
  source_queue_id uuid references zigo.unmatched_request_queue(id) on delete set null,
  proposal_type text not null check (
    proposal_type in ('intent_example', 'intent_mapping', 'template', 'primitive', 'rule_change')
  ),
  proposed_definition jsonb not null,
  justification text not null,
  status zigo.review_status not null default 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists zigo.master_versions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  approval_status zigo.review_status not null default 'pending',
  approved_by text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, version)
);

create table if not exists zigo.booking_pricing_policies (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version integer not null check (version > 0),
  booking_mode_id uuid references zigo.booking_modes(id) on delete set null,
  currency char(3) not null default 'INR',
  billing_increment_minutes integer not null check (billing_increment_minutes > 0),
  minimum_billable_minutes integer not null check (minimum_billable_minutes >= 0),
  hourly_rate numeric(12, 2) not null check (hourly_rate >= 0),
  surcharge_policy jsonb not null default '{}'::jsonb,
  travel_policy jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null,
  effective_until timestamptz,
  status zigo.lifecycle_status not null default 'draft',
  unique (code, version),
  check (effective_until is null or effective_until > effective_from)
);

create table if not exists zigo.booking_execution_plans (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references zigo.bookings(id) on delete cascade,
  template_id uuid references zigo.task_templates(id) on delete set null,
  plan_version integer not null check (plan_version > 0),
  ordered_steps jsonb not null,
  estimated_task_minutes integer not null default 0 check (estimated_task_minutes >= 0),
  estimated_travel_minutes integer not null default 0 check (estimated_travel_minutes >= 0),
  estimated_wait_minutes integer not null default 0 check (estimated_wait_minutes >= 0),
  billable_minutes integer not null default 0 check (billable_minutes >= 0),
  pricing_policy_id uuid references zigo.booking_pricing_policies(id) on delete set null,
  review_status zigo.review_status not null default 'pending',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (booking_id, plan_version)
);

create index if not exists idx_assistant_capabilities_capability
  on zigo.assistant_capabilities(capability_id, verification_status);

create index if not exists idx_assistant_availability_windows_time
  on zigo.assistant_availability_windows(assistant_id, starts_at, ends_at);

create index if not exists idx_customer_requests_customer_created
  on zigo.customer_requests(customer_id, created_at desc);

create index if not exists idx_bookings_customer_status
  on zigo.bookings(customer_id, status);

create index if not exists idx_booking_tasks_booking_status
  on zigo.booking_tasks(booking_id, status);

create index if not exists idx_assignments_booking_status
  on zigo.assignments(booking_id, status, assigned_at desc);

create index if not exists idx_booking_task_events_task_time
  on zigo.booking_task_events(booking_task_id, occurred_at);

create index if not exists idx_ai_interpretations_request
  on zigo.ai_interpretations(request_id, created_at desc);

create index if not exists idx_validation_results_request
  on zigo.validation_results(request_id, created_at desc);

create index if not exists idx_intent_examples_intent
  on zigo.intent_examples(intent_id, review_status);

create index if not exists idx_intent_task_mappings_active
  on zigo.intent_task_mappings(intent_id, status);

create index if not exists idx_unmatched_request_queue_status
  on zigo.unmatched_request_queue(status, created_at);

create index if not exists idx_support_decisions_queue
  on zigo.support_decisions(queue_id, decided_at);

create index if not exists idx_master_change_proposals_status
  on zigo.master_change_proposals(status, created_at);

create index if not exists idx_booking_execution_plans_booking
  on zigo.booking_execution_plans(booking_id, plan_version desc);
