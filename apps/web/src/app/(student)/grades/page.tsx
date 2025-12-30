"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/trpc/client";
import { Award, TrendingUp, BookOpen, GraduationCap } from "lucide-react";
import { LoadingSpinner, StatCard, Alert } from "@/components/ui";

export default function GradesPage() {
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);

  // Get student data
  const { data: studentData } = trpc.student.me.useQuery();

  // Get enrollment history (completed courses with grades)
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

  // Get GPA summary
  const { data: gpaSummary, isLoading: isLoadingGpa } =
    trpc.enrollment.getGpaSummary.useQuery(
      {
        studentId: studentData?.id || "",
        termId: selectedTermId || undefined,
      },
      {
        enabled: !!studentData?.id,
      }
    );

  // Group enrollments by term
  const enrollmentsByTerm = useMemo(() => {
    if (!enrollmentHistory) return {};

    return enrollmentHistory.reduce(
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
  }, [enrollmentHistory]);

  // Get unique terms and sort them (most recent first)
  const terms = useMemo(() => {
    if (!enrollmentsByTerm) return [];
    return Object.values(enrollmentsByTerm).sort((a, b) =>
      b.termName.localeCompare(a.termName)
    );
  }, [enrollmentsByTerm]);

  // Auto-select first term if not selected
  if (!selectedTermId && terms.length > 0 && terms[0]) {
    setSelectedTermId(terms[0].termId);
  }

  const selectedTerm = terms.find((t) => t.termId === selectedTermId);

  // Calculate term totals
  const termTotals = useMemo(() => {
    if (!selectedTerm) return { credits: 0, qualityPoints: 0, gpa: 0 };

    let totalCredits = 0;
    let totalQualityPoints = 0;

    selectedTerm.enrollments.forEach((enrollment) => {
      const credits = parseFloat(enrollment.creditHours || "0");
      const gradePoints = parseFloat(enrollment.gradePoints || "0");

      totalCredits += credits;
      if (gradePoints > 0) {
        totalQualityPoints += credits * gradePoints;
      }
    });

    const gpa = totalCredits > 0 ? totalQualityPoints / totalCredits : 0;

    return {
      credits: totalCredits,
      qualityPoints: totalQualityPoints,
      gpa: gpa,
    };
  }, [selectedTerm]);

  // Helper functions
  const formatGrade = (gradeCode: string | null) => {
    if (!gradeCode) return "N/A";
    return gradeCode;
  };

  const getGradeColor = (gradeCode: string | null) => {
    if (!gradeCode) return "text-gray-500";

    const grade = gradeCode.toUpperCase();
    if (grade === "A" || grade === "A+" || grade === "A-") return "text-green-600 font-semibold";
    if (grade === "B" || grade === "B+" || grade === "B-") return "text-blue-600 font-semibold";
    if (grade === "C" || grade === "C+" || grade === "C-") return "text-yellow-600 font-semibold";
    if (grade === "D" || grade === "D+" || grade === "D-") return "text-orange-600 font-semibold";
    if (grade === "F") return "text-red-600 font-semibold";
    if (grade === "P") return "text-green-600 font-semibold";
    return "text-gray-700";
  };

  if (isLoadingHistory || isLoadingGpa) {
    return <LoadingSpinner size="md" text="Loading grades..." centered />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Grades</h1>
        <p className="mt-1 text-sm text-gray-500">
          View your academic performance and GPA
        </p>
      </div>

      {/* GPA Summary Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Cumulative GPA"
          value={gpaSummary?.cumulativeGpa.toFixed(3) || "0.000"}
          icon={GraduationCap}
          color="blue"
        />

        <StatCard
          label="Term GPA"
          value={gpaSummary?.termGpa?.toFixed(3) || "N/A"}
          icon={TrendingUp}
          color="green"
        />

        <StatCard
          label="Credits Earned"
          value={gpaSummary?.cumulativeEarnedCredits.toFixed(1) || "0.0"}
          icon={Award}
          color="purple"
        />

        <StatCard
          label="Credits Attempted"
          value={gpaSummary?.cumulativeAttemptedCredits.toFixed(1) || "0.0"}
          icon={BookOpen}
          color="orange"
        />
      </div>

      {/* Term Selector */}
      {terms.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <label
            htmlFor="term-selector"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Select Term
          </label>
          <select
            id="term-selector"
            className="block w-full max-w-md rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={selectedTermId || ""}
            onChange={(e) => setSelectedTermId(e.target.value)}
          >
            {terms.map((term) => (
              <option key={term.termId} value={term.termId}>
                {term.termName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Empty State */}
      {(!enrollmentHistory || enrollmentHistory.length === 0) && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <GraduationCap className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No Grades Found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            You don't have any grades posted yet.
          </p>
        </div>
      )}

      {/* Grades Table */}
      {selectedTerm && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Term Header */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              {selectedTerm.termName} - Course Grades
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {selectedTerm.enrollments.length} course
              {selectedTerm.enrollments.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Grades Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course Code
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
                    Grade Points
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quality Points
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {selectedTerm.enrollments.map((enrollment) => {
                  const credits = parseFloat(enrollment.creditHours || "0");
                  const gradePoints = parseFloat(enrollment.gradePoints || "0");
                  const qualityPoints = credits * gradePoints;

                  return (
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
                        {credits.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={getGradeColor(enrollment.gradeCode)}>
                          {formatGrade(enrollment.gradeCode)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {gradePoints > 0 ? gradePoints.toFixed(2) : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {gradePoints > 0 ? qualityPoints.toFixed(2) : "N/A"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Term Totals Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-700">
                Term Totals
              </div>
              <div className="flex gap-8 text-sm">
                <div>
                  <span className="text-gray-500">Credits: </span>
                  <span className="font-semibold text-gray-900">
                    {termTotals.credits.toFixed(1)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Quality Points: </span>
                  <span className="font-semibold text-gray-900">
                    {termTotals.qualityPoints.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Term GPA: </span>
                  <span className="font-semibold text-gray-900">
                    {termTotals.gpa.toFixed(3)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GPA Calculation Info */}
      <Alert variant="info" title="GPA Calculation">
        <p>
          GPA is calculated by dividing total quality points by total
          credits. Quality points = credits × grade points. Only courses
          with letter grades count toward GPA calculation.
        </p>
      </Alert>
    </div>
  );
}
