"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { useRouter } from "next/navigation";

type ApplicationStatus =
  | "submitted"
  | "audit_review"
  | "audit_incomplete"
  | "pending_clearances"
  | "clearances_complete"
  | "approved"
  | "denied"
  | "withdrawn"
  | "conferred";

type ClearanceType = "financial" | "library" | "advisor" | "department" | "exit_counseling";

export default function GraduationApplicationsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("submitted");
  const [showClearanceModal, setShowClearanceModal] = useState<{
    applicationId: string;
    studentName: string;
  } | null>(null);
  const [showConferModal, setShowConferModal] = useState<{
    applicationId: string;
    studentName: string;
    programName: string;
  } | null>(null);

  // Fetch graduation applications with filters
  const { data: applications, isLoading, error, refetch } = trpc.graduation.listApplications.useQuery({
    status: statusFilter === "all" ? undefined : [statusFilter],
    limit: 100,
    offset: 0,
  });

  // Update status mutation
  const updateStatus = trpc.graduation.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleRowClick = (studentId: string) => {
    router.push(`/admin/students/${studentId}`);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "submitted":
        return "bg-yellow-100 text-yellow-800";
      case "audit_review":
        return "bg-blue-100 text-blue-800";
      case "audit_incomplete":
        return "bg-orange-100 text-orange-800";
      case "pending_clearances":
        return "bg-purple-100 text-purple-800";
      case "clearances_complete":
        return "bg-indigo-100 text-indigo-800";
      case "approved":
        return "bg-emerald-100 text-emerald-800";
      case "denied":
        return "bg-red-100 text-red-800";
      case "withdrawn":
        return "bg-gray-100 text-gray-800";
      case "conferred":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getHonorsBadge = (honors: string | null) => {
    if (!honors || honors === "none") return null;

    const honorsMap: Record<string, { label: string; color: string }> = {
      summa_cum_laude: { label: "Summa Cum Laude", color: "bg-yellow-100 text-yellow-800" },
      magna_cum_laude: { label: "Magna Cum Laude", color: "bg-amber-100 text-amber-800" },
      cum_laude: { label: "Cum Laude", color: "bg-orange-100 text-orange-800" },
    };

    const honorInfo = honorsMap[honors];
    if (!honorInfo) return null;

    return (
      <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${honorInfo.color}`}>
        {honorInfo.label}
      </span>
    );
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getClearanceStatus = (app: {
    financialClearance: boolean | null;
    libraryClearance: boolean | null;
    advisorClearance: boolean | null;
    departmentClearance: boolean | null;
  }) => {
    const clearances = [
      { name: "Financial", cleared: app.financialClearance },
      { name: "Library", cleared: app.libraryClearance },
      { name: "Advisor", cleared: app.advisorClearance },
      { name: "Dept", cleared: app.departmentClearance },
    ];

    const cleared = clearances.filter((c) => c.cleared).length;
    return `${cleared}/${clearances.length}`;
  };

  const total = applications?.length ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Graduation Applications
            </h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/admin/graduation/ceremonies")}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <svg
                  className="-ml-1 mr-2 h-5 w-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Ceremonies
              </button>
              <button
                onClick={() => router.push("/admin/graduation/batch")}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <svg
                  className="-ml-1 mr-2 h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                Batch Conferral
              </button>
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
                    setStatusFilter(e.target.value as ApplicationStatus | "all")
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Statuses</option>
                  <option value="submitted">Submitted</option>
                  <option value="audit_review">Audit Review</option>
                  <option value="audit_incomplete">Audit Incomplete</option>
                  <option value="pending_clearances">Pending Clearances</option>
                  <option value="clearances_complete">Clearances Complete</option>
                  <option value="approved">Approved</option>
                  <option value="conferred">Conferred</option>
                  <option value="denied">Denied</option>
                  <option value="withdrawn">Withdrawn</option>
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
                <p className="mt-2">Loading applications...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-6 text-center text-red-600">
                <p>Error: {error.message}</p>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && applications && applications.length === 0 && (
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
                    d="M12 14l9-5-9-5-9 5 9 5z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No graduation applications found
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  No applications match the current filters.
                </p>
              </div>
            )}

            {/* Results Table */}
            {!isLoading && applications && applications.length > 0 && (
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
                      Program
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
                      Clearances
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Submitted
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
                  {applications.map((app) => (
                    <tr
                      key={app.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                        onClick={() => handleRowClick(app.studentId)}
                      >
                        <div>
                          <div className="font-medium">
                            {app.student?.legalFirstName} {app.student?.legalLastName}
                            {getHonorsBadge(app.honorsDesignation)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {app.student?.studentId}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>
                          <div className="font-medium">
                            Program ({app.studentProgram?.status ?? "unknown"})
                          </div>
                          <div className="text-xs text-gray-500">
                            {app.requestedConferralTerm?.name ?? ""}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(
                            app.status
                          )}`}
                        >
                          {app.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <span className="font-medium">{getClearanceStatus(app)}</span>
                          {(app.status === "pending_clearances" || app.status === "approved") && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowClearanceModal({
                                  applicationId: app.id,
                                  studentName: `${app.student?.legalFirstName} ${app.student?.legalLastName}`,
                                });
                              }}
                              className="ml-2 text-blue-600 hover:text-blue-800"
                            >
                              Update
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(app.applicationDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {app.status === "submitted" && (
                          <div className="flex space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatus.mutate({
                                  applicationId: app.id,
                                  status: "audit_review",
                                });
                              }}
                              className="text-blue-600 hover:text-blue-900 font-medium"
                            >
                              Start Review
                            </button>
                          </div>
                        )}
                        {app.status === "audit_review" && (
                          <div className="flex space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatus.mutate({
                                  applicationId: app.id,
                                  status: "pending_clearances",
                                });
                              }}
                              className="text-green-600 hover:text-green-900 font-medium"
                            >
                              Audit OK
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatus.mutate({
                                  applicationId: app.id,
                                  status: "audit_incomplete",
                                });
                              }}
                              className="text-orange-600 hover:text-orange-900 font-medium"
                            >
                              Incomplete
                            </button>
                          </div>
                        )}
                        {app.status === "clearances_complete" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatus.mutate({
                                applicationId: app.id,
                                status: "approved",
                              });
                            }}
                            className="text-green-600 hover:text-green-900 font-medium"
                          >
                            Approve
                          </button>
                        )}
                        {app.status === "approved" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowConferModal({
                                applicationId: app.id,
                                studentName: `${app.student?.legalFirstName} ${app.student?.legalLastName}`,
                                programName: `Program (${app.studentProgram?.status ?? "unknown"})`,
                              });
                            }}
                            className="text-green-600 hover:text-green-900 font-medium"
                          >
                            Confer Degree
                          </button>
                        )}
                        {app.status === "conferred" && (
                          <span className="text-green-600">
                            ✓ {formatDate(app.actualConferralDate)}
                          </span>
                        )}
                        {(app.status === "denied" || app.status === "withdrawn") && (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Results Count */}
            {!isLoading && applications && applications.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{total}</span> applications
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Clearance Update Modal */}
      {showClearanceModal && (
        <ClearanceModal
          applicationId={showClearanceModal.applicationId}
          studentName={showClearanceModal.studentName}
          onClose={() => setShowClearanceModal(null)}
          onSuccess={() => {
            refetch();
            setShowClearanceModal(null);
          }}
        />
      )}

      {/* Confer Degree Modal */}
      {showConferModal && (
        <ConferDegreeModal
          applicationId={showConferModal.applicationId}
          studentName={showConferModal.studentName}
          programName={showConferModal.programName}
          onClose={() => setShowConferModal(null)}
          onSuccess={() => {
            refetch();
            setShowConferModal(null);
          }}
        />
      )}
    </div>
  );
}

