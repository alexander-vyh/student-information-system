# Demo Credentials

These accounts are created by the seed script for local development.

## Staff Accounts

| Email | Password | Role | Description |
|-------|----------|------|-------------|
| admin@demo.edu | admin123 | Administrator | Full system access |
| registrar@demo.edu | registrar123 | Registrar | Registration and records |
| advisor@demo.edu | advisor123 | Advisor | Student advising |

## Student Accounts

| Email | Password | Student ID | Name |
|-------|----------|------------|------|
| student1@demo.edu | student123 | STU001 | Alice Student |
| student2@demo.edu | student123 | STU002 | Bob Learner |

## Quick Start

**One command to start everything:**

```bash
pnpm dev:setup
```

This single command will:
1. Start Docker containers (PostgreSQL, Redis, MinIO)
2. Wait for services to be ready
3. Run database migrations
4. Seed demo data (if not already seeded)
5. Start the development server

Then visit http://localhost:3000 and log in with any account above.

### Manual Setup (if needed)

```bash
# Start infrastructure
docker compose up -d

# Install dependencies
pnpm install

# Push database schema
pnpm db:push

# Seed demo data
pnpm db:seed

# Start development server
pnpm dev
```

## Notes

- These credentials only work in development mode
- The password hashing uses a temporary dev-only format (`dev_<password>`)
- Never use these credentials or this auth method in production
