#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Student Information System - Dev Setup${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if Docker is running
echo -e "\n${YELLOW}[1/5] Checking Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Docker is not running. Please start Docker Desktop and try again.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Start Docker containers
echo -e "\n${YELLOW}[2/5] Starting infrastructure (PostgreSQL, Redis, MinIO)...${NC}"
docker compose -f docker/docker-compose.yml up -d

# Wait for PostgreSQL to be ready
echo -e "\n${YELLOW}[3/5] Waiting for PostgreSQL to be ready...${NC}"
RETRIES=30
until docker compose -f docker/docker-compose.yml exec -T postgres pg_isready -U sis -d sis > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
    echo "Waiting for PostgreSQL... ($RETRIES attempts remaining)"
    RETRIES=$((RETRIES-1))
    sleep 1
done

if [ $RETRIES -eq 0 ]; then
    echo -e "${RED}PostgreSQL failed to start. Check docker compose logs.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ PostgreSQL is ready${NC}"

# Build database package (needed for drizzle-kit to read compiled schema)
echo -e "\n${YELLOW}[4/6] Building database package...${NC}"
pnpm --filter @sis/db build

# Run database migrations
echo -e "\n${YELLOW}[5/6] Running database migrations...${NC}"
pnpm db:migrate

# Check if seed data exists and seed if needed
echo -e "\n${YELLOW}[6/6] Checking seed data...${NC}"
SEED_CHECK=$(docker compose -f docker/docker-compose.yml exec -T postgres psql -U sis -d sis -tAc "SELECT COUNT(*) FROM identity.users" 2>/dev/null || echo "0")

if [ "$SEED_CHECK" = "0" ] || [ -z "$SEED_CHECK" ]; then
    echo "No users found. Running seed script..."
    pnpm db:seed
    echo -e "${GREEN}✓ Database seeded with demo data${NC}"
else
    echo -e "${GREEN}✓ Database already has data ($SEED_CHECK users)${NC}"
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\nDemo Credentials:"
echo -e "  Admin:     admin@demo.edu / admin123"
echo -e "  Registrar: registrar@demo.edu / registrar123"
echo -e "  Student:   student1@demo.edu / student123"
echo -e "\n${YELLOW}Starting development server...${NC}\n"

# Start the dev server
exec pnpm dev
