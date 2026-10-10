DROP TABLE IF EXISTS vapi_deletions;
ALTER TABLE calls DROP COLUMN IF EXISTS vapi_deleted_at;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS sip_call_id text;
