"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { LoadingSpinner, StatCard } from "@/components/ui";
import { BookOpen, CheckCircle } from "lucide-react";

export default function MyClassesPage() {
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);

  // Get student data
  const { data: studentData } = trpc.student.me.useQuery();

  // Get enrollment history
  const { data: enrollmentHistory, isLoading: isLoadingHistory } =
    trpc.enrollment.getHistory.useQuery(
      {
        studentId: studentData?.id || "",
        includeDropped: false,
      },
      {
        enabled: !!studentData?.id,
      }
    );

  // Group enrollments by term
  const enrollmentsByTerm = enrollmentHistory?.reduce(
    (acc, enrollment) => {
      const termId = enrollment.termId;
      if (!acc[termId]) {
        acc[termId] = {
          termId: termId,
          termName: enrollment.termName,
          enrollments: [],
        };
      }
      acc[termId].enrollments.push(enrollment);
      return acc;
    },
    {} as Record<
      string,
      {
        termId: string;
        termName: string;
        enrollments: typeof enrollmentHistory;
      }
    >
  );

  // Get unique terms and sort them
  const terms = enrollmentsByTerm
    ? Object.values(enrollmentsByTerm).sort((a, b) =>
        b.termName.localeCompare(a.termName)
      )
    : [];

  // Auto-select first term if not selected
  if (!selectedTermId && terms.length > 0 && terms[0]) {
    setSelectedTermId(terms[0].termId);
  }

  const selectedTerm = terms.find((t) => t.termId === selectedTermId);

  // Helper functions
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "registered":
        return "bg-green-100 text-green-800";
      case "waitlisted":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      case "dropped":
        return "bg-gray-100 text-gray-800";
      case "withdrawn":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatGrade = (gradeCode: string | null) => {
    if (!gradeCode) return "Not Posted";
    return gradeCode;
  };

  const isCurrentTerm = (termName: string) => {
    // Simple heuristic - could be improved with actual term dates
    return termName.includes(new Date().getFullYear().toString());
  };

  const handleDropClass = async (registrationId: string) => {
    if (
      !confirm(
        "Are you sure you want to drop this class? This action may affect your enrollment status."
      )
    ) {
      return;
    }

    try {
      // This is a stub - the drop mutation would be called here
      alert(
        "Drop functionality is a stub. In production, this would call the drop mutation."
      );
      // await dropMutation.mutateAsync({
      //   studentId: studentData?.id || "",
      //   registrationId: registrationId,
      // });
    } catch (error) {
      console.error("Error dropping class:", error);
      alert("Failed to drop class. Please try again.");
    }
  };

  if (isLoadingHistory) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">My Classes</h1>
        </div>
        <LoadingSpinner size="md" text="Loading your classes..." centered />
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">My Classes</h1>
        <p className="mt-2 text-sm text-gray-600">
          View and manage your current and past course enrollments
        </p>
      </div>

      {/* Term Selector */}
      {terms.length > 0 && (
        <div className="mb-6">
          <label
            htmlFor="term-selector"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Select Term
          </label>
          <select
            id="term-selector"
            className="block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            value={selectedTermId || ""}
            onChange={(e) => setSelectedTermId(e.target.value)}
          >
            {terms.map((term) => (
              <option key={term.termId} value={term.termId}>
                {term.termName}
                {isCurrentTerm(term.termName) && " (Current)"}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Empty State */}
      {(!enrollmentHistory || enrollmentHistory.length === 0) && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
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
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No Classes Found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            You are not currently enrolled in any classes.
          </p>
        </div>
      )}

      {/* Classes List */}
      {selectedTerm && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Term Header */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              {selectedTerm.termName}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {selectedTerm.enrollments.length} class
              {selectedTerm.enrollments.length !== 1 ? "es" : ""}
              {" - "}
              {selectedTerm.enrollments
                .reduce((sum, e) => sum + parseFloat(e.creditHours || "0"), 0)
                .toFixed(1)}{" "}
              total credits
            </p>
          </div>

          {/* Classes Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Grade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  {isCurrentTerm(selectedTerm.termName) && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {selectedTerm.enrollments.map((enrollment) => (
                  <tr
                    key={enrollment.registrationId}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {enrollment.courseCode}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {enrollment.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {parseFloat(enrollment.creditHours).toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatGrade(enrollment.gradeCode)}
                      {enrollment.gradePoints && (
                        <span className="text-gray-500 ml-1">
                          ({parseFloat(enrollment.gradePoints).toFixed(2)})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(
                          enrollment.status
                        )}`}
                      >
                        {enrollment.status}
                      </span>
                    </td>
                    {isCurrentTerm(selectedTerm.termName) &&
                      enrollment.status === "registered" && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() =>
                              handleDropClass(enrollment.registrationId)
                            }
                            className="text-red-600 hover:text-red-900 font-medium"
                          >
                            Drop
                          </button>
                        </td>
                      )}
                    {isCurrentTerm(selectedTerm.termName) &&
                      enrollment.status !== "registered" && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          -
                        </td>
                      )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Meeting Times Stub Section */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Note: Meeting times and instructor information will be displayed
              here once the scheduling system is integrated.
            </p>
          </div>
        </div>
      )}

      {/* Additional Info Cards */}
      {selectedTerm && (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Total Credits"
            value={selectedTerm.enrollments
              .reduce((sum, e) => sum + parseFloat(e.creditHours || "0"), 0)
              .toFixed(1)}
            icon={BookOpen}
            color="blue"
          />

          {!isCurrentTerm(selectedTerm.termName) && (
            <StatCard
              label="Completed Classes"
              value={
                selectedTerm.enrollments.filter(
                  (e) => e.status === "completed"
                ).length
              }
              icon={CheckCircle}
              color="green"
            />
          )}

          {isCurrentTerm(selectedTerm.termName) && (
            <StatCard
              label="Active Enrollments"
              value={
                selectedTerm.enrollments.filter(
                  (e) => e.status === "registered"
                ).length
              }
              icon={CheckCircle}
              color="green"
            />
          )}
        </div>
      )}
    </div>
  );
}
