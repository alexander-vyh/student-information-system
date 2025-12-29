/**
 * Bursar Router
 *
 * Handles student financial account operations including:
 * - Account lookup and balance viewing
 * - Ledger/transaction viewing
 * - Charge posting (individual and batch)
 * - Payment recording
 * - Financial holds management
 * - Payment plan operations
 *
 * All operations require BURSAR or ADMIN role.
 */

import { z } from "zod";
import { eq, and, desc, asc, sql, isNull, lte, or, gt, like, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  router,
  protectedProcedure,
  requireRole,
} from "../trpc.js";
import {
  accounts,
  ledgerEntries,
  chargeCodes,
  financialHolds,
  paymentPlans,
  paymentPlanInstallments,
  students,
  terms,
  users,
} from "@sis/db/schema";

// ============================================================================
// Input Schemas
// ============================================================================

const searchAccountsSchema = z.object({
  query: z.string().min(2).max(100),
  limit: z.number().min(1).max(100).default(25),
});

const getAccountSchema = z.object({
  accountId: z.string().uuid(),
});

const getAccountByStudentSchema = z.object({
  studentId: z.string().uuid(),
});

const getLedgerSchema = z.object({
  accountId: z.string().uuid(),
  termId: z.string().uuid().optional(),
  entryType: z.enum(["charge", "payment", "credit", "adjustment", "refund"]).optional(),
  limit: z.number().min(1).max(500).default(100),
  offset: z.number().min(0).default(0),
});

const postChargeSchema = z.object({
  accountId: z.string().uuid(),
  chargeCodeId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format"),
  termId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
  dueDate: z.string().date().optional(),
});

const recordPaymentSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format"),
  paymentMethod: z.enum(["cash", "check", "card_present", "wire", "ach", "financial_aid"]),
  checkNumber: z.string().max(20).optional(),
  cardLast4: z.string().length(4).optional(),
  referenceNumber: z.string().max(50).optional(),
  termId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
});

