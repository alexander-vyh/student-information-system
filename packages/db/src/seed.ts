/**
 * Database Seed Script
 *
 * Generates comprehensive test data using @faker-js/faker
 * Run with: pnpm --filter @sis/db db:seed
 */

import "dotenv/config";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { db } from "./index.js";
import {
  institutions,
  campuses,
  terms,
  buildings,
  rooms,
  users,
  roles,
  userRoles,
  students,
  studentPrograms,
  studentGpaSummary,
  colleges,
  departments,
  subjects,
  courses,
  sections,
  registrations,
  gradeScales,
  grades,
  programs,
  degreeTypes,
  catalogYears,
  academicStandingPolicies,
  academicStandingHistory,
  academicStandingAppeals,
  requirementCategories,
  programRequirements,
  requirementCourses,
  holdTypes,
  sectionAssignments,
  instructorAssignments,
  accounts,
  chargeCodes,
  ledgerEntries,
  financialHolds,
  paymentPlans,
  paymentPlanInstallments,
} from "./schema/index.js";

// Use fixed seed for reproducibility
faker.seed(42);

// Pre-compute bcrypt hashes (synchronous for seed script simplicity)
// Using cost factor 10 for faster seeding; production uses 12
const BCRYPT_ROUNDS = 10;
const passwordHashes = {
  admin: bcrypt.hashSync("admin123", BCRYPT_ROUNDS),
  registrar: bcrypt.hashSync("registrar123", BCRYPT_ROUNDS),
  advisor: bcrypt.hashSync("advisor123", BCRYPT_ROUNDS),
  faculty: bcrypt.hashSync("faculty123", BCRYPT_ROUNDS),
  student: bcrypt.hashSync("student123", BCRYPT_ROUNDS),
};

// Configuration
const CONFIG = {
  numStudents: 100, // Reduced for alpha testing
  termsPerStudent: { min: 2, max: 4 }, // Fewer historical terms
  coursesPerTerm: { min: 3, max: 5 },
  numFaculty: 15, // Fewer faculty
  numCourses: 30, // Fewer courses
  numSectionsPerCourse: 3, // More sections per course for better availability
};

// Generate UUIDs deterministically
function generateId(): string {
  return faker.string.uuid();
}

// Store IDs for reference
const IDS: Record<string, string> = {};

/** Helper to get ID with non-null assertion */
function getId(key: string): string {
  const id = IDS[key];
  if (!id) throw new Error(`Missing ID: ${key}`);
  return id;
}

// Grade distribution for realistic GPAs
const GRADE_DISTRIBUTION = [
  { grade: "A", weight: 15, points: 4.0 },
  { grade: "A-", weight: 12, points: 3.7 },
  { grade: "B+", weight: 13, points: 3.3 },
  { grade: "B", weight: 15, points: 3.0 },
  { grade: "B-", weight: 10, points: 2.7 },
  { grade: "C+", weight: 8, points: 2.3 },
  { grade: "C", weight: 10, points: 2.0 },
  { grade: "C-", weight: 5, points: 1.7 },
  { grade: "D+", weight: 4, points: 1.3 },
  { grade: "D", weight: 4, points: 1.0 },
  { grade: "D-", weight: 2, points: 0.7 },
  { grade: "F", weight: 2, points: 0.0 },
];

function pickWeightedGrade(targetGpa?: number): { grade: string; points: number } {
  if (targetGpa !== undefined) {
    // Bias distribution based on target GPA
    const biased = GRADE_DISTRIBUTION.map((g) => ({
      ...g,
      weight: g.weight * (1 - Math.abs(g.points - targetGpa) / 4),
    }));
    const total = biased.reduce((sum, g) => sum + g.weight, 0);
    let random = Math.random() * total;
    for (const g of biased) {
      random -= g.weight;
      if (random <= 0) return { grade: g.grade, points: g.points };
    }
  }

  const total = GRADE_DISTRIBUTION.reduce((sum, g) => sum + g.weight, 0);
  let random = Math.random() * total;
  for (const g of GRADE_DISTRIBUTION) {
    random -= g.weight;
    if (random <= 0) return { grade: g.grade, points: g.points };
  }
  return { grade: "C", points: 2.0 };
}

// Academic standing based on GPA
function determineStanding(gpa: number): string {
  if (gpa >= 2.0) return "good_standing";
  if (gpa >= 1.5) return "probation";
  if (gpa >= 1.0) return "suspension";
  return "dismissal";
}

// Course prefixes and names by department
const DEPARTMENT_COURSES: Record<string, { prefix: string; courses: string[] }> = {
  "Computer Science": {
    prefix: "CS",
    courses: [
      "Introduction to Programming",
      "Data Structures",
      "Algorithms",
      "Database Systems",
      "Operating Systems",
      "Computer Networks",
      "Software Engineering",
      "Artificial Intelligence",
      "Machine Learning",
      "Web Development",
    ],
  },
  "Business Administration": {
    prefix: "BUS",
    courses: [
      "Principles of Management",
      "Financial Accounting",
      "Managerial Accounting",
      "Business Statistics",
      "Marketing Fundamentals",
      "Organizational Behavior",
      "Business Law",
      "Strategic Management",
      "Entrepreneurship",
      "International Business",
    ],
  },
  "Biology": {
    prefix: "BIO",
    courses: [
      "General Biology I",
      "General Biology II",
      "Cell Biology",
      "Genetics",
      "Microbiology",
      "Ecology",
      "Anatomy & Physiology I",
      "Anatomy & Physiology II",
      "Biochemistry",
      "Evolution",
    ],
  },
  "English": {
    prefix: "ENG",
    courses: [
      "College Writing I",
      "College Writing II",
      "Introduction to Literature",
      "American Literature",
      "British Literature",
      "Creative Writing",
      "Technical Writing",
      "World Literature",
      "Shakespeare",
      "Modern Poetry",
    ],
  },
  "Mathematics": {
    prefix: "MATH",
    courses: [
      "College Algebra",
      "Precalculus",
      "Calculus I",
      "Calculus II",
      "Calculus III",
      "Linear Algebra",
      "Differential Equations",
      "Discrete Mathematics",
      "Statistics",
      "Probability Theory",
    ],
  },
  "Psychology": {
    prefix: "PSY",
    courses: [
      "Introduction to Psychology",
      "Developmental Psychology",
      "Abnormal Psychology",
      "Social Psychology",
      "Cognitive Psychology",
      "Research Methods",
      "Personality Theory",
      "Behavioral Neuroscience",
      "Psychology of Learning",
      "Clinical Psychology",
    ],
  },
};

