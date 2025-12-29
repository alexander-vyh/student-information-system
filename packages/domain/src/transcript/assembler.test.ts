/**
 * TranscriptAssembler Tests
 *
 * Test-driven development: write tests first, then implement.
 * Tests transformation of database records → TranscriptData
 */

import { describe, it, expect } from "vitest";
import { TranscriptAssembler, type AssemblerInput } from "./assembler.js";

describe("TranscriptAssembler", () => {
  describe("basic student information", () => {
    it("should assemble basic student data with no middle name", () => {
      const input: AssemblerInput = {
        student: {
          id: "student-123",
          studentId: "STU000123",
          firstName: "Jane",
          middleName: null,
          lastName: "Doe",
          suffix: null,
          birthDate: new Date("2000-05-15"),
        },
        institution: {
          name: "State University",
          address1: "123 College Ave",
          city: "Springfield",
          state: "IL",
          postalCode: "62701",
          registrarName: "Dr. Sarah Johnson",
          registrarTitle: "University Registrar",
        },
        nameHistory: [],
        terms: [],
        transferCredits: [],
        degrees: [],
        transcriptType: "unofficial",
      };

      const result = TranscriptAssembler.assemble(input);

      expect(result.student.studentId).toBe("STU000123");
      expect(result.student.firstName).toBe("Jane");
      expect(result.student.middleName).toBeNull();
      expect(result.student.lastName).toBe("Doe");
      expect(result.student.formerNames).toEqual([]);
      expect(result.transcriptType).toBe("unofficial");
    });

    it("should assemble student with middle name and suffix", () => {
      const input: AssemblerInput = {
        student: {
          id: "student-456",
          studentId: "STU000456",
          firstName: "John",
          middleName: "Robert",
          lastName: "Smith",
          suffix: "Jr.",
          birthDate: new Date("1998-03-20"),
        },
        institution: {
          name: "State University",
          address1: "123 College Ave",
          city: "Springfield",
          state: "IL",
          postalCode: "62701",
          registrarName: "Dr. Sarah Johnson",
          registrarTitle: "University Registrar",
        },
        nameHistory: [],
        terms: [],
        transferCredits: [],
        degrees: [],
        transcriptType: "official",
      };

      const result = TranscriptAssembler.assemble(input);

      expect(result.student.middleName).toBe("Robert");
      expect(result.student.suffix).toBe("Jr.");
    });

    it("should assemble former names from name history", () => {
      const input: AssemblerInput = {
        student: {
          id: "student-789",
          studentId: "STU000789",
          firstName: "Mary",
          middleName: "Anne",
          lastName: "Johnson",
          suffix: null,
          birthDate: new Date("1999-08-10"),
        },
        institution: {
          name: "State University",
          address1: "123 College Ave",
          city: "Springfield",
          state: "IL",
          postalCode: "62701",
          registrarName: "Dr. Sarah Johnson",
          registrarTitle: "University Registrar",
        },
        nameHistory: [
          {
            firstName: "Mary",
            middleName: "Anne",
            lastName: "Williams",
            suffix: null,
            nameType: "previous_legal",
            effectiveFrom: new Date("2015-08-01"),
            effectiveUntil: new Date("2020-06-15"),
          },
          {
            firstName: "Mary",
            middleName: null,
            lastName: "Smith",
            suffix: null,
            nameType: "previous_legal",
            effectiveFrom: new Date("2020-06-16"),
            effectiveUntil: new Date("2023-12-20"),
          },
        ],
        terms: [],
        transferCredits: [],
        degrees: [],
        transcriptType: "official",
      };

      const result = TranscriptAssembler.assemble(input);

      expect(result.student.formerNames).toEqual([
        "Williams, Mary Anne",
        "Smith, Mary",
      ]);
    });
  });

  describe("term and course data", () => {
    it("should assemble single term with courses", () => {
      const input: AssemblerInput = {
        student: {
          id: "student-123",
          studentId: "STU000123",
          firstName: "Jane",
          middleName: null,
          lastName: "Doe",
          suffix: null,
          birthDate: new Date("2000-05-15"),
        },
        institution: {
          name: "State University",
          address1: "123 College Ave",
          city: "Springfield",
          state: "IL",
          postalCode: "62701",
          registrarName: "Dr. Sarah Johnson",
          registrarTitle: "University Registrar",
        },
        nameHistory: [],
        terms: [
          {
            termId: "term-fa24",
            termCode: "FA24",
            termName: "Fall 2024",
            startDate: new Date("2024-08-26"),
            endDate: new Date("2024-12-15"),
            registrations: [
              {
                courseCode: "CS 101",
                courseTitle: "Introduction to Computer Science",
                creditHours: 3.0,
                gradeCode: "A",
                gradePoints: 4.0,
                creditsEarned: 3.0,
                includeInGpa: true,
                isRepeat: false,
                status: "completed",
              },
              {
                courseCode: "MATH 150",
                courseTitle: "Calculus I",
                creditHours: 4.0,
                gradeCode: "B+",
                gradePoints: 3.3,
                creditsEarned: 4.0,
                includeInGpa: true,
                isRepeat: false,
                status: "completed",
              },
            ],
          },
        ],
        transferCredits: [],
        degrees: [],
        transcriptType: "unofficial",
      };

      const result = TranscriptAssembler.assemble(input);

      expect(result.terms).toHaveLength(1);
      expect(result.terms[0].termCode).toBe("FA24");
      expect(result.terms[0].courses).toHaveLength(2);
      expect(result.terms[0].courses[0].courseCode).toBe("CS 101");
      expect(result.terms[0].courses[0].gradeCode).toBe("A");
      expect(result.terms[0].termGpa).toBeCloseTo(3.6, 2); // (3*4.0 + 4*3.3) / 7 = 3.6
      expect(result.terms[0].termCreditsAttempted).toBe(7.0);
      expect(result.terms[0].termCreditsEarned).toBe(7.0);
    });

    it("should calculate cumulative GPA across multiple terms", () => {
      const input: AssemblerInput = {
        student: {
          id: "student-123",
          studentId: "STU000123",
          firstName: "Jane",
          middleName: null,
          lastName: "Doe",
          suffix: null,
          birthDate: new Date("2000-05-15"),
        },
        institution: {
          name: "State University",
          address1: "123 College Ave",
          city: "Springfield",
          state: "IL",
          postalCode: "62701",
          registrarName: "Dr. Sarah Johnson",
          registrarTitle: "University Registrar",
        },
        nameHistory: [],
        terms: [
          {
            termId: "term-fa24",
            termCode: "FA24",
            termName: "Fall 2024",
            startDate: new Date("2024-08-26"),
            endDate: new Date("2024-12-15"),
            registrations: [
              {
                courseCode: "CS 101",
                courseTitle: "Introduction to Computer Science",
                creditHours: 3.0,
                gradeCode: "A",
                gradePoints: 4.0,
                creditsEarned: 3.0,
                includeInGpa: true,
                isRepeat: false,
                status: "completed",
              },
            ],
          },
          {
            termId: "term-sp25",
            termCode: "SP25",
            termName: "Spring 2025",
            startDate: new Date("2025-01-13"),
            endDate: new Date("2025-05-10"),
            registrations: [
              {
                courseCode: "CS 102",
                courseTitle: "Data Structures",
                creditHours: 3.0,
                gradeCode: "B",
                gradePoints: 3.0,
                creditsEarned: 3.0,
                includeInGpa: true,
                isRepeat: false,
                status: "completed",
              },
            ],
          },
        ],
        transferCredits: [],
        degrees: [],
        transcriptType: "unofficial",
      };

      const result = TranscriptAssembler.assemble(input);

      expect(result.cumulativeGpa).toBeCloseTo(3.5, 2); // (3*4.0 + 3*3.0) / 6 = 3.5
      expect(result.totalCreditsAttempted).toBe(6.0);
      expect(result.totalCreditsEarned).toBe(6.0);
      expect(result.totalQualityPoints).toBe(21.0); // 3*4.0 + 3*3.0
    });

    it("should handle withdrawn courses (no credits earned, no GPA impact)", () => {
      const input: AssemblerInput = {
        student: {
          id: "student-123",
          studentId: "STU000123",
          firstName: "Jane",
          middleName: null,
          lastName: "Doe",
          suffix: null,
          birthDate: new Date("2000-05-15"),
        },
        institution: {
          name: "State University",
          address1: "123 College Ave",
          city: "Springfield",
          state: "IL",
          postalCode: "62701",
          registrarName: "Dr. Sarah Johnson",
          registrarTitle: "University Registrar",
        },
        nameHistory: [],
        terms: [
          {
            termId: "term-fa24",
            termCode: "FA24",
            termName: "Fall 2024",
            startDate: new Date("2024-08-26"),
            endDate: new Date("2024-12-15"),
            registrations: [
              {
                courseCode: "CS 101",
                courseTitle: "Introduction to Computer Science",
                creditHours: 3.0,
                gradeCode: "A",
                gradePoints: 4.0,
                creditsEarned: 3.0,
                includeInGpa: true,
                isRepeat: false,
                status: "completed",
              },
              {
                courseCode: "MATH 150",
                courseTitle: "Calculus I",
                creditHours: 4.0,
                gradeCode: "W",
                gradePoints: null,
                creditsEarned: 0.0,
                includeInGpa: false,
                isRepeat: false,
                status: "withdrawn",
              },
            ],
          },
        ],
        transferCredits: [],
        degrees: [],
        transcriptType: "unofficial",
      };

      const result = TranscriptAssembler.assemble(input);

      expect(result.terms[0].termGpa).toBeCloseTo(4.0, 2); // Only CS 101 counts
      expect(result.terms[0].termCreditsAttempted).toBe(7.0); // Both courses attempted
      expect(result.terms[0].termCreditsEarned).toBe(3.0); // Only CS 101 earned
      expect(result.totalCreditsAttempted).toBe(7.0);
      expect(result.totalCreditsEarned).toBe(3.0);
    });

    it("should handle in-progress courses (no grade yet)", () => {
      const input: AssemblerInput = {
        student: {
          id: "student-123",
          studentId: "STU000123",
          firstName: "Jane",
          middleName: null,
          lastName: "Doe",
          suffix: null,
          birthDate: new Date("2000-05-15"),
        },
        institution: {
          name: "State University",
          address1: "123 College Ave",
          city: "Springfield",
          state: "IL",
          postalCode: "62701",
          registrarName: "Dr. Sarah Johnson",
          registrarTitle: "University Registrar",
        },
        nameHistory: [],
        terms: [
          {
            termId: "term-sp25",
            termCode: "SP25",
            termName: "Spring 2025",
            startDate: new Date("2025-01-13"),
            endDate: new Date("2025-05-10"),
            registrations: [
              {
                courseCode: "CS 201",
                courseTitle: "Algorithms",
                creditHours: 3.0,
                gradeCode: null,
                gradePoints: null,
                creditsEarned: 0.0,
                includeInGpa: false,
                isRepeat: false,
                status: "registered",
              },
            ],
          },
        ],
        transferCredits: [],
        degrees: [],
        transcriptType: "unofficial",
      };

      const result = TranscriptAssembler.assemble(input);

      expect(result.terms[0].courses[0].gradeCode).toBeNull();
      expect(result.terms[0].termGpa).toBeNull(); // No grades yet
      expect(result.terms[0].termCreditsAttempted).toBe(3.0);
      expect(result.terms[0].termCreditsEarned).toBe(0.0);
    });
  });

  describe("transfer credits", () => {
    it("should assemble transfer credits separately", () => {
      const input: AssemblerInput = {
        student: {
          id: "student-123",
          studentId: "STU000123",
          firstName: "Jane",
          middleName: null,
          lastName: "Doe",
          suffix: null,
          birthDate: new Date("2000-05-15"),
        },
        institution: {
          name: "State University",
          address1: "123 College Ave",
          city: "Springfield",
          state: "IL",
          postalCode: "62701",
          registrarName: "Dr. Sarah Johnson",
          registrarTitle: "University Registrar",
        },
        nameHistory: [],
        terms: [],
        transferCredits: [
          {
            courseCode: "ENG 101",
            courseTitle: "English Composition",
            credits: 3.0,
            transferInstitution: "Community College of Springfield",
          },
          {
            courseCode: "HIST 100",
            courseTitle: "World History",
            credits: 3.0,
            transferInstitution: "Community College of Springfield",
          },
        ],
        degrees: [],
        transcriptType: "official",
      };

      const result = TranscriptAssembler.assemble(input);

      expect(result.transferCredits).toHaveLength(2);
      expect(result.transferCredits[0].courseCode).toBe("ENG 101");
      expect(result.transferCredits[0].gradeCode).toBeNull(); // Transfer credits have no grades
      expect(result.transferCredits[0].isTransfer).toBe(true);
      expect(result.transferCredits[0].transferInstitution).toBe("Community College of Springfield");
      expect(result.totalCreditsEarned).toBe(6.0); // Transfer credits count as earned
      expect(result.cumulativeGpa).toBeNull(); // No graded courses
    });
  });

  describe("degrees", () => {
    it("should assemble conferred degrees", () => {
      const input: AssemblerInput = {
        student: {
          id: "student-123",
          studentId: "STU000123",
          firstName: "Jane",
          middleName: null,
          lastName: "Doe",
          suffix: null,
          birthDate: new Date("2000-05-15"),
        },
        institution: {
          name: "State University",
          address1: "123 College Ave",
          city: "Springfield",
          state: "IL",
          postalCode: "62701",
          registrarName: "Dr. Sarah Johnson",
          registrarTitle: "University Registrar",
        },
        nameHistory: [],
        terms: [],
        transferCredits: [],
        degrees: [
          {
            degreeTitle: "Bachelor of Science in Computer Science",
            conferralDate: new Date("2024-05-15"),
            honorsDesignation: "Magna Cum Laude",
          },
        ],
        transcriptType: "official",
      };

      const result = TranscriptAssembler.assemble(input);

      expect(result.degrees).toHaveLength(1);
      expect(result.degrees[0].degreeTitle).toBe("Bachelor of Science in Computer Science");
      expect(result.degrees[0].honorsDesignation).toBe("Magna Cum Laude");
    });
  });

  describe("metadata", () => {
    it("should set generatedAt timestamp", () => {
      const before = new Date();

      const input: AssemblerInput = {
        student: {
          id: "student-123",
          studentId: "STU000123",
          firstName: "Jane",
          middleName: null,
          lastName: "Doe",
          suffix: null,
          birthDate: new Date("2000-05-15"),
        },
        institution: {
          name: "State University",
          address1: "123 College Ave",
          city: "Springfield",
          state: "IL",
          postalCode: "62701",
          registrarName: "Dr. Sarah Johnson",
          registrarTitle: "University Registrar",
        },
        nameHistory: [],
        terms: [],
        transferCredits: [],
        degrees: [],
        transcriptType: "official",
      };

      const result = TranscriptAssembler.assemble(input);
      const after = new Date();

      expect(result.generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
