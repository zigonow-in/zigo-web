BEGIN;

CREATE TABLE IF NOT EXISTS zigo.support_reply_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_code varchar(20) NOT NULL CHECK (channel_code IN ('customer', 'assistant')),
  reply_type varchar(20) NOT NULL CHECK (reply_type IN ('quick', 'auto')),
  title varchar(160) NOT NULL,
  description text NOT NULL,
  icon_url text,
  is_active boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  created_by uuid REFERENCES zigo.users(id),
  updated_by uuid REFERENCES zigo.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_reply_templates_channel_type
  ON zigo.support_reply_templates (channel_code, reply_type, is_active, created_at);

COMMIT;
