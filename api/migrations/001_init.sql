CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('admin', 'staff');
CREATE TYPE call_outcome AS ENUM ('faq_answered', 'booked', 'transferred', 'message_taken', 'abandoned');
CREATE TYPE urgency AS ENUM ('low', 'normal', 'high');
CREATE TYPE meeting_type AS ENUM ('phone', 'teams', 'office');
CREATE TYPE transfer_status AS ENUM ('requested', 'dialing', 'connected', 'no_answer', 'busy', 'failed', 'cancelled', 'refused');
CREATE TYPE call_language AS ENUM ('sv', 'en');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE CHECK (email ~* '^[^@\s]+@rkjh\.se$'),
  display_name text NOT NULL,
  password_hash text NOT NULL,
  role user_role NOT NULL DEFAULT 'staff',
  totp_secret_enc text,
  totp_last_step bigint,
  mfa_enabled boolean NOT NULL DEFAULT false,
  recovery_codes_hash text[] NOT NULL DEFAULT '{}',
  failed_count int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  lockouts int NOT NULL DEFAULT 0,
  disabled_at timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token text NOT NULL,
  mfa_passed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  user_agent text
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_last_seen_idx ON sessions(last_seen_at);

CREATE TABLE invites (
  token_hash text PRIMARY KEY,
  email citext NOT NULL CHECK (email ~* '^[^@\s]+@rkjh\.se$'),
  display_name text NOT NULL,
  role user_role NOT NULL,
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE password_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE login_attempts (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target text,
  detail jsonb,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_at_idx ON audit_log(at);

CREATE TABLE staff (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]+$'),
  name text NOT NULL,
  role text NOT NULL,
  direct_phone_e164 text CHECK (direct_phone_e164 IS NULL OR direct_phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  upn citext,
  teams_webhook_ref text,
  languages call_language[] NOT NULL DEFAULT '{sv}',
  transferable boolean NOT NULL DEFAULT false,
  bookable boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staff_name_trgm_idx ON staff USING gin (name gin_trgm_ops);

CREATE TABLE staff_topics (
  staff_id text NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  topic text NOT NULL,
  PRIMARY KEY (staff_id, topic)
);
CREATE INDEX staff_topics_trgm_idx ON staff_topics USING gin (topic gin_trgm_ops);

CREATE TABLE topic_aliases (
  alias text PRIMARY KEY,
  topic text NOT NULL
);
CREATE INDEX topic_aliases_trgm_idx ON topic_aliases USING gin (alias gin_trgm_ops);

CREATE TABLE settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE calls (
  id text PRIMARY KEY,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_s int,
  language call_language,
  caller_number_e164 text,
  caller_name text,
  company text,
  callback_number text,
  reason text,
  outcome call_outcome NOT NULL DEFAULT 'abandoned',
  urgency urgency,
  staff_id text REFERENCES staff(id) ON DELETE SET NULL,
  summary_sv text,
  transcript text,
  ended_reason text,
  cost_total numeric(10,4),
  cost_breakdown jsonb,
  vapi_deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  search tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('swedish', coalesce(caller_name, '') || ' ' || coalesce(company, '')), 'A') ||
    setweight(to_tsvector('swedish', coalesce(reason, '') || ' ' || coalesce(summary_sv, '')), 'B')
  ) STORED
);
CREATE INDEX calls_started_idx ON calls(started_at DESC);
CREATE INDEX calls_outcome_idx ON calls(outcome);
CREATE INDEX calls_staff_idx ON calls(staff_id);
CREATE INDEX calls_search_idx ON calls USING gin(search);

CREATE TABLE call_events (
  call_id text NOT NULL,
  kind text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (call_id, kind)
);

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id text NOT NULL,
  staff_id text NOT NULL REFERENCES staff(id),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  meeting_type meeting_type NOT NULL,
  topic text NOT NULL,
  caller_name text NOT NULL,
  company text,
  phone_e164 text NOT NULL,
  email text,
  graph_event_id text,
  teams_join_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (call_id, staff_id, start_at),
  CHECK (end_at > start_at)
);
CREATE INDEX bookings_call_idx ON bookings(call_id);
CREATE INDEX bookings_staff_start_idx ON bookings(staff_id, start_at);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id text NOT NULL,
  staff_id text REFERENCES staff(id) ON DELETE SET NULL,
  caller_name text NOT NULL,
  company text,
  phone_e164 text NOT NULL,
  reason text NOT NULL,
  urgency urgency NOT NULL DEFAULT 'normal',
  language call_language,
  teams_posted_at timestamptz,
  handled_at timestamptz,
  handled_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_call_idx ON messages(call_id);
