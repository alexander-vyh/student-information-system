"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { useRouter, useParams } from "next/navigation";

type EntryType = "charge" | "payment" | "credit" | "adjustment" | "refund";
type PaymentMethod = "cash" | "check" | "card_present" | "wire" | "ach" | "financial_aid";

export default function AccountDetailPage() {
  const router = useRouter();
  const params = useParams();
  const accountId = params["id"] as string;

  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [entryTypeFilter, setEntryTypeFilter] = useState<EntryType | "all">("all");

  // Fetch account details
  const {
    data: account,
    isLoading: accountLoading,
    refetch: refetchAccount,
  } = trpc.bursar.getAccount.useQuery({ accountId });

  // Fetch ledger entries
  const {
    data: ledger,
    isLoading: ledgerLoading,
    refetch: refetchLedger,
  } = trpc.bursar.getLedger.useQuery({
    accountId,
    entryType: entryTypeFilter === "all" ? undefined : entryTypeFilter,
    limit: 100,
  });

  // Fetch charge codes for posting
  const { data: chargeCodes } = trpc.bursar.getChargeCodes.useQuery();

  const formatCurrency = (amount: string | number | null) => {
    if (amount === null) return "$0.00";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getEntryTypeColor = (type: string) => {
    switch (type) {
      case "charge":
        return "text-red-600";
      case "payment":
        return "text-green-600";
      case "credit":
        return "text-green-600";
      case "adjustment":
        return "text-blue-600";
      case "refund":
        return "text-orange-600";
      default:
        return "text-gray-600";
    }
  };

  const getEntryTypeBadge = (type: string) => {
    switch (type) {
      case "charge":
        return "bg-red-100 text-red-800";
      case "payment":
        return "bg-green-100 text-green-800";
      case "credit":
        return "bg-green-100 text-green-800";
      case "adjustment":
        return "bg-blue-100 text-blue-800";
      case "refund":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleRefresh = () => {
    refetchAccount();
    refetchLedger();
  };

  if (accountLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Account not found</h2>
          <button
            onClick={() => router.push("/admin/bursar")}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Back to Bursar Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => router.push("/admin/bursar")}
                className="text-sm text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Bursar Portal
              </button>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                {account.student.legalFirstName} {account.student.legalLastName}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {account.student.studentId} &bull; Account #{account.accountNumber}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Record Payment
              </button>
              <button
                onClick={() => setShowChargeModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Post Charge
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Account Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Current Balance */}
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-500">Current Balance</p>
            <p
              className={`text-3xl font-bold ${
                parseFloat(account.currentBalance ?? "0") > 0
                  ? "text-red-600"
                  : parseFloat(account.currentBalance ?? "0") < 0
                  ? "text-green-600"
                  : "text-gray-900"
              }`}
            >
              {formatCurrency(account.currentBalance)}
            </p>
          </div>

          {/* Account Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-500">Account Status</p>
            <p className="text-xl font-semibold text-gray-900 capitalize mt-1">
              {account.status}
            </p>
            {account.hasFinancialHold && (
              <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Financial Hold Active
              </span>
            )}
          </div>

          {/* Payment Plan */}
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-500">Payment Plan</p>
            {account.onPaymentPlan && account.activePlan ? (
              <div>
                <p className="text-xl font-semibold text-blue-600 capitalize mt-1">
                  {account.activePlan.planType}
                </p>
                <p className="text-sm text-gray-500">
                  {formatCurrency(account.activePlan.remainingBalance)} remaining
                </p>
              </div>
            ) : (
              <p className="text-xl font-semibold text-gray-400 mt-1">None</p>
            )}
          </div>

          {/* Last Payment */}
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-500">Last Payment</p>
            {account.lastPayment ? (
              <div>
                <p className="text-xl font-semibold text-green-600 mt-1">
                  {formatCurrency(account.lastPayment.amount)}
                </p>
                <p className="text-sm text-gray-500">
                  {formatDate(account.lastPayment.date)} via {account.lastPayment.method}
                </p>
              </div>
            ) : (
              <p className="text-xl font-semibold text-gray-400 mt-1">No payments</p>
            )}
          </div>
        </div>

        {/* Active Holds */}
        {account.activeHolds && account.activeHolds.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Active Financial Holds</h3>
            <div className="space-y-2">
              {account.activeHolds.map((hold) => (
                <div key={hold.id} className="flex items-center justify-between bg-white rounded p-3">
                  <div>
                    <p className="font-medium text-gray-900">{hold.holdName}</p>
                    <p className="text-sm text-gray-500">{hold.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      Blocks:{" "}
                      {[
                        hold.blocksRegistration && "Registration",
                        hold.blocksGrades && "Grades",
                        hold.blocksTranscript && "Transcript",
                        hold.blocksDiploma && "Diploma",
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ledger */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Account Ledger</h2>
              <div className="flex items-center gap-4">
                <select
                  value={entryTypeFilter}
                  onChange={(e) => setEntryTypeFilter(e.target.value as EntryType | "all")}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Transactions</option>
                  <option value="charge">Charges</option>
                  <option value="payment">Payments</option>
                  <option value="credit">Credits</option>
                  <option value="adjustment">Adjustments</option>
                  <option value="refund">Refunds</option>
                </select>
                <button
                  onClick={handleRefresh}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            {ledgerLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : ledger && ledger.entries.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Term
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ledger.entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(entry.transactionDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${getEntryTypeBadge(
                            entry.entryType
                          )}`}
                        >
                          {entry.entryType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>
                          <p>{entry.description}</p>
                          {entry.chargeCodeName && (
                            <p className="text-xs text-gray-500">{entry.chargeCodeName}</p>
                          )}
                          {entry.paymentMethod && (
                            <p className="text-xs text-gray-500">via {entry.paymentMethod}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {entry.termName || "-"}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${getEntryTypeColor(
                          entry.entryType
                        )}`}
                      >
                        {formatCurrency(entry.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            entry.status === "posted"
                              ? "bg-green-100 text-green-800"
                              : entry.status === "voided"
                              ? "bg-gray-100 text-gray-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <p>No transactions found</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {ledger && ledger.total > ledger.limit && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-700">
                Showing {ledger.entries.length} of {ledger.total} transactions
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Post Charge Modal */}
      {showChargeModal && (
        <PostChargeModal
          accountId={accountId}
          chargeCodes={chargeCodes || []}
          onClose={() => setShowChargeModal(false)}
          onSuccess={() => {
            setShowChargeModal(false);
            handleRefresh();
          }}
        />
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <RecordPaymentModal
          accountId={accountId}
          currentBalance={account.currentBalance ?? "0"}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            handleRefresh();
          }}
        />
      )}
    </div>
  );
}

// Post Charge Modal
function PostChargeModal({
  accountId,
  chargeCodes,
  onClose,
  onSuccess,
}: {
  accountId: string;
  chargeCodes: { id: string; code: string; name: string; category: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    chargeCodeId: "",
    amount: "",
    description: "",
    dueDate: "",
  });

  const postCharge = trpc.bursar.postCharge.useMutation({
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    postCharge.mutate({
      accountId,
      chargeCodeId: formData.chargeCodeId,
      amount: formData.amount,
      description: formData.description || undefined,
      dueDate: formData.dueDate || undefined,
    });
  };

  const selectedChargeCode = chargeCodes.find((c) => c.id === formData.chargeCodeId);

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Post Charge</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Charge Code *
            </label>
            <select
              value={formData.chargeCodeId}
              onChange={(e) => setFormData({ ...formData, chargeCodeId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a charge code...</option>
              {chargeCodes.map((code) => (
                <option key={code.id} value={code.id}>
                  {code.code} - {code.name}
                </option>
              ))}
            </select>
            {selectedChargeCode && (
              <p className="mt-1 text-sm text-gray-500">
                Category: {selectedChargeCode.category}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Optional description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {postCharge.error && (
            <div className="text-sm text-red-600">Error: {postCharge.error.message}</div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={postCharge.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300"
            >
              {postCharge.isPending ? "Posting..." : "Post Charge"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Record Payment Modal
function RecordPaymentModal({
  accountId,
  currentBalance,
  onClose,
  onSuccess,
}: {
  accountId: string;
  currentBalance: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    amount: "",
    paymentMethod: "cash" as PaymentMethod,
    checkNumber: "",
    cardLast4: "",
    referenceNumber: "",
    description: "",
  });

  const recordPayment = trpc.bursar.recordPayment.useMutation({
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    recordPayment.mutate({
      accountId,
      amount: formData.amount,
      paymentMethod: formData.paymentMethod,
      checkNumber: formData.checkNumber || undefined,
      cardLast4: formData.cardLast4 || undefined,
      referenceNumber: formData.referenceNumber || undefined,
      description: formData.description || undefined,
    });
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Record Payment</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Current Balance Display */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Current Balance</p>
            <p
              className={`text-2xl font-bold ${
                parseFloat(currentBalance) > 0
                  ? "text-red-600"
                  : parseFloat(currentBalance) < 0
                  ? "text-green-600"
                  : "text-gray-900"
              }`}
            >
              {formatCurrency(currentBalance)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                placeholder="0.00"
                required
              />
            </div>
            {parseFloat(currentBalance) > 0 && (
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, amount: parseFloat(currentBalance).toFixed(2) })
                }
                className="mt-1 text-sm text-blue-600 hover:text-blue-800"
              >
                Pay full balance
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method *
            </label>
            <select
              value={formData.paymentMethod}
              onChange={(e) =>
                setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethod })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              required
            >
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="card_present">Card (In-Person)</option>
              <option value="ach">ACH/Bank Transfer</option>
              <option value="wire">Wire Transfer</option>
              <option value="financial_aid">Financial Aid</option>
            </select>
          </div>

          {formData.paymentMethod === "check" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Check Number
              </label>
              <input
                type="text"
                value={formData.checkNumber}
                onChange={(e) => setFormData({ ...formData, checkNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                placeholder="Check #"
              />
            </div>
          )}

          {formData.paymentMethod === "card_present" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Card Last 4 Digits
              </label>
              <input
                type="text"
                maxLength={4}
                value={formData.cardLast4}
                onChange={(e) =>
                  setFormData({ ...formData, cardLast4: e.target.value.replace(/\D/g, "") })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                placeholder="1234"
              />
            </div>
          )}

          {(formData.paymentMethod === "ach" || formData.paymentMethod === "wire") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference Number
              </label>
              <input
                type="text"
                value={formData.referenceNumber}
                onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                placeholder="Transaction reference"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              placeholder="Optional description..."
            />
          </div>

          {recordPayment.error && (
            <div className="text-sm text-red-600">Error: {recordPayment.error.message}</div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={recordPayment.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:bg-gray-300"
            >
              {recordPayment.isPending ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
