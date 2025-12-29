"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { useRouter } from "next/navigation";

type HoldType = "academic" | "financial" | "administrative" | "disciplinary";
type HoldStatus = "active" | "resolved";

export default function RegistrationHoldsPage() {
  const router = useRouter();
  const [holdTypeFilter, setHoldTypeFilter] = useState<HoldType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<HoldStatus>("active");
  const [showAddModal, setShowAddModal] = useState(false);
  const [releaseConfirmation, setReleaseConfirmation] = useState<{
    holdId: string;
    studentName: string;
  } | null>(null);

  // Fetch holds with filters
  const { data, isLoading, error, refetch } = trpc.holds.list.useQuery({
    holdType: holdTypeFilter === "all" ? undefined : holdTypeFilter,
    status: statusFilter,
    limit: 100,
    offset: 0,
  });

  // Release hold mutation
  const releaseHold = trpc.holds.release.useMutation({
    onSuccess: () => {
      refetch();
      setReleaseConfirmation(null);
    },
  });

  const handleReleaseHold = (holdId: string, notes?: string) => {
    releaseHold.mutate({
      holdId,
      resolutionNotes: notes,
    });
  };

  const handleRowClick = (studentId: string) => {
    router.push(`/admin/students/${studentId}`);
  };

  const getHoldTypeBadgeColor = (holdType: string) => {
    switch (holdType) {
      case "academic":
        return "bg-blue-100 text-blue-800";
      case "financial":
        return "bg-red-100 text-red-800";
      case "administrative":
        return "bg-yellow-100 text-yellow-800";
      case "disciplinary":
        return "bg-purple-100 text-purple-800";
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

  const getBlocksDescription = (hold: any) => {
    const blocks = [];
    if (hold.blocksRegistration) blocks.push("Registration");
    if (hold.blocksGrades) blocks.push("Grades");
    if (hold.blocksTranscript) blocks.push("Transcript");
    if (hold.blocksDiploma) blocks.push("Diploma");
    return blocks.join(", ") || "None";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Registration Holds Management
            </h1>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Hold
            </button>
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
                  htmlFor="hold-type"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Hold Type
                </label>
                <select
                  id="hold-type"
                  value={holdTypeFilter}
                  onChange={(e) =>
                    setHoldTypeFilter(e.target.value as HoldType | "all")
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  <option value="academic">Academic</option>
                  <option value="financial">Financial</option>
                  <option value="administrative">Administrative</option>
                  <option value="disciplinary">Disciplinary</option>
                </select>
              </div>

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
                    setStatusFilter(e.target.value as HoldStatus)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="resolved">Resolved</option>
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
                <p className="mt-2">Loading holds...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-6 text-center text-red-600">
                <p>Error: {error.message}</p>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && data && data.holds.length === 0 && (
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No holds found
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {statusFilter === "active"
                    ? "There are no active holds matching your filters."
                    : "There are no resolved holds matching your filters."}
                </p>
              </div>
            )}

            {/* Results Table */}
            {!isLoading && data && data.holds.length > 0 && (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Student Name
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Student ID
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Hold Type
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Hold Name
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Blocks
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Placed Date
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Placed By
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
                  {data.holds.map((hold) => (
                    <tr
                      key={hold.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                        onClick={() =>
                          hold.student && handleRowClick(hold.student.id)
                        }
                      >
                        {hold.student
                          ? `${hold.student.firstName} ${hold.student.lastName}`
                          : "Unknown"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {hold.student?.studentId ?? "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getHoldTypeBadgeColor(
                            hold.holdType
                          )}`}
                        >
                          {hold.holdType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs">
                          <div className="font-medium">{hold.holdName}</div>
                          <div className="text-xs text-gray-500">
                            {hold.holdCode}
                          </div>
                          {hold.description && (
                            <div className="text-xs text-gray-500 mt-1 truncate">
                              {hold.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="max-w-xs text-xs">
                          {getBlocksDescription(hold)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(hold.effectiveFrom)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {hold.placedBy ?? hold.placedByOffice ?? "System"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {statusFilter === "active" && !hold.resolvedAt ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReleaseConfirmation({
                                holdId: hold.id,
                                studentName: hold.student
                                  ? `${hold.student.firstName} ${hold.student.lastName}`
                                  : "Unknown",
                              });
                            }}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            Release
                          </button>
                        ) : (
                          <span className="text-gray-400">Released</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Results Count */}
            {!isLoading && data && data.holds.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{data.holds.length}</span>{" "}
                  of <span className="font-medium">{data.total}</span> holds
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Hold Modal */}
      {showAddModal && (
        <AddHoldModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            refetch();
          }}
        />
      )}

      {/* Release Confirmation Dialog */}
      {releaseConfirmation && (
        <ReleaseConfirmationDialog
          studentName={releaseConfirmation.studentName}
          onConfirm={(notes) =>
            handleReleaseHold(releaseConfirmation.holdId, notes)
          }
          onCancel={() => setReleaseConfirmation(null)}
          isLoading={releaseHold.isPending}
        />
      )}
    </div>
  );
}

// Add Hold Modal Component
function AddHoldModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<{
    id: string;
    name: string;
    studentId: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    holdType: "academic" as HoldType,
    holdCode: "",
    holdName: "",
    description: "",
    blocksRegistration: true,
    blocksGrades: false,
    blocksTranscript: false,
    blocksDiploma: false,
    releaseAuthority: "",
    placedByOffice: "",
  });

  // Search students
  const { data: searchResults } = trpc.student.search.useQuery(
    {
      query: studentSearchQuery,
      limit: 10,
      offset: 0,
    },
    {
      enabled: studentSearchQuery.length >= 2,
    }
  );

  // Create hold mutation
  const createHold = trpc.holds.create.useMutation({
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    createHold.mutate({
      studentId: selectedStudent.id,
      ...formData,
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Add Registration Hold
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
          {/* Student Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Student
            </label>
            {!selectedStudent ? (
              <div>
                <input
                  type="text"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  placeholder="Search by name, ID, or email..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchResults && searchResults.students.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-md max-h-40 overflow-y-auto">
                    {searchResults.students.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudent({
                            id: student.id,
                            name: `${
                              student.preferredFirstName ||
                              student.legalFirstName
                            } ${student.legalLastName}`,
                            studentId: student.studentId,
                          });
                          setStudentSearchQuery("");
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-sm">
                          {student.preferredFirstName || student.legalFirstName}{" "}
                          {student.legalLastName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {student.studentId} - {student.primaryEmail}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border border-blue-200 rounded-md">
                <div>
                  <div className="font-medium text-sm">{selectedStudent.name}</div>
                  <div className="text-xs text-gray-600">
                    {selectedStudent.studentId}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Hold Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hold Type
            </label>
            <select
              value={formData.holdType}
              onChange={(e) =>
                setFormData({ ...formData, holdType: e.target.value as HoldType })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="academic">Academic</option>
              <option value="financial">Financial</option>
              <option value="administrative">Administrative</option>
              <option value="disciplinary">Disciplinary</option>
            </select>
          </div>

          {/* Hold Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hold Code
            </label>
            <input
              type="text"
              value={formData.holdCode}
              onChange={(e) =>
                setFormData({ ...formData, holdCode: e.target.value })
              }
              maxLength={20}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Hold Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hold Name
            </label>
            <input
              type="text"
              value={formData.holdName}
              onChange={(e) =>
                setFormData({ ...formData, holdName: e.target.value })
              }
              maxLength={100}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* What it blocks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What This Hold Blocks
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.blocksRegistration}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      blocksRegistration: e.target.checked,
                    })
                  }
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Registration</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.blocksGrades}
                  onChange={(e) =>
                    setFormData({ ...formData, blocksGrades: e.target.checked })
                  }
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Grades</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.blocksTranscript}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      blocksTranscript: e.target.checked,
                    })
                  }
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Transcript</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.blocksDiploma}
                  onChange={(e) =>
                    setFormData({ ...formData, blocksDiploma: e.target.checked })
                  }
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Diploma</span>
              </label>
            </div>
          </div>

          {/* Release Authority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Release Authority (Optional)
            </label>
            <input
              type="text"
              value={formData.releaseAuthority}
              onChange={(e) =>
                setFormData({ ...formData, releaseAuthority: e.target.value })
              }
              maxLength={50}
              placeholder="e.g., Registrar, Bursar, Dean"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Placed By Office */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Placed By Office (Optional)
            </label>
            <input
              type="text"
              value={formData.placedByOffice}
              onChange={(e) =>
                setFormData({ ...formData, placedByOffice: e.target.value })
              }
              maxLength={100}
              placeholder="e.g., Office of the Registrar"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Error Message */}
          {createHold.error && (
            <div className="text-sm text-red-600">
              Error: {createHold.error.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedStudent || createHold.isPending}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {createHold.isPending ? "Creating..." : "Create Hold"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Release Confirmation Dialog Component
function ReleaseConfirmationDialog({
  studentName,
  onConfirm,
  onCancel,
  isLoading,
}: {
  studentName: string;
  onConfirm: (notes?: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Release Hold</h2>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700">
            Are you sure you want to release this hold for{" "}
            <span className="font-semibold">{studentName}</span>?
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Resolution Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Enter any notes about why this hold is being released..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(notes || undefined)}
            disabled={isLoading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isLoading ? "Releasing..." : "Release Hold"}
          </button>
        </div>
      </div>
    </div>
  );
}
