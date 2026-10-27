-- Add the business tax category while preserving the existing percent/flat calculation type.
alter table zigo.tax_master_rules
  add column if not exists tax_category text not null default 'service';

update zigo.tax_master_rules
set tax_category = 'service'
where tax_category is null or btrim(tax_category) = '';
