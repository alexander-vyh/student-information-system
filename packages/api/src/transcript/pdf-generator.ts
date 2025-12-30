/**
 * Transcript PDF Generator
 *
 * Generates PDF transcripts using pdf-lib.
 * Direct PDF generation optimized for server-side rendering.
 */

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import type { TranscriptData } from "@sis/domain/transcript";
import {
  formatStudentName,
  formatGpa,
  formatDate,
  formatCredits,
  formatFormerNames,
} from "@sis/domain/transcript";

/**
 * PDF Layout Constants
 */
const MARGIN = 50;
const PAGE_WIDTH = 612; // 8.5 inches * 72 points/inch
const PAGE_HEIGHT = 792; // 11 inches * 72 points/inch
const LINE_HEIGHT = 14;

/**
 * Generate PDF bytes from transcript data using pdf-lib
 */
export async function generateTranscriptPDF(
  data: TranscriptData
): Promise<Uint8Array> {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();

  // Embed fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Add a page
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  let yPos = PAGE_HEIGHT - MARGIN;

  // Format student data
  const studentName = formatStudentName({
    firstName: data.student.firstName,
    middleName: data.student.middleName,
    lastName: data.student.lastName,
    suffix: data.student.suffix,
  });

  const formerNamesText = formatFormerNames(data.student.formerNames);

  // Watermark for unofficial transcripts (top of page)
  if (data.transcriptType === "unofficial") {
    page.drawText("UNOFFICIAL TRANSCRIPT", {
      x: MARGIN,
      y: yPos + 10,
      size: 14,
      font: helveticaBold,
      color: rgb(1, 0, 0),
    });
    yPos -= 10;
  }

  // Header - Institution Name
  const institutionName = data.institution.name;
  const nameWidth = helveticaBold.widthOfTextAtSize(institutionName, 16);
  page.drawText(institutionName, {
    x: (PAGE_WIDTH - nameWidth) / 2,
    y: yPos,
    size: 16,
    font: helveticaBold,
  });
  yPos -= 20;

  // Institution Address
  const address1 = data.institution.address.address1;
  const addr1Width = helvetica.widthOfTextAtSize(address1, 9);
  page.drawText(address1, {
    x: (PAGE_WIDTH - addr1Width) / 2,
    y: yPos,
    size: 9,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });
  yPos -= 12;

  const cityStateZip = `${data.institution.address.city}, ${data.institution.address.state} ${data.institution.address.postalCode}`;
  const cityWidth = helvetica.widthOfTextAtSize(cityStateZip, 9);
  page.drawText(cityStateZip, {
    x: (PAGE_WIDTH - cityWidth) / 2,
    y: yPos,
    size: 9,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });
  yPos -= 30;

  // Title
  const title = `${data.transcriptType === "official" ? "OFFICIAL" : "UNOFFICIAL"} ACADEMIC TRANSCRIPT`;
  const titleWidth = helveticaBold.widthOfTextAtSize(title, 14);
  page.drawText(title, {
    x: (PAGE_WIDTH - titleWidth) / 2,
    y: yPos,
    size: 14,
    font: helveticaBold,
  });
  yPos -= 30;

  // Student Information Section
  page.drawText("Student Information", {
    x: MARGIN,
    y: yPos,
    size: 11,
    font: helveticaBold,
  });
  page.drawLine({
    start: { x: MARGIN, y: yPos - 2 },
    end: { x: PAGE_WIDTH - MARGIN, y: yPos - 2 },
    thickness: 1,
  });
  yPos -= 20;

  // Student details
  page.drawText("Name:", { x: MARGIN, y: yPos, size: 10, font: helveticaBold });
  page.drawText(studentName, { x: MARGIN + 150, y: yPos, size: 10, font: helvetica });
  yPos -= LINE_HEIGHT;

  if (formerNamesText) {
    page.drawText(formerNamesText, { x: MARGIN + 150, y: yPos, size: 10, font: helvetica });
    yPos -= LINE_HEIGHT;
  }

  page.drawText("Student ID:", { x: MARGIN, y: yPos, size: 10, font: helveticaBold });
  page.drawText(data.student.studentId, { x: MARGIN + 150, y: yPos, size: 10, font: helvetica });
  yPos -= LINE_HEIGHT;

  page.drawText("Date of Birth:", { x: MARGIN, y: yPos, size: 10, font: helveticaBold });
  page.drawText(formatDate(data.student.birthDate), { x: MARGIN + 150, y: yPos, size: 10, font: helvetica });
  yPos -= 30;

  // Cumulative Summary
  page.drawText("Academic Summary", {
    x: MARGIN,
    y: yPos,
    size: 11,
    font: helveticaBold,
  });
  page.drawLine({
    start: { x: MARGIN, y: yPos - 2 },
    end: { x: PAGE_WIDTH - MARGIN, y: yPos - 2 },
    thickness: 1,
  });
  yPos -= 20;

  page.drawText("Cumulative GPA:", { x: MARGIN, y: yPos, size: 10, font: helveticaBold });
  page.drawText(formatGpa(data.cumulativeGpa), { x: MARGIN + 150, y: yPos, size: 10, font: helvetica });
  yPos -= LINE_HEIGHT;

  page.drawText("Total Credits Earned:", { x: MARGIN, y: yPos, size: 10, font: helveticaBold });
  page.drawText(formatCredits(data.totalCreditsEarned), { x: MARGIN + 150, y: yPos, size: 10, font: helvetica });
  yPos -= LINE_HEIGHT;

  page.drawText("Total Credits Attempted:", { x: MARGIN, y: yPos, size: 10, font: helveticaBold });
  page.drawText(formatCredits(data.totalCreditsAttempted), { x: MARGIN + 150, y: yPos, size: 10, font: helvetica });
  yPos -= 30;

  // Footer
  const footerY = 50;
  page.drawLine({
    start: { x: MARGIN, y: footerY + 20 },
    end: { x: PAGE_WIDTH - MARGIN, y: footerY + 20 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });

  page.drawText(`${data.institution.registrarName}, ${data.institution.registrarTitle}`, {
    x: MARGIN,
    y: footerY + 10,
    size: 8,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });

  const generatedText = `Generated: ${formatDate(data.generatedAt)}`;
  const genWidth = helvetica.widthOfTextAtSize(generatedText, 8);
  page.drawText(generatedText, {
    x: PAGE_WIDTH - MARGIN - genWidth,
    y: footerY + 10,
    size: 8,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });

  if (data.transcriptType === "unofficial") {
    page.drawText(
      "This is an unofficial transcript and is not valid for official use.",
      {
        x: MARGIN,
        y: footerY,
        size: 7,
        font: helvetica,
        color: rgb(1, 0, 0),
      }
    );
  }

  // Serialize the PDF
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
