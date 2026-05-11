#!/bin/sh
set -e

# Fail fast if DATABASE_URL is not set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL is not set. Aborting."
    exit 1
fi

echo "Waiting for PostgreSQL..."
RETRIES=30
until python -c "
import os, sys, psycopg2
try:
    psycopg2.connect(os.environ['DATABASE_URL'])
except Exception as e:
    print(f'DB check failed: {e}', file=sys.stderr)
    raise SystemExit(1)
"; do
    RETRIES=$((RETRIES - 1))
    if [ "$RETRIES" -le 0 ]; then
        echo "ERROR: PostgreSQL did not become ready after 30 attempts. Aborting."
        exit 1
    fi
    echo "PostgreSQL not ready — retrying in 2s... ($RETRIES attempts left)"
    sleep 2
done

echo "PostgreSQL ready. Running migrations..."
alembic upgrade head

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info
