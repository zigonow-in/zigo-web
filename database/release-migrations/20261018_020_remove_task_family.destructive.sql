-- Tasks and actions are reusable across all pillars and services.
drop index if exists zigo.idx_task_definitions_family_status;
alter table zigo.task_definitions
  drop column if exists task_family;
