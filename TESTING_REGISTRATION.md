# Testing Student Registration Feature

This guide explains how to test the new student self-registration feature in the SIS.

## Quick Start

```bash
# 1. Start Docker services (PostgreSQL, Redis, MinIO)
docker compose -f docker/docker-compose.yml up -d

# 2. Push database schema
pnpm db:push

# 3. Seed demo data (100 students, 30 courses, 3 terms)
pnpm db:seed

# 4. Start development server
pnpm dev

# 5. Navigate to http://localhost:3000
```

## Demo User Credentials

The seed script creates test users with these credentials:

- **Student**: `student@demo.edu` / `student123`
- **Admin**: `admin@demo.edu` / `admin123`
- **Registrar**: `registrar@demo.edu` / `registrar123`

## Registration Term Setup

The demo data includes three terms:

| Term | Code | Registration Window | Purpose |
|------|------|---------------------|---------|
| **Spring 2026** | SP26 | Dec 1, 2025 - Jan 17, 2026 | **ACTIVE** - Primary testing term |
| Summer 2026 | SU26 | Mar 1 - May 20, 2026 | Future - Registration not yet open |
| Fall 2025 | FA25 | Apr 1 - Aug 30, 2025 | Past - Registration closed |

**Note:** Spring 2026 registration is currently OPEN, making it perfect for testing.

## Testing the Registration Workflow

### 1. Term Selection
- Log in as a student
- Navigate to **Registration** from the sidebar
- Select "Spring 2026" from the term dropdown
- Verify you see the search interface

### 2. Section Search
Test the search functionality:

- **By Course Code**: Enter "CSCI 101" to find Computer Science courses
- **By Title**: Enter "Introduction" to find intro-level courses
- **By Subject**: Enter "MATH" in the subject filter for all math courses

Expected behavior:
- Results display in real-time
- Each section shows:
  - Course code and title
  - Available seats (e.g., "15 of 30 seats available")
  - Status badge (Open / Waitlist Available / Closed)
  - Instructional method (In Person / Online / Hybrid)

### 3. Shopping Cart

Add sections to cart and test validation:

**Test Case 1: Add Open Section**
- Click "Add to Cart" on a section with available seats
- Section moves to cart with validation status
- Should show green checkmark "Ready to register"

**Test Case 2: Prerequisites**
- Try adding upper-level courses (300/400 level)
- If prerequisites aren't met, red error appears
- Message shows which course is required

**Test Case 3: Schedule Conflicts**
- Add a section (e.g., "MATH 101 - Section 01" MWF 9:00-9:50am)
- Try adding another section with overlapping times
- Cart validation shows red conflict error
- Error specifies conflicting course and day/time

**Test Case 4: Capacity Warnings**
- Add a section that's nearly full (90%+ enrolled)
- Yellow warning appears: "Section is nearly full"
- Can still register, but warned seats are limited

**Test Case 5: Full Section**
- Find a section marked "Closed" (current enrollment = max enrollment)
- "Add to Cart" button is disabled
- Cannot be added to cart

### 4. Grade Mode Selection

For each section in cart:
- Change grade mode dropdown (Letter Grade / Pass-Fail / Audit)
- Verify selection persists
- All modes should be selectable

### 5. Cart Validation

The cart validates in real-time:

**Global Errors** (blocks all registration):
- Registration holds on student account
- Term mismatch (sections from different terms)

**Section Errors** (blocks that specific section):
- Prerequisites not met
- Schedule conflict with another cart item
- Already enrolled or waitlisted
- Section is full

**Warnings** (allows registration but alerts):
- Section is nearly full

### 6. Registration Submission

**Success Path:**
1. Add 3-4 compatible sections to cart (no conflicts, no holds)
2. Verify all show green "Ready to register" status
3. Click "Register Now" button
4. Success alert appears
5. Cart clears automatically
6. Sections appear in "Current Schedule" section

