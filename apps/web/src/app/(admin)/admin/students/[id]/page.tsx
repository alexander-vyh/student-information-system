"use client";

import { use, useState, useEffect } from "react";
import { trpc } from "@/trpc/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StudentCourseRegistrationModal } from "@/components/StudentCourseRegistrationModal";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function StudentDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch student data
  const {
    data: student,
    isLoading: studentLoading,
    error: studentError,
  } = trpc.student.getById.useQuery({
    studentId: id,
  });

  // Fetch current term enrollments (simplified - getting history for now)
  const {
    data: enrollmentHistory,
    isLoading: enrollmentLoading,
    error: enrollmentError,
  } = trpc.enrollment.getHistory.useQuery({
    studentId: id,
    includeDropped: true, // Include dropped to show full history
  });

  // Fetch student holds
  const {
    data: studentHolds,
    isLoading: holdsLoading,
  } = trpc.holds.getStudentHolds.useQuery({
    studentId: id,
  });

  // Fetch available terms for term selector
  const { data: terms } = trpc.enrollment.getTerms.useQuery({
    includeInactive: false,
  });

  // Fetch current term schedule
  const { data: currentSchedule, refetch: refetchSchedule } = trpc.enrollment.getSchedule.useQuery(
    {
      studentId: id,
      termId: selectedTermId,
    },
    {
      enabled: !!selectedTermId,
    }
  );

  const isLoading = studentLoading || enrollmentLoading || holdsLoading;
  const error = studentError || enrollmentError;

  const utils = trpc.useUtils();

  // Set default term when loaded
  useEffect(() => {
    if (terms && terms.length > 0 && !selectedTermId) {
      setSelectedTermId(terms[0].id);
    }
  }, [terms, selectedTermId]);

  // Drop course mutation
  const dropMutation = trpc.enrollment.drop.useMutation({
    onSuccess: () => {
      utils.enrollment.getSchedule.invalidate({ studentId: id, termId: selectedTermId });
      utils.enrollment.getHistory.invalidate({ studentId: id });
      refetchSchedule();
      setMessage({ type: "success", text: "Course dropped successfully" });
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (error) => {
      setMessage({ type: "error", text: `Failed to drop course: ${error.message}` });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  // Withdraw mutation
  const withdrawMutation = trpc.enrollment.withdraw.useMutation({
    onSuccess: () => {
      utils.enrollment.getSchedule.invalidate({ studentId: id, termId: selectedTermId });
      utils.enrollment.getHistory.invalidate({ studentId: id });
      refetchSchedule();
      setMessage({ type: "success", text: "Withdrew from course successfully" });
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (error) => {
      setMessage({ type: "error", text: `Failed to withdraw: ${error.message}` });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-gray-100 text-gray-800";
      case "graduated":
        return "bg-blue-100 text-blue-800";
      case "withdrawn":
        return "bg-yellow-100 text-yellow-800";
      case "deceased":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getDisplayName = () => {
    if (!student) return "";
    const firstName = student.preferredFirstName || student.legalFirstName;
    const lastName = student.preferredLastName || student.legalLastName;
    return `${firstName} ${lastName}`;
  };

  const getLegalName = () => {
    if (!student) return "";
    return `${student.legalFirstName}${
      student.legalMiddleName ? ` ${student.legalMiddleName}` : ""
    } ${student.legalLastName}${student.suffix ? ` ${student.suffix}` : ""}`;
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Filter to only show active holds (not resolved)
  const activeHolds = studentHolds?.filter((hold) => !hold.resolvedAt) ?? [];

  // Calculate GPA summary from enrollment history
  const calculateGpaSummary = () => {
    if (!enrollmentHistory || enrollmentHistory.length === 0) {
      return { totalCredits: 0, qualityPoints: 0, gpa: 0, completedCredits: 0 };
    }

    let totalCredits = 0;
    let qualityPoints = 0;
    let completedCredits = 0;

    // Grade point values - would ideally come from the grade scale
    const gradePoints: Record<string, number> = {
      "A": 4.0, "A-": 3.7,
      "B+": 3.3, "B": 3.0, "B-": 2.7,
      "C+": 2.3, "C": 2.0, "C-": 1.7,
      "D+": 1.3, "D": 1.0, "D-": 0.7,
      "F": 0.0,
    };

    enrollmentHistory.forEach((enrollment) => {
      if (enrollment.status === "completed" && enrollment.gradeCode) {
        const credits = parseFloat(enrollment.creditHours);
        const points = gradePoints[enrollment.gradeCode];

        if (points !== undefined) {
          totalCredits += credits;
          qualityPoints += credits * points;
          if (points >= 1.0) { // D- or better
            completedCredits += credits;
          }
        }
      }
    });

    const gpa = totalCredits > 0 ? qualityPoints / totalCredits : 0;
    return { totalCredits, qualityPoints, gpa, completedCredits };
  };

  const gpaSummary = calculateGpaSummary();

  // Group enrollments by term
  const enrollmentsByTerm = enrollmentHistory?.reduce((acc, enrollment) => {
    const termName = enrollment.termName;
    if (!acc[termName]) {
      acc[termName] = [];
    }
    acc[termName].push(enrollment);
    return acc;
  }, {} as Record<string, typeof enrollmentHistory>) ?? {};

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Loading...
            </h1>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center p-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Error
            </h1>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center text-red-600">
              <p className="text-lg font-semibold">
                {error?.message || "Student not found"}
              </p>
              <Link
                href="/admin/students"
                className="mt-4 inline-block text-blue-600 hover:text-blue-800"
              >
                Back to Student Search
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/admin/students"
                className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
              >
                &larr; Back to Search
              </Link>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                {getDisplayName()}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Student ID: {student.studentId}
              </p>
            </div>
            <span
              className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadgeColor(
                student.status
              )}`}
            >
              {student.status}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Success/Error Messages */}
        {message && (
          <div
            className={`px-4 py-3 rounded-md ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            <div className="flex items-center">
              {message.type === "success" ? (
                <svg
                  className="h-5 w-5 mr-2 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5 mr-2 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              <span className="text-sm font-medium">{message.text}</span>
              <button
                onClick={() => setMessage(null)}
                className="ml-auto text-gray-500 hover:text-gray-700"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Student Information Card */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Student Information
            </h2>
          </div>
          <div className="px-6 py-4">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Legal Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{getLegalName()}</dd>
              </div>

              {(student.preferredFirstName || student.preferredLastName) && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Preferred Name
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {getDisplayName()}
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Primary Email
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <a
                    href={`mailto:${student.primaryEmail}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {student.primaryEmail}
                  </a>
                </dd>
              </div>

              {student.institutionalEmail && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Institutional Email
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <a
                      href={`mailto:${student.institutionalEmail}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {student.institutionalEmail}
                    </a>
                  </dd>
                </div>
              )}

              {student.primaryPhone && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Primary Phone
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {student.primaryPhone}
                  </dd>
                </div>
              )}

              {student.mobilePhone && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Mobile Phone
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {student.mobilePhone}
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Date of Birth
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatDate(student.dateOfBirth)}
                </dd>
              </div>

              {student.gender && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Gender</dt>
                  <dd className="mt-1 text-sm text-gray-900">{student.gender}</dd>
                </div>
              )}

              {student.pronouns && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Pronouns</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {student.pronouns}
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-gray-500">
                  First Enrollment
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatDate(student.firstEnrollmentDate)}
                </dd>
              </div>

              {student.ssnLast4 && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">SSN</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    ***-**-{student.ssnLast4}
                  </dd>
                </div>
              )}

              {student.ferpaBlock && (
                <div className="sm:col-span-2">
                  <div className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <svg
                      className="h-5 w-5 text-yellow-600 mr-2"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm font-medium text-yellow-800">
                      FERPA Block: Directory information restricted
                    </span>
                  </div>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Academic Summary */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Academic Summary
            </h2>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">
                  {gpaSummary.gpa.toFixed(2)}
                </p>
                <p className="text-sm text-gray-600 mt-1">Cumulative GPA</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">
                  {gpaSummary.completedCredits.toFixed(0)}
                </p>
                <p className="text-sm text-gray-600 mt-1">Credits Earned</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-3xl font-bold text-purple-600">
                  {gpaSummary.totalCredits.toFixed(0)}
                </p>
                <p className="text-sm text-gray-600 mt-1">Credits Attempted</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-3xl font-bold text-orange-600">
                  {gpaSummary.qualityPoints.toFixed(1)}
                </p>
                <p className="text-sm text-gray-600 mt-1">Quality Points</p>
              </div>
            </div>
          </div>
        </div>

        {/* Registration Holds */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Registration Holds
            </h2>
            {activeHolds.length > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {activeHolds.length} Active
              </span>
            )}
          </div>
          <div className="px-6 py-4">
            {activeHolds.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
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
                <p className="mt-2 text-sm font-medium">No active holds</p>
                <p className="text-xs text-gray-400">
                  Student has no registration restrictions
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeHolds.map((hold) => (
                  <div
                    key={hold.id}
                    className="border border-red-200 bg-red-50 rounded-md p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-semibold text-red-900">
                          {hold.holdName}
                        </h3>
                        <p className="text-xs text-red-700 mt-1">
                          Type: {hold.holdType} | Code: {hold.holdCode}
                        </p>
                        {hold.description && (
                          <p className="text-sm text-red-800 mt-2">
                            {hold.description}
                          </p>
                        )}
                        <p className="text-xs text-red-600 mt-2">
                          Effective from: {formatDate(hold.effectiveFrom?.toString())}
                        </p>
                      </div>
                      <div className="flex flex-col items-end space-y-1">
                        {hold.blocksRegistration && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-800 bg-red-100 rounded">
                            Blocks Registration
                          </span>
                        )}
                        {hold.blocksGrades && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-orange-800 bg-orange-100 rounded">
                            Blocks Grades
                          </span>
                        )}
                        {hold.blocksTranscript && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded">
                            Blocks Transcript
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Current Enrollments */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Current Enrollments
              </h2>
              <div className="w-64">
                <select
                  value={selectedTermId}
                  onChange={(e) => setSelectedTermId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a term...</option>
                  {terms?.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="px-6 py-4">
            {!selectedTermId ? (
              <div className="text-center py-8 text-gray-500">
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
                <p className="mt-2 text-sm font-medium">Select a term</p>
                <p className="text-xs text-gray-400">
                  Choose a term from the dropdown to view enrollments
                </p>
              </div>
            ) : currentSchedule && currentSchedule.length > 0 ? (
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
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Credits
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Grade
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentSchedule.map((enrollment) => (
                      <tr key={enrollment.registrationId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {enrollment.courseCode}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {enrollment.title}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {enrollment.creditHours}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          {enrollment.gradeCode ? (
                            <span className="font-semibold text-gray-900">
                              {enrollment.gradeCode}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              enrollment.status === "registered"
                                ? "bg-green-100 text-green-800"
                                : enrollment.status === "completed"
                                ? "bg-blue-100 text-blue-800"
                                : enrollment.status === "dropped"
                                ? "bg-red-100 text-red-800"
                                : enrollment.status === "withdrawn"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {enrollment.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {enrollment.status === "registered" && (
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Drop ${enrollment.courseCode}? This will remove the course from the student's schedule.`
                                    )
                                  ) {
                                    dropMutation.mutate({
                                      registrationId: enrollment.registrationId,
                                    });
                                  }
                                }}
                                disabled={dropMutation.isPending}
                                className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Drop
                              </button>
                              <span className="text-gray-300">|</span>
                              <button
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Withdraw from ${enrollment.courseCode}? This will assign a W grade.`
                                    )
                                  ) {
                                    withdrawMutation.mutate({
                                      registrationId: enrollment.registrationId,
                                    });
                                  }
                                }}
                                disabled={withdrawMutation.isPending}
                                className="text-yellow-600 hover:text-yellow-900 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Withdraw
                              </button>
                            </div>
                          )}
                          {enrollment.status !== "registered" && (
                            <span className="text-gray-400 text-xs">No actions</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
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
                <p className="mt-2 text-sm font-medium">No enrollments</p>
                <p className="text-xs text-gray-400">
                  Student has no courses for the selected term
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Enrollment History by Term */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Enrollment History
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {Object.keys(enrollmentsByTerm).length > 0 ? (
              Object.entries(enrollmentsByTerm).map(([termName, termEnrollments]) => {
                // Calculate term totals
                const termCredits = termEnrollments.reduce((sum, e) => sum + parseFloat(e.creditHours), 0);
                const gradePoints: Record<string, number> = {
                  "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7,
                  "C+": 2.3, "C": 2.0, "C-": 1.7, "D+": 1.3, "D": 1.0, "D-": 0.7, "F": 0.0,
                };
                let termQP = 0;
                let termAttempted = 0;
                termEnrollments.forEach((e) => {
                  if (e.status === "completed" && e.gradeCode) {
                    const points = gradePoints[e.gradeCode];
                    if (points !== undefined) {
                      const credits = parseFloat(e.creditHours);
                      termQP += credits * points;
                      termAttempted += credits;
                    }
                  }
                });
                const termGpa = termAttempted > 0 ? termQP / termAttempted : 0;

                return (
                  <div key={termName} className="p-0">
                    {/* Term Header */}
                    <div className="px-6 py-3 bg-gray-50 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">{termName}</h3>
                      <div className="flex items-center space-x-4 text-xs text-gray-600">
                        <span>{termCredits.toFixed(1)} credits</span>
                        {termAttempted > 0 && (
                          <span className="font-medium">Term GPA: {termGpa.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                    {/* Term Courses */}
                    <table className="min-w-full">
                      <tbody className="divide-y divide-gray-100">
                        {termEnrollments.map((enrollment) => (
                          <tr key={enrollment.registrationId} className="hover:bg-gray-50">
                            <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900 w-32">
                              {enrollment.courseCode}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-900">
                              {enrollment.title}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 w-20 text-center">
                              {enrollment.creditHours}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm w-20 text-center">
                              {enrollment.gradeCode ? (
                                <span className="font-semibold text-gray-900">{enrollment.gradeCode}</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm w-28 text-right">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  enrollment.status === "registered"
                                    ? "bg-green-100 text-green-800"
                                    : enrollment.status === "completed"
                                    ? "bg-blue-100 text-blue-800"
                                    : enrollment.status === "dropped"
                                    ? "bg-red-100 text-red-800"
                                    : enrollment.status === "withdrawn"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {enrollment.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-gray-500">
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
                <p className="mt-2 text-sm font-medium">No enrollment records</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <button
                className="inline-flex items-center justify-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={() => setIsRegistrationModalOpen(true)}
              >
                <svg
                  className="h-5 w-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Register for Course
              </button>

              <button
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={() => alert("View Transcript - Feature coming soon")}
              >
                <svg
                  className="h-5 w-5 mr-2 text-gray-500"
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
                View Transcript
              </button>

              <button
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={() => alert("Edit Student - Feature coming soon")}
              >
                <svg
                  className="h-5 w-5 mr-2 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit Student
              </button>

              <button
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={() => alert("Add Note - Feature coming soon")}
              >
                <svg
                  className="h-5 w-5 mr-2 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Add Note
              </button>

              <button
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={() => alert("View Financial Aid - Feature coming soon")}
              >
                <svg
                  className="h-5 w-5 mr-2 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                View Financial Aid
              </button>

              <button
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={() => alert("Send Email - Feature coming soon")}
              >
                <svg
                  className="h-5 w-5 mr-2 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                Send Email
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Registration Modal */}
      <StudentCourseRegistrationModal
        studentId={id}
        studentName={getDisplayName()}
        isOpen={isRegistrationModalOpen}
        onClose={() => setIsRegistrationModalOpen(false)}
        onSuccess={() => {
          // Explicitly refetch schedule to ensure UI updates
          refetchSchedule();
          setMessage({ type: "success", text: `Successfully registered ${getDisplayName()} for the course!` });
          setTimeout(() => setMessage(null), 5000);
        }}
      />
    </div>
  );
}
