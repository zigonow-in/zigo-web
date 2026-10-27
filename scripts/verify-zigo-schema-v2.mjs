import "dotenv/config";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const target = new URL(connectionString);
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
if (!localHosts.has(target.hostname.toLowerCase())) {
  throw new Error(`V2 verification is local-only; refused database host ${target.hostname}.`);
}

const requiredTables = [
  "service_pillars",
  "service_pillar_mappings",
  "service_category_masters",
  "service_category_pillar_mappings",
  "service_category_service_mappings",
  "task_definitions",
  "service_task_mappings",
  "task_input_definitions",
  "workflow_templates",
  "workflow_steps",
  "capabilities",
  "task_capability_requirements",
  "validation_rules",
  "duration_rules",
  "task_pricing_rules",
  "question_templates",
  "completion_rules",
  "policy_rules",
  "exception_types",
  "service_zones",
  "task_zone_availability",
  "booking_modes",
  "assistant_capabilities",
  "assistant_availability_windows",
  "customer_requests",
  "bookings",
  "booking_tasks",
  "booking_task_inputs",
  "booking_task_dependencies",
  "quotes",
  "quote_lines",
  "assignments",
  "booking_task_events",
  "completion_evidence",
  "expense_items",
  "operational_exceptions",
  "ai_conversations",
  "ai_messages",
  "ai_interpretations",
  "clarification_requests",
  "validation_results",
  "audit_logs",
  "system_settings",
  "task_primitives",
  "task_primitive_mappings",
  "task_templates",
  "task_template_steps",
  "intent_catalogue",
  "intent_task_mappings",
  "intent_examples",
  "unmatched_request_queue",
  "support_decisions",
  "master_change_proposals",
  "master_versions",
  "booking_pricing_policies",
  "booking_execution_plans"
];

const expected = {
  pillars: 5,
  services: 25,
  tasks: 119,
  serviceTaskMappings: 119,
  bookingModes: 5
};

const client = new pg.Client({
  connectionString,
  application_name: "zigo-v2-schema-verification"
});

await client.connect();
try {
  const identity = (await client.query(`
    select current_database() as database,
      coalesce(inet_server_addr()::text, 'local-socket') as "serverAddress"
  `)).rows[0];

  const tablesResult = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'zigo'
      and table_type = 'BASE TABLE'
  `);
  const tables = new Set(tablesResult.rows.map((row) => row.table_name));
  const missingTables = requiredTables.filter((table) => !tables.has(table));
  if (missingTables.length) {
    throw new Error(`Missing V2 tables: ${missingTables.join(", ")}`);
  }

  const typeResult = await client.query(`
    select t.typname
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'zigo'
      and t.typname = any($1::text[])
  `, [["lifecycle_status", "review_status", "booking_status", "task_status"]]);
  if (typeResult.rowCount !== 4) {
    throw new Error("One or more V2 enum types are missing.");
  }

  const counts = (await client.query(`
    select
      (select count(*)::int from zigo.service_pillars
        where code in ('PERSONAL_LIFE', 'FAMILY', 'TRAVEL', 'HOME', 'BUSINESS_NEEDS')) as pillars,
      (select count(*)::int from zigo.services
        where metadata ->> 'catalogSource' = 'zigo_personal_assistant_v2'
          and is_deleted = false) as services,
      (select count(*)::int from zigo.task_definitions
        where metadata ->> 'catalogSource' = 'zigo_personal_assistant_v2') as tasks,
      (select count(*)::int
        from zigo.service_task_mappings mapping
        join zigo.task_definitions task on task.id = mapping.task_id
        where task.metadata ->> 'catalogSource' = 'zigo_personal_assistant_v2') as "serviceTaskMappings",
      (select count(*)::int from zigo.booking_modes
        where code in ('TASK', 'MULTI_TASK', 'ASSISTANT_3H', 'ASSISTANT_6H', 'ASSISTANT_8H')) as "bookingModes",
      (select count(*)::int from zigo.services
        where metadata ->> 'catalogSource' = 'zigo_personal_assistant_v2'
          and is_deleted = false
          and (is_active or is_enabled or status <> 'draft')) as "unsafeServices",
      (select count(*)::int from zigo.task_definitions
        where metadata ->> 'catalogSource' = 'zigo_personal_assistant_v2'
          and status <> 'draft') as "unsafeTasks",
      (select count(*)::int
        from zigo.service_pillar_mappings mapping
        join zigo.services service on service.id = mapping.service_id
        where service.metadata ->> 'catalogSource' = 'zigo_personal_assistant_v2'
        group by mapping.service_id
        having count(*) filter (where mapping.is_primary) <> 1
        limit 1) as "invalidPrimaryPillar",
      (select count(*)::int
        from zigo.service_task_mappings mapping
        left join zigo.services service on service.id = mapping.service_id
        left join zigo.task_definitions task on task.id = mapping.task_id
        where service.id is null or task.id is null) as "orphanMappings"
  `)).rows[0];

  for (const [key, expectedValue] of Object.entries(expected)) {
    if (counts[key] !== expectedValue) {
      throw new Error(`Unexpected ${key} count: expected ${expectedValue}, received ${counts[key]}.`);
    }
  }
  if (counts.unsafeServices !== 0 || counts.unsafeTasks !== 0) {
    throw new Error("V2 catalog content must remain disabled and in draft until approved.");
  }
  if (counts.invalidPrimaryPillar != null || counts.orphanMappings !== 0) {
    throw new Error("V2 catalog relationship integrity check failed.");
  }

  console.log(JSON.stringify({
    target: `${target.hostname}:${target.port || "5432"}/${identity.database}`,
    serverAddress: identity.serverAddress,
    schema: "zigo",
    tablesVerified: requiredTables.length,
    ...counts,
    result: "passed"
  }, null, 2));
} finally {
  await client.end();
}
