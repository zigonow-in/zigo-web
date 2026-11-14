BEGIN;

ALTER TABLE IF EXISTS zigo.customer_support_tickets
  ADD COLUMN IF NOT EXISTS admin_read_at timestamptz;

ALTER TABLE IF EXISTS zigo.assistant_support_tickets
  ADD COLUMN IF NOT EXISTS admin_read_at timestamptz;

UPDATE zigo.customer_support_tickets
SET admin_read_at = last_message_at
WHERE admin_read_at IS NULL;

DO $$
BEGIN
  IF to_regclass('zigo.assistant_support_tickets') IS NOT NULL THEN
    EXECUTE 'UPDATE zigo.assistant_support_tickets SET admin_read_at = last_message_at WHERE admin_read_at IS NULL';
  END IF;
END $$;

COMMIT;