**Failure Path:**
1. Add sections with conflicts or unmet prerequisites
2. Observe red validation errors in cart
3. "Register Now" button is disabled (grayed out)
4. Error message shows: "Cannot register - fix errors above"

## Advanced Test Scenarios

### Schedule Conflict Detection

Create time conflicts to test validation:

1. Add "MATH 101-01" (MWF 9:00-9:50am)
2. Try adding "CSCI 101-01" (MWF 9:30-10:20am)
3. Cart should show: "Schedule conflict with MATH 101 on M, W, F"

### Credit Hour Limits

- Add multiple sections to cart
- Watch the "Total Credits" counter update
- Typical semester: 12-18 credits
- System allows up to 10 sections per transaction

### Registration Holds

To test hold blocking:

1. Use Drizzle Studio or admin interface to add a hold:
   ```sql
   INSERT INTO enrollment.registration_holds
   (student_id, hold_type_id, blocks_registration, description)
   VALUES
   ('<student_id>', '<hold_type_id>', true, 'Outstanding balance');
   ```
2. Attempt registration
3. Cart shows global error: "Registration hold present"

## Database Inspection

Use Drizzle Studio to inspect data:

```bash
pnpm db:studio
```

Navigate to:
- **`curriculum.sections`** - View section enrollment levels
- **`enrollment.registrations`** - See all student registrations
- **`core.terms`** - Check registration windows

## API Testing with tRPC

You can also test the backend directly via tRPC panel (if enabled) or browser console:

```typescript
// Get available terms
await trpc.enrollment.getAvailableTerms.query();

// Search sections
await trpc.enrollment.searchAvailableSections.query({
  termId: "<spring-2026-id>",
  query: "Introduction",
  availableOnly: true,
});

// Validate cart
await trpc.enrollment.validateRegistrationCart.query({
  studentId: "<student-id>",
  termId: "<term-id>",
  sectionIds: ["<section-1>", "<section-2>"],
});

// Register
await trpc.enrollment.registerForSections.mutate({
  studentId: "<student-id>",
  termId: "<term-id>",
  sections: [
    { sectionId: "<section-1>", gradeMode: "standard" },
    { sectionId: "<section-2>", gradeMode: "standard" },
  ],
});
```

## Expected Section Availability Distribution

The seed script creates varied availability:

- **~33% Empty sections** (0 students) - Easy to register
- **~33% Half-full** (~50% enrolled) - Moderate availability
- **~20% Nearly full** (>90% enrolled) - Tests capacity warnings
- **~14% Few seats** (1-5 students) - Mixed scenarios

This distribution ensures you can test all UI states (open/warning/waitlist/closed).

## Troubleshooting

**Issue**: No terms appear in dropdown
- **Fix**: Ensure seed script ran successfully. Check `core.terms` table has records with `registrationStartDate <= NOW()`.

**Issue**: All sections show "Closed"
- **Fix**: Seed may have created full sections. Re-run `pnpm db:seed` or manually reduce `currentEnrollment` in database.

**Issue**: Validation never completes (stuck on "Validating...")
- **Fix**: Check browser console for tRPC errors. Verify API server is running on port 3000.

**Issue**: "Cannot access student" error
- **Fix**: Ensure you're logged in as a user with STUDENT role. Check `identity.user_roles` table.

## Demo Data Summary

After running `pnpm db:seed`:

- **100 students** with varied academic histories
- **30 courses** across 4 subjects (Computer Science, Mathematics, Psychology, Business)
- **3 sections per course** = ~90 sections per term
- **3 terms** (Fall 2025, Spring 2026, Summer 2026)
- **1 open registration window** (Spring 2026)

## Next Steps for Production

Before deploying to production:

1. **Compliance**: Re-enable FERPA audit logging
2. **Testing**: Add unit tests for validation logic
3. **Capacity**: Increase student count (500-5000)
4. **Real Data**: Import actual courses, prerequisites, and students
5. **Registration Appointments**: Implement priority registration windows
6. **Payment Integration**: Connect to bursar system for holds/balances
