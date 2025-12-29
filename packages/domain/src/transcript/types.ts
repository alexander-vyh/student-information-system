/**
 * Transcript Domain Types
 *
 * Pure TypeScript types for transcript generation.
 * No database or framework dependencies.
 */

/**
 * Student demographic information for transcript
 */
export interface TranscriptStudent {
  studentId: string; // Institutional student ID (e.g., "STU000123")
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  birthDate: Date;
  formerNames: string[]; // For "Formerly known as" section
}

/**
 * Course enrollment for transcript
 */
export interface TranscriptCourse {
  courseCode: string; // e.g., "CS 231"
  courseTitle: string; // Historical title (at time of registration)
  credits: number;
  gradeCode: string | null; // e.g., "A", "B+", "W", "I"
  gradePoints: number | null; // e.g., 4.0, 3.3, null for W/I
  includeInGpa: boolean;
  isRepeat: boolean;
  isTransfer: boolean;
  transferInstitution?: string;
}

/**
 * Term/semester data for transcript
 */
export interface TranscriptTerm {
  termId: string;
  termCode: string; // e.g., "SP26"
  termName: string; // e.g., "Spring 2026"
  startDate: Date;
  endDate: Date;
  courses: TranscriptCourse[];
  termGpa: number | null; // null if no graded courses
  termCreditsAttempted: number;
  termCreditsEarned: number;
}

/**
 * Degree conferred information
 */
export interface TranscriptDegree {
  degreeTitle: string; // e.g., "Bachelor of Science in Computer Science"
  conferralDate: Date;
  honorsDesignation: string | null; // e.g., "Magna Cum Laude"
}

/**
 * Institution information
 */
export interface TranscriptInstitution {
  name: string;
  address: {
    address1: string;
    city: string;
    state: string;
    postalCode: string;
  };
  registrarName: string;
  registrarTitle: string;
}

/**
 * Complete transcript data structure
 */
export interface TranscriptData {
  // Student information
  student: TranscriptStudent;

  // Institution
  institution: TranscriptInstitution;

  // Academic history (ordered by term)
  terms: TranscriptTerm[];

  // Transfer credits (grouped separately)
  transferCredits: TranscriptCourse[];

  // Cumulative statistics
  cumulativeGpa: number | null;
  totalCreditsAttempted: number;
  totalCreditsEarned: number;
  totalQualityPoints: number;

  // Degrees awarded
  degrees: TranscriptDegree[];

  // Metadata
  generatedAt: Date;
  transcriptType: "official" | "unofficial";
}

/**
 * PDF generation options
 */
export interface PdfGenerationOptions {
  // Watermark for unofficial transcripts
  watermark?: string; // Default: "UNOFFICIAL"

  // Include security features (official only)
  includeDigitalSignature: boolean;
  includeQrCode: boolean;
  includeInstitutionSeal: boolean;

  // Layout options
  fontSize: number; // Default: 10
  pageMargins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };

  // Verification URL (for QR code)
  verificationUrl?: string;
}

/**
 * Security features for PDF
 */
export interface TranscriptSecurityFeatures {
  documentHash: string; // SHA-256
  digitalSignature: {
    certificate: string; // Base64 X.509
    signature: string; // PKCS#7
  } | null;
  qrCode: string | null; // Data URL
  watermark: string | null;
}

/**
 * Transcript generation result
 */
export interface TranscriptGenerationResult {
  pdfBytes: Uint8Array;
  securityFeatures: TranscriptSecurityFeatures;
  metadata: {
    pageCount: number;
    fileSize: number;
    generatedAt: Date;
  };
}
