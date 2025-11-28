/**
 * Database Seed Script
 *
 * Creates demo data for local development and testing.
 * Run with: pnpm --filter @sis/db db:seed
 */

import "dotenv/config";
import { db } from "./index";
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
  colleges,
  departments,
  subjects,
  courses,
  sections,
  registrations,
} from "./schema/index";

// Demo UUIDs (fixed for reproducibility)
const IDS = {
  institution: "11111111-1111-1111-1111-111111111111",
  // Campus
  mainCampus: "22222222-2222-2222-2222-222222222000",
  // Terms
  termFall2024: "22222222-2222-2222-2222-222222222001",
  termSpring2025: "22222222-2222-2222-2222-222222222002",
  // Users
  adminUser: "33333333-3333-3333-3333-333333333001",
  registrarUser: "33333333-3333-3333-3333-333333333002",
  advisorUser: "33333333-3333-3333-3333-333333333003",
  studentUser1: "33333333-3333-3333-3333-333333333004",
  studentUser2: "33333333-3333-3333-3333-333333333005",
  // Roles
  roleAdmin: "44444444-4444-4444-4444-444444444001",
  roleRegistrar: "44444444-4444-4444-4444-444444444002",
  roleAdvisor: "44444444-4444-4444-4444-444444444003",
  roleStudent: "44444444-4444-4444-4444-444444444004",
  // Students
  student1: "55555555-5555-5555-5555-555555555001",
  student2: "55555555-5555-5555-5555-555555555002",
  // Academic
  collegeArtsSciences: "66666666-6666-6666-6666-666666666001",
  deptComputerScience: "77777777-7777-7777-7777-777777777001",
  deptMathematics: "77777777-7777-7777-7777-777777777002",
  subjectCS: "88888888-8888-8888-8888-888888888001",
  subjectMATH: "88888888-8888-8888-8888-888888888002",
  // Courses
  courseCS101: "99999999-9999-9999-9999-999999999001",
  courseCS201: "99999999-9999-9999-9999-999999999002",
  courseMATH101: "99999999-9999-9999-9999-999999999003",
  // Sections
  sectionCS101_01: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001",
  sectionCS201_01: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002",
  sectionMATH101_01: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003",
  // Buildings
  buildingScience: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001",
  // Rooms
  roomSci101: "cccccccc-cccc-cccc-cccc-ccccccccc001",
  roomSci201: "cccccccc-cccc-cccc-cccc-ccccccccc002",
};

