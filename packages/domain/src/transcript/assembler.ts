/**
 * TranscriptAssembler
 *
 * Transforms database records into domain TranscriptData.
 * Pure function - no database dependencies, fully testable.
 */

import type {
  TranscriptData,
  TranscriptStudent,
  TranscriptCourse,
  TranscriptTerm,
  TranscriptDegree,
  TranscriptInstitution,
} from "./types.js";
import { formatStudentName } from "./formatter.js";

/**
 * Input shape from database queries
 * This defines the contract between the database layer and domain logic
 */
export interface AssemblerInput {
  student: {
    id: string;
    studentId: string; // Institutional ID
    firstName: string;
    middleName: string | null;
    lastName: string;
    suffix: string | null;
    birthDate: Date;
  };

  institution: {
    name: string;
    address1: string;
    city: string;
    state: string;
    postalCode: string;
    registrarName: string;
    registrarTitle: string;
  };

  nameHistory: Array<{
    firstName: string;
    middleName: string | null;
    lastName: string;
    suffix: string | null;
    nameType: string;
    effectiveFrom: Date;
    effectiveUntil: Date | null;
  }>;

  terms: Array<{
    termId: string;
    termCode: string;
    termName: string;
    startDate: Date;
    endDate: Date;
    registrations: Array<{
      courseCode: string;
      courseTitle: string;
      creditHours: number;
      gradeCode: string | null;
      gradePoints: number | null;
      creditsEarned: number;
      includeInGpa: boolean;
      isRepeat: boolean;
      status: string;
    }>;
  }>;

  transferCredits: Array<{
    courseCode: string;
    courseTitle: string;
    credits: number;
    transferInstitution: string;
  }>;

  degrees: Array<{
    degreeTitle: string;
    conferralDate: Date;
    honorsDesignation: string | null;
  }>;

  transcriptType: "official" | "unofficial";
}

/**
 * TranscriptAssembler
 *
 * Main entry point for transforming database records into transcript data.
 */
export class TranscriptAssembler {
  /**
   * Assemble complete transcript from database records
   */
  static assemble(input: AssemblerInput): TranscriptData {
    const student = this.assembleStudent(input);
    const institution = this.assembleInstitution(input.institution);
    const terms = this.assembleTerms(input.terms);
    const transferCredits = this.assembleTransferCredits(input.transferCredits);
    const degrees = this.assembleDegrees(input.degrees);

    // Calculate cumulative statistics
    const stats = this.calculateCumulativeStatistics(terms, transferCredits);

    return {
      student,
      institution,
      terms,
      transferCredits,
      degrees,
      cumulativeGpa: stats.cumulativeGpa,
      totalCreditsAttempted: stats.totalCreditsAttempted,
      totalCreditsEarned: stats.totalCreditsEarned,
      totalQualityPoints: stats.totalQualityPoints,
      generatedAt: new Date(),
      transcriptType: input.transcriptType,
    };
  }

  /**
   * Assemble student information with former names
   */
  private static assembleStudent(input: AssemblerInput): TranscriptStudent {
    const formerNames = input.nameHistory
      .filter((name) => name.nameType === "previous_legal")
      .map((name) =>
        formatStudentName({
          firstName: name.firstName,
          middleName: name.middleName,
          lastName: name.lastName,
          suffix: name.suffix,
        })
      );

    return {
      studentId: input.student.studentId,
      firstName: input.student.firstName,
      middleName: input.student.middleName,
      lastName: input.student.lastName,
      suffix: input.student.suffix,
      birthDate: input.student.birthDate,
      formerNames,
    };
  }

  /**
   * Assemble institution information
   */
  private static assembleInstitution(
    institution: AssemblerInput["institution"]
  ): TranscriptInstitution {
    return {
      name: institution.name,
      address: {
        address1: institution.address1,
        city: institution.city,
        state: institution.state,
        postalCode: institution.postalCode,
      },
      registrarName: institution.registrarName,
      registrarTitle: institution.registrarTitle,
    };
  }

