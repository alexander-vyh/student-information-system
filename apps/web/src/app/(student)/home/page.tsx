"use client";

import { trpc } from "@/trpc/client";
import {
  BookOpen,
  GraduationCap,
  TrendingUp,
  Target,
  CheckCircle2,
  ArrowRight,
  FileText,
  Calendar,
  User,
} from "lucide-react";
import {
  Card,
  CardContent,
  StatCard,
  Alert,
  LoadingSpinner,
} from "@/components/ui";
import Link from "next/link";

export default function StudentDashboardPage() {
  // Fetch student profile
  const { data: student } = trpc.student.me.useQuery();

  // Fetch detailed information including GPA, enrollments, and holds
  const { data: details, isLoading } = trpc.student.getWithDetails.useQuery(
    { studentId: student?.id ?? "" },
    { enabled: !!student?.id }
  );

  // Fetch academic standing
  const { data: academicStanding } = trpc.academicStanding.getCurrentStanding.useQuery(
    { studentId: student?.id ?? "" },
    { enabled: !!student?.id }
  );

  // Fetch degree progress (if we have studentProgramId)
  const { data: degreeProgress } = trpc.degreeAudit.getProgressSummary.useQuery(
    {
      studentId: student?.id ?? "",
      studentProgramId: academicStanding?.studentProgramId ?? "",
    },
    { enabled: !!student?.id && !!academicStanding?.studentProgramId }
  );

  if (isLoading || !student || !details) {
    return <LoadingSpinner centered text="Loading dashboard..." />;
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
      <CardContent>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {studentName}!
        </h1>
        <p className="mt-2 text-gray-600">
          Here's an overview of your academic progress and current schedule.
        </p>
      </CardContent>

      {/* Academic Standing Warning */}
      {academicStanding && academicStanding.severity >= 2 && (
        <Alert
          variant={academicStanding.severity >= 4 ? "error" : "warning"}
          title={`Academic Standing: ${academicStanding.standingDisplayName}`}
        >
          <p>
            Your current academic standing is{" "}
            <strong>{academicStanding.standingDisplayName}</strong>.
            {academicStanding.severity >= 4 &&
              " This may affect your ability to continue enrollment."}
            {academicStanding.severity === 2 &&
              " Please meet with your academic advisor to discuss strategies for improvement."}
            {academicStanding.severity === 3 &&
              " You must improve your GPA to avoid suspension. Contact your advisor immediately."}
          </p>
          <p className="mt-2">
            <Link
              href="/profile"
              className="font-medium underline hover:no-underline"
            >
              View full academic standing details →
            </Link>
          </p>
        </Alert>
      )}

      {/* Active Holds Warning */}
      {details.activeHolds.length > 0 && (
        <Alert variant="error" title="Active Holds on Your Account">
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
        </Alert>
      )}

      {/* Degree Progress Card (if available) */}
      {degreeProgress && (
        <Card>
          <CardContent className="relative overflow-hidden">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Degree Progress
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {degreeProgress.programName}
                </p>
              </div>
              <div className="flex-shrink-0">
                <Target className="h-8 w-8 text-blue-600" />
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Overall Completion
                </span>
                <span className="text-sm font-bold text-blue-600">
                  {degreeProgress.completionPercentage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${degreeProgress.completionPercentage}%` }}
                />
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-900">
                  {degreeProgress.creditsEarned.toFixed(0)}
                </p>
                <p className="text-xs text-blue-700 mt-1">Credits Earned</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">
                  {degreeProgress.creditsRemaining.toFixed(0)}
                </p>
                <p className="text-xs text-gray-700 mt-1">Credits Remaining</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-900">
                  {degreeProgress.requirementsComplete}
                </p>
                <p className="text-xs text-green-700 mt-1">
                  Requirements Complete
                </p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">
                  {degreeProgress.requirementsTotal}
                </p>
                <p className="text-xs text-gray-700 mt-1">Total Requirements</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <Link
                href="/profile"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center"
              >
                View detailed degree audit
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Current Term Credits"
          value={currentTermCredits.toFixed(1)}
          icon={BookOpen}
          color="blue"
        />

        <StatCard
          label="Cumulative GPA"
          value={
            details.gpaSummary?.cumulativeGpa
              ? parseFloat(details.gpaSummary.cumulativeGpa).toFixed(2)
              : "N/A"
          }
          icon={GraduationCap}
          color="green"
        />

        <StatCard
          label="Credits Earned"
          value={
            details.gpaSummary?.cumulativeEarnedCredits
              ? parseFloat(details.gpaSummary.cumulativeEarnedCredits).toFixed(1)
              : "0"
          }
          icon={TrendingUp}
          color="purple"
          subtitle={
            details.gpaSummary?.transferCredits &&
            parseFloat(details.gpaSummary.transferCredits) > 0
              ? `${parseFloat(details.gpaSummary.transferCredits).toFixed(1)} transfer credits`
              : undefined
          }
        />
      </div>

      {/* Current Schedule */}
      <Card>
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
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardContent>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              href="/registration"
              className="flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors group"
            >
              <Calendar className="h-6 w-6 text-blue-600 group-hover:scale-110 transition-transform" />
              <div>
                <p className="font-medium text-blue-900">Register</p>
                <p className="text-xs text-blue-700">Add/drop classes</p>
              </div>
            </Link>

            <Link
              href="/grades"
              className="flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors group"
            >
              <GraduationCap className="h-6 w-6 text-green-600 group-hover:scale-110 transition-transform" />
              <div>
                <p className="font-medium text-green-900">View Grades</p>
                <p className="text-xs text-green-700">Check your GPA</p>
              </div>
            </Link>

            <Link
              href="/transcripts"
              className="flex items-center gap-3 p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors group"
            >
              <FileText className="h-6 w-6 text-purple-600 group-hover:scale-110 transition-transform" />
              <div>
                <p className="font-medium text-purple-900">Transcripts</p>
                <p className="text-xs text-purple-700">Request official</p>
              </div>
            </Link>

            <Link
              href="/profile"
              className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
            >
              <User className="h-6 w-6 text-gray-600 group-hover:scale-110 transition-transform" />
              <div>
                <p className="font-medium text-gray-900">My Profile</p>
                <p className="text-xs text-gray-700">Update info</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Academic Summary */}
      {details.gpaSummary && (
        <CardContent>
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
        </CardContent>
      )}
    </div>
  );
}
