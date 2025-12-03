-- Runs once when the Postgres volume is first created.
--
-- scopeflow_owner owns the schema and runs migrations. Because it owns the tables
-- (and RLS is not FORCEd), it bypasses row-level security. The API uses it only for
-- the few system paths listed in apps/api/src/db/README.md.
--
-- scopeflow_app is what the API uses for every tenant request. It has DML rights only,
-- so every query it runs is filtered by the RLS policies.
CREATE ROLE scopeflow_owner LOGIN PASSWORD 'scopeflow_owner' CREATEDB;
CREATE ROLE scopeflow_app LOGIN PASSWORD 'scopeflow_app';

CREATE DATABASE scopeflow OWNER scopeflow_owner;
CREATE DATABASE scopeflow_test OWNER scopeflow_owner;
CREATE DATABASE keycloak OWNER scopeflow_owner;

\connect scopeflow
ALTER SCHEMA public OWNER TO scopeflow_owner;
GRANT USAGE ON SCHEMA public TO scopeflow_app;
ALTER DEFAULT PRIVILEGES FOR ROLE scopeflow_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO scopeflow_app;
ALTER DEFAULT PRIVILEGES FOR ROLE scopeflow_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO scopeflow_app;

\connect scopeflow_test
ALTER SCHEMA public OWNER TO scopeflow_owner;
GRANT USAGE ON SCHEMA public TO scopeflow_app;
ALTER DEFAULT PRIVILEGES FOR ROLE scopeflow_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO scopeflow_app;
ALTER DEFAULT PRIVILEGES FOR ROLE scopeflow_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO scopeflow_app;
