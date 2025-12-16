"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { useRouter } from "next/navigation";

type HoldStatus = "active" | "resolved" | "all";

export default function FinancialHoldsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<HoldStatus>("active");
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [selectedHoldId, setSelectedHoldId] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState("");

  const utils = trpc.useUtils();

  const { data: holds, isLoading } = trpc.bursar.listFinancialHolds.useQuery({
    status: statusFilter,
    limit: 100,
  });

  const releaseHoldMutation = trpc.bursar.releaseFinancialHold.useMutation({
    onSuccess: () => {
      utils.bursar.listFinancialHolds.invalidate();
      setShowReleaseModal(false);
      setSelectedHoldId(null);
      setReleaseNotes("");
    },
  });

  const formatCurrency = (amount: string | number | null) => {
    if (amount === null) return "$0.00";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleReleaseClick = (holdId: string) => {
    setSelectedHoldId(holdId);
    setShowReleaseModal(true);
  };

  const handleReleaseConfirm = () => {
    if (!selectedHoldId) return;
    releaseHoldMutation.mutate({
      holdId: selectedHoldId,
      resolutionNotes: releaseNotes || undefined,
    });
  };

  const handleViewAccount = (accountId: string) => {
    router.push(`/admin/bursar/accounts/${accountId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                Financial Holds
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage student financial holds
              </p>
            </div>
            <button
              onClick={() => router.push("/admin/bursar")}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Bursar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <div className="flex gap-2">
              {(["active", "resolved", "all"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    statusFilter === status
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Holds Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading holds...</p>
            </div>
          ) : holds && holds.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hold Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Blocks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {holds.map((hold) => (
                  <tr key={hold.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-medium text-gray-900">
                          {hold.studentName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {hold.studentIdDisplay}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-medium text-gray-900">{hold.holdName}</p>
                        <p className="text-sm text-gray-500">{hold.holdCode}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-red-600 font-medium">
                        {formatCurrency(hold.currentAmount)}
                      </p>
                      {hold.thresholdAmount && (
                        <p className="text-xs text-gray-500">
                          Threshold: {formatCurrency(hold.thresholdAmount)}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {hold.blocksRegistration && (
                          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                            Registration
                          </span>
                        )}
                        {hold.blocksGrades && (
                          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                            Grades
                          </span>
                        )}
                        {hold.blocksTranscript && (
                          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                            Transcript
                          </span>
                        )}
                        {hold.blocksDiploma && (
                          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                            Diploma
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(hold.effectiveFrom)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {hold.resolvedAt ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                          Resolved
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewAccount(hold.accountId)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View Account
                        </button>
                        {!hold.resolvedAt && (
                          <button
                            onClick={() => handleReleaseClick(hold.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Release
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="mt-2">No holds found</p>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        {holds && holds.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total Active Holds</p>
              <p className="text-2xl font-bold text-red-600">
                {holds.filter((h) => !h.resolvedAt).length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total Outstanding</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(
                  holds
                    .filter((h) => !h.resolvedAt)
                    .reduce((sum, h) => sum + parseFloat(h.currentAmount || "0"), 0)
                )}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Resolved This Month</p>
              <p className="text-2xl font-bold text-green-600">
                {
                  holds.filter((h) => {
                    if (!h.resolvedAt) return false;
                    const resolved = new Date(h.resolvedAt);
                    const now = new Date();
                    return (
                      resolved.getMonth() === now.getMonth() &&
                      resolved.getFullYear() === now.getFullYear()
                    );
                  }).length
                }
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Release Hold Modal */}
      {showReleaseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Release Hold
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Are you sure you want to release this hold? This will allow the
                student to register, view grades, and access transcripts (depending
                on what was blocked).
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Release Notes (optional)
                </label>
                <textarea
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter reason for releasing hold..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowReleaseModal(false);
                    setSelectedHoldId(null);
                    setReleaseNotes("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReleaseConfirm}
                  disabled={releaseHoldMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {releaseHoldMutation.isPending ? "Releasing..." : "Release Hold"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
