/**
 * Return to Title IV (R2T4) Calculator
 *
 * Implements R2T4 calculation per federal regulations (34 CFR 668.22).
 * Required when a Title IV recipient withdraws from all classes.
 *
 * This module will be implemented in a future iteration.
 */

export interface R2t4Input {
  withdrawalDate: Date;
  lastDateOfAttendance: Date;
  paymentPeriodStart: Date;
  paymentPeriodEnd: Date;
  titleIvDisbursed: R2t4Disbursement[];
  titleIvCouldDisburse: R2t4Disbursement[];
  institutionalCharges: number;
}

export interface R2t4Disbursement {
  fundCode: string;
  fundName: string;
  amount: number;
  isLoan: boolean;
}

export interface R2t4Result {
  daysCompleted: number;
  daysInPeriod: number;
  percentageCompleted: number;
  earnedPercentage: number;
  titleIvAidEarned: number;
  titleIvAidToReturn: number;
  schoolReturn: number;
  studentReturn: number;
  postWithdrawalDisbursement: number;
  returnOrder: R2t4ReturnOrder[];
}

export interface R2t4ReturnOrder {
  fundCode: string;
  fundName: string;
  returnAmount: number;
  returnedBy: "school" | "student";
}

/**
 * Calculate R2T4 return amounts
 *
 * @param input - R2T4 calculation input
 * @returns R2T4 calculation result
 */
export function calculateR2t4(input: R2t4Input): R2t4Result {
  // Calculate days completed
  const daysCompleted = Math.floor(
    (input.lastDateOfAttendance.getTime() - input.paymentPeriodStart.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  const daysInPeriod = Math.floor(
    (input.paymentPeriodEnd.getTime() - input.paymentPeriodStart.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  // Calculate percentage completed
  let percentageCompleted = daysCompleted / daysInPeriod;

  // If 60% or more completed, earned 100%
  const earnedPercentage = percentageCompleted >= 0.6 ? 1.0 : percentageCompleted;

  // Calculate total Title IV aid
  const totalDisbursed = input.titleIvDisbursed.reduce(
    (sum, d) => sum + d.amount,
    0
  );
  const totalCouldDisburse = input.titleIvCouldDisburse.reduce(
    (sum, d) => sum + d.amount,
    0
  );
  const totalTitleIv = totalDisbursed + totalCouldDisburse;

  // Calculate earned and unearned amounts
  const titleIvAidEarned = totalTitleIv * earnedPercentage;
  const titleIvAidToReturn = totalDisbursed - titleIvAidEarned;

  // Post-withdrawal disbursement (if earned more than disbursed)
  const postWithdrawalDisbursement = Math.max(
    0,
    titleIvAidEarned - totalDisbursed
  );

  // Calculate school vs student responsibility
  // School returns lesser of: unearned charges OR unearned aid
  const unearnedCharges =
    input.institutionalCharges * (1 - earnedPercentage);
  const schoolReturn = Math.min(
    titleIvAidToReturn > 0 ? titleIvAidToReturn : 0,
    unearnedCharges
  );
  const studentReturn = Math.max(0, titleIvAidToReturn - schoolReturn);

  // Return order per federal regulations
  const returnOrder = calculateReturnOrder(
    input.titleIvDisbursed,
    schoolReturn,
    studentReturn
  );

  return {
    daysCompleted,
    daysInPeriod,
    percentageCompleted: Math.round(percentageCompleted * 10000) / 10000,
    earnedPercentage: Math.round(earnedPercentage * 10000) / 10000,
    titleIvAidEarned: Math.round(titleIvAidEarned * 100) / 100,
    titleIvAidToReturn: Math.round(titleIvAidToReturn * 100) / 100,
    schoolReturn: Math.round(schoolReturn * 100) / 100,
    studentReturn: Math.round(studentReturn * 100) / 100,
    postWithdrawalDisbursement:
      Math.round(postWithdrawalDisbursement * 100) / 100,
    returnOrder,
  };
}

/**
 * Calculate return order per 34 CFR 668.22(i)
 */
function calculateReturnOrder(
  disbursements: R2t4Disbursement[],
  schoolReturn: number,
  studentReturn: number
): R2t4ReturnOrder[] {
  // Federal return order:
  // 1. Unsubsidized Direct Loans
  // 2. Subsidized Direct Loans
  // 3. Direct PLUS Loans (Graduate)
  // 4. Direct PLUS Loans (Parent)
  // 5. Pell Grants
  // 6. FSEOG
  // 7. TEACH Grants
  // 8. Iraq/Afghanistan Service Grants

  const returnOrderPriority = [
    "UNSUB",
    "SUB",
    "GPLUS",
    "PPLUS",
    "PELL",
    "SEOG",
    "TEACH",
    "IRAQ",
  ];

  const orders: R2t4ReturnOrder[] = [];
  let remainingSchool = schoolReturn;
  let remainingStudent = studentReturn;

  for (const fundCode of returnOrderPriority) {
    const disbursement = disbursements.find((d) => d.fundCode === fundCode);
    if (!disbursement || disbursement.amount <= 0) continue;

    // School return
    if (remainingSchool > 0) {
      const schoolAmount = Math.min(remainingSchool, disbursement.amount);
      if (schoolAmount > 0) {
        orders.push({
          fundCode: disbursement.fundCode,
          fundName: disbursement.fundName,
          returnAmount: Math.round(schoolAmount * 100) / 100,
          returnedBy: "school",
        });
        remainingSchool -= schoolAmount;
      }
    }

    // Student return (only for loans typically)
    if (remainingStudent > 0 && disbursement.isLoan) {
      const studentAmount = Math.min(
        remainingStudent,
        disbursement.amount - (orders.find((o) => o.fundCode === fundCode)?.returnAmount ?? 0)
      );
      if (studentAmount > 0) {
        orders.push({
          fundCode: disbursement.fundCode,
          fundName: disbursement.fundName,
          returnAmount: Math.round(studentAmount * 100) / 100,
          returnedBy: "student",
        });
        remainingStudent -= studentAmount;
      }
    }
  }

  return orders;
}