const voidEntrySchema = z.object({
  ledgerEntryId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

const createFinancialHoldSchema = z.object({
  accountId: z.string().uuid(),
  holdType: z.enum(["balance_due", "payment_plan_default", "returned_payment", "collections"]),
  holdCode: z.string().max(20),
  holdName: z.string().max(100),
  description: z.string().max(500).optional(),
  thresholdAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  blocksRegistration: z.boolean().default(true),
  blocksGrades: z.boolean().default(false),
  blocksTranscript: z.boolean().default(false),
  blocksDiploma: z.boolean().default(false),
  autoReleaseThreshold: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
});

const releaseHoldSchema = z.object({
  holdId: z.string().uuid(),
  resolutionNotes: z.string().max(500).optional(),
});

const createPaymentPlanSchema = z.object({
  accountId: z.string().uuid(),
  termId: z.string().uuid().optional(),
  planType: z.enum(["standard", "extended", "custom"]),
  totalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  downPayment: z.string().regex(/^\d+(\.\d{1,2})?$/).default("0"),
  enrollmentFee: z.string().regex(/^\d+(\.\d{1,2})?$/).default("0"),
  numberOfPayments: z.number().min(2).max(12),
  startDate: z.string().date(),
});

// ============================================================================
// Router
// ============================================================================

export const bursarRouter = router({
  // ==========================================================================
  // Dashboard & Overview
  // ==========================================================================

  /**
   * Get bursar dashboard statistics
   */
  getDashboardStats: protectedProcedure
    .use(requireRole("ADMIN", "BURSAR"))
    .query(async ({ ctx }) => {
      const institutionId = ctx.user!.institutionId;

      // Get aggregate stats
      const [balanceStats] = await ctx.db
        .select({
          totalAccounts: sql<number>`count(*)`,
          totalReceivables: sql<string>`coalesce(sum(case when ${accounts.currentBalance} > 0 then ${accounts.currentBalance} else 0 end), 0)`,
          accountsWithBalance: sql<number>`count(case when ${accounts.currentBalance} > 0 then 1 end)`,
          accountsWithHolds: sql<number>`count(case when ${accounts.hasFinancialHold} = true then 1 end)`,
          accountsOnPaymentPlan: sql<number>`count(case when ${accounts.onPaymentPlan} = true then 1 end)`,
        })
        .from(accounts)
        .where(eq(accounts.institutionId, institutionId));

      // Get today's payments
      const today = new Date().toISOString().split("T")[0]!;
      const [todayPayments] = await ctx.db
        .select({
          count: sql<number>`count(*)`,
          total: sql<string>`coalesce(sum(abs(${ledgerEntries.amount})), 0)`,
        })
        .from(ledgerEntries)
        .innerJoin(accounts, eq(ledgerEntries.accountId, accounts.id))
        .where(
          and(
            eq(accounts.institutionId, institutionId),
            eq(ledgerEntries.entryType, "payment"),
            eq(ledgerEntries.transactionDate, today),
            eq(ledgerEntries.status, "posted")
          )
        );

      // Get pending charges count
      const [pendingCharges] = await ctx.db
        .select({
          count: sql<number>`count(*)`,
          total: sql<string>`coalesce(sum(${ledgerEntries.amount}), 0)`,
        })
        .from(ledgerEntries)
        .innerJoin(accounts, eq(ledgerEntries.accountId, accounts.id))
        .where(
          and(
            eq(accounts.institutionId, institutionId),
            eq(ledgerEntries.status, "pending")
          )
        );

      return {
        totalAccounts: balanceStats?.totalAccounts ?? 0,
        totalReceivables: balanceStats?.totalReceivables ?? "0",
        accountsWithBalance: balanceStats?.accountsWithBalance ?? 0,
        accountsWithHolds: balanceStats?.accountsWithHolds ?? 0,
        accountsOnPaymentPlan: balanceStats?.accountsOnPaymentPlan ?? 0,
        todayPayments: {
          count: todayPayments?.count ?? 0,
          total: todayPayments?.total ?? "0",
        },
        pendingCharges: {
          count: pendingCharges?.count ?? 0,
          total: pendingCharges?.total ?? "0",
        },
      };
    }),

  // ==========================================================================
  // Account Operations
  // ==========================================================================

  /**
   * Search for student accounts
   */
  searchAccounts: protectedProcedure
    .input(searchAccountsSchema)
    .use(requireRole("ADMIN", "BURSAR", "FINANCIAL_AID"))
    .query(async ({ ctx, input }) => {
      const institutionId = ctx.user!.institutionId;
      const searchTerm = `%${input.query}%`;

      const results = await ctx.db
        .select({
          accountId: accounts.id,
          accountNumber: accounts.accountNumber,
          currentBalance: accounts.currentBalance,
          hasFinancialHold: accounts.hasFinancialHold,
          onPaymentPlan: accounts.onPaymentPlan,
          status: accounts.status,
          studentId: students.id,
          studentIdDisplay: students.studentId,
          firstName: students.legalFirstName,
          lastName: students.legalLastName,
          preferredName: students.preferredFirstName,
          email: students.institutionalEmail,
        })
        .from(accounts)
        .innerJoin(students, eq(accounts.studentId, students.id))
        .where(
          and(
            eq(accounts.institutionId, institutionId),
            or(
              like(students.studentId, searchTerm),
              like(students.legalFirstName, searchTerm),
              like(students.legalLastName, searchTerm),
              like(students.institutionalEmail, searchTerm),
              like(accounts.accountNumber, searchTerm)
            )
          )
        )
        .orderBy(students.legalLastName, students.legalFirstName)
        .limit(input.limit);

      return results.map((r) => ({
        accountId: r.accountId,
        accountNumber: r.accountNumber,
        currentBalance: r.currentBalance,
        hasFinancialHold: r.hasFinancialHold,
        onPaymentPlan: r.onPaymentPlan,
        status: r.status,
        student: {
          id: r.studentId,
          studentId: r.studentIdDisplay,
          name: r.preferredName
            ? `${r.preferredName} ${r.lastName}`
            : `${r.firstName} ${r.lastName}`,
          legalName: `${r.lastName}, ${r.firstName}`,
          email: r.email,
        },
      }));
    }),

  /**
   * Get account details with summary
   */
  getAccount: protectedProcedure
    .input(getAccountSchema)
    .use(requireRole("ADMIN", "BURSAR", "FINANCIAL_AID"))
    .query(async ({ ctx, input }) => {
      const account = await ctx.db.query.accounts.findFirst({
        where: eq(accounts.id, input.accountId),
        with: {
          student: true,
        },
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      // Get active holds
      const activeHolds = await ctx.db.query.financialHolds.findMany({
        where: and(
          eq(financialHolds.accountId, input.accountId),
          isNull(financialHolds.resolvedAt)
        ),
      });

      // Get active payment plan
      const activePlan = await ctx.db.query.paymentPlans.findFirst({
        where: and(
          eq(paymentPlans.accountId, input.accountId),
          eq(paymentPlans.status, "active")
        ),
        with: {
          installments: {
            orderBy: asc(paymentPlanInstallments.dueDate),
          },
        },
      });

      // Get last payment
      const [lastPayment] = await ctx.db
        .select()
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.accountId, input.accountId),
            eq(ledgerEntries.entryType, "payment"),
            eq(ledgerEntries.status, "posted")
          )
        )
        .orderBy(desc(ledgerEntries.transactionDate))
        .limit(1);

      return {
        ...account,
        activeHolds,
        activePlan,
        lastPayment: lastPayment
          ? {
              date: lastPayment.transactionDate,
              amount: lastPayment.amount,
              method: lastPayment.paymentMethod,
            }
          : null,
      };
    }),

  /**
   * Get account by student ID
   */
  getAccountByStudent: protectedProcedure
    .input(getAccountByStudentSchema)
    .use(requireRole("ADMIN", "BURSAR", "FINANCIAL_AID"))
    .query(async ({ ctx, input }) => {
      const account = await ctx.db.query.accounts.findFirst({
        where: eq(accounts.studentId, input.studentId),
        with: {
          student: true,
        },
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No financial account found for this student",
        });
      }

      return account;
    }),

  // ==========================================================================
  // Ledger Operations
  // ==========================================================================

  /**
   * Get ledger entries for an account
   */
  getLedger: protectedProcedure
    .input(getLedgerSchema)
    .use(requireRole("ADMIN", "BURSAR", "FINANCIAL_AID"))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(ledgerEntries.accountId, input.accountId)];

      if (input.termId) {
        conditions.push(eq(ledgerEntries.termId, input.termId));
      }

      if (input.entryType) {
        conditions.push(eq(ledgerEntries.entryType, input.entryType));
      }

      const entries = await ctx.db
        .select({
          id: ledgerEntries.id,
          transactionNumber: ledgerEntries.transactionNumber,
          referenceNumber: ledgerEntries.referenceNumber,
          entryType: ledgerEntries.entryType,
          transactionDate: ledgerEntries.transactionDate,
          effectiveDate: ledgerEntries.effectiveDate,
          dueDate: ledgerEntries.dueDate,
          amount: ledgerEntries.amount,
          description: ledgerEntries.description,
          paymentMethod: ledgerEntries.paymentMethod,
          status: ledgerEntries.status,
          chargeCode: chargeCodes.code,
          chargeCodeName: chargeCodes.name,
          termId: ledgerEntries.termId,
          termName: terms.name,
          postedByName: users.displayName,
        })
        .from(ledgerEntries)
        .leftJoin(chargeCodes, eq(ledgerEntries.chargeCodeId, chargeCodes.id))
        .leftJoin(terms, eq(ledgerEntries.termId, terms.id))
        .leftJoin(users, eq(ledgerEntries.postedBy, users.id))
        .where(and(...conditions))
        .orderBy(desc(ledgerEntries.transactionDate), desc(ledgerEntries.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      // Get total count
      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(ledgerEntries)
        .where(and(...conditions));

      return {
        entries,
        total: countResult?.count ?? 0,
        limit: input.limit,
        offset: input.offset,
      };
    }),

  // ==========================================================================
  // Charge Operations
  // ==========================================================================

  /**
   * Get available charge codes
   */
  getChargeCodes: protectedProcedure
    .use(requireRole("ADMIN", "BURSAR"))
    .query(async ({ ctx }) => {
      const institutionId = ctx.user!.institutionId;

      return ctx.db.query.chargeCodes.findMany({
        where: and(
          eq(chargeCodes.institutionId, institutionId),
          eq(chargeCodes.isActive, true)
        ),
        orderBy: [asc(chargeCodes.category), asc(chargeCodes.name)],
      });
    }),

  /**
   * Post a charge to an account
   */
  postCharge: protectedProcedure
    .input(postChargeSchema)
    .use(requireRole("ADMIN", "BURSAR"))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user!.id;
      const today = new Date().toISOString().split("T")[0]!;

      // Verify account exists
      const account = await ctx.db.query.accounts.findFirst({
        where: eq(accounts.id, input.accountId),
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      // Get charge code details
      const chargeCode = await ctx.db.query.chargeCodes.findFirst({
        where: eq(chargeCodes.id, input.chargeCodeId),
      });

      if (!chargeCode) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Charge code not found",
        });
      }

      // Generate transaction number
      const transactionNumber = `CHG${Date.now()}`;

      // Create ledger entry and update balance in transaction
      const result = await ctx.db.transaction(async (tx) => {
        // Insert ledger entry
        const [entry] = await tx
          .insert(ledgerEntries)
          .values({
            accountId: input.accountId,
            transactionNumber,
            entryType: "charge",
            chargeCodeId: input.chargeCodeId,
            transactionDate: today,
            effectiveDate: today,
            dueDate: input.dueDate ?? null,
            amount: input.amount,
            termId: input.termId ?? null,
            description: input.description ?? chargeCode.name,
            isQtre: chargeCode.isQtre ?? false,
            taxYear: new Date().getFullYear(),
            status: "posted",
            postedBy: userId,
          })
          .returning();

        // Update account balance
        await tx
          .update(accounts)
          .set({
            currentBalance: sql`${accounts.currentBalance} + ${input.amount}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, input.accountId));

        return entry;
      });

      return {
        success: true,
        transactionId: result?.id,
        transactionNumber,
      };
    }),

  // ==========================================================================
  // Payment Operations
  // ==========================================================================

  /**
   * Record a payment
   */
  recordPayment: protectedProcedure
    .input(recordPaymentSchema)
    .use(requireRole("ADMIN", "BURSAR"))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user!.id;
      const today = new Date().toISOString().split("T")[0]!;

      // Verify account exists
      const account = await ctx.db.query.accounts.findFirst({
        where: eq(accounts.id, input.accountId),
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      // Generate transaction number
      const transactionNumber = `PMT${Date.now()}`;

      // Create payment entry and update balance
      const result = await ctx.db.transaction(async (tx) => {
        // Insert payment (negative amount for credits)
        const [entry] = await tx
          .insert(ledgerEntries)
          .values({
            accountId: input.accountId,
            transactionNumber,
            entryType: "payment",
            transactionDate: today,
            effectiveDate: today,
            amount: `-${input.amount}`, // Negative for payments/credits
            termId: input.termId ?? null,
            description: input.description ?? `Payment - ${input.paymentMethod}`,
            paymentMethod: input.paymentMethod,
            checkNumber: input.checkNumber ?? null,
            cardLast4: input.cardLast4 ?? null,
            referenceNumber: input.referenceNumber ?? null,
            status: "posted",
            postedBy: userId,
          })
          .returning();

        // Update account balance
        await tx
          .update(accounts)
          .set({
            currentBalance: sql`${accounts.currentBalance} - ${input.amount}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, input.accountId));

        // Check and auto-release financial holds
        await checkAndReleaseHolds(tx, input.accountId);

        return entry;
      });

      return {
        success: true,
        transactionId: result?.id,
        transactionNumber,
      };
    }),

  /**
   * Void a ledger entry
   */
  voidEntry: protectedProcedure
    .input(voidEntrySchema)
    .use(requireRole("ADMIN", "BURSAR"))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.query.ledgerEntries.findFirst({
        where: eq(ledgerEntries.id, input.ledgerEntryId),
      });

      if (!entry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ledger entry not found",
        });
      }

      if (entry.status === "voided") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Entry is already voided",
        });
      }

      // Void entry and reverse balance
      await ctx.db.transaction(async (tx) => {
        // Mark as voided
        await tx
          .update(ledgerEntries)
          .set({
            status: "voided",
            description: `${entry.description} [VOIDED: ${input.reason}]`,
            updatedAt: new Date(),
          })
          .where(eq(ledgerEntries.id, input.ledgerEntryId));

        // Reverse the balance effect
        const amount = parseFloat(entry.amount);
        await tx
          .update(accounts)
          .set({
            currentBalance: sql`${accounts.currentBalance} - ${amount}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, entry.accountId));
      });

      return { success: true };
    }),

  // ==========================================================================
  // Financial Holds Operations
  // ==========================================================================

  /**
   * List financial holds
   */
  listFinancialHolds: protectedProcedure
    .input(
      z.object({
        status: z.enum(["active", "resolved", "all"]).default("active"),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .use(requireRole("ADMIN", "BURSAR"))
    .query(async ({ ctx, input }) => {
      const institutionId = ctx.user!.institutionId;

      const conditions = [eq(accounts.institutionId, institutionId)];

      if (input.status === "active") {
        conditions.push(isNull(financialHolds.resolvedAt));
      } else if (input.status === "resolved") {
        conditions.push(sql`${financialHolds.resolvedAt} IS NOT NULL`);
      }

      const holds = await ctx.db
        .select({
          id: financialHolds.id,
          holdType: financialHolds.holdType,
          holdCode: financialHolds.holdCode,
          holdName: financialHolds.holdName,
          description: financialHolds.description,
          thresholdAmount: financialHolds.thresholdAmount,
          currentAmount: financialHolds.currentAmount,
          blocksRegistration: financialHolds.blocksRegistration,
          blocksGrades: financialHolds.blocksGrades,
          blocksTranscript: financialHolds.blocksTranscript,
          blocksDiploma: financialHolds.blocksDiploma,
          effectiveFrom: financialHolds.effectiveFrom,
          resolvedAt: financialHolds.resolvedAt,
          accountId: accounts.id,
          accountNumber: accounts.accountNumber,
          currentBalance: accounts.currentBalance,
          studentId: students.id,
          studentIdDisplay: students.studentId,
          studentName: sql<string>`concat(${students.legalLastName}, ', ', ${students.legalFirstName})`,
        })
        .from(financialHolds)
        .innerJoin(accounts, eq(financialHolds.accountId, accounts.id))
        .innerJoin(students, eq(accounts.studentId, students.id))
        .where(and(...conditions))
        .orderBy(desc(financialHolds.effectiveFrom))
        .limit(input.limit)
        .offset(input.offset);

      return holds;
    }),

  /**
   * Create a financial hold
   */
  createFinancialHold: protectedProcedure
    .input(createFinancialHoldSchema)
    .use(requireRole("ADMIN", "BURSAR"))
    .mutation(async ({ ctx, input }) => {
      // Verify account exists
      const account = await ctx.db.query.accounts.findFirst({
        where: eq(accounts.id, input.accountId),
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      // Create hold
      const [hold] = await ctx.db
        .insert(financialHolds)
        .values({
          accountId: input.accountId,
          holdType: input.holdType,
          holdCode: input.holdCode,
          holdName: input.holdName,
          description: input.description ?? null,
          thresholdAmount: input.thresholdAmount ?? null,
          currentAmount: account.currentBalance,
          blocksRegistration: input.blocksRegistration,
          blocksGrades: input.blocksGrades,
          blocksTranscript: input.blocksTranscript,
          blocksDiploma: input.blocksDiploma,
          autoReleaseThreshold: input.autoReleaseThreshold ?? null,
        })
        .returning();

      // Update account hold flag
      await ctx.db
        .update(accounts)
        .set({
          hasFinancialHold: true,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, input.accountId));

      return { success: true, holdId: hold?.id };
    }),

  /**
   * Release a financial hold
   */
  releaseFinancialHold: protectedProcedure
    .input(releaseHoldSchema)
    .use(requireRole("ADMIN", "BURSAR"))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user!.id;

      const hold = await ctx.db.query.financialHolds.findFirst({
        where: eq(financialHolds.id, input.holdId),
      });

      if (!hold) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Hold not found",
        });
      }

      if (hold.resolvedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Hold is already resolved",
        });
      }

      await ctx.db.transaction(async (tx) => {
        // Resolve hold
        await tx
          .update(financialHolds)
          .set({
            resolvedAt: new Date(),
            resolvedBy: userId,
            resolutionNotes: input.resolutionNotes ?? null,
            updatedAt: new Date(),
          })
          .where(eq(financialHolds.id, input.holdId));

        // Check if any active holds remain
        const remainingHolds = await tx.query.financialHolds.findFirst({
          where: and(
            eq(financialHolds.accountId, hold.accountId),
            isNull(financialHolds.resolvedAt),
            sql`${financialHolds.id} != ${input.holdId}`
          ),
        });

        // Update account hold flag if no holds remain
        if (!remainingHolds) {
          await tx
            .update(accounts)
            .set({
              hasFinancialHold: false,
              updatedAt: new Date(),
            })
            .where(eq(accounts.id, hold.accountId));
        }
      });

      return { success: true };
    }),

  // ==========================================================================
  // Payment Plan Operations
  // ==========================================================================

  /**
   * Create a payment plan
   */
  createPaymentPlan: protectedProcedure
    .input(createPaymentPlanSchema)
    .use(requireRole("ADMIN", "BURSAR"))
    .mutation(async ({ ctx, input }) => {
      // Verify account exists
      const account = await ctx.db.query.accounts.findFirst({
        where: eq(accounts.id, input.accountId),
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      // Check for existing active plan
      const existingPlan = await ctx.db.query.paymentPlans.findFirst({
        where: and(
          eq(paymentPlans.accountId, input.accountId),
          eq(paymentPlans.status, "active")
        ),
      });

      if (existingPlan) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Student already has an active payment plan",
        });
      }

      // Calculate installment amount
      const totalAmount = parseFloat(input.totalAmount);
      const downPayment = parseFloat(input.downPayment);
      const enrollmentFee = parseFloat(input.enrollmentFee);
      const amountToFinance = totalAmount - downPayment;
      const installmentAmount = amountToFinance / input.numberOfPayments;

      // Create plan with installments
      const result = await ctx.db.transaction(async (tx) => {
        // Create payment plan
        const [plan] = await tx
          .insert(paymentPlans)
          .values({
            accountId: input.accountId,
            termId: input.termId ?? null,
            planType: input.planType,
            totalAmount: input.totalAmount,
            downPayment: input.downPayment,
            enrollmentFee: input.enrollmentFee,
            numberOfPayments: input.numberOfPayments,
            paymentAmount: installmentAmount.toFixed(2),
            startDate: input.startDate,
            status: "active",
            remainingBalance: amountToFinance.toFixed(2),
          })
          .returning();

        if (!plan) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create payment plan",
          });
        }

        // Generate installments
        const startDate = new Date(input.startDate);
        const installmentValues = Array.from({ length: input.numberOfPayments }, (_, i) => {
          const dueDate = new Date(startDate);
          dueDate.setMonth(dueDate.getMonth() + i);
          return {
            paymentPlanId: plan.id,
            installmentNumber: i + 1,
            dueDate: dueDate.toISOString().split("T")[0]!,
            amount: installmentAmount.toFixed(2),
            status: "pending" as const,
          };
        });

        await tx.insert(paymentPlanInstallments).values(installmentValues);

        // Update account flags
        await tx
          .update(accounts)
          .set({
            onPaymentPlan: true,
            paymentPlanId: plan.id,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, input.accountId));

        // Post enrollment fee if applicable
        if (enrollmentFee > 0) {
          const today = new Date().toISOString().split("T")[0]!;
          await tx.insert(ledgerEntries).values({
            accountId: input.accountId,
            transactionNumber: `PPF${Date.now()}`,
            entryType: "charge",
            transactionDate: today,
            effectiveDate: today,
            amount: enrollmentFee.toFixed(2),
            description: "Payment Plan Enrollment Fee",
            status: "posted",
            postedBy: ctx.user!.id,
          });

          await tx
            .update(accounts)
            .set({
              currentBalance: sql`${accounts.currentBalance} + ${enrollmentFee}`,
            })
            .where(eq(accounts.id, input.accountId));
        }

        return plan;
      });

      return {
        success: true,
        planId: result.id,
        installmentAmount: installmentAmount.toFixed(2),
      };
    }),

  /**
   * Get payment plans for an account
   */
  getPaymentPlans: protectedProcedure
    .input(getAccountSchema)
    .use(requireRole("ADMIN", "BURSAR"))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.paymentPlans.findMany({
        where: eq(paymentPlans.accountId, input.accountId),
        with: {
          installments: {
            orderBy: asc(paymentPlanInstallments.installmentNumber),
          },
        },
        orderBy: desc(paymentPlans.createdAt),
      });
    }),

  // ==========================================================================
  // Reports
  // ==========================================================================

  /**
   * AR Aging Report
   */
  getArAgingReport: protectedProcedure
    .use(requireRole("ADMIN", "BURSAR"))
    .query(async ({ ctx }) => {
      const institutionId = ctx.user!.institutionId;

      const aging = await ctx.db.execute(sql`
        WITH aged_balances AS (
          SELECT
            a.id as account_id,
            a.student_id,
            a.account_number,
            a.current_balance,
            s.student_id as student_id_display,
            s.legal_last_name,
            s.legal_first_name,
            COALESCE(
              (SELECT MIN(le.effective_date)
               FROM financial.ledger_entries le
               WHERE le.account_id = a.id
                 AND le.status = 'posted'
                 AND le.amount > 0
                 AND le.effective_date <= CURRENT_DATE
              ), CURRENT_DATE
            ) as oldest_charge_date
          FROM financial.accounts a
          JOIN student.students s ON a.student_id = s.id
          WHERE a.institution_id = ${institutionId}
            AND a.current_balance > 0
        )
        SELECT
          account_id,
          student_id,
          account_number,
          current_balance,
          student_id_display,
          legal_last_name,
          legal_first_name,
          oldest_charge_date,
          CASE
            WHEN oldest_charge_date >= CURRENT_DATE - INTERVAL '30 days' THEN 'current'
            WHEN oldest_charge_date >= CURRENT_DATE - INTERVAL '60 days' THEN '31-60'
            WHEN oldest_charge_date >= CURRENT_DATE - INTERVAL '90 days' THEN '61-90'
            WHEN oldest_charge_date >= CURRENT_DATE - INTERVAL '120 days' THEN '91-120'
            ELSE '120+'
          END as aging_bucket
        FROM aged_balances
        ORDER BY current_balance DESC
      `);

      // Summarize by bucket
      const summary = {
        current: { count: 0, total: 0 },
        "31-60": { count: 0, total: 0 },
        "61-90": { count: 0, total: 0 },
        "91-120": { count: 0, total: 0 },
        "120+": { count: 0, total: 0 },
      };

      type AgingRow = {
        account_id: string;
        student_id: string;
        account_number: string;
        current_balance: string;
        student_id_display: string;
        legal_last_name: string;
        legal_first_name: string;
        aging_bucket: keyof typeof summary;
      };

      const rows = aging as unknown as AgingRow[];

      for (const row of rows) {
        const bucket = row.aging_bucket;
        if (bucket in summary) {
          summary[bucket].count++;
          summary[bucket].total += parseFloat(row.current_balance);
        }
      }

      return {
        summary,
        details: rows.map((r) => ({
          accountId: r.account_id,
          accountNumber: r.account_number,
          studentId: r.student_id_display,
          studentName: `${r.legal_last_name}, ${r.legal_first_name}`,
          balance: r.current_balance,
          agingBucket: r.aging_bucket,
        })),
      };
    }),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check and auto-release financial holds based on balance threshold
 */
async function checkAndReleaseHolds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  accountId: string
): Promise<void> {
  // This is a simplified version - in production, use proper transaction type
  // Get current balance
  const [account] = await (tx as any)
    .select({ currentBalance: accounts.currentBalance })
    .from(accounts)
    .where(eq(accounts.id, accountId));

  if (!account) return;

  const balance = parseFloat(account.currentBalance);

  // Find holds eligible for auto-release
  const eligibleHolds = await (tx as any).query.financialHolds.findMany({
    where: and(
      eq(financialHolds.accountId, accountId),
      isNull(financialHolds.resolvedAt),
      sql`${financialHolds.autoReleaseThreshold} IS NOT NULL`
    ),
  });

  for (const hold of eligibleHolds) {
    const threshold = parseFloat(hold.autoReleaseThreshold);
    if (balance <= threshold) {
      await (tx as any)
        .update(financialHolds)
        .set({
          resolvedAt: new Date(),
          resolutionNotes: `Auto-released: balance $${balance.toFixed(2)} <= threshold $${threshold.toFixed(2)}`,
          updatedAt: new Date(),
        })
        .where(eq(financialHolds.id, hold.id));
    }
  }

  // Update account hold flag if no active holds remain
  const remainingHolds = await (tx as any).query.financialHolds.findFirst({
    where: and(
      eq(financialHolds.accountId, accountId),
      isNull(financialHolds.resolvedAt)
    ),
  });

  if (!remainingHolds) {
    await (tx as any)
      .update(accounts)
      .set({
        hasFinancialHold: false,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId));
  }
}
