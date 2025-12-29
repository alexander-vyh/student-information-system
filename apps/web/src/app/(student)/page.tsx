"use client";

import { trpc } from "@/trpc/client";
import { AlertCircle, BookOpen, GraduationCap, TrendingUp } from "lucide-react";

export default function StudentDashboardPage() {
  // Fetch student profile
  const { data: student } = trpc.student.me.useQuery();

  // Fetch detailed information including GPA, enrollments, and holds
  const { data: details, isLoading } = trpc.student.getWithDetails.useQuery(
    { studentId: student?.id ?? "" },
    { enabled: !!student?.id }
  );

  if (isLoading || !student || !details) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const studentName = student.preferredFirstName && student.preferredLastName
    ? `${student.preferredFirstName} ${student.preferredLastName}`
    : `${student.legalFirstName} ${student.legalLastName}`;

  // Calculate current term credits from enrollments
  const currentTermCredits = details.currentEnrollments.reduce(
    (sum, enrollment) => sum + parseFloat(enrollment.creditHours),
    0
  );

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {studentName}!
        </h1>
        <p className="mt-2 text-gray-600">
          Here's an overview of your academic progress and current schedule.
        </p>
      </div>

      {/* Active Holds Warning */}
      {details.activeHolds.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Active Holds on Your Account
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p className="mb-2">
                  You have {details.activeHolds.length} active hold(s) that may
                  affect your ability to register or access certain services:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {details.activeHolds.map((hold) => (
                    <li key={hold.id}>
                      <strong>{hold.holdName}</strong> ({hold.holdType})
                      {hold.blocksRegistration && " - Blocks Registration"}
                      {hold.blocksGrades && " - Blocks Grades"}
                      {hold.blocksTranscript && " - Blocks Transcripts"}
                    </li>
                  ))}
                </ul>
                <p className="mt-2">
                  Please contact the appropriate office to resolve these holds.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Term Credits */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <BookOpen className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-500">
                Current Term Credits
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {currentTermCredits.toFixed(1)}
              </p>
            </div>
          </div>
        </div>

        {/* Cumulative GPA */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <GraduationCap className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-500">Cumulative GPA</p>
              <p className="text-2xl font-bold text-gray-900">
                {details.gpaSummary?.cumulativeGpa
                  ? parseFloat(details.gpaSummary.cumulativeGpa).toFixed(2)
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* Total Credits Earned */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-500">Credits Earned</p>
              <p className="text-2xl font-bold text-gray-900">
                {details.gpaSummary?.cumulativeEarnedCredits
                  ? parseFloat(details.gpaSummary.cumulativeEarnedCredits).toFixed(
                      1
                    )
                  : "0"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {details.gpaSummary?.transferCredits &&
                parseFloat(details.gpaSummary.transferCredits) > 0
                  ? `${parseFloat(
                      details.gpaSummary.transferCredits
                    ).toFixed(1)} transfer credits`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Schedule */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Current Schedule
          </h2>
        </div>
        <div className="overflow-x-auto">
          {details.currentEnrollments.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No Current Enrollments
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                You are not currently registered for any classes.
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Course
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Title
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Section
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
                    Grade Mode
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Term
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {details.currentEnrollments.map((enrollment) => (
                  <tr key={enrollment.registrationId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {enrollment.courseCode}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {enrollment.courseTitle}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {enrollment.sectionNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {parseFloat(enrollment.creditHours).toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="capitalize">
                        {(enrollment.gradeMode ?? "standard").replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {enrollment.termName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {details.currentEnrollments.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-700">
              Total Credits:{" "}
              <span className="font-medium">{currentTermCredits.toFixed(1)}</span>
            </p>
          </div>
        )}
      </div>

      {/* Academic Summary */}
      {details.gpaSummary && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Academic Summary
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Cumulative GPA</p>
              <p className="text-lg font-semibold text-gray-900">
                {parseFloat(details.gpaSummary.cumulativeGpa ?? "0").toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Last Term GPA</p>
              <p className="text-lg font-semibold text-gray-900">
                {details.gpaSummary.lastTermGpa
                  ? parseFloat(details.gpaSummary.lastTermGpa).toFixed(2)
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Credits Attempted</p>
              <p className="text-lg font-semibold text-gray-900">
                {parseFloat(
                  details.gpaSummary.cumulativeAttemptedCredits ?? "0"
                ).toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">In Progress</p>
              <p className="text-lg font-semibold text-gray-900">
                {details.gpaSummary.inProgressCredits
                  ? parseFloat(details.gpaSummary.inProgressCredits).toFixed(1)
                  : "0.0"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
