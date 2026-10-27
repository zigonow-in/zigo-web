BEGIN;

ALTER TABLE IF EXISTS zigo.booking_billing_snapshots
  ADD COLUMN IF NOT EXISTS item_base_price_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS item_discount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS item_selling_price_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS item_taxable_after_discount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS item_tax_inclusive_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS item_tax_exclusive_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addon_total_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addon_discount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addon_taxable_after_discount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addon_tax_inclusive_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addon_tax_exclusive_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_delivery_charges_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_discount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_charges_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_discount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal_after_discount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pre_round_total_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rounding_adjustment_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_to_pay_paise bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS zigo.booking_item_charge_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL REFERENCES zigo.service_requests(id) ON DELETE CASCADE,
  line_sequence integer NOT NULL DEFAULT 1,
  item_type text NOT NULL DEFAULT 'category',
  service_id uuid,
  category_id uuid,
  service_name text NOT NULL DEFAULT '',
  category_name text NOT NULL DEFAULT '',
  base_price_paise bigint NOT NULL DEFAULT 0,
  discount_type text NOT NULL DEFAULT 'none',
  discount_value numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount_paise bigint NOT NULL DEFAULT 0,
  selling_price_paise bigint NOT NULL DEFAULT 0,
  taxable_after_discount_paise bigint NOT NULL DEFAULT 0,
  item_total_paise bigint NOT NULL DEFAULT 0,
  tax_inclusive_paise bigint NOT NULL DEFAULT 0,
  tax_exclusive_paise bigint NOT NULL DEFAULT 0,
  tax_amount_paise bigint NOT NULL DEFAULT 0,
  total_amount_paise bigint NOT NULL DEFAULT 0,
  rounding_adjustment_paise bigint NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_item_charge_lines_booking
  ON zigo.booking_item_charge_lines(service_request_id, line_sequence, created_at);

ALTER TABLE IF EXISTS zigo.booking_addon_charge_lines
  ADD COLUMN IF NOT EXISTS raw_gross_amount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_net_amount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxable_after_discount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_after_discount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inclusive_tax_amount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exclusive_tax_amount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rounding_adjustment_paise bigint NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS zigo.booking_add_on_payments
  ADD COLUMN IF NOT EXISTS raw_gross_amount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_net_amount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxable_after_discount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_after_discount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inclusive_tax_amount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exclusive_tax_amount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rounding_adjustment_paise bigint NOT NULL DEFAULT 0;

COMMIT;
