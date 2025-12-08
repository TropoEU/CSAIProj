#!/bin/bash
# Fix n8n database schema conflict
# Run this script to clean up n8n tables from public schema and prepare for n8n schema isolation

echo "🔧 Fixing n8n database schema conflict..."
echo ""

# Load environment variables
source ./backend/.env

# Check if containers are running
if ! docker ps | grep -q "docker-postgres-1"; then
    echo "❌ Error: Postgres container is not running"
    echo "Start containers first: pnpm dockerup"
    exit 1
fi

echo "📋 Step 1: Stopping n8n container..."
docker compose --env-file ./backend/.env -f ./docker/docker-compose.yml stop n8n

echo "📋 Step 2: Cleaning up conflicting tables..."
docker exec -i docker-postgres-1 psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < fix-n8n.sql

if [ $? -eq 0 ]; then
    echo "✅ Database cleanup successful"
else
    echo "❌ Database cleanup failed"
    exit 1
fi

echo "📋 Step 3: Restarting n8n with new schema configuration..."
docker compose --env-file ./backend/.env -f ./docker/docker-compose.yml up -d n8n

echo ""
echo "✅ Fix complete! n8n is now using the 'n8n' schema."
echo "Wait a few seconds for n8n to initialize, then check:"
echo "  curl http://localhost:3000/health"
echo ""
