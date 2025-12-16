"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { useRouter } from "next/navigation";

type TranscriptStatus = "pending" | "processing" | "completed" | "failed" | "hold_blocked" | "cancelled";
type TranscriptType = "official" | "unofficial" | "verification_only";

export default function TranscriptRequestsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<TranscriptStatus | "all">("pending");
  const [typeFilter, setTypeFilter] = useState<TranscriptType | "all">("all");
  const [showProcessModal, setShowProcessModal] = useState<{
    requestId: string;
    studentName: string;
    type: string;
  } | null>(null);

  // Fetch transcript requests with filters
  const { data: requests, isLoading, error, refetch } = trpc.transcript.listRequests.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    transcriptType: typeFilter === "all" ? undefined : typeFilter,
    limit: 100,
    offset: 0,
  });

  // Update request status mutation
  const updateStatus = trpc.transcript.updateRequestStatus.useMutation({
    onSuccess: () => {
      refetch();
      setShowProcessModal(null);
    },
  });

  const handleRowClick = (studentId: string) => {
    router.push(`/admin/students/${studentId}`);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "hold_blocked":
        return "bg-orange-100 text-orange-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "official":
        return "bg-purple-100 text-purple-800";
      case "unofficial":
        return "bg-gray-100 text-gray-800";
      case "verification_only":
        return "bg-indigo-100 text-indigo-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const total = requests?.length ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Transcript Requests
            </h1>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-500">
                {total} total requests
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow">
          {/* Filters */}
          <div className="p-6 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="status"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Status
                </label>
                <select
                  id="status"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as TranscriptStatus | "all")
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="hold_blocked">Hold Blocked</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="type"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Transcript Type
                </label>
                <select
                  id="type"
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter(e.target.value as TranscriptType | "all")
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  <option value="official">Official</option>
                  <option value="unofficial">Unofficial</option>
                  <option value="verification_only">Verification Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="overflow-x-auto">
            {/* Loading State */}
            {isLoading && (
              <div className="p-6 text-center text-gray-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <p className="mt-2">Loading requests...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-6 text-center text-red-600">
                <p>Error: {error.message}</p>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && requests && requests.length === 0 && (
              <div className="p-12 text-center text-gray-500">
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No transcript requests found
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  No requests match the current filters.
                </p>
              </div>
            )}

            {/* Results Table */}
            {!isLoading && requests && requests.length > 0 && (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Student
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Type
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Delivery
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Requested
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Copies
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requests.map((request) => (
                    <tr
                      key={request.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                        onClick={() => handleRowClick(request.studentId)}
                      >
                        <div>
                          <div className="font-medium">
                            {request.student?.legalFirstName} {request.student?.legalLastName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {request.student?.studentId}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeBadgeColor(
                            request.transcriptType
                          )}`}
                        >
                          {request.transcriptType.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="capitalize">{request.deliveryMethod.replace(/_/g, " ")}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(
                            request.status
                          )}`}
                        >
                          {request.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(request.requestedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {request.copiesRequested}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {request.status === "pending" && (
                          <div className="flex space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowProcessModal({
                                  requestId: request.id,
                                  studentName: `${request.student?.legalFirstName} ${request.student?.legalLastName}`,
                                  type: request.transcriptType,
                                });
                              }}
                              className="text-blue-600 hover:text-blue-900 font-medium"
                            >
                              Process
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatus.mutate({
                                  requestId: request.id,
                                  status: "cancelled",
                                });
                              }}
                              className="text-red-600 hover:text-red-900 font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        {request.status === "processing" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatus.mutate({
                                requestId: request.id,
                                status: "completed",
                              });
                            }}
                            className="text-green-600 hover:text-green-900 font-medium"
                          >
                            Mark Complete
                          </button>
                        )}
                        {(request.status === "completed" || request.status === "cancelled" || request.status === "failed") && (
                          <span className="text-gray-400">—</span>
                        )}
                        {request.status === "hold_blocked" && (
                          <span className="text-orange-600 text-xs">Waiting for hold release</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Results Count */}
            {!isLoading && requests && requests.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{requests.length}</span> requests
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Process Request Modal */}
      {showProcessModal && (
        <ProcessTranscriptModal
          requestId={showProcessModal.requestId}
          studentName={showProcessModal.studentName}
          transcriptType={showProcessModal.type}
          onClose={() => setShowProcessModal(null)}
          onSuccess={() => {
            refetch();
            setShowProcessModal(null);
          }}
        />
      )}
    </div>
  );
}

// Process Transcript Modal Component
function ProcessTranscriptModal({
  requestId,
  studentName,
  transcriptType,
  onClose,
  onSuccess,
}: {
  requestId: string;
  studentName: string;
  transcriptType: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const updateStatus = trpc.transcript.updateRequestStatus.useMutation({
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleProcess = () => {
    updateStatus.mutate({
      requestId,
      status: "processing",
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Process Transcript Request
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 p-4 rounded-md">
            <p className="text-sm text-blue-700">
              <strong>Student:</strong> {studentName}
            </p>
            <p className="text-sm text-blue-700">
              <strong>Type:</strong>{" "}
              <span className="capitalize">{transcriptType.replace(/_/g, " ")}</span>
            </p>
          </div>

          <p className="text-sm text-gray-600">
            Click &quot;Start Processing&quot; to begin processing this transcript request.
            The request status will change to &quot;Processing&quot;.
          </p>

          {updateStatus.error && (
            <div className="text-sm text-red-600">
              Error: {updateStatus.error.message}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
          <button
            onClick={onClose}
            disabled={updateStatus.isPending}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleProcess}
            disabled={updateStatus.isPending}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {updateStatus.isPending ? "Processing..." : "Start Processing"}
          </button>
        </div>
      </div>
    </div>
  );
}