// Clearance Update Modal Component
function ClearanceModal({
  applicationId,
  studentName,
  onClose,
  onSuccess,
}: {
  applicationId: string;
  studentName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [clearanceType, setClearanceType] = useState<ClearanceType>("financial");
  const [cleared, setCleared] = useState(true);
  const [notes, setNotes] = useState("");

  const updateClearance = trpc.graduation.updateClearance.useMutation({
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateClearance.mutate({
      applicationId,
      clearanceType,
      cleared,
      notes: notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Update Clearance
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50 p-4 rounded-md">
            <p className="text-sm text-blue-700">
              <strong>Student:</strong> {studentName}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Clearance Type
            </label>
            <select
              value={clearanceType}
              onChange={(e) => setClearanceType(e.target.value as ClearanceType)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="financial">Financial</option>
              <option value="library">Library</option>
              <option value="advisor">Advisor</option>
              <option value="department">Department</option>
              <option value="exit_counseling">Exit Counseling</option>
            </select>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                checked={cleared}
                onChange={() => setCleared(true)}
                className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Cleared</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                checked={!cleared}
                onChange={() => setCleared(false)}
                className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Not Cleared</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {updateClearance.error && (
            <div className="text-sm text-red-600">
              Error: {updateClearance.error.message}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateClearance.isPending}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {updateClearance.isPending ? "Saving..." : "Save Clearance"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Confer Degree Modal Component
function ConferDegreeModal({
  applicationId,
  studentName,
  programName,
  onClose,
  onSuccess,
}: {
  applicationId: string;
  studentName: string;
  programName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [conferralDate, setConferralDate] = useState(
    new Date().toISOString().split("T")[0]!
  );
  const [calculateHonors, setCalculateHonors] = useState(true);

  const conferDegree = trpc.graduation.conferDegree.useMutation({
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    conferDegree.mutate({
      applicationId,
      conferralDate: new Date(conferralDate),
      calculateHonors,
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Confer Degree
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-green-50 p-4 rounded-md">
            <p className="text-sm text-green-800">
              <strong>Student:</strong> {studentName}
            </p>
            <p className="text-sm text-green-800">
              <strong>Program:</strong> {programName}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conferral Date
            </label>
            <input
              type="date"
              value={conferralDate}
              onChange={(e) => setConferralDate(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="calculateHonors"
              checked={calculateHonors}
              onChange={(e) => setCalculateHonors(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="calculateHonors" className="ml-2 text-sm text-gray-700">
              Calculate Latin honors based on GPA
            </label>
          </div>

          <div className="bg-yellow-50 p-3 rounded-md">
            <p className="text-sm text-yellow-800">
              ⚠️ This action will officially confer the degree and update the student&apos;s status to &quot;Graduated&quot;.
            </p>
          </div>

          {conferDegree.error && (
            <div className="text-sm text-red-600">
              Error: {conferDegree.error.message}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={conferDegree.isPending}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {conferDegree.isPending ? "Conferring..." : "Confer Degree"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