  /**
   * Assemble terms with courses and term statistics
   */
  private static assembleTerms(terms: AssemblerInput["terms"]): TranscriptTerm[] {
    return terms.map((term) => {
      const courses = term.registrations.map((reg) =>
        this.assembleCourse(reg)
      );

      const termStats = this.calculateTermStatistics(term.registrations);

      return {
        termId: term.termId,
        termCode: term.termCode,
        termName: term.termName,
        startDate: term.startDate,
        endDate: term.endDate,
        courses,
        termGpa: termStats.termGpa,
        termCreditsAttempted: termStats.creditsAttempted,
        termCreditsEarned: termStats.creditsEarned,
      };
    });
  }

  /**
   * Assemble single course from registration
   */
  private static assembleCourse(
    registration: AssemblerInput["terms"][0]["registrations"][0]
  ): TranscriptCourse {
    return {
      courseCode: registration.courseCode,
      courseTitle: registration.courseTitle,
      credits: registration.creditHours,
      gradeCode: registration.gradeCode,
      gradePoints: registration.gradePoints,
      includeInGpa: registration.includeInGpa,
      isRepeat: registration.isRepeat,
      isTransfer: false,
    };
  }

  /**
   * Assemble transfer credits
   */
  private static assembleTransferCredits(
    credits: AssemblerInput["transferCredits"]
  ): TranscriptCourse[] {
    return credits.map((credit) => ({
      courseCode: credit.courseCode,
      courseTitle: credit.courseTitle,
      credits: credit.credits,
      gradeCode: null, // Transfer credits don't have grades
      gradePoints: null,
      includeInGpa: false,
      isRepeat: false,
      isTransfer: true,
      transferInstitution: credit.transferInstitution,
    }));
  }

  /**
   * Assemble degrees
   */
  private static assembleDegrees(
    degrees: AssemblerInput["degrees"]
  ): TranscriptDegree[] {
    return degrees.map((degree) => ({
      degreeTitle: degree.degreeTitle,
      conferralDate: degree.conferralDate,
      honorsDesignation: degree.honorsDesignation,
    }));
  }

  /**
   * Calculate term-level statistics (GPA, credits)
   */
  private static calculateTermStatistics(
    registrations: AssemblerInput["terms"][0]["registrations"]
  ): {
    termGpa: number | null;
    creditsAttempted: number;
    creditsEarned: number;
  } {
    let totalQualityPoints = 0;
    let totalGpaCredits = 0;
    let creditsAttempted = 0;
    let creditsEarned = 0;

    for (const reg of registrations) {
      creditsAttempted += reg.creditHours;
      creditsEarned += reg.creditsEarned;

      if (reg.includeInGpa && reg.gradePoints !== null) {
        totalQualityPoints += reg.creditHours * reg.gradePoints;
        totalGpaCredits += reg.creditHours;
      }
    }

    const termGpa = totalGpaCredits > 0 ? totalQualityPoints / totalGpaCredits : null;

    return {
      termGpa,
      creditsAttempted,
      creditsEarned,
    };
  }

  /**
   * Calculate cumulative statistics across all terms
   */
  private static calculateCumulativeStatistics(
    terms: TranscriptTerm[],
    transferCredits: TranscriptCourse[]
  ): {
    cumulativeGpa: number | null;
    totalCreditsAttempted: number;
    totalCreditsEarned: number;
    totalQualityPoints: number;
  } {
    let totalQualityPoints = 0;
    let totalGpaCredits = 0;
    let totalCreditsAttempted = 0;
    let totalCreditsEarned = 0;

    // Sum up all term courses
    for (const term of terms) {
      totalCreditsAttempted += term.termCreditsAttempted;
      totalCreditsEarned += term.termCreditsEarned;

      for (const course of term.courses) {
        if (course.includeInGpa && course.gradePoints !== null) {
          totalQualityPoints += course.credits * course.gradePoints;
          totalGpaCredits += course.credits;
        }
      }
    }

    // Add transfer credits to earned (but not GPA)
    for (const credit of transferCredits) {
      totalCreditsEarned += credit.credits;
    }

    const cumulativeGpa = totalGpaCredits > 0 ? totalQualityPoints / totalGpaCredits : null;

    return {
      cumulativeGpa,
      totalCreditsAttempted,
      totalCreditsEarned,
      totalQualityPoints,
    };
  }
}