async function seed() {
  console.log("Seeding database with faker data...\n");

  // Clear existing data using TRUNCATE CASCADE for all schemas
  console.log("Clearing existing data...");
  await db.execute(`
    -- Truncate all tables in all custom schemas with CASCADE
    TRUNCATE TABLE
      student.academic_standing_appeals,
      student.academic_standing_history,
      student.academic_standing_policies,
      student.student_gpa_summary,
      student.student_programs,
      student.students,
      enrollment.registrations,
      enrollment.registration_holds,
      enrollment.hold_types,
      curriculum.requirement_courses,
      curriculum.program_requirements,
      curriculum.requirement_categories,
      curriculum.grades,
      curriculum.grade_scales,
      curriculum.sections,
      curriculum.courses,
      curriculum.subjects,
      curriculum.programs,
      curriculum.degree_types,
      curriculum.catalog_years,
      curriculum.departments,
      curriculum.colleges,
      identity.user_roles,
      identity.users,
      identity.roles,
      scheduling.instructor_assignments,
      scheduling.section_assignments,
      scheduling.date_patterns,
      scheduling.meeting_patterns,
      scheduling.meeting_pattern_times,
      core.rooms,
      core.buildings,
      core.terms,
      core.campuses,
      core.institutions
    CASCADE;
  `);

  // 1. Institution
  console.log("Creating institution...");
  IDS["institution"] = generateId();
  await db.insert(institutions).values({
    id: getId("institution"),
    code: "DEMO",
    name: "Demo University",
    shortName: "Demo U",
    opeid: "00000000",
    ipedsId: "000000",
    accreditingBody: "Higher Learning Commission",
  });

  // 2. Campuses
  console.log("Creating campuses...");
  IDS["mainCampus"] = generateId();
  IDS["onlineCampus"] = generateId();
  await db.insert(campuses).values([
    {
      id: getId("mainCampus"),
      institutionId: getId("institution"),
      code: "MAIN",
      name: "Main Campus",
      isMainCampus: true,
      address1: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state({ abbreviated: true }),
      postalCode: faker.location.zipCode(),
    },
    {
      id: getId("onlineCampus"),
      institutionId: getId("institution"),
      code: "ONLINE",
      name: "Online Campus",
      isMainCampus: false,
    },
  ]);

  // 3. Terms (optimized for alpha testing with open registration)
  console.log("Creating terms...");
  const termData: Array<{ id: string; code: string; name: string; type: string; year: number; startDate: string; endDate: string }> = [];

  // Current term: Spring 2026 - Registration OPEN NOW for alpha testing
  const spring2026Id = generateId();
  IDS["termSpring2026"] = spring2026Id;
  termData.push({
    id: spring2026Id,
    code: "SP26",
    name: "Spring 2026",
    type: "spring",
    year: 2026,
    startDate: "2026-01-12",
    endDate: "2026-05-01",
  });

  // Upcoming term: Summer 2026 - Registration opens in future
  const summer2026Id = generateId();
  IDS["termSummer2026"] = summer2026Id;
  termData.push({
    id: summer2026Id,
    code: "SU26",
    name: "Summer 2026",
    type: "summer",
    year: 2026,
    startDate: "2026-05-18",
    endDate: "2026-07-31",
  });

  // Past term: Fall 2025 - Registration closed (historical data)
  const fall2025Id = generateId();
  IDS["termFall2025"] = fall2025Id;
  termData.push({
    id: fall2025Id,
    code: "FA25",
    name: "Fall 2025",
    type: "fall",
    year: 2025,
    startDate: "2025-08-25",
    endDate: "2025-12-12",
  });

  await db.insert(terms).values(
    termData.map((t) => ({
      id: t.id,
      institutionId: getId("institution"),
      code: t.code,
      name: t.name,
      termType: t.type,
      startDate: t.startDate,
      endDate: t.endDate,
      // Spring 2026: Registration OPEN NOW (Dec 2025 - Jan 2026)
      registrationStartDate: t.type === "spring" ? "2025-12-01" : t.type === "summer" ? "2026-03-01" : "2025-04-01",
      registrationEndDate: t.type === "spring" ? "2026-01-17" : t.type === "summer" ? "2026-05-20" : "2025-08-30",
      dropDeadline: t.type === "spring" ? "2026-01-23" : t.type === "summer" ? "2026-05-25" : "2025-09-05",
      withdrawalDeadline: t.type === "spring" ? "2026-03-20" : t.type === "summer" ? "2026-07-10" : "2025-10-31",
      finalGradesDue: t.type === "spring" ? "2026-05-08" : t.type === "summer" ? "2026-08-07" : "2025-12-19",
    }))
  );

  // 4. Buildings & Rooms
  console.log("Creating buildings and rooms...");
  const buildingNames = ["Science Hall", "Business Building", "Liberal Arts", "Student Center", "Library"];
  const buildingIds: string[] = [];

  for (const name of buildingNames) {
    const id = generateId();
    buildingIds.push(id);
    await db.insert(buildings).values({
      id,
      campusId: getId("mainCampus"),
      code: name.split(" ").map((w) => w[0]).join(""),
      name,
    });
  }

  const roomValues: Array<{ id: string; buildingId: string; roomNumber: string; capacity: number; roomType: string }> = [];
  for (const buildingId of buildingIds) {
    for (let floor = 1; floor <= 3; floor++) {
      for (let room = 1; room <= 5; room++) {
        roomValues.push({
          id: generateId(),
          buildingId,
          roomNumber: `${floor}0${room}`,
          capacity: faker.number.int({ min: 20, max: 100 }),
          roomType: room <= 3 ? "classroom" : "lab",
        });
      }
    }
  }
  await db.insert(rooms).values(roomValues);

  // 5. Roles
  console.log("Creating roles...");
  const roleData = [
    { code: "ADMIN", name: "Administrator", description: "Full system access" },
    { code: "REGISTRAR", name: "Registrar", description: "Registration and records management" },
    { code: "ADVISOR", name: "Academic Advisor", description: "Student advising access" },
    { code: "INSTRUCTOR", name: "Instructor", description: "Course management and grading" },
    { code: "STUDENT", name: "Student", description: "Student self-service access" },
  ];

  for (const role of roleData) {
    IDS[`role${role.code}`] = generateId();
  }

  await db.insert(roles).values(
    roleData.map((r) => ({
      id: IDS[`role${r.code}`],
      institutionId: getId("institution"),
      code: r.code,
      name: r.name,
      description: r.description,
      isSystem: true,
    }))
  );

  // 6. Hold Types
  console.log("Creating hold types...");
  await db.insert(holdTypes).values([
    {
      id: generateId(),
      institutionId: getId("institution"),
      code: "ACADEMIC",
      name: "Academic Hold",
      description: "Placed for academic issues",
      category: "academic",
      severity: "high",
      blocksRegistration: true,
      blocksTranscript: false,
      blocksDiploma: true,
    },
    {
      id: generateId(),
      institutionId: getId("institution"),
      code: "FINANCIAL",
      name: "Financial Hold",
      description: "Outstanding balance on account",
      category: "financial",
      severity: "high",
      blocksRegistration: true,
      blocksTranscript: true,
      blocksDiploma: true,
    },
    {
      id: generateId(),
      institutionId: getId("institution"),
      code: "ADVISING",
      name: "Advising Hold",
      description: "Must meet with advisor before registration",
      category: "administrative",
      severity: "standard",
      blocksRegistration: true,
      blocksTranscript: false,
      blocksDiploma: false,
    },
  ]);

  // 7. Admin/Staff Users
  console.log("Creating staff users...");
  const now = new Date();

  const staffUsers = [
    { email: "admin@demo.edu", hashKey: "admin" as const, firstName: "Admin", lastName: "User", role: "ADMIN" },
    { email: "registrar@demo.edu", hashKey: "registrar" as const, firstName: "Rachel", lastName: "Registrar", role: "REGISTRAR" },
    { email: "advisor@demo.edu", hashKey: "advisor" as const, firstName: "Adam", lastName: "Advisor", role: "ADVISOR" },
  ];

  for (const staff of staffUsers) {
    const userId = generateId();
    IDS[staff.role.toLowerCase() + "User"] = userId;

    await db.insert(users).values({
      id: userId,
      institutionId: getId("institution"),
      email: staff.email,
      passwordHash: passwordHashes[staff.hashKey],
      firstName: staff.firstName,
      lastName: staff.lastName,
      status: "active",
      emailVerified: now,
    });

    await db.insert(userRoles).values({
      userId,
      roleId: getId(`role${staff.role}`),
    });
  }

  // 8. Faculty/Instructors
  console.log("Creating faculty...");
  const facultyIds: string[] = [];
  for (let i = 0; i < CONFIG.numFaculty; i++) {
    const userId = generateId();
    facultyIds.push(userId);
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    await db.insert(users).values({
      id: userId,
      institutionId: getId("institution"),
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@demo.edu`,
      passwordHash: passwordHashes.faculty,
      firstName,
      lastName,
      status: "active",
      emailVerified: now,
    });

    await db.insert(userRoles).values({
      userId,
      roleId: getId("roleINSTRUCTOR"),
    });
  }

  // 9. Academic Structure
  console.log("Creating academic structure...");
  IDS["college"] = generateId();
  await db.insert(colleges).values({
    id: getId("college"),
    institutionId: getId("institution"),
    code: "CAS",
    name: "College of Arts & Sciences",
  });

  // Degree Types
  IDS["degreeBA"] = generateId();
  IDS["degreeBS"] = generateId();
  await db.insert(degreeTypes).values([
    { id: getId("degreeBA"), institutionId: getId("institution"), code: "BA", name: "Bachelor of Arts", level: "undergraduate" },
    { id: getId("degreeBS"), institutionId: getId("institution"), code: "BS", name: "Bachelor of Science", level: "undergraduate" },
  ]);

  // Catalog Years
  IDS["catalog2023"] = generateId();
  IDS["catalog2024"] = generateId();
  await db.insert(catalogYears).values([
    { id: getId("catalog2023"), institutionId: getId("institution"), code: "2023-2024", name: "2023-2024 Catalog", startDate: "2023-08-01", endDate: "2024-07-31", isActive: true },
    { id: getId("catalog2024"), institutionId: getId("institution"), code: "2024-2025", name: "2024-2025 Catalog", startDate: "2024-08-01", endDate: "2025-07-31", isActive: true },
  ]);

  // Departments, Subjects, and Courses
  const departmentIds: Record<string, string> = {};
  const subjectIds: Record<string, string> = {};
  const courseIds: string[] = [];
  const courseData: Array<{ id: string; subjectId: string; departmentId: string; number: string; title: string; credits: number }> = [];

  for (const [deptName, deptInfo] of Object.entries(DEPARTMENT_COURSES)) {
    const deptId = generateId();
    const subjectId = generateId();
    departmentIds[deptName] = deptId;
    subjectIds[deptInfo.prefix] = subjectId;

    await db.insert(departments).values({
      id: deptId,
      collegeId: getId("college"),
      code: deptInfo.prefix,
      name: deptName,
    });

    await db.insert(subjects).values({
      id: subjectId,
      institutionId: getId("institution"),
      code: deptInfo.prefix,
      name: deptName,
      departmentId: deptId,
    });

    // Create courses for this department
    let courseNum = 101;
    for (const courseTitle of deptInfo.courses) {
      const courseId = generateId();
      courseIds.push(courseId);
      const credits = courseNum < 300 ? 3 : faker.helpers.arrayElement([3, 4]);

      courseData.push({
        id: courseId,
        subjectId,
        departmentId: deptId,
        number: courseNum.toString(),
        title: courseTitle,
        credits,
      });

      courseNum += faker.number.int({ min: 5, max: 15 }) * 10;
      if (courseNum > 500) break;
    }
  }

  await db.insert(courses).values(
    courseData.map((c) => ({
      id: c.id,
      institutionId: getId("institution"),
      subjectId: c.subjectId,
      departmentId: c.departmentId,
      courseNumber: c.number,
      courseCode: `${Object.entries(subjectIds).find(([, id]) => id === c.subjectId)?.[0]} ${c.number}`,
      title: c.title,
      description: faker.lorem.paragraph(),
      creditHoursMin: c.credits.toFixed(2),
      creditHoursMax: c.credits.toFixed(2),
    }))
  );

  // 10. Programs
  console.log("Creating programs...");
  const programData = [
    { name: "Computer Science", dept: "Computer Science", degree: getId("degreeBS"), prefix: "CS" },
    { name: "Business Administration", dept: "Business Administration", degree: getId("degreeBS"), prefix: "BUS" },
    { name: "Biology", dept: "Biology", degree: getId("degreeBS"), prefix: "BIO" },
    { name: "English", dept: "English", degree: getId("degreeBA"), prefix: "ENG" },
    { name: "Mathematics", dept: "Mathematics", degree: getId("degreeBS"), prefix: "MATH" },
    { name: "Psychology", dept: "Psychology", degree: getId("degreeBA"), prefix: "PSY" },
  ];

  const programIds: string[] = [];
  for (const prog of programData) {
    const id = generateId();
    programIds.push(id);
    IDS[`program${prog.prefix}`] = id;

    await db.insert(programs).values({
      id,
      institutionId: getId("institution"),
      departmentId: departmentIds[prog.dept]!,
      degreeTypeId: prog.degree,
      code: prog.prefix,
      name: `${prog.name} Major`,
      totalCredits: "120.00",
      isActive: true,
    });
  }

  // 11. Sections (for each term and course)
  console.log("Creating sections...");
  const sectionData: Array<{ id: string; courseId: string; termId: string; sectionNum: string; credits: number }> = [];

  for (const term of termData) {
    for (const course of courseData) {
      for (let secNum = 1; secNum <= CONFIG.numSectionsPerCourse; secNum++) {
        sectionData.push({
          id: generateId(),
          courseId: course.id,
          termId: term.id,
          sectionNum: secNum.toString().padStart(2, "0"),
          credits: course.credits,
        });
      }
    }
  }

  // Batch insert sections with varied enrollment for realistic demo
  for (let i = 0; i < sectionData.length; i += 100) {
    const batch = sectionData.slice(i, i + 100);
    await db.insert(sections).values(
      batch.map((s, idx) => {
        const maxEnrollment = faker.number.int({ min: 25, max: 35 });
        // Vary enrollment: some empty, some half-full, some nearly full
        let currentEnrollment = 0;
        if (idx % 5 === 0) {
          // 20% are nearly full (good for testing waitlists)
          currentEnrollment = Math.floor(maxEnrollment * 0.9);
        } else if (idx % 3 === 0) {
          // 33% are half full
          currentEnrollment = Math.floor(maxEnrollment * 0.5);
        } else if (idx % 7 === 0) {
          // ~14% have a few seats taken
          currentEnrollment = faker.number.int({ min: 1, max: 5 });
        }
        // Remaining ~33% are empty (currentEnrollment = 0)

        return {
          id: s.id,
          courseId: s.courseId,
          termId: s.termId,
          sectionNumber: s.sectionNum,
          creditHours: s.credits.toFixed(2),
          maxEnrollment,
          currentEnrollment,
          waitlistMax: maxEnrollment >= 30 ? 10 : 0, // Add waitlist to larger sections
          waitlistCurrent: 0,
          instructionalMethod: faker.helpers.arrayElement(["in_person", "in_person", "in_person", "online", "hybrid"]),
          status: "active",
        };
      })
    );
  }

  // 12. Grade Scale
  console.log("Creating grade scale...");
  IDS["gradeScale"] = generateId();
  await db.insert(gradeScales).values({
    id: getId("gradeScale"),
    institutionId: getId("institution"),
    code: "STD",
    name: "Standard Letter Grades",
    isDefault: true,
    isActive: true,
  });

  const gradeValues = [
    { code: "A", points: "4.000", order: 1 },
    { code: "A-", points: "3.700", order: 2 },
    { code: "B+", points: "3.300", order: 3 },
    { code: "B", points: "3.000", order: 4 },
    { code: "B-", points: "2.700", order: 5 },
    { code: "C+", points: "2.300", order: 6 },
    { code: "C", points: "2.000", order: 7 },
    { code: "C-", points: "1.700", order: 8 },
    { code: "D+", points: "1.300", order: 9 },
    { code: "D", points: "1.000", order: 10 },
    { code: "D-", points: "0.700", order: 11 },
    { code: "F", points: "0.000", order: 12 },
    { code: "W", points: null, order: 20, special: { countInGpa: false, earnedCredits: false, attemptedCredits: false, isWithdrawal: true } },
    { code: "I", points: null, order: 21, special: { countInGpa: false, earnedCredits: false, attemptedCredits: true, isIncomplete: true } },
    { code: "P", points: null, order: 22, special: { countInGpa: false, earnedCredits: true, attemptedCredits: false, isPassFail: true } },
    { code: "NP", points: null, order: 23, special: { countInGpa: false, earnedCredits: false, attemptedCredits: false, isPassFail: true } },
    { code: "AU", points: null, order: 24, special: { countInGpa: false, earnedCredits: false, attemptedCredits: false, isAudit: true } },
  ];

  await db.insert(grades).values(
    gradeValues.map((g) => ({
      gradeScaleId: getId("gradeScale"),
      gradeCode: g.code,
      gradePoints: g.points,
      displayOrder: g.order,
      ...(g.special || {}),
    }))
  );

  // 13. Requirement Categories
  console.log("Creating requirement categories...");
  const categories = [
    { code: "GEN_ED", name: "General Education", order: 1 },
    { code: "MAJOR_CORE", name: "Major Core Requirements", order: 2 },
    { code: "MAJOR_ELECT", name: "Major Electives", order: 3 },
    { code: "FREE_ELECT", name: "Free Electives", order: 4 },
  ];

  const categoryIds: Record<string, string> = {};
  for (const cat of categories) {
    const id = generateId();
    categoryIds[cat.code] = id;
    await db.insert(requirementCategories).values({
      id,
      institutionId: getId("institution"),
      code: cat.code,
      name: cat.name,
      displayOrder: cat.order,
      isActive: true,
    });
  }

  // 14. Program Requirements
  console.log("Creating program requirements...");
  for (const prog of programData) {
    const progId = getId(`program${prog.prefix}`);

    // General Education requirement
    const genEdReqId = generateId();
    await db.insert(programRequirements).values({
      id: genEdReqId,
      programId: progId,
      catalogYearId: getId("catalog2024"),
      categoryId: categoryIds["GEN_ED"]!,
      name: "General Education Requirements",
      minimumCredits: "30.00",
      displayOrder: 1,
      isActive: true,
    });

    // Major Core requirement
    const coreReqId = generateId();
    await db.insert(programRequirements).values({
      id: coreReqId,
      programId: progId,
      catalogYearId: getId("catalog2024"),
      categoryId: categoryIds["MAJOR_CORE"]!,
      name: `${prog.name} Core Courses`,
      minimumCredits: "45.00",
      minimumGpa: "2.000",
      displayOrder: 2,
      isActive: true,
    });

    // Link some courses to requirements
    const deptCourses = courseData.filter((c) => c.subjectId === subjectIds[prog.prefix]);
    for (let i = 0; i < Math.min(5, deptCourses.length); i++) {
      const course = deptCourses[i];
      if (!course) continue;
      await db.insert(requirementCourses).values({
        id: generateId(),
        requirementId: coreReqId,
        courseId: course.id,
        isRequired: i < 3,
        minimumGrade: "C",
      });
    }
  }

  // 15. Academic Standing Policy
  console.log("Creating academic standing policy...");
  IDS["standingPolicy"] = generateId();
  await db.insert(academicStandingPolicies).values({
    id: getId("standingPolicy"),
    institutionId: getId("institution"),
    name: "Standard Undergraduate Policy",
    code: "UG_STANDARD",
    description: "Standard academic standing policy for undergraduate students",
    goodStandingMinGpa: "2.000",
    warningMinGpa: "1.750",
    probationMinGpa: "1.500",
    probationMaxTerms: 2,
    suspensionDurationTerms: 1,
    maxSuspensions: 2,
    evaluateAfterEachTerm: true,
    isActive: true,
  });

  // 16. Students (500 with enrollments, grades, and standing)
  console.log(`\nCreating ${CONFIG.numStudents} students with enrollments...`);

  // Determine GPA targets for distribution
  // 60% good (2.5-4.0), 25% warning (2.0-2.5), 10% probation (1.5-2.0), 5% poor (<1.5)
  const gpaTargets = Array(CONFIG.numStudents).fill(0).map((_, i) => {
    const pct = i / CONFIG.numStudents;
    if (pct < 0.60) return faker.number.float({ min: 2.5, max: 4.0, fractionDigits: 2 });
    if (pct < 0.85) return faker.number.float({ min: 2.0, max: 2.5, fractionDigits: 2 });
    if (pct < 0.95) return faker.number.float({ min: 1.5, max: 2.0, fractionDigits: 2 });
    return faker.number.float({ min: 0.5, max: 1.5, fractionDigits: 2 });
  });
  faker.helpers.shuffle(gpaTargets);

  const studentBatches: Array<{
    userId: string;
    studentId: string;
    firstName: string;
    lastName: string;
    email: string;
    programId: string;
    gpaTarget: number;
  }> = [];

  // Generate student data
  for (let i = 0; i < CONFIG.numStudents; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@demo.edu`;

    studentBatches.push({
      userId: generateId(),
      studentId: generateId(),
      firstName,
      lastName,
      email,
      programId: faker.helpers.arrayElement(programIds),
      gpaTarget: gpaTargets[i] ?? 3.0,
    });
  }

  // Batch insert users
  console.log("  Creating user accounts...");
  for (let i = 0; i < studentBatches.length; i += 100) {
    const batch = studentBatches.slice(i, i + 100);
    await db.insert(users).values(
      batch.map((s) => ({
        id: s.userId,
        institutionId: getId("institution"),
        email: s.email,
        passwordHash: passwordHashes.student,
        firstName: s.firstName,
        lastName: s.lastName,
        status: "active",
        emailVerified: now,
      }))
    );

    await db.insert(userRoles).values(
      batch.map((s) => ({
        userId: s.userId,
        roleId: getId("roleSTUDENT"),
      }))
    );

    process.stdout.write(`\r  Users: ${Math.min(i + 100, studentBatches.length)}/${studentBatches.length}`);
  }
  console.log("");

  // Insert students
  console.log("  Creating student records...");
  for (let i = 0; i < studentBatches.length; i += 100) {
    const batch = studentBatches.slice(i, i + 100);
    await db.insert(students).values(
      batch.map((s, idx) => ({
        id: s.studentId,
        institutionId: getId("institution"),
        userId: s.userId,
        studentId: `STU${(i + idx + 1).toString().padStart(6, "0")}`,
        legalFirstName: s.firstName,
        legalLastName: s.lastName,
        dateOfBirth: faker.date.birthdate({ min: 18, max: 25, mode: "age" }).toISOString().split("T")[0],
        primaryEmail: s.email,
        status: "active",
      }))
    );
    process.stdout.write(`\r  Students: ${Math.min(i + 100, studentBatches.length)}/${studentBatches.length}`);
  }
  console.log("");

  // Insert student programs (10% graduated, 5% withdrawn, 85% active)
  console.log("  Assigning programs...");
  const graduatedCount = Math.floor(studentBatches.length * 0.1);
  const withdrawnCount = Math.floor(studentBatches.length * 0.05);

  for (let i = 0; i < studentBatches.length; i += 100) {
    const batch = studentBatches.slice(i, i + 100);
    await db.insert(studentPrograms).values(
      batch.map((s, batchIdx) => {
        const globalIdx = i + batchIdx;
        let status: string;
        let actualGraduationDate: string | null = null;

        if (globalIdx < graduatedCount) {
          status = "graduated";
          actualGraduationDate = faker.date.past({ years: 1 }).toISOString().split("T")[0] ?? null;
        } else if (globalIdx < graduatedCount + withdrawnCount) {
          status = "withdrawn";
        } else {
          status = "active";
        }

        return {
          id: generateId(),
          studentId: s.studentId,
          programId: s.programId,
          catalogYearId: faker.helpers.arrayElement([getId("catalog2023"), getId("catalog2024")]),
          status,
          isPrimary: true,
          admitDate: faker.date.past({ years: 3 }).toISOString().split("T")[0],
          actualGraduationDate,
        };
      })
    );
    process.stdout.write(`\r  Programs: ${Math.min(i + 100, studentBatches.length)}/${studentBatches.length}`);
  }
  console.log("");

  // Create enrollments and calculate GPAs
  console.log("  Creating enrollments and grades...");
  const allRegistrations: Array<{
    studentId: string;
    sectionId: string;
    termId: string;
    credits: number;
    grade: string;
    gradePoints: number;
  }> = [];

  const gpaSummaries: Array<{
    studentId: string;
    cumGpa: number;
    cumCreditsAttempted: number;
    cumCreditsEarned: number;
  }> = [];

  const standingHistories: Array<{
    id: string;
    studentId: string;
    termId: string;
    standing: string;
    prevStanding: string | null;
    termGpa: number;
    cumGpa: number;
    termCreditsAttempted: number;
    termCreditsEarned: number;
    cumCreditsAttempted: number;
    cumCreditsEarned: number;
  }> = [];

  // Group sections by term for easy lookup
  const sectionsByTerm: Record<string, typeof sectionData> = {};
  for (const section of sectionData) {
    const termId = section.termId;
    if (!sectionsByTerm[termId]) sectionsByTerm[termId] = [];
    sectionsByTerm[termId]!.push(section);
  }

  // Sort terms chronologically
  const sortedTerms = [...termData].sort((a, b) => a.year - b.year || (a.type === "spring" ? 0 : 1) - (b.type === "spring" ? 0 : 1));

  for (let si = 0; si < studentBatches.length; si++) {
    const student = studentBatches[si]!;
    const numTerms = faker.number.int(CONFIG.termsPerStudent);
    const enrolledTerms = sortedTerms.slice(0, numTerms);

    let cumCreditsAttempted = 0;
    let cumCreditsEarned = 0;
    let cumQualityPoints = 0;
    let prevStanding: string | null = null;

    for (const term of enrolledTerms) {
      const termSections = sectionsByTerm[term.id] || [];
      if (termSections.length === 0) continue;

      const numCourses = faker.number.int(CONFIG.coursesPerTerm);
      const selectedSections = faker.helpers.arrayElements(termSections, numCourses);

      let termCreditsAttempted = 0;
      let termCreditsEarned = 0;
      let termQualityPoints = 0;

      for (const section of selectedSections) {
        const { grade, points } = pickWeightedGrade(student.gpaTarget);
        const credits = section.credits;

        allRegistrations.push({
          studentId: student.studentId,
          sectionId: section.id,
          termId: term.id,
          credits,
          grade,
          gradePoints: points,
        });

        termCreditsAttempted += credits;
        if (points >= 1.0) termCreditsEarned += credits;
        termQualityPoints += points * credits;
      }

      cumCreditsAttempted += termCreditsAttempted;
      cumCreditsEarned += termCreditsEarned;
      cumQualityPoints += termQualityPoints;

      const termGpa = termCreditsAttempted > 0 ? termQualityPoints / termCreditsAttempted : 0;
      const cumGpa = cumCreditsAttempted > 0 ? cumQualityPoints / cumCreditsAttempted : 0;
      const standing = determineStanding(cumGpa);

      standingHistories.push({
        id: generateId(),
        studentId: student.studentId,
        termId: term.id,
        standing,
        prevStanding,
        termGpa,
        cumGpa,
        termCreditsAttempted,
        termCreditsEarned,
        cumCreditsAttempted,
        cumCreditsEarned,
      });

      prevStanding = standing;
    }

    const finalGpa = cumCreditsAttempted > 0 ? cumQualityPoints / cumCreditsAttempted : 0;
    gpaSummaries.push({
      studentId: student.studentId,
      cumGpa: finalGpa,
      cumCreditsAttempted,
      cumCreditsEarned,
    });

    if ((si + 1) % 50 === 0) {
      process.stdout.write(`\r  Enrollments: ${si + 1}/${studentBatches.length}`);
    }
  }
  console.log(`\r  Enrollments: ${studentBatches.length}/${studentBatches.length}`);

  // Batch insert registrations
  console.log("  Saving registrations...");
  for (let i = 0; i < allRegistrations.length; i += 500) {
    const batch = allRegistrations.slice(i, i + 500);
    await db.insert(registrations).values(
      batch.map((r) => ({
        studentId: r.studentId,
        sectionId: r.sectionId,
        termId: r.termId,
        creditHours: r.credits.toFixed(2),
        status: "graded",
        gradeMode: "standard",
        registrationMethod: "self",
        finalGrade: r.grade,
      }))
    );
    process.stdout.write(`\r  Registrations: ${Math.min(i + 500, allRegistrations.length)}/${allRegistrations.length}`);
  }
  console.log("");

  // Batch insert GPA summaries
  console.log("  Saving GPA summaries...");
  for (let i = 0; i < gpaSummaries.length; i += 100) {
    const batch = gpaSummaries.slice(i, i + 100);
    await db.insert(studentGpaSummary).values(
      batch.map((g) => ({
        id: generateId(),
        studentId: g.studentId,
        cumulativeGpa: g.cumGpa.toFixed(3),
        cumulativeCreditsAttempted: g.cumCreditsAttempted.toFixed(2),
        cumulativeCreditsEarned: g.cumCreditsEarned.toFixed(2),
        cumulativeQualityPoints: (g.cumGpa * g.cumCreditsAttempted).toFixed(3),
      }))
    );
    process.stdout.write(`\r  GPA Summaries: ${Math.min(i + 100, gpaSummaries.length)}/${gpaSummaries.length}`);
  }
  console.log("");

  // Batch insert standing history
  console.log("  Saving academic standing history...");
  for (let i = 0; i < standingHistories.length; i += 100) {
    const batch = standingHistories.slice(i, i + 100);
    await db.insert(academicStandingHistory).values(
      batch.map((h) => ({
        id: h.id,
        studentId: h.studentId,
        termId: h.termId,
        policyId: getId("standingPolicy"),
        standing: h.standing,
        previousStanding: h.prevStanding,
        termGpa: h.termGpa.toFixed(3),
        cumulativeGpa: h.cumGpa.toFixed(3),
        termCreditsAttempted: h.termCreditsAttempted.toFixed(2),
        termCreditsEarned: h.termCreditsEarned.toFixed(2),
        cumulativeCreditsAttempted: h.cumCreditsAttempted.toFixed(2),
        cumulativeCreditsEarned: h.cumCreditsEarned.toFixed(2),
        isAutomatic: true,
      }))
    );
    process.stdout.write(`\r  Standing History: ${Math.min(i + 100, standingHistories.length)}/${standingHistories.length}`);
  }
  console.log("");

  // Create some appeals for students on probation/suspension
  console.log("  Creating sample appeals...");
  const studentsNeedingAppeals = standingHistories
    .filter((h) => h.standing === "probation" || h.standing === "suspension")
    .slice(0, 10);

  for (const standing of studentsNeedingAppeals) {
    await db.insert(academicStandingAppeals).values({
      standingHistoryId: standing.id,
      studentId: standing.studentId,
      appealDate: faker.date.recent({ days: 30 }).toISOString().split("T")[0]!,
      appealReason: faker.lorem.paragraphs(2),
      status: faker.helpers.arrayElement(["pending", "pending", "pending", "under_review", "approved"]),
      academicPlanSubmitted: faker.datatype.boolean(),
      academicPlanDetails: faker.lorem.paragraph(),
    });
  }

  // ===========================================
  // FINANCIAL DATA - Bursar Portal
  // ===========================================
  console.log("\nSeeding Financial Data...");

  // Create charge codes
  console.log("  Creating charge codes...");
  const chargeCodeData = [
    { id: generateId(), code: "TUI-UG", name: "Undergraduate Tuition", category: "tuition", isQtre: true, box1Eligible: true, glAccountCode: "4100-1000" },
    { id: generateId(), code: "TUI-GR", name: "Graduate Tuition", category: "tuition", isQtre: true, box1Eligible: true, glAccountCode: "4100-2000" },
    { id: generateId(), code: "FEE-REG", name: "Registration Fee", category: "fees", isQtre: true, box1Eligible: true, glAccountCode: "4200-1000" },
    { id: generateId(), code: "FEE-TECH", name: "Technology Fee", category: "fees", isQtre: true, box1Eligible: true, glAccountCode: "4200-2000" },
    { id: generateId(), code: "FEE-ACT", name: "Student Activity Fee", category: "fees", isQtre: false, box1Eligible: false, glAccountCode: "4200-3000" },
    { id: generateId(), code: "FEE-HEALTH", name: "Health Services Fee", category: "fees", isQtre: false, box1Eligible: false, glAccountCode: "4200-4000" },
    { id: generateId(), code: "FEE-LAB", name: "Lab Fee", category: "fees", isQtre: true, box1Eligible: true, glAccountCode: "4200-5000" },
    { id: generateId(), code: "FEE-PARK", name: "Parking Permit", category: "fees", isQtre: false, box1Eligible: false, glAccountCode: "4200-6000" },
    { id: generateId(), code: "HSG-DORM", name: "Residence Hall", category: "housing", isQtre: false, box1Eligible: false, glAccountCode: "4300-1000" },
    { id: generateId(), code: "HSG-APT", name: "Campus Apartments", category: "housing", isQtre: false, box1Eligible: false, glAccountCode: "4300-2000" },
    { id: generateId(), code: "MEAL-STD", name: "Standard Meal Plan", category: "meal_plan", isQtre: false, box1Eligible: false, glAccountCode: "4400-1000" },
    { id: generateId(), code: "MEAL-UNL", name: "Unlimited Meal Plan", category: "meal_plan", isQtre: false, box1Eligible: false, glAccountCode: "4400-2000" },
    { id: generateId(), code: "FEE-LATE", name: "Late Payment Fee", category: "other", isQtre: false, box1Eligible: false, glAccountCode: "4500-1000" },
    { id: generateId(), code: "FEE-DROP", name: "Late Drop Fee", category: "other", isQtre: false, box1Eligible: false, glAccountCode: "4500-2000" },
    { id: generateId(), code: "BOOK-ADV", name: "Bookstore Advance", category: "other", isQtre: false, box1Eligible: false, glAccountCode: "4500-3000" },
  ];

  await db.insert(chargeCodes).values(
    chargeCodeData.map((cc) => ({
      id: cc.id,
      institutionId: getId("institution"),
      code: cc.code,
      name: cc.name,
      category: cc.category,
      isQtre: cc.isQtre,
      box1Eligible: cc.box1Eligible,
      glAccountCode: cc.glAccountCode,
      isActive: true,
    }))
  );

  // Create student accounts and ledger entries
  console.log("  Creating student accounts...");
  const accountData: Array<{
    id: string;
    studentId: string;
    accountNumber: string;
    currentBalance: string;
    hasFinancialHold: boolean;
    onPaymentPlan: boolean;
  }> = [];

  // Generate an account for each student
  for (let i = 0; i < studentBatches.length; i++) {
    const student = studentBatches[i]!;
    const acctId = generateId();
    const acctNum = `A${(i + 1).toString().padStart(8, "0")}`;

    // Different balance scenarios:
    // 60% paid in full or credit balance
    // 25% have balance due < $2000
    // 10% have balance due $2000-$10000
    // 5% have large balance due > $10000 (with holds)
    let balance: number;
    let hasHold = false;
    let onPlan = false;
    const scenario = faker.number.int({ min: 1, max: 100 });

    if (scenario <= 50) {
      balance = 0; // Paid in full
    } else if (scenario <= 60) {
      balance = faker.number.float({ min: -500, max: -50, fractionDigits: 2 }); // Credit balance
    } else if (scenario <= 85) {
      balance = faker.number.float({ min: 100, max: 1999, fractionDigits: 2 }); // Small balance
    } else if (scenario <= 95) {
      balance = faker.number.float({ min: 2000, max: 9999, fractionDigits: 2 }); // Medium balance
      onPlan = faker.datatype.boolean(); // Some on payment plan
    } else {
      balance = faker.number.float({ min: 10000, max: 25000, fractionDigits: 2 }); // Large balance
      hasHold = true; // Always have a hold
      onPlan = faker.datatype.boolean();
    }

    accountData.push({
      id: acctId,
      studentId: student.studentId,
      accountNumber: acctNum,
      currentBalance: balance.toFixed(2),
      hasFinancialHold: hasHold,
      onPaymentPlan: onPlan,
    });
  }

  // Batch insert accounts
  for (let i = 0; i < accountData.length; i += 100) {
    const batch = accountData.slice(i, i + 100);
    await db.insert(accounts).values(
      batch.map((a) => ({
        id: a.id,
        institutionId: getId("institution"),
        studentId: a.studentId,
        accountNumber: a.accountNumber,
        currentBalance: a.currentBalance,
        hasFinancialHold: a.hasFinancialHold,
        onPaymentPlan: a.onPaymentPlan,
        status: "active",
      }))
    );
    process.stdout.write(`\r  Accounts: ${Math.min(i + 100, accountData.length)}/${accountData.length}`);
  }
  console.log("");

  // Create ledger entries for each account
  console.log("  Creating ledger entries...");
  const ledgerData: Array<{
    accountId: string;
    entryType: string;
    chargeCodeId: string | null;
    transactionDate: string;
    effectiveDate: string;
    dueDate: string | null;
    amount: string;
    termId: string | null;
    description: string;
    paymentMethod: string | null;
    status: string;
  }> = [];

  const tuitionCode = chargeCodeData.find((c) => c.code === "TUI-UG")!;
  const regFeeCode = chargeCodeData.find((c) => c.code === "FEE-REG")!;
  const techFeeCode = chargeCodeData.find((c) => c.code === "FEE-TECH")!;
  const actFeeCode = chargeCodeData.find((c) => c.code === "FEE-ACT")!;
  const healthFeeCode = chargeCodeData.find((c) => c.code === "FEE-HEALTH")!;
  const lateFeeCode = chargeCodeData.find((c) => c.code === "FEE-LATE")!;

  // Current term for charges
  const currentTerm = termData.find((t) => t.code === "FA24") || termData[termData.length - 1]!;
  const previousTerm = termData.find((t) => t.code === "SP24") || termData[termData.length - 2]!;

  let transactionCounter = 1;

  for (const account of accountData) {
    const balance = parseFloat(account.currentBalance);
    const isCurrentStudent = faker.datatype.boolean({ probability: 0.9 }); // 90% are current students

    // Standard tuition charge for current term (for current students)
    if (isCurrentStudent) {
      const tuitionAmount = faker.helpers.arrayElement([15000, 16500, 18000, 19500]); // Per semester tuition
      const chargeDate = currentTerm.startDate;

      ledgerData.push({
        accountId: account.id,
        entryType: "charge",
        chargeCodeId: tuitionCode.id,
        transactionDate: chargeDate,
        effectiveDate: chargeDate,
        dueDate: faker.date.soon({ days: 30, refDate: chargeDate }).toISOString().split("T")[0]!,
        amount: tuitionAmount.toFixed(2),
        termId: currentTerm.id,
        description: `${currentTerm.name} Tuition`,
        paymentMethod: null,
        status: "posted",
      });

      // Registration fee
      ledgerData.push({
        accountId: account.id,
        entryType: "charge",
        chargeCodeId: regFeeCode.id,
        transactionDate: chargeDate,
        effectiveDate: chargeDate,
        dueDate: null,
        amount: "350.00",
        termId: currentTerm.id,
        description: `${currentTerm.name} Registration Fee`,
        paymentMethod: null,
        status: "posted",
      });

      // Technology fee
      ledgerData.push({
        accountId: account.id,
        entryType: "charge",
        chargeCodeId: techFeeCode.id,
        transactionDate: chargeDate,
        effectiveDate: chargeDate,
        dueDate: null,
        amount: "150.00",
        termId: currentTerm.id,
        description: `${currentTerm.name} Technology Fee`,
        paymentMethod: null,
        status: "posted",
      });

      // Activity fee
      ledgerData.push({
        accountId: account.id,
        entryType: "charge",
        chargeCodeId: actFeeCode.id,
        transactionDate: chargeDate,
        effectiveDate: chargeDate,
        dueDate: null,
        amount: "75.00",
        termId: currentTerm.id,
        description: `${currentTerm.name} Student Activity Fee`,
        paymentMethod: null,
        status: "posted",
      });

      // Health fee
      ledgerData.push({
        accountId: account.id,
        entryType: "charge",
        chargeCodeId: healthFeeCode.id,
        transactionDate: chargeDate,
        effectiveDate: chargeDate,
        dueDate: null,
        amount: "200.00",
        termId: currentTerm.id,
        description: `${currentTerm.name} Health Services Fee`,
        paymentMethod: null,
        status: "posted",
      });

      // Calculate total charges and needed payments
      const totalCharges = tuitionAmount + 350 + 150 + 75 + 200;
      const neededPayment = totalCharges - balance;

      // Add payments to reach the target balance
      if (neededPayment > 0) {
        // Financial aid payment
        const aidAmount = faker.helpers.arrayElement([5000, 7500, 10000, 12000, 15000]);
        const aidDate = faker.date.between({ from: chargeDate, to: new Date() }).toISOString().split("T")[0]!;

        ledgerData.push({
          accountId: account.id,
          entryType: "payment",
          chargeCodeId: null,
          transactionDate: aidDate,
          effectiveDate: aidDate,
          dueDate: null,
          amount: (-aidAmount).toFixed(2),
          termId: currentTerm.id,
          description: "Financial Aid Disbursement - Federal Pell Grant",
          paymentMethod: "financial_aid",
          status: "posted",
        });

        // Additional payment if needed
        const remainingAfterAid = totalCharges - aidAmount - balance;
        if (remainingAfterAid > 0) {
          const paymentDate = faker.date.between({ from: aidDate, to: new Date() }).toISOString().split("T")[0]!;
          const paymentMethod = faker.helpers.arrayElement(["card_present", "ach", "check"]) as string;

          ledgerData.push({
            accountId: account.id,
            entryType: "payment",
            chargeCodeId: null,
            transactionDate: paymentDate,
            effectiveDate: paymentDate,
            dueDate: null,
            amount: (-remainingAfterAid).toFixed(2),
            termId: currentTerm.id,
            description: paymentMethod === "check" ? "Payment - Check" : paymentMethod === "ach" ? "Payment - ACH" : "Payment - Card",
            paymentMethod: paymentMethod,
            status: "posted",
          });
        }
      }

      // Add late fee for some accounts with balance
      if (balance > 500 && faker.datatype.boolean({ probability: 0.3 })) {
        ledgerData.push({
          accountId: account.id,
          entryType: "charge",
          chargeCodeId: lateFeeCode.id,
          transactionDate: faker.date.recent({ days: 30 }).toISOString().split("T")[0]!,
          effectiveDate: faker.date.recent({ days: 30 }).toISOString().split("T")[0]!,
          dueDate: null,
          amount: "100.00",
          termId: currentTerm.id,
          description: "Late Payment Fee",
          paymentMethod: null,
          status: "posted",
        });
      }
    }

    transactionCounter++;
  }

  // Batch insert ledger entries
  for (let i = 0; i < ledgerData.length; i += 500) {
    const batch = ledgerData.slice(i, i + 500);
    await db.insert(ledgerEntries).values(
      batch.map((e, idx) => ({
        accountId: e.accountId,
        transactionNumber: `TXN${(i + idx + 1).toString().padStart(8, "0")}`,
        entryType: e.entryType,
        chargeCodeId: e.chargeCodeId,
        transactionDate: e.transactionDate,
        effectiveDate: e.effectiveDate,
        dueDate: e.dueDate,
        amount: e.amount,
        termId: e.termId,
        description: e.description,
        paymentMethod: e.paymentMethod,
        status: e.status,
        isQtre: e.chargeCodeId ? chargeCodeData.find((c) => c.id === e.chargeCodeId)?.isQtre ?? false : false,
      }))
    );
    process.stdout.write(`\r  Ledger Entries: ${Math.min(i + 500, ledgerData.length)}/${ledgerData.length}`);
  }
  console.log("");

  // Create financial holds for accounts with hasFinancialHold = true
  console.log("  Creating financial holds...");
  const accountsWithHolds = accountData.filter((a) => a.hasFinancialHold);
  const holdData = accountsWithHolds.map((account) => ({
    id: generateId(),
    accountId: account.id,
    holdType: "balance_due",
    holdCode: "FIN-BAL",
    holdName: "Financial Balance Hold",
    description: "Account has outstanding balance exceeding threshold",
    thresholdAmount: "5000.00",
    currentAmount: account.currentBalance,
    blocksRegistration: true,
    blocksGrades: true,
    blocksTranscript: true,
    blocksDiploma: true,
    autoReleaseThreshold: "500.00",
  }));

  if (holdData.length > 0) {
    await db.insert(financialHolds).values(holdData);
  }
  console.log(`  Created ${holdData.length} financial holds`);

  // Create payment plans for accounts with onPaymentPlan = true
  console.log("  Creating payment plans...");
  const accountsWithPlans = accountData.filter((a) => a.onPaymentPlan);
  let paymentPlanCount = 0;
  let installmentCount = 0;

  for (const account of accountsWithPlans) {
    const planId = generateId();
    const balance = parseFloat(account.currentBalance);
    if (balance <= 0) continue; // Skip if no balance

    const numberOfPayments = faker.helpers.arrayElement([3, 4, 5, 6]);
    const paymentAmount = Math.ceil(balance / numberOfPayments);
    const startDate = faker.date.recent({ days: 60 }).toISOString().split("T")[0]!;

    await db.insert(paymentPlans).values({
      id: planId,
      accountId: account.id,
      termId: currentTerm.id,
      planType: "standard",
      planName: `${currentTerm.name} Payment Plan`,
      totalAmount: balance.toFixed(2),
      downPayment: "0.00",
      enrollmentFee: "50.00",
      numberOfPayments,
      paymentAmount: paymentAmount.toFixed(2),
      startDate,
      status: "active",
      remainingBalance: balance.toFixed(2),
      missedPayments: faker.number.int({ min: 0, max: 1 }),
    });
    paymentPlanCount++;

    // Create installments
    const installments = [];
    for (let i = 0; i < numberOfPayments; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);

      const isPaid = i === 0 ? faker.datatype.boolean({ probability: 0.7 }) : false;

      installments.push({
        paymentPlanId: planId,
        installmentNumber: i + 1,
        dueDate: dueDate.toISOString().split("T")[0]!,
        amount: (i === numberOfPayments - 1 ? balance - paymentAmount * (numberOfPayments - 1) : paymentAmount).toFixed(2),
        status: isPaid ? "paid" : i === 0 ? "overdue" : "pending",
        paidAmount: isPaid ? paymentAmount.toFixed(2) : "0.00",
        paidDate: isPaid ? faker.date.recent({ days: 30 }).toISOString().split("T")[0] : null,
      });
      installmentCount++;
    }

    await db.insert(paymentPlanInstallments).values(installments);
  }
  console.log(`  Created ${paymentPlanCount} payment plans with ${installmentCount} installments`);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Seed completed successfully!");
  console.log("=".repeat(60));
  console.log("\nData created:");
  console.log(`  - 1 institution, 2 campuses`);
  console.log(`  - ${termData.length} terms`);
  console.log(`  - ${buildingNames.length} buildings, ${roomValues.length} rooms`);
  console.log(`  - ${Object.keys(DEPARTMENT_COURSES).length} departments`);
  console.log(`  - ${courseData.length} courses, ${sectionData.length} sections`);
  console.log(`  - ${programData.length} programs`);
  console.log(`  - ${CONFIG.numFaculty} faculty members`);
  console.log(`  - ${CONFIG.numStudents} students`);
  console.log(`  - ${allRegistrations.length} enrollments with grades`);
  console.log(`  - ${standingHistories.length} academic standing records`);
  console.log(`  - ${studentsNeedingAppeals.length} academic appeals`);
  console.log(`  - ${chargeCodeData.length} charge codes`);
  console.log(`  - ${accountData.length} student accounts`);
  console.log(`  - ${ledgerData.length} ledger entries`);
  console.log(`  - ${holdData.length} financial holds`);
  console.log(`  - ${paymentPlanCount} payment plans (${installmentCount} installments)`);

  console.log("\nDemo accounts:");
  console.log("  admin@demo.edu      / admin123      (Administrator)");
  console.log("  registrar@demo.edu  / registrar123  (Registrar)");
  console.log("  advisor@demo.edu    / advisor123    (Advisor)");
  console.log("\nStudent accounts: firstname.lastname#@demo.edu / student123");
  console.log("");
}

// Run seed
seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nSeed failed:", err);
    process.exit(1);
  });