CREATE INDEX messages_created_idx ON messages(created_at DESC);

CREATE TABLE transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id text NOT NULL,
  staff_id text NOT NULL REFERENCES staff(id),
  reason text,
  caller_name text,
  company text,
  status transfer_status NOT NULL DEFAULT 'requested',
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transfers_call_idx ON transfers(call_id, created_at DESC);

CREATE TABLE tool_calls (
  call_id text NOT NULL,
  tool text NOT NULL,
  count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (call_id, tool)
);

CREATE TABLE tool_call_results (
  tool_call_id text PRIMARY KEY,
  call_id text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vapi_deletions (
  call_id text PRIMARY KEY,
  requested_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE daily_rollups (
  day date NOT NULL,
  language text NOT NULL,
  outcome text NOT NULL,
  calls int NOT NULL DEFAULT 0,
  total_duration_s bigint NOT NULL DEFAULT 0,
  total_cost numeric(12,4) NOT NULL DEFAULT 0,
  bookings int NOT NULL DEFAULT 0,
  transfers_attempted int NOT NULL DEFAULT 0,
  transfers_connected int NOT NULL DEFAULT 0,
  messages int NOT NULL DEFAULT 0,
  hour_histogram int[] NOT NULL DEFAULT array_fill(0, ARRAY[24]),
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, language, outcome)
);

CREATE TABLE faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_sv text NOT NULL,
  answer_sv text NOT NULL,
  question_en text,
  answer_en text,
  tags text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  embedding vector(1536),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  tsv_sv tsvector GENERATED ALWAYS AS (to_tsvector('swedish', question_sv || ' ' || answer_sv)) STORED,
  tsv_en tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(question_en, '') || ' ' || coalesce(answer_en, ''))) STORED
);
CREATE INDEX faqs_tsv_sv_idx ON faqs USING gin(tsv_sv);
CREATE INDEX faqs_tsv_en_idx ON faqs USING gin(tsv_en);

CREATE TABLE kb_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  title text,
  lang call_language NOT NULL DEFAULT 'sv',
  content_hash text NOT NULL,
  text text NOT NULL,
  tokens int NOT NULL DEFAULT 0,
  etag text,
  last_modified text,
  status text NOT NULL DEFAULT 'active',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE kb_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES kb_pages(id) ON DELETE CASCADE,
  ord int NOT NULL,
  lang call_language NOT NULL,
  text text NOT NULL,
  tokens int NOT NULL,
  embedding vector(1536),
  tsv tsvector NOT NULL,
  UNIQUE (page_id, ord)
);
CREATE INDEX kb_chunks_tsv_idx ON kb_chunks USING gin(tsv);
CREATE INDEX kb_chunks_embedding_idx ON kb_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX faqs_embedding_idx ON faqs USING hnsw (embedding vector_cosine_ops);

CREATE TABLE scrape_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  pages_seen int NOT NULL DEFAULT 0,
  pages_changed int NOT NULL DEFAULT 0,
  pages_removed int NOT NULL DEFAULT 0,
  corpus_tokens int,
  retrieval_mode text,
  errors jsonb NOT NULL DEFAULT '[]'
);
