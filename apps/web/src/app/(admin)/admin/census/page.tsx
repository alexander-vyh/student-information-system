"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";

type SnapshotType = "census" | "midterm" | "final" | "custom";

export default function CensusPage() {
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [viewingSnapshotId, setViewingSnapshotId] = useState<string | null>(null);

  // Get terms for dropdown
  const { data: terms } = trpc.admin.getTerms.useQuery({ includeInactive: false, limit: 20 });

  // Get snapshots for selected term
  const { data: snapshots, isLoading, refetch } = trpc.census.listSnapshots.useQuery(
    { termId: selectedTermId },
    { enabled: !!selectedTermId }
  );

  // Get current enrollment (real-time)
  const { data: currentEnrollment } = trpc.census.getCurrentEnrollment.useQuery(
    { termId: selectedTermId },
    { enabled: !!selectedTermId }
  );

  // Mutations
  const deleteSnapshot = trpc.census.deleteSnapshot.useMutation({
    onSuccess: () => refetch(),
  });

  const finalizeSnapshot = trpc.census.finalizeSnapshot.useMutation({
    onSuccess: () => refetch(),
  });

  const generateNscFile = trpc.census.generateNscFile.useMutation({
    onSuccess: (data) => {
      // Create download
      const blob = new Blob([data.fileContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.fileName;
      a.click();
      URL.revokeObjectURL(url);
      refetch();
    },
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "draft":
        return "bg-yellow-100 text-yellow-800";
      case "finalized":
        return "bg-blue-100 text-blue-800";
      case "submitted":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeBadge = (type: string | null) => {
    switch (type) {
      case "census":
        return "bg-purple-100 text-purple-800";
      case "midterm":
        return "bg-orange-100 text-orange-800";
      case "final":
        return "bg-green-100 text-green-800";
      case "custom":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this draft snapshot?")) {
      deleteSnapshot.mutate({ id });
    }
  };

  const handleFinalize = (id: string) => {
    if (confirm("Finalize this snapshot? This action cannot be undone.")) {
      finalizeSnapshot.mutate({ id });
    }
  };

  const handleGenerateNsc = (snapshotId: string) => {
    generateNscFile.mutate({ snapshotId });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Census & Enrollment Reporting
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Generate census snapshots and NSC enrollment files
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Term Selector + Generate Button */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Select Term:</label>
              <select
                value={selectedTermId}
                onChange={(e) => setSelectedTermId(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a term...</option>
                {terms?.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name} ({term.code})
                  </option>
                ))}
              </select>
            </div>
            {selectedTermId && (
              <button
                onClick={() => setShowGenerateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Generate Snapshot
              </button>
            )}
          </div>
        </div>

        {/* Current Enrollment Summary */}
        {selectedTermId && currentEnrollment && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm font-medium text-gray-500">Current Headcount</div>
              <div className="mt-1 text-3xl font-semibold text-gray-900">{currentEnrollment.headcount}</div>
              <div className="text-xs text-gray-400">Real-time</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm font-medium text-gray-500">Full-Time</div>
              <div className="mt-1 text-3xl font-semibold text-blue-600">{currentEnrollment.fullTime}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm font-medium text-gray-500">Part-Time</div>
              <div className="mt-1 text-3xl font-semibold text-green-600">{currentEnrollment.partTime}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm font-medium text-gray-500">Total Credit Hours</div>
              <div className="mt-1 text-3xl font-semibold text-gray-900">{currentEnrollment.totalCredits}</div>
            </div>
          </div>
        )}

        {/* Snapshots Table */}
        {selectedTermId && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Census Snapshots</h2>
            </div>
            <div className="overflow-x-auto">
              {isLoading && (
                <div className="p-6 text-center text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  <p className="mt-2">Loading snapshots...</p>
                </div>
              )}

              {!isLoading && snapshots && snapshots.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No snapshots yet</h3>
                  <p className="mt-1 text-sm text-gray-500">Generate a census snapshot to capture enrollment data.</p>
                </div>
              )}

              {!isLoading && snapshots && snapshots.length > 0 && (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Headcount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">FTE</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">FT / PT</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">NSC</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {snapshots.map((snapshot) => (
                      <tr key={snapshot.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(snapshot.snapshotDate)}
                          </div>
                          {snapshot.session && (
                            <div className="text-xs text-gray-500">{snapshot.session.name}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeBadge(snapshot.snapshotType)}`}>
                            {snapshot.snapshotType}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {snapshot.totalHeadcount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {snapshot.totalFte}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {snapshot.fullTimeCount} / {snapshot.partTimeCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(snapshot.status)}`}>
                            {snapshot.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {snapshot.nscFileName ? (
                            <span className="text-green-600">{snapshot.nscFileName}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <button
                            onClick={() => setViewingSnapshotId(snapshot.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </button>
                          {snapshot.status === "draft" && (
                            <>
                              <button
                                onClick={() => handleFinalize(snapshot.id)}
                                className="text-green-600 hover:text-green-900"
                                disabled={finalizeSnapshot.isPending}
                              >
                                Finalize
                              </button>
                              <button
                                onClick={() => handleDelete(snapshot.id)}
                                className="text-red-600 hover:text-red-900"
                                disabled={deleteSnapshot.isPending}
                              >
                                Delete
                              </button>
                            </>
                          )}
                          {snapshot.status === "finalized" && !snapshot.nscFileName && (
                            <button
                              onClick={() => handleGenerateNsc(snapshot.id)}
                              className="text-purple-600 hover:text-purple-900"
                              disabled={generateNscFile.isPending}
                            >
                              Generate NSC
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {!isLoading && snapshots && snapshots.length > 0 && (
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{snapshots.length}</span> snapshots
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {!selectedTermId && (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Select a term</h3>
            <p className="mt-1 text-sm text-gray-500">Choose a term to view and manage census snapshots.</p>
          </div>
        )}
      </main>

      {/* Generate Snapshot Modal */}
      {showGenerateModal && selectedTermId && (
        <GenerateSnapshotModal
          termId={selectedTermId}
          onClose={() => setShowGenerateModal(false)}
          onSuccess={() => {
            setShowGenerateModal(false);
            refetch();
          }}
        />
      )}

      {/* View Snapshot Modal */}
      {viewingSnapshotId && (
        <ViewSnapshotModal
          snapshotId={viewingSnapshotId}
          onClose={() => setViewingSnapshotId(null)}
        />
      )}
    </div>
  );
}

// Generate Snapshot Modal
function GenerateSnapshotModal({
  termId,
  onClose,
  onSuccess,
}: {
  termId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [formData, setFormData] = useState({
    snapshotDate: today,
    snapshotType: "census" as SnapshotType,
    fullTimeCreditsThreshold: 12,
    halfTimeCreditsThreshold: 6,
  });

  const generateSnapshot = trpc.census.generateSnapshot.useMutation({
    onSuccess: (result) => {
      alert(`Snapshot generated: ${result.totalHeadcount} students, ${result.totalFte} FTE`);
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generateSnapshot.mutate({
      termId,
      snapshotDate: formData.snapshotDate,
      snapshotType: formData.snapshotType,
      fullTimeCreditsThreshold: formData.fullTimeCreditsThreshold,
      halfTimeCreditsThreshold: formData.halfTimeCreditsThreshold,
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Generate Census Snapshot</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Snapshot Date</label>
            <input
              type="date"
              value={formData.snapshotDate}
              onChange={(e) => setFormData({ ...formData, snapshotDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Snapshot Type</label>
            <select
              value={formData.snapshotType}
              onChange={(e) => setFormData({ ...formData, snapshotType: e.target.value as SnapshotType })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="census">Census (Official)</option>
              <option value="midterm">Midterm</option>
              <option value="final">Final</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full-Time Credits</label>
              <input
                type="number"
                value={formData.fullTimeCreditsThreshold}
                onChange={(e) => setFormData({ ...formData, fullTimeCreditsThreshold: parseInt(e.target.value) || 12 })}
                min={1}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Typically 12 credits</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Half-Time Credits</label>
              <input
                type="number"
                value={formData.halfTimeCreditsThreshold}
                onChange={(e) => setFormData({ ...formData, halfTimeCreditsThreshold: parseInt(e.target.value) || 6 })}
                min={1}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Typically 6 credits</p>
            </div>
          </div>

          {generateSnapshot.error && (
            <div className="text-sm text-red-600">Error: {generateSnapshot.error.message}</div>
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
              disabled={generateSnapshot.isPending}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300"
            >
              {generateSnapshot.isPending ? "Generating..." : "Generate Snapshot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// View Snapshot Modal
function ViewSnapshotModal({
  snapshotId,
  onClose,
}: {
  snapshotId: string;
  onClose: () => void;
}) {
  const { data: snapshot, isLoading } = trpc.census.getSnapshot.useQuery({ id: snapshotId });
  const { data: details } = trpc.census.getSnapshotDetails.useQuery(
    { snapshotId, limit: 50 },
    { enabled: !!snapshot }
  );

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Snapshot Details</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="text-center text-gray-500">Loading...</div>
          )}

          {snapshot && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">Date</div>
                  <div className="text-lg font-semibold">{formatDate(snapshot.snapshotDate)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">Headcount</div>
                  <div className="text-lg font-semibold">{snapshot.totalHeadcount}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">Total FTE</div>
                  <div className="text-lg font-semibold">{snapshot.totalFte}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">Credit Hours</div>
                  <div className="text-lg font-semibold">{snapshot.totalCreditHours}</div>
                </div>
              </div>

              {/* Enrollment Breakdown */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Enrollment Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-gray-500">Full-Time</div>
                    <div className="text-xl font-semibold text-blue-600">{snapshot.fullTimeCount}</div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-gray-500">Half-Time</div>
                    <div className="text-xl font-semibold text-green-600">{snapshot.halfTimeCount}</div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-gray-500">Part-Time</div>
                    <div className="text-xl font-semibold text-yellow-600">{snapshot.partTimeCount}</div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-gray-500">&lt; Half-Time</div>
                    <div className="text-xl font-semibold text-gray-600">{snapshot.lessThanHalfTimeCount}</div>
                  </div>
                </div>
              </div>

              {/* FTE by Level */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">FTE by Level</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-gray-500">Undergraduate FTE</div>
                    <div className="text-xl font-semibold">{snapshot.undergraduateFte}</div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-gray-500">Graduate FTE</div>
                    <div className="text-xl font-semibold">{snapshot.graduateFte}</div>
                  </div>
                </div>
              </div>

              {/* Student Records Preview */}
              {details && details.data.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Student Records (showing {details.data.length} of {details.pagination.total})
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Student</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Credits</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">FTE</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Level</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {details.data.map((record) => (
                          <tr key={record.id}>
                            <td className="px-4 py-2 text-sm">
                              <div className="font-medium text-gray-900">{record.studentName}</div>
                              <div className="text-gray-500 text-xs">{record.studentNumber}</div>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {record.enrollmentType?.replace("_", " ")}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">{record.creditHours}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{record.fte}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{record.level}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
