-- Run ONCE after `az deployment` as a member of the Postgres Entra admin group, from a host with
-- network access to the private server (Cloud Shell in the VNet, or a VM in snet-admin):
--   export PGPASSWORD=$(az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv)
--   psql "host=<postgresFqdn> dbname=postgres user=<admin-group-name> sslmode=require" \
--        -v voice=func-rkjh-ai-prod-voice -v dash=func-rkjh-ai-prod-dash -f pg-roles.sql

SELECT * FROM pgaadauth_create_principal(:'voice', false, false);
SELECT * FROM pgaadauth_create_principal(:'dash', false, false);

\connect rkjh

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

GRANT CONNECT ON DATABASE rkjh TO :"voice", :"dash";
ALTER SCHEMA public OWNER TO :"voice";
GRANT USAGE ON SCHEMA public TO :"dash";
ALTER DEFAULT PRIVILEGES FOR ROLE :"voice" IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"dash";
ALTER DEFAULT PRIVILEGES FOR ROLE :"voice" IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO :"dash";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"dash";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"dash";
