"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { useRouter } from "next/navigation";

type JobStatus = "pending" | "processing" | "completed" | "failed";

interface BatchResult {
  studentId: string;
  studentProgramId: string;
  graduationApplicationId: string;
  status: "conferred" | "failed" | "skipped";
  honorsDesignation?: string;
  failureReason?: string;
}

export default function BatchConferralPage() {
  const router = useRouter();
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [conferralDate, setConferralDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [calculateHonors, setCalculateHonors] = useState(true);
  const [updateStudentStatus, setUpdateStudentStatus] = useState(true);
  const [generateTranscripts, setGenerateTranscripts] = useState(true);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Get available terms
  const { data: terms } = trpc.admin.getTerms.useQuery({});

  // Get candidates for batch conferral (approved applications for selected term)
  const { data: candidatesData, isLoading: loadingCandidates } =
    trpc.graduation.listApplications.useQuery(
      {
        termId: selectedTermId,
        status: ["approved"],
        limit: 500,
        offset: 0,
      },
      {
        enabled: !!selectedTermId,
      }
    );

  // Start batch conferral mutation
  const startBatch = trpc.graduation.startBatchConferral.useMutation({
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
    },
  });

  // Poll for job status
  const { data: jobData } = trpc.graduation.getBatchJob.useQuery(
    { jobId: activeJobId! },
    {
      enabled: !!activeJobId,
      refetchInterval: (query) => {
        const data = query.state.data;
        // Stop polling when job is completed or failed
        if (data?.status === "completed" || data?.status === "failed") {
          return false;
        }
        return 2000; // Poll every 2 seconds while processing
      },
    }
  );

  const handleStartBatch = () => {
    if (!selectedTermId || !conferralDate) return;

    startBatch.mutate({
      termId: selectedTermId,
      conferralDate: new Date(conferralDate),
      calculateLatinHonors: calculateHonors,
      updateStudentStatus,
      generateTranscripts,
    });
  };

  const getStatusBadge = (status: JobStatus) => {
    const colors: Record<JobStatus, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const candidates = candidatesData ?? [];
  const results = (jobData?.results ?? []) as BatchResult[];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <button
              onClick={() => router.push("/admin/graduation")}
              className="mr-4 text-gray-500 hover:text-gray-700"
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
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Batch Degree Conferral
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Conferral Settings
              </h2>

              <div className="space-y-4">
                {/* Term Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Term *
                  </label>
                  <select
                    value={selectedTermId}
                    onChange={(e) => {
                      setSelectedTermId(e.target.value);
                      setActiveJobId(null);
                    }}
                    disabled={!!activeJobId}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="">Select term...</option>
                    {terms?.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.name} ({term.academicYear?.name ?? ""})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Conferral Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Conferral Date *
                  </label>
                  <input
                    type="date"
                    value={conferralDate}
                    onChange={(e) => setConferralDate(e.target.value)}
                    disabled={!!activeJobId}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>

                {/* Options */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="calculateHonors"
                      checked={calculateHonors}
                      onChange={(e) => setCalculateHonors(e.target.checked)}
                      disabled={!!activeJobId}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="calculateHonors" className="ml-2 text-sm text-gray-700">
                      Calculate Latin Honors
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="updateStudentStatus"
                      checked={updateStudentStatus}
                      onChange={(e) => setUpdateStudentStatus(e.target.checked)}
                      disabled={!!activeJobId}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="updateStudentStatus" className="ml-2 text-sm text-gray-700">
                      Update Student Status to Graduated
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="generateTranscripts"
                      checked={generateTranscripts}
                      onChange={(e) => setGenerateTranscripts(e.target.checked)}
                      disabled={!!activeJobId}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="generateTranscripts" className="ml-2 text-sm text-gray-700">
                      Generate Final Transcripts
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600 mb-4">
                    <strong>Eligible Candidates:</strong>{" "}
                    {!selectedTermId ? (
                      "Select a term first"
                    ) : loadingCandidates ? (
                      "Loading..."
                    ) : (
                      <span className="text-lg font-semibold text-blue-600">
                        {candidates.length}
                      </span>
                    )}
                  </div>

                  {!activeJobId ? (
                    <button
                      onClick={handleStartBatch}
                      disabled={
                        !selectedTermId ||
                        loadingCandidates ||
                        candidates.length === 0 ||
                        startBatch.isPending
                      }
                      className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {startBatch.isPending
                        ? "Starting..."
                        : "Start Batch Conferral"}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setActiveJobId(null);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {startBatch.error && (
                  <div className="text-sm text-red-600 mt-2">
                    Error: {startBatch.error.message}
                  </div>
                )}
              </div>
            </div>

            {/* Job Status Panel */}
            {activeJobId && jobData && (
              <div className="bg-white rounded-lg shadow p-6 mt-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Job Status
                </h2>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Status</span>
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                        jobData.status as JobStatus
                      )}`}
                    >
                      {jobData.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Total Eligible</span>
                    <span className="text-sm font-medium text-gray-900">
                      {jobData.totalEligible ?? 0}
                    </span>
                  </div>

                  {/* Progress bar */}
                  {jobData.status === "processing" && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300 animate-pulse"
                        style={{ width: "50%" }}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Conferred</span>
                    <span className="text-sm font-medium text-green-600">
                      {jobData.totalConferred ?? 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Failed</span>
                    <span className="text-sm font-medium text-red-600">
                      {jobData.totalFailed ?? 0}
                    </span>
                  </div>

                  {jobData.completedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Completed</span>
                      <span className="text-sm text-gray-600">
                        {formatDate(jobData.completedAt)}
                      </span>
                    </div>
                  )}

                  {jobData.errorMessage && (
                    <div className="mt-2 p-2 bg-red-50 rounded-md">
                      <p className="text-xs text-red-700">
                        {jobData.errorMessage}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Candidates/Results Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  {activeJobId && jobData?.status === "completed"
                    ? "Conferral Results"
                    : "Eligible Candidates"}
                </h2>
              </div>

              <div className="overflow-x-auto">
                {/* No Term Selected */}
                {!selectedTermId && (
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
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      Select a term
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Choose a term to view eligible candidates for batch conferral.
                    </p>
                  </div>
                )}

                {/* Loading State */}
                {selectedTermId && loadingCandidates && !activeJobId && (
                  <div className="p-6 text-center text-gray-500">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    <p className="mt-2">Loading candidates...</p>
                  </div>
                )}

                {/* Empty State */}
                {selectedTermId &&
                  !loadingCandidates &&
                  !activeJobId &&
                  candidates.length === 0 && (
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
                        No candidates available
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        There are no approved graduation applications ready for conferral in this term.
                      </p>
                    </div>
                  )}

                {/* Candidates Table (before job starts) */}
                {!activeJobId && candidates.length > 0 && (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Student
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Program
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          GPA
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Submitted
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {candidates.map((app) => (
                        <tr key={app.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {app.student?.legalFirstName} {app.student?.legalLastName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {app.student?.studentId}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            Program ({app.studentProgram?.status ?? "—"})
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {app.finalGpa ? Number(app.finalGpa).toFixed(2) : "—"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(app.applicationDate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Results Table (after job completes) */}
                {activeJobId && jobData?.status === "completed" && results.length > 0 && (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Application ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Result
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {results.map((result, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {result.graduationApplicationId.slice(0, 8)}...
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                result.status === "conferred"
                                  ? "bg-green-100 text-green-800"
                                  : result.status === "skipped"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {result.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {result.status === "conferred" ? (
                              <span>
                                {result.honorsDesignation && result.honorsDesignation !== "none" ? (
                                  <span className="text-amber-600">
                                    {result.honorsDesignation.replace(/_/g, " ")}
                                  </span>
                                ) : (
                                  "Degree conferred"
                                )}
                              </span>
                            ) : (
                              <span className="text-red-600">{result.failureReason || "Unknown error"}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Processing State */}
                {activeJobId && jobData && jobData.status === "processing" && (
                  <div className="p-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-gray-600">
                      Processing batch conferral...
                    </p>
                    <p className="text-sm text-gray-500">
                      This may take a few moments.
                    </p>
                  </div>
                )}

                {/* Completed with no results */}
                {activeJobId && jobData?.status === "completed" && results.length === 0 && (
                  <div className="p-12 text-center text-gray-500">
                    <svg
                      className="mx-auto h-12 w-12 text-green-400"
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
                      Job completed
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Conferred: {jobData.totalConferred ?? 0} | Failed: {jobData.totalFailed ?? 0}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