async function seed() {
  console.log("🌱 Starting database seed...\n");

  // Clear existing data (in reverse dependency order)
  console.log("Clearing existing data...");
  await db.delete(registrations);
  await db.delete(sections);
  await db.delete(courses);
  await db.delete(subjects);
  await db.delete(departments);
  await db.delete(colleges);
  await db.delete(students);
  await db.delete(userRoles);
  await db.delete(users);
  await db.delete(roles);
  await db.delete(rooms);
  await db.delete(buildings);
  await db.delete(terms);
  await db.delete(campuses);
  await db.delete(institutions);

  // 1. Institution
  console.log("Creating institution...");
  await db.insert(institutions).values({
    id: IDS.institution,
    code: "DEMO",
    name: "Demo University",
    shortName: "Demo U",
    opeid: "00000000",
    ipedsId: "000000",
    accreditingBody: "Regional Accreditation",
  });

  // 2. Campus (required for buildings)
  console.log("Creating campus...");
  await db.insert(campuses).values({
    id: IDS.mainCampus,
    institutionId: IDS.institution,
    code: "MAIN",
    name: "Main Campus",
    isMainCampus: true,
  });

  // 3. Terms
  console.log("Creating terms...");
  await db.insert(terms).values([
    {
      id: IDS.termFall2024,
      institutionId: IDS.institution,
      code: "FA24",
      name: "Fall 2024",
      termType: "fall",
      startDate: "2024-08-26",
      endDate: "2024-12-13",
      registrationStartDate: "2024-04-01",
      registrationEndDate: "2024-08-30",
      dropDeadline: "2024-09-06",
      withdrawalDeadline: "2024-11-01",
      finalGradesDue: "2024-12-20",
    },
    {
      id: IDS.termSpring2025,
      institutionId: IDS.institution,
      code: "SP25",
      name: "Spring 2025",
      termType: "spring",
      startDate: "2025-01-13",
      endDate: "2025-05-02",
      registrationStartDate: "2024-11-01",
      registrationEndDate: "2025-01-17",
      dropDeadline: "2025-01-24",
      withdrawalDeadline: "2025-03-21",
      finalGradesDue: "2025-05-09",
    },
  ]);

  // 4. Buildings & Rooms
  console.log("Creating buildings and rooms...");
  await db.insert(buildings).values({
    id: IDS.buildingScience,
    campusId: IDS.mainCampus,
    code: "SCI",
    name: "Science Building",
  });

  await db.insert(rooms).values([
    {
      id: IDS.roomSci101,
      buildingId: IDS.buildingScience,
      roomNumber: "101",
      capacity: 30,
      roomType: "classroom",
    },
    {
      id: IDS.roomSci201,
      buildingId: IDS.buildingScience,
      roomNumber: "201",
      capacity: 25,
      roomType: "lab",
    },
  ]);

  // 5. Roles
  console.log("Creating roles...");
  await db.insert(roles).values([
    {
      id: IDS.roleAdmin,
      institutionId: IDS.institution,
      code: "ADMIN",
      name: "Administrator",
      description: "Full system access",
      isSystem: true,
    },
    {
      id: IDS.roleRegistrar,
      institutionId: IDS.institution,
      code: "REGISTRAR",
      name: "Registrar",
      description: "Registration and records management",
      isSystem: true,
    },
    {
      id: IDS.roleAdvisor,
      institutionId: IDS.institution,
      code: "ADVISOR",
      name: "Academic Advisor",
      description: "Student advising access",
      isSystem: true,
    },
    {
      id: IDS.roleStudent,
      institutionId: IDS.institution,
      code: "STUDENT",
      name: "Student",
      description: "Student self-service access",
      isSystem: true,
    },
  ]);

  // 6. Users (password format: dev_<password>)
  console.log("Creating users...");
  const now = new Date();
  await db.insert(users).values([
    {
      id: IDS.adminUser,
      institutionId: IDS.institution,
      email: "admin@demo.edu",
      passwordHash: "dev_admin123",
      firstName: "Admin",
      lastName: "User",
      status: "active",
      emailVerified: now,
    },
    {
      id: IDS.registrarUser,
      institutionId: IDS.institution,
      email: "registrar@demo.edu",
      passwordHash: "dev_registrar123",
      firstName: "Rachel",
      lastName: "Registrar",
      status: "active",
      emailVerified: now,
    },
    {
      id: IDS.advisorUser,
      institutionId: IDS.institution,
      email: "advisor@demo.edu",
      passwordHash: "dev_advisor123",
      firstName: "Adam",
      lastName: "Advisor",
      status: "active",
      emailVerified: now,
    },
    {
      id: IDS.studentUser1,
      institutionId: IDS.institution,
      email: "student1@demo.edu",
      passwordHash: "dev_student123",
      firstName: "Alice",
      lastName: "Student",
      status: "active",
      emailVerified: now,
    },
    {
      id: IDS.studentUser2,
      institutionId: IDS.institution,
      email: "student2@demo.edu",
      passwordHash: "dev_student123",
      firstName: "Bob",
      lastName: "Learner",
      status: "active",
      emailVerified: now,
    },
  ]);

  // 7. User Role Assignments
  console.log("Assigning roles...");
  await db.insert(userRoles).values([
    { userId: IDS.adminUser, roleId: IDS.roleAdmin },
    { userId: IDS.registrarUser, roleId: IDS.roleRegistrar },
    { userId: IDS.advisorUser, roleId: IDS.roleAdvisor },
    { userId: IDS.studentUser1, roleId: IDS.roleStudent },
    { userId: IDS.studentUser2, roleId: IDS.roleStudent },
  ]);

  // 8. Students
  console.log("Creating students...");
  await db.insert(students).values([
    {
      id: IDS.student1,
      institutionId: IDS.institution,
      userId: IDS.studentUser1,
      studentId: "STU001",
      legalFirstName: "Alice",
      legalLastName: "Student",
      preferredFirstName: "Ali",
      dateOfBirth: "2002-05-15",
      primaryEmail: "student1@demo.edu",
      status: "active",
    },
    {
      id: IDS.student2,
      institutionId: IDS.institution,
      userId: IDS.studentUser2,
      studentId: "STU002",
      legalFirstName: "Bob",
      legalLastName: "Learner",
      dateOfBirth: "2001-09-22",
      primaryEmail: "student2@demo.edu",
      status: "active",
    },
  ]);

  // 9. Academic Structure
  console.log("Creating academic structure...");
  await db.insert(colleges).values({
    id: IDS.collegeArtsSciences,
    institutionId: IDS.institution,
    code: "CAS",
    name: "College of Arts & Sciences",
  });

  await db.insert(departments).values([
    {
      id: IDS.deptComputerScience,
      collegeId: IDS.collegeArtsSciences,
      code: "CS",
      name: "Computer Science",
    },
    {
      id: IDS.deptMathematics,
      collegeId: IDS.collegeArtsSciences,
      code: "MATH",
      name: "Mathematics",
    },
  ]);

  await db.insert(subjects).values([
    {
      id: IDS.subjectCS,
      institutionId: IDS.institution,
      code: "CS",
      name: "Computer Science",
      departmentId: IDS.deptComputerScience,
    },
    {
      id: IDS.subjectMATH,
      institutionId: IDS.institution,
      code: "MATH",
      name: "Mathematics",
      departmentId: IDS.deptMathematics,
    },
  ]);

  // 10. Courses
  console.log("Creating courses...");
  await db.insert(courses).values([
    {
      id: IDS.courseCS101,
      institutionId: IDS.institution,
      subjectId: IDS.subjectCS,
      courseNumber: "101",
      courseCode: "CS 101",
      title: "Introduction to Computer Science",
      description: "Fundamentals of programming and computational thinking.",
      creditHoursMin: "3.00",
    },
    {
      id: IDS.courseCS201,
      institutionId: IDS.institution,
      subjectId: IDS.subjectCS,
      courseNumber: "201",
      courseCode: "CS 201",
      title: "Data Structures",
      description: "Arrays, linked lists, trees, graphs, and algorithms.",
      creditHoursMin: "3.00",
    },
    {
      id: IDS.courseMATH101,
      institutionId: IDS.institution,
      subjectId: IDS.subjectMATH,
      courseNumber: "101",
      courseCode: "MATH 101",
      title: "College Algebra",
      description: "Fundamental concepts of algebra.",
      creditHoursMin: "3.00",
    },
  ]);

  // 11. Sections
  console.log("Creating sections...");
  await db.insert(sections).values([
    {
      id: IDS.sectionCS101_01,
      courseId: IDS.courseCS101,
      termId: IDS.termFall2024,
      sectionNumber: "01",
      creditHours: "3.00",
      maxEnrollment: 30,
      currentEnrollment: 2,
      instructionalMethod: "in_person",
    },
    {
      id: IDS.sectionCS201_01,
      courseId: IDS.courseCS201,
      termId: IDS.termSpring2025,
      sectionNumber: "01",
      creditHours: "3.00",
      maxEnrollment: 25,
      currentEnrollment: 0,
      instructionalMethod: "in_person",
    },
    {
      id: IDS.sectionMATH101_01,
      courseId: IDS.courseMATH101,
      termId: IDS.termFall2024,
      sectionNumber: "01",
      creditHours: "3.00",
      maxEnrollment: 30,
      currentEnrollment: 1,
      instructionalMethod: "in_person",
    },
  ]);

  // 12. Registrations (enrollments)
  console.log("Creating registrations...");
  await db.insert(registrations).values([
    {
      studentId: IDS.student1,
      sectionId: IDS.sectionCS101_01,
      termId: IDS.termFall2024,
      creditHours: "3.00",
      status: "registered",
      registrationMethod: "self",
      gradeMode: "standard",
    },
    {
      studentId: IDS.student1,
      sectionId: IDS.sectionMATH101_01,
      termId: IDS.termFall2024,
      creditHours: "3.00",
      status: "registered",
      registrationMethod: "self",
      gradeMode: "standard",
    },
    {
      studentId: IDS.student2,
      sectionId: IDS.sectionCS101_01,
      termId: IDS.termFall2024,
      creditHours: "3.00",
      status: "registered",
      registrationMethod: "advisor",
      gradeMode: "standard",
    },
  ]);

  console.log("\n✅ Seed completed successfully!\n");
  console.log("Demo accounts created:");
  console.log("  📧 admin@demo.edu      / admin123      (Administrator)");
  console.log("  📧 registrar@demo.edu  / registrar123  (Registrar)");
  console.log("  📧 advisor@demo.edu    / advisor123    (Advisor)");
  console.log("  📧 student1@demo.edu   / student123    (Student: Alice)");
  console.log("  📧 student2@demo.edu   / student123    (Student: Bob)");
  console.log("");
}

// Run seed
seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
