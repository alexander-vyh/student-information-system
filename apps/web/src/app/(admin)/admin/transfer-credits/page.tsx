"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { useRouter } from "next/navigation";

type TransferCreditStatus = "pending" | "approved" | "denied";

export default function TransferCreditsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<TransferCreditStatus | "all">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEvaluateModal, setShowEvaluateModal] = useState<{
    id: string;
    studentName: string;
    sourceInstitution: string;
    sourceCourse: string;
    sourceCredits: string;
  } | null>(null);

  // Fetch transfer credits with filters
  const { data, isLoading, error, refetch } = trpc.transferCredit.list.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: searchQuery || undefined,
    limit: 100,
    offset: 0,
  });

  // Fetch stats
  const { data: stats } = trpc.transferCredit.getStats.useQuery();

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-green-100 text-green-800";
      case "denied":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getInstitutionTypeBadge = (type: string | null) => {
    switch (type) {
      case "4year":
        return "bg-blue-100 text-blue-800";
      case "2year":
        return "bg-purple-100 text-purple-800";
      case "international":
        return "bg-indigo-100 text-indigo-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleRowClick = (studentId: string) => {
    router.push(`/admin/students/${studentId}`);
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Transfer Credit Evaluation
            </h1>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Add Transfer Credit
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                      <span className="text-yellow-600 font-semibold">{stats.pending.count}</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Pending Review</dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {stats.pending.totalCredits?.toFixed(1) ?? 0} credits
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-semibold">{stats.approved.count}</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Approved</dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {stats.approved.totalCredits?.toFixed(1) ?? 0} credits
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-red-600 font-semibold">{stats.denied.count}</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Denied</dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {stats.denied.totalCredits?.toFixed(1) ?? 0} credits
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
                    setStatusFilter(e.target.value as TransferCreditStatus | "all")
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="denied">Denied</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="search"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Search
                </label>
                <input
                  type="text"
                  id="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by institution or course..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="overflow-x-auto">
            {/* Loading State */}
            {isLoading && (
              <div className="p-6 text-center text-gray-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <p className="mt-2">Loading transfer credits...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-6 text-center text-red-600">
                <p>Error: {error.message}</p>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && items.length === 0 && (
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
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No transfer credits found
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  No records match the current filters.
                </p>
              </div>
            )}

            {/* Results Table */}
            {!isLoading && items.length > 0 && (
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
                      Source Institution
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Source Course
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Credits
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Equivalent
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
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((credit) => (
                    <tr
                      key={credit.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                        onClick={() => handleRowClick(credit.studentId)}
                      >
                        <div>
                          <div className="font-medium">
                            {credit.student?.legalFirstName} {credit.student?.legalLastName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {credit.student?.studentId}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm text-gray-900">
                            {credit.sourceInstitutionName}
                          </div>
                          {credit.sourceInstitutionType && (
                            <span
                              className={`mt-1 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getInstitutionTypeBadge(
                                credit.sourceInstitutionType
                              )}`}
                            >
                              {credit.sourceInstitutionType}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {credit.sourceCourseCode || "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {credit.sourceCourseTitle || "No title"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div>{credit.sourceCredits} source</div>
                          <div className="text-xs text-gray-500">
                            {credit.transferCredits} transfer
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {credit.equivalentCourse ? (
                          <div>
                            <div className="font-medium text-gray-900">
                              {credit.equivalentCourse.courseCode}
                            </div>
                            <div className="text-xs">
                              {credit.equivalentCourse.title}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">Not assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(
                            credit.status
                          )}`}
                        >
                          {credit.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {credit.status === "pending" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowEvaluateModal({
                                id: credit.id,
                                studentName: `${credit.student?.legalFirstName} ${credit.student?.legalLastName}`,
                                sourceInstitution: credit.sourceInstitutionName,
                                sourceCourse: `${credit.sourceCourseCode || ""} ${credit.sourceCourseTitle || ""}`.trim() || "Unknown",
                                sourceCredits: credit.sourceCredits,
                              });
                            }}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            Evaluate
                          </button>
                        )}
                        {credit.status !== "pending" && (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Results Count */}
            {!isLoading && items.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{items.length}</span> of{" "}
                  <span className="font-medium">{total}</span> transfer credits
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTransferCreditModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            refetch();
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Evaluate Modal */}
      {showEvaluateModal && (
        <EvaluateTransferCreditModal
          creditId={showEvaluateModal.id}
          studentName={showEvaluateModal.studentName}
          sourceInstitution={showEvaluateModal.sourceInstitution}
          sourceCourse={showEvaluateModal.sourceCourse}
          sourceCredits={showEvaluateModal.sourceCredits}
          onClose={() => setShowEvaluateModal(null)}
          onSuccess={() => {
            refetch();
            setShowEvaluateModal(null);
          }}
        />
      )}
    </div>
  );
}

// Create Transfer Credit Modal
function CreateTransferCreditModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [formData, setFormData] = useState({
    sourceInstitutionName: "",
    sourceInstitutionCode: "",
    sourceInstitutionType: "" as "" | "4year" | "2year" | "international",
    sourceCourseCode: "",
    sourceCourseTitle: "",
    sourceCredits: "",
    sourceGrade: "",
    transferCredits: "",
    transcriptReceivedDate: "",
    evaluationNotes: "",
  });

  // Search for students
  const { data: studentsData } = trpc.student.search.useQuery(
    { query: studentSearch, limit: 10 },
    { enabled: studentSearch.length >= 2 }
  );

  const createMutation = trpc.transferCredit.create.useMutation({
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;

    createMutation.mutate({
      studentId: selectedStudentId,
      sourceInstitutionName: formData.sourceInstitutionName,
      sourceInstitutionCode: formData.sourceInstitutionCode || undefined,
      sourceInstitutionType: formData.sourceInstitutionType || undefined,
      sourceCourseCode: formData.sourceCourseCode || undefined,
      sourceCourseTitle: formData.sourceCourseTitle || undefined,
      sourceCredits: parseFloat(formData.sourceCredits),
      sourceGrade: formData.sourceGrade || undefined,
      transferCredits: parseFloat(formData.transferCredits || formData.sourceCredits),
      transcriptReceivedDate: formData.transcriptReceivedDate || undefined,
      evaluationNotes: formData.evaluationNotes || undefined,
      status: "pending",
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Add Transfer Credit
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Student Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Student *
            </label>
            {!selectedStudentId ? (
              <div>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search for student..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {studentsData && studentsData.students.length > 0 && (
                  <ul className="mt-2 border border-gray-300 rounded-md max-h-40 overflow-y-auto">
                    {studentsData.students.map((student) => (
                      <li
                        key={student.id}
                        onClick={() => {
                          setSelectedStudentId(student.id);
                          setStudentSearch(
                            `${student.legalFirstName} ${student.legalLastName} (${student.studentId})`
                          );
                        }}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      >
                        {student.legalFirstName} {student.legalLastName} ({student.studentId})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between bg-blue-50 px-4 py-2 rounded-md">
                <span>{studentSearch}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudentId("");
                    setStudentSearch("");
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Source Institution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source Institution *
              </label>
              <input
                type="text"
                value={formData.sourceInstitutionName}
                onChange={(e) =>
                  setFormData({ ...formData, sourceInstitutionName: e.target.value })
                }
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Institution Type
              </label>
              <select
                value={formData.sourceInstitutionType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sourceInstitutionType: e.target.value as "" | "4year" | "2year" | "international",
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select type...</option>
                <option value="4year">4-Year Institution</option>
                <option value="2year">2-Year Institution</option>
                <option value="international">International</option>
              </select>
            </div>
          </div>

          {/* Source Course */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source Course Code
              </label>
              <input
                type="text"
                value={formData.sourceCourseCode}
                onChange={(e) =>
                  setFormData({ ...formData, sourceCourseCode: e.target.value })
                }
                placeholder="e.g., ENG 101"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source Course Title
              </label>
              <input
                type="text"
                value={formData.sourceCourseTitle}
                onChange={(e) =>
                  setFormData({ ...formData, sourceCourseTitle: e.target.value })
                }
                placeholder="e.g., English Composition"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Credits and Grade */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source Credits *
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={formData.sourceCredits}
                onChange={(e) =>
                  setFormData({ ...formData, sourceCredits: e.target.value })
                }
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transfer Credits
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={formData.transferCredits}
                onChange={(e) =>
                  setFormData({ ...formData, transferCredits: e.target.value })
                }
                placeholder="Same as source if blank"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source Grade
              </label>
              <input
                type="text"
                value={formData.sourceGrade}
                onChange={(e) =>
                  setFormData({ ...formData, sourceGrade: e.target.value })
                }
                placeholder="e.g., A, B+, 3.5"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Transcript Received */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transcript Received Date
            </label>
            <input
              type="date"
              value={formData.transcriptReceivedDate}
              onChange={(e) =>
                setFormData({ ...formData, transcriptReceivedDate: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.evaluationNotes}
              onChange={(e) =>
                setFormData({ ...formData, evaluationNotes: e.target.value })
              }
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {createMutation.error && (
            <div className="text-sm text-red-600">
              Error: {createMutation.error.message}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={createMutation.isPending}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !selectedStudentId || !formData.sourceInstitutionName || !formData.sourceCredits}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? "Creating..." : "Create Transfer Credit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Evaluate Transfer Credit Modal
function EvaluateTransferCreditModal({
  creditId,
  studentName,
  sourceInstitution,
  sourceCourse,
  sourceCredits,
  onClose,
  onSuccess,
}: {
  creditId: string;
  studentName: string;
  sourceInstitution: string;
  sourceCourse: string;
  sourceCredits: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [decision, setDecision] = useState<"approved" | "denied">("approved");
  const [courseSearch, setCourseSearch] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [transferCredits, setTransferCredits] = useState(sourceCredits);
  const [includeInGpa, setIncludeInGpa] = useState(false);
  const [notes, setNotes] = useState("");

  // Search for equivalent courses
  const { data: coursesData } = trpc.transferCredit.getAvailableCourses.useQuery(
    { search: courseSearch, limit: 10 },
    { enabled: courseSearch.length >= 2 }
  );

  const evaluateMutation = trpc.transferCredit.evaluate.useMutation({
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    evaluateMutation.mutate({
      transferCreditId: creditId,
      status: decision,
      equivalentCourseId: selectedCourseId,
      transferCredits: parseFloat(transferCredits),
      includeInGpa,
      evaluationNotes: notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Evaluate Transfer Credit
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Credit Info */}
          <div className="bg-gray-50 p-4 rounded-md">
            <p className="text-sm text-gray-700">
              <strong>Student:</strong> {studentName}
            </p>
            <p className="text-sm text-gray-700">
              <strong>Institution:</strong> {sourceInstitution}
            </p>
            <p className="text-sm text-gray-700">
              <strong>Course:</strong> {sourceCourse}
            </p>
            <p className="text-sm text-gray-700">
              <strong>Credits:</strong> {sourceCredits}
            </p>
          </div>

          {/* Decision */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Decision *
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="approved"
                  checked={decision === "approved"}
                  onChange={(e) => setDecision(e.target.value as "approved" | "denied")}
                  className="h-4 w-4 text-blue-600 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">Approve</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="denied"
                  checked={decision === "denied"}
                  onChange={(e) => setDecision(e.target.value as "approved" | "denied")}
                  className="h-4 w-4 text-red-600 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">Deny</span>
              </label>
            </div>
          </div>

          {decision === "approved" && (
            <>
              {/* Equivalent Course */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Equivalent Course (optional)
                </label>
                {!selectedCourseId ? (
                  <div>
                    <input
                      type="text"
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                      placeholder="Search for equivalent course..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {coursesData && coursesData.length > 0 && (
                      <ul className="mt-2 border border-gray-300 rounded-md max-h-40 overflow-y-auto">
                        {coursesData.map((course) => (
                          <li
                            key={course.id}
                            onClick={() => {
                              setSelectedCourseId(course.id);
                              setCourseSearch(`${course.courseCode} - ${course.title}`);
                            }}
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                          >
                            {course.courseCode} - {course.title}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-green-50 px-4 py-2 rounded-md">
                    <span>{courseSearch}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCourseId(null);
                        setCourseSearch("");
                      }}
                      className="text-green-600 hover:text-green-800"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              {/* Transfer Credits */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transfer Credits
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={transferCredits}
                  onChange={(e) => setTransferCredits(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Include in GPA */}
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeInGpa}
                    onChange={(e) => setIncludeInGpa(e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Include in GPA calculation
                  </span>
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  Typically, transfer credits do not count toward GPA
                </p>
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Evaluation Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={decision === "denied" ? "Please provide reason for denial..." : "Optional notes..."}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {evaluateMutation.error && (
            <div className="text-sm text-red-600">
              Error: {evaluateMutation.error.message}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={evaluateMutation.isPending}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={evaluateMutation.isPending}
              className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                decision === "approved"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              } disabled:bg-gray-300 disabled:cursor-not-allowed`}
            >
              {evaluateMutation.isPending
                ? "Processing..."
                : decision === "approved"
                ? "Approve Credit"
                : "Deny Credit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
