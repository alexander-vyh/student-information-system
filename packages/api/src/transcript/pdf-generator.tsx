/**
 * Transcript PDF Generator
 *
 * Generates PDF transcripts using @react-pdf/renderer.
 * Uses React components for maintainable, template-like code.
 */

import React, { type FC } from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFViewer,
  pdf,
} from "@react-pdf/renderer";
import type { TranscriptData } from "@sis/domain/transcript";
import {
  formatStudentName,
  formatGpa,
  formatDate,
  formatCredits,
  formatFormerNames,
} from "@sis/domain/transcript";

// Styles for transcript PDF
const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
    textAlign: "center",
  },
  institutionName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  institutionAddress: {
    fontSize: 9,
    color: "#666",
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 15,
    marginBottom: 15,
    textAlign: "center",
    textTransform: "uppercase",
  },
  watermark: {
    position: "absolute",
    fontSize: 72,
    color: "#ff0000",
    opacity: 0.15,
    transform: "rotate(-45deg)",
    top: "45%",
    left: "15%",
    fontWeight: "bold",
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 5,
    borderBottom: "1pt solid #000",
    paddingBottom: 2,
  },
  row: {
    flexDirection: "row",
    marginBottom: 2,
  },
  label: {
    width: "30%",
    fontWeight: "bold",
  },
  value: {
    width: "70%",
  },
  termHeader: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 5,
    borderBottom: "1pt solid #ccc",
    paddingBottom: 2,
  },
  courseTable: {
    marginBottom: 10,
  },
  courseRow: {
    flexDirection: "row",
    borderBottom: "0.5pt solid #eee",
    paddingVertical: 3,
  },
  courseCode: {
    width: "15%",
  },
  courseTitle: {
    width: "50%",
  },
  courseCredits: {
    width: "12%",
    textAlign: "right",
  },
  courseGrade: {
    width: "12%",
    textAlign: "right",
  },
  coursePoints: {
    width: "11%",
    textAlign: "right",
  },
  termSummary: {
    flexDirection: "row",
    marginTop: 5,
    marginBottom: 5,
    paddingTop: 3,
    borderTop: "1pt solid #000",
  },
  summaryLabel: {
    width: "65%",
    fontWeight: "bold",
    textAlign: "right",
    paddingRight: 10,
  },
  summaryValue: {
    width: "35%",
    textAlign: "right",
  },
  cumulativeSection: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#f0f0f0",
  },
  cumulativeRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  cumulativeLabel: {
    width: "70%",
    fontWeight: "bold",
  },
  cumulativeValue: {
    width: "30%",
    textAlign: "right",
    fontWeight: "bold",
  },
  degreeSection: {
    marginTop: 20,
    padding: 15,
    border: "2pt solid #000",
    textAlign: "center",
  },
  degreeTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 5,
  },
  degreeDate: {
    fontSize: 10,
    marginTop: 3,
  },
  degreeHonors: {
    fontSize: 10,
    fontStyle: "italic",
    marginTop: 5,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    fontSize: 8,
    color: "#666",
    borderTop: "0.5pt solid #ccc",
    paddingTop: 5,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
});

interface TranscriptPDFProps {
  data: TranscriptData;
}

/**
 * Transcript PDF Document Component
 */
