/**
 * Financial Data Seed Script
 *
 * Seeds only the financial tables (accounts, charge codes, ledger entries, etc.)
 * Assumes students already exist from main seed.
 *
 * Run with: pnpm --filter @sis/db db:seed:financial
 */

import "dotenv/config";
import { faker } from "@faker-js/faker";
import { db } from "./index.js";
import { eq, sql } from "drizzle-orm";
import {
  accounts,
  chargeCodes,
  ledgerEntries,
  financialHolds,
  paymentPlans,
  paymentPlanInstallments,
} from "./schema/index.js";
import { students } from "./schema/student.js";
import { institutions, terms } from "./schema/core.js";

// Use fixed seed for reproducibility
faker.seed(42);

function generateId(): string {
  return faker.string.uuid();
}

async function seedFinancial() {
  console.log("=".repeat(60));
  console.log("Financial Data Seed");
  console.log("=".repeat(60));

  // Get institution
  const [institution] = await db.select().from(institutions).limit(1);
  if (!institution) {
    throw new Error("No institution found. Run main seed first.");
  }
  console.log(`\nUsing institution: ${institution.name}`);

  // Get all students
  const allStudents = await db.select({ id: students.id }).from(students);
  if (allStudents.length === 0) {
    throw new Error("No students found. Run main seed first.");
  }
  console.log(`Found ${allStudents.length} students`);

  // Get terms for charges
  const allTerms = await db.select().from(terms).orderBy(terms.startDate);
  if (allTerms.length === 0) {
    throw new Error("No terms found. Run main seed first.");
  }
  const currentTerm = allTerms.find((t) => t.code === "FA24") || allTerms[allTerms.length - 1]!;
  console.log(`Current term: ${currentTerm.name}`);

  // Clear existing financial data
  console.log("\nClearing existing financial data...");
  await db.delete(paymentPlanInstallments);
  await db.delete(paymentPlans);
  await db.delete(financialHolds);
  await db.delete(ledgerEntries);
  await db.delete(accounts);
  await db.delete(chargeCodes);
  console.log("  Done");

  // Create charge codes
  console.log("\nCreating charge codes...");
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
      institutionId: institution.id,
      code: cc.code,
      name: cc.name,
      category: cc.category,
      isQtre: cc.isQtre,
      box1Eligible: cc.box1Eligible,
      glAccountCode: cc.glAccountCode,
      isActive: true,
    }))
  );
  console.log(`  Created ${chargeCodeData.length} charge codes`);

  // Create student accounts
  console.log("\nCreating student accounts...");
  const accountData: Array<{
    id: string;
    studentId: string;
    accountNumber: string;
    currentBalance: string;
    hasFinancialHold: boolean;
    onPaymentPlan: boolean;
  }> = [];

  // Reset faker seed for consistent account generation
  faker.seed(123);

  for (let i = 0; i < allStudents.length; i++) {
    const student = allStudents[i]!;
    const acctId = generateId();
    const acctNum = `A${(i + 1).toString().padStart(8, "0")}`;

    // Different balance scenarios
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
      onPlan = faker.datatype.boolean();
    } else {
      balance = faker.number.float({ min: 10000, max: 25000, fractionDigits: 2 }); // Large balance
      hasHold = true;
      onPlan = faker.datatype.boolean();
    }

    accountData.push({
      id: acctId,
      studentId: student.id,
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
        institutionId: institution.id,
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

  // Create ledger entries
  console.log("Creating ledger entries...");
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
    isQtre: boolean;
  }> = [];

  const tuitionCode = chargeCodeData.find((c) => c.code === "TUI-UG")!;
  const regFeeCode = chargeCodeData.find((c) => c.code === "FEE-REG")!;
  const techFeeCode = chargeCodeData.find((c) => c.code === "FEE-TECH")!;
  const actFeeCode = chargeCodeData.find((c) => c.code === "FEE-ACT")!;
  const healthFeeCode = chargeCodeData.find((c) => c.code === "FEE-HEALTH")!;
  const lateFeeCode = chargeCodeData.find((c) => c.code === "FEE-LATE")!;

  const chargeDate = currentTerm.startDate;

  for (const account of accountData) {
    const balance = parseFloat(account.currentBalance);
    const isCurrentStudent = faker.datatype.boolean({ probability: 0.9 });

    if (isCurrentStudent) {
      const tuitionAmount = faker.helpers.arrayElement([15000, 16500, 18000, 19500]);

      // Tuition charge
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
        isQtre: true,
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
        isQtre: true,
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
        isQtre: true,
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
        isQtre: false,
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
        isQtre: false,
      });

      const totalCharges = tuitionAmount + 350 + 150 + 75 + 200;
      const neededPayment = totalCharges - balance;

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
          isQtre: false,
        });

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
            isQtre: false,
          });
        }
      }

      // Late fee for some accounts with balance
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
          isQtre: false,
        });
      }
    }
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
        isQtre: e.isQtre,
      }))
    );
    process.stdout.write(`\r  Ledger Entries: ${Math.min(i + 500, ledgerData.length)}/${ledgerData.length}`);
  }
  console.log("");

  // Create financial holds
  console.log("Creating financial holds...");
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

  // Create payment plans
  console.log("Creating payment plans...");
  const accountsWithPlans = accountData.filter((a) => a.onPaymentPlan);
  let paymentPlanCount = 0;
  let installmentCount = 0;

  for (const account of accountsWithPlans) {
    const planId = generateId();
    const balance = parseFloat(account.currentBalance);
    if (balance <= 0) continue;

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
  console.log("Financial seed completed!");
  console.log("=".repeat(60));
  console.log("\nFinancial data created:");
  console.log(`  - ${chargeCodeData.length} charge codes`);
  console.log(`  - ${accountData.length} student accounts`);
  console.log(`  - ${ledgerData.length} ledger entries`);
  console.log(`  - ${holdData.length} financial holds`);
  console.log(`  - ${paymentPlanCount} payment plans (${installmentCount} installments)`);
  console.log("");
}

// Run seed
seedFinancial()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nSeed failed:", err);
    process.exit(1);
  });
