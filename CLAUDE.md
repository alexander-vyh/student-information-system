# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **modern, self-hostable Student Information System (SIS)** for higher education institutions (100-10,000 students). Built with:

- **Frontend**: Next.js 15 (App Router) + React + TailwindCSS
- **API**: tRPC v11 (end-to-end type safety)
- **ORM**: Drizzle ORM (SQL-first, fast, excellent TypeScript inference)
- **Database**: PostgreSQL 16
- **Cache/Queue**: Redis 7 + BullMQ
- **Storage**: MinIO (S3-compatible)
- **Auth**: NextAuth.js v5 (SAML/OIDC federation)

## Repository Structure

```
student-information-system/
├── apps/
│   └── web/                    # Next.js 15 application
│       ├── src/
│       │   ├── app/            # App Router pages
│       │   ├── components/     # React components
│       │   ├── lib/            # Client utilities
│       │   └── trpc/           # tRPC client setup
│       └── ...
├── packages/
│   ├── db/                     # Drizzle ORM schemas & client
│   │   └── src/schema/         # Database schemas by domain
│   ├── api/                    # tRPC routers
│   │   └── src/routers/        # Domain-specific routers
│   ├── domain/                 # Pure business logic
│   │   └── src/{gpa,sap,r2t4}/ # Calculators (no DB deps)
│   └── typescript-config/      # Shared TS configs
├── docker/                     # Docker Compose + init scripts
└── .claude/agents/             # Domain expert agents
```

## Key Commands

```bash
# Install dependencies
pnpm install

# Start development (Docker services + Next.js)
docker compose -f docker/docker-compose.yml up -d
pnpm dev

# Database operations
pnpm db:generate    # Generate migrations from schema
pnpm db:migrate     # Run migrations
pnpm db:push        # Push schema directly (dev only)
pnpm db:studio      # Open Drizzle Studio

# Build and type check
pnpm build
pnpm typecheck
```

## Database Schemas

Schemas are organized by domain in `packages/db/src/schema/`:

| Schema | Purpose |
|--------|---------|
| `core` | Institutions, terms, campuses, calendar |
| `identity` | Users, roles, permissions, audit logs (FERPA) |
| `student` | Bio-demo, programs, advisors, GPA summary |
| `curriculum` | Courses, sections, catalog, grade scales |
| `enrollment` | Registrations, grades, transfers, holds |
| `financial` | Accounts, ledger, payment plans, 1098-T |
| `aid` | ISIR, awards, SAP, R2T4, disbursements |

## Domain Logic (packages/domain)

Pure TypeScript business logic with no database dependencies:

- **GPA Calculator** (`@sis/domain/gpa`) - Cumulative/term GPA, repeat policies
- **SAP Calculator** (`@sis/domain/sap`) - Satisfactory Academic Progress per 34 CFR 668.34
- **R2T4 Calculator** (`@sis/domain/r2t4`) - Return to Title IV per 34 CFR 668.22

These are fully unit-testable with no mocking required.

## API Layer (packages/api)

tRPC routers with type-safe procedures:

```typescript
// Protected procedure with FERPA access control
export const studentRouter = router({
  getById: protectedProcedure
    .input(z.object({ studentId: z.string().uuid() }))
    .use(canAccessStudent((input) => input.studentId))
    .query(async ({ ctx, input }) => {
      // FERPA-compliant data access
    }),
});
```

## Domain Expert Agents

14 specialized agents in `.claude/agents/` provide domain expertise:

### Domain/Functional Experts
- `financial-aid-expert` - Title IV, FAFSA, SAP, R2T4, disbursement
- `registrar-expert` - Academic records, FERPA, transcripts, degree audit
- `bursar-expert` - Student accounts, billing, payments, 1098-T
- `admissions-expert` - Applications, decisions, yield, recruitment
- `academic-affairs-expert` - Curriculum, scheduling, catalog
- `irs-1098t-expert` - Tax reporting, FIRE system, qualified tuition
- `student-success-expert` - Retention, early alerts, advising
- `international-student-expert` - SEVIS, I-20, F-1/J-1 visas

### Compliance/Regulatory
- `ferpa-compliance-expert` - Student privacy, access logging
- `accreditation-expert` - HLC/SACSCOC, IPEDS, assessment
- `accessibility-expert` - WCAG 2.1, Section 508, ADA

### Technical Architecture
- `security-architect` - IAM, RBAC, PCI-DSS, audit
- `integration-architect` - COD, NSLDS, SEVIS, LMS
- `data-architect` - Data modeling, ETL, IPEDS

### Project Management
- `higher-ed-pm` - Implementation methodology, change management

## Compliance Requirements

This SIS must comply with:

- **FERPA** - Access logging, legitimate educational interest
- **Title IV** - Federal aid regulations (34 CFR Parts 668, 682, 685, 690)
- **IRS 1098-T** - Tax reporting for qualified tuition
- **SEVIS** - International student immigration reporting
- **PCI-DSS** - Payment card security (tokenization)
- **WCAG 2.1 AA** - Digital accessibility

## Development Guidelines

1. **Type Safety First** - Use Zod schemas for all inputs, leverage Drizzle inference
2. **Pure Domain Logic** - Business calculations go in `packages/domain`, no DB deps
3. **FERPA Compliance** - All student data access must be logged and authorized
4. **Security** - Field-level encryption for SSN, no raw card data storage
5. **Testing** - Unit test domain logic, integration test tRPC procedures

## Reference Documents

Original requirements are in `.extracted/`:
- `essential-functions/` - 722 university operational processes
- `sis-processes/` - SIS capability requirements
