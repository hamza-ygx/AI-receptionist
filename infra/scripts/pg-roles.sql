-- Run ONCE after `az deployment` as a member of the Postgres Entra admin group, from a host with
-- network access to the private server (Cloud Shell in the VNet, or a VM in snet-admin):
--   export PGPASSWORD=$(az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv)
--   psql "host=<postgresFqdn> dbname=postgres user=<admin-group-name> sslmode=require" \
--        -v jobs=func-rkjh-ai-prod-jobs -v dash=func-rkjh-ai-prod-dash -v media=vm-rkjh-ai-prod-media -f pg-roles.sql

SELECT * FROM pgaadauth_create_principal(:'jobs', false, false);
SELECT * FROM pgaadauth_create_principal(:'dash', false, false);
SELECT * FROM pgaadauth_create_principal(:'media', false, false);

\connect rkjh

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

GRANT CONNECT ON DATABASE rkjh TO :"jobs", :"dash", :"media";
ALTER SCHEMA public OWNER TO :"jobs";
GRANT USAGE ON SCHEMA public TO :"dash", :"media";
ALTER DEFAULT PRIVILEGES FOR ROLE :"jobs" IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"dash", :"media";
ALTER DEFAULT PRIVILEGES FOR ROLE :"jobs" IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO :"dash", :"media";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"dash", :"media";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"dash", :"media";