export const TranscriptPDF: FC<TranscriptPDFProps> = ({ data }) => {
  const studentName = formatStudentName({
    firstName: data.student.firstName,
    middleName: data.student.middleName,
    lastName: data.student.lastName,
    suffix: data.student.suffix,
  });

  const formerNamesText = formatFormerNames(data.student.formerNames);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Watermark for unofficial transcripts */}
        {data.transcriptType === "unofficial" && (
          <View style={styles.watermark} fixed>
            <Text>UNOFFICIAL</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.institutionName}>{data.institution.name}</Text>
          <Text style={styles.institutionAddress}>
            {data.institution.address.address1}
          </Text>
          <Text style={styles.institutionAddress}>
            {data.institution.address.city}, {data.institution.address.state}{" "}
            {data.institution.address.postalCode}
          </Text>
        </View>

        <Text style={styles.title}>
          {data.transcriptType === "official" ? "Official" : "Unofficial"}{" "}
          Academic Transcript
        </Text>

        {/* Student Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Student Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name:</Text>
            <Text style={styles.value}>{studentName}</Text>
          </View>
          {formerNamesText && (
            <View style={styles.row}>
              <Text style={styles.label}></Text>
              <Text style={styles.value}>{formerNamesText}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Student ID:</Text>
            <Text style={styles.value}>{data.student.studentId}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date of Birth:</Text>
            <Text style={styles.value}>
              {formatDate(data.student.birthDate)}
            </Text>
          </View>
        </View>

        {/* Transfer Credits */}
        {data.transferCredits.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transfer Credits Accepted</Text>
            <View style={styles.courseTable}>
              {data.transferCredits.map((course, idx) => (
                <View key={idx} style={styles.courseRow}>
                  <Text style={styles.courseCode}>{course.courseCode}</Text>
                  <Text style={styles.courseTitle}>{course.courseTitle}</Text>
                  <Text style={styles.courseCredits}>
                    {formatCredits(course.credits)}
                  </Text>
                  <Text style={styles.courseGrade}>TR</Text>
                  <Text style={styles.coursePoints}>-</Text>
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 8, fontStyle: "italic" }}>
              Institution: {data.transferCredits[0]?.transferInstitution}
            </Text>
          </View>
        )}

        {/* Academic History by Term */}
        {data.terms.map((term, termIdx) => (
          <View key={term.termId} style={styles.section} wrap={false}>
            <Text style={styles.termHeader}>
              {term.termName} ({term.termCode})
            </Text>

            <View style={styles.courseTable}>
              {/* Course header */}
              <View style={styles.courseRow}>
                <Text style={[styles.courseCode, { fontWeight: "bold" }]}>
                  Course
                </Text>
                <Text style={[styles.courseTitle, { fontWeight: "bold" }]}>
                  Title
                </Text>
                <Text style={[styles.courseCredits, { fontWeight: "bold" }]}>
                  Credits
                </Text>
                <Text style={[styles.courseGrade, { fontWeight: "bold" }]}>
                  Grade
                </Text>
                <Text style={[styles.coursePoints, { fontWeight: "bold" }]}>
                  Points
                </Text>
              </View>

              {/* Courses */}
              {term.courses.map((course, idx) => (
                <View key={idx} style={styles.courseRow}>
                  <Text style={styles.courseCode}>{course.courseCode}</Text>
                  <Text style={styles.courseTitle}>{course.courseTitle}</Text>
                  <Text style={styles.courseCredits}>
                    {formatCredits(course.credits)}
                  </Text>
                  <Text style={styles.courseGrade}>
                    {course.gradeCode || "IP"}
                  </Text>
                  <Text style={styles.coursePoints}>
                    {course.gradePoints !== null
                      ? formatGpa(course.gradePoints)
                      : "-"}
                  </Text>
                </View>
              ))}
            </View>

            {/* Term Summary */}
            <View style={styles.termSummary}>
              <Text style={styles.summaryLabel}>Term GPA:</Text>
              <Text style={styles.summaryValue}>
                {formatGpa(term.termGpa)}
              </Text>
            </View>
            <View style={styles.termSummary}>
              <Text style={styles.summaryLabel}>Term Credits:</Text>
              <Text style={styles.summaryValue}>
                {formatCredits(term.termCreditsEarned)} earned /{" "}
                {formatCredits(term.termCreditsAttempted)} attempted
              </Text>
            </View>
          </View>
        ))}

        {/* Cumulative Summary */}
        <View style={styles.cumulativeSection} wrap={false}>
          <View style={styles.cumulativeRow}>
            <Text style={styles.cumulativeLabel}>Cumulative GPA:</Text>
            <Text style={styles.cumulativeValue}>
              {formatGpa(data.cumulativeGpa)}
            </Text>
          </View>
          <View style={styles.cumulativeRow}>
            <Text style={styles.cumulativeLabel}>Total Credits Earned:</Text>
            <Text style={styles.cumulativeValue}>
              {formatCredits(data.totalCreditsEarned)}
            </Text>
          </View>
          <View style={styles.cumulativeRow}>
            <Text style={styles.cumulativeLabel}>Total Credits Attempted:</Text>
            <Text style={styles.cumulativeValue}>
              {formatCredits(data.totalCreditsAttempted)}
            </Text>
          </View>
          <View style={styles.cumulativeRow}>
            <Text style={styles.cumulativeLabel}>Total Quality Points:</Text>
            <Text style={styles.cumulativeValue}>
              {data.totalQualityPoints.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Degrees Conferred */}
        {data.degrees.map((degree, idx) => (
          <View key={idx} style={styles.degreeSection} wrap={false}>
            <Text style={styles.degreeTitle}>{degree.degreeTitle}</Text>
            <Text style={styles.degreeDate}>
              Conferred: {formatDate(degree.conferralDate)}
            </Text>
            {degree.honorsDesignation && (
              <Text style={styles.degreeHonors}>
                {degree.honorsDesignation}
              </Text>
            )}
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={styles.footerRow}>
            <Text>
              {data.institution.registrarName},{" "}
              {data.institution.registrarTitle}
            </Text>
            <Text>Generated: {formatDate(data.generatedAt)}</Text>
          </View>
          {data.transcriptType === "unofficial" && (
            <Text style={{ marginTop: 5, fontSize: 7, color: "#ff0000" }}>
              This is an unofficial transcript and is not valid for official
              use. Request an official transcript for verification purposes.
            </Text>
          )}
        </View>
      </Page>
    </Document>
  );
};

/**
 * Generate PDF bytes from transcript data
 */
export async function generateTranscriptPDF(
  data: TranscriptData
): Promise<Uint8Array> {
  const doc = <TranscriptPDF data={data} />;
  const asPdf = pdf(doc);
  const blob = await asPdf.toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
