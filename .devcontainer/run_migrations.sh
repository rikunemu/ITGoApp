#!/bin/sh
set -eu

# Wait for DB to be ready
echo "Waiting for PostgreSQL at ${DATABASE_HOST}:${DATABASE_PORT}..."
until pg_isready -h "${DATABASE_HOST}" -p "${DATABASE_PORT}" -U "${DATABASE_USER}" -d "${DATABASE_NAME}" >/dev/null 2>&1; do
  sleep 1
done

echo "Postgres is ready. Applying migrations..."

MIGRATION_DIR=".devcontainer/migrations"
if [ ! -d "$MIGRATION_DIR" ]; then
  echo "No migrations directory found at $MIGRATION_DIR"
  exit 0
fi

for f in "$MIGRATION_DIR"/*.sql; do
  [ -e "$f" ] || continue
  echo "Applying $f"
  PGPASSWORD="$DATABASE_PASSWORD" psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -v ON_ERROR_STOP=1 -f "$f" || {
    echo "Warning: applying $f failed (continuing)." >&2
  }
done

echo "Migrations done."
