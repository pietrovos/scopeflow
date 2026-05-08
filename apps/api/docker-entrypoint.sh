#!/bin/sh
# Builds the two database URLs from parts when they aren't given whole. On ECS the
# passwords come from Secrets Manager as separate variables.
set -e
if [ -z "$DATABASE_URL" ] && [ -n "$DB_HOST" ]; then
  export DATABASE_URL="postgresql://scopeflow_app:${DB_APP_PASSWORD}@${DB_HOST}:${DB_PORT:-5432}/${DB_NAME:-scopeflow}"
  export DATABASE_OWNER_URL="postgresql://scopeflow_owner:${DB_OWNER_PASSWORD}@${DB_HOST}:${DB_PORT:-5432}/${DB_NAME:-scopeflow}"
fi
exec "$@"
