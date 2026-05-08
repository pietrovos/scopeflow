-- One-time database setup on Amazon RDS, run by the db-bootstrap ECS task as the RDS
-- master user (which has CREATEROLE/CREATEDB but is not a superuser). Same layout as
-- infra/postgres/init.sql for local development. Passwords arrive as psql variables.
--   psql -v owner_password=... -v app_password=... -v keycloak_password=... -f bootstrap-rds.sql
\set ON_ERROR_STOP on

CREATE ROLE scopeflow_owner LOGIN CREATEDB PASSWORD :'owner_password';
CREATE ROLE scopeflow_app LOGIN PASSWORD :'app_password';
CREATE ROLE keycloak LOGIN PASSWORD :'keycloak_password';

-- The master user needs membership to create databases owned by these roles and to set
-- default privileges on their behalf.
GRANT scopeflow_owner, keycloak TO CURRENT_USER;

CREATE DATABASE scopeflow OWNER scopeflow_owner;
CREATE DATABASE keycloak OWNER keycloak;

\connect scopeflow
ALTER SCHEMA public OWNER TO scopeflow_owner;
GRANT USAGE ON SCHEMA public TO scopeflow_app;
ALTER DEFAULT PRIVILEGES FOR ROLE scopeflow_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO scopeflow_app;
ALTER DEFAULT PRIVILEGES FOR ROLE scopeflow_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO scopeflow_app;
