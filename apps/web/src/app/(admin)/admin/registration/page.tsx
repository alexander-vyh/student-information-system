"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/trpc/client";
import {
  Search,
  UserPlus,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  BookOpen,
  Trash2,
  LogOut,
} from "lucide-react";

// Types for our data
interface SelectedStudent {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  programName?: string;
}

interface ScheduleItem {
  registrationId: string;
  sectionId: string;
  status: string;
  gradeMode: string | null;
  creditHours: string;
  registeredAt: Date | null;
  course: {
    courseCode: string | null;
    title: string;
    creditHours: string;
  } | null;
  section: {
    sectionNumber: string;
    instructionalMethod: string | null;
  } | null;
}

interface SectionResult {
  id: string;
  courseCode: string;
  title: string;
  sectionNumber: string;
  crn: string | null;
  creditHours: string;
  instructionalMethod: string | null;
  maxEnrollment: number;
  currentEnrollment: number;
  availableSeats: number;
}

export default function RegistrationPage() {
  // State
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<SelectedStudent | null>(null);
  const [sectionSearchQuery, setSectionSearchQuery] = useState("");
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showDropModal, setShowDropModal] = useState<{
    registrationId: string;
    courseCode: string;
    action: "drop" | "withdraw";
  } | null>(null);
  const [dropReason, setDropReason] = useState("");

  // Queries
  const { data: terms } = trpc.enrollment.getTerms.useQuery({
    includeInactive: true,
  });

  const {
    data: studentSearchResults,
    isLoading: isSearchingStudents,
  } = trpc.student.search.useQuery(
    { query: studentSearchQuery, limit: 10 },
    { enabled: studentSearchQuery.length >= 2 }
  );

  const {
    data: studentSchedule,
    refetch: refetchSchedule,
  } = trpc.enrollment.getSchedule.useQuery(
    { studentId: selectedStudent?.id ?? "", termId: selectedTermId },
    { enabled: !!selectedStudent && !!selectedTermId }
  );

  const { data: studentHolds } = trpc.holds.getStudentHolds.useQuery(
    { studentId: selectedStudent?.id ?? "" },
    { enabled: !!selectedStudent }
  );

  const {
    data: sectionSearchResults,
    isLoading: isSearchingSections,
  } = trpc.enrollment.searchSections.useQuery(
    { termId: selectedTermId, query: sectionSearchQuery },
    { enabled: !!selectedTermId && sectionSearchQuery.length >= 2 }
  );

  // Mutations
  const overrideEnrollMutation = trpc.enrollment.overrideEnroll.useMutation({
    onSuccess: () => {
      setActionMessage({ type: "success", text: "Student enrolled successfully" });
      refetchSchedule();
      setSectionSearchQuery("");
    },
    onError: (error) => {
      setActionMessage({ type: "error", text: error.message });
    },
  });

  const adminDropMutation = trpc.enrollment.adminDrop.useMutation({
    onSuccess: () => {
      setActionMessage({ type: "success", text: "Student dropped successfully" });
      refetchSchedule();
      setShowDropModal(null);
      setDropReason("");
    },
    onError: (error) => {
      setActionMessage({ type: "error", text: error.message });
    },
  });

  const adminWithdrawMutation = trpc.enrollment.adminWithdraw.useMutation({
    onSuccess: () => {
      setActionMessage({ type: "success", text: "Student withdrawn with W grade" });
      refetchSchedule();
      setShowDropModal(null);
      setDropReason("");
    },
    onError: (error) => {
      setActionMessage({ type: "error", text: error.message });
    },
  });

  // Auto-select first term
  useEffect(() => {
    if (terms && terms.length > 0 && !selectedTermId) {
      const firstTerm = terms[0];
      if (firstTerm) {
        setSelectedTermId(firstTerm.id);
      }
    }
  }, [terms, selectedTermId]);

  // Clear action message after 5 seconds
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  // Handlers
  const handleSelectStudent = (student: {
    id: string;
    studentId: string;
    firstName: string;
    lastName: string;
    email: string;
    programName?: string;
  }) => {
    setSelectedStudent(student);
    setStudentSearchQuery("");
  };

  const handleEnrollStudent = (section: SectionResult) => {
    if (!selectedStudent) return;

    overrideEnrollMutation.mutate({
      studentId: selectedStudent.id,
      sectionId: section.id,
      overrideReason: "Registrar enrollment",
      capacityOverride: section.availableSeats <= 0,
    });
  };

  const handleDropWithdraw = () => {
    if (!showDropModal || !dropReason.trim()) return;

    if (showDropModal.action === "drop") {
      adminDropMutation.mutate({
        registrationId: showDropModal.registrationId,
        reason: dropReason,
      });
    } else {
      adminWithdrawMutation.mutate({
        registrationId: showDropModal.registrationId,
        reason: dropReason,
      });
    }
  };

  const activeHolds = studentHolds?.filter((h) => !h.resolvedAt) ?? [];
  const hasRegistrationHold = activeHolds.some((h) => h.blocksRegistration);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Student Registration</h1>
        <p className="text-gray-600">
          Register students for courses, manage enrollments, and process drops/withdrawals
        </p>
      </div>

      {/* Action Messages */}
      {actionMessage && (
        <div
          className={`flex items-center gap-2 rounded-lg p-4 ${
            actionMessage.type === "success"
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          {actionMessage.type === "success" ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Term Selector */}
      <div className="rounded-lg border bg-white p-4">
        <label className="block text-sm font-medium text-gray-700">
          Registration Term
        </label>
        <select
          value={selectedTermId}
          onChange={(e) => setSelectedTermId(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {terms?.map((term) => (
            <option key={term.id} value={term.id}>
              {term.name}
            </option>
          ))}
        </select>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column - Student Selection & Schedule */}
        <div className="space-y-6">
          {/* Student Search */}
          <div className="rounded-lg border bg-white p-4">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Select Student
            </h2>

            {selectedStudent ? (
              <div className="flex items-center justify-between rounded-lg bg-blue-50 p-4">
                <div>
                  <p className="font-medium text-blue-900">
                    {selectedStudent.firstName} {selectedStudent.lastName}
                  </p>
                  <p className="text-sm text-blue-700">
                    ID: {selectedStudent.studentId} | {selectedStudent.email}
                  </p>
                  {selectedStudent.programName && (
                    <p className="text-sm text-blue-600">
                      {selectedStudent.programName}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="rounded p-1 text-blue-600 hover:bg-blue-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, ID, or email..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />

                {/* Search Results Dropdown */}
                {studentSearchQuery.length >= 2 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg">
                    {isSearchingStudents ? (
                      <div className="p-4 text-center text-sm text-gray-500">
                        Searching...
                      </div>
                    ) : studentSearchResults?.students && studentSearchResults.students.length > 0 ? (
                      <ul className="max-h-60 overflow-auto py-1">
                        {studentSearchResults.students.map((student) => (
                          <li
                            key={student.id}
                            onClick={() =>
                              handleSelectStudent({
                                id: student.id,
                                studentId: student.studentId,
                                firstName: student.preferredFirstName ?? student.legalFirstName,
                                lastName: student.legalLastName,
                                email: student.primaryEmail,
                                programName: undefined,
                              })
                            }
                            className="cursor-pointer px-4 py-2 hover:bg-gray-100"
                          >
                            <p className="font-medium text-gray-900">
                              {student.preferredFirstName ?? student.legalFirstName} {student.legalLastName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {student.studentId} | {student.primaryEmail}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-4 text-center text-sm text-gray-500">
                        No students found
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Holds Warning */}
          {selectedStudent && activeHolds.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <div>
                  <h3 className="font-medium text-amber-800">Active Holds</h3>
                  <ul className="mt-1 space-y-1">
                    {activeHolds.map((hold) => (
                      <li key={hold.id} className="text-sm text-amber-700">
                        {hold.holdName} ({hold.holdType})
                        {hold.blocksRegistration && (
                          <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-xs">
                            Blocks Registration
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Current Schedule */}
          {selectedStudent && (
            <div className="rounded-lg border bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Current Schedule
                </h2>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                  {studentSchedule?.totalCredits ?? 0} Credits
                </span>
              </div>

              {studentSchedule?.schedule && studentSchedule.schedule.length > 0 ? (
                <div className="space-y-3">
                  {studentSchedule.schedule.map((item: ScheduleItem) => (
                    <div
                      key={item.registrationId}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {item.course?.courseCode ?? "Unknown"}
                          </span>
                          <span className="text-sm text-gray-500">
                            Section {item.section?.sectionNumber ?? "?"}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-xs ${
                              item.status === "registered"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {item.course?.title ?? "Unknown Course"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.creditHours} credits | {item.gradeMode}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            setShowDropModal({
                              registrationId: item.registrationId,
                              courseCode: item.course?.courseCode ?? "Unknown",
                              action: "drop",
                            })
                          }
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title="Drop"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            setShowDropModal({
                              registrationId: item.registrationId,
                              courseCode: item.course?.courseCode ?? "Unknown",
                              action: "withdraw",
                            })
                          }
                          className="rounded p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600"
                          title="Withdraw (W grade)"
                        >
                          <LogOut className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-gray-500">
                  No registrations for this term
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Section Search & Enrollment */}
        <div className="space-y-6">
          <div className="rounded-lg border bg-white p-4">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Add Course
            </h2>

            {!selectedStudent ? (
              <p className="text-center text-sm text-gray-500">
                Select a student first to add courses
              </p>
            ) : (
              <>
                {/* Section Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search courses (e.g., CS 101, Introduction...)"
                    value={sectionSearchQuery}
                    onChange={(e) => setSectionSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Section Results */}
                {sectionSearchQuery.length >= 2 && (
                  <div className="space-y-3">
                    {isSearchingSections ? (
                      <p className="text-center text-sm text-gray-500">
                        Searching sections...
                      </p>
                    ) : sectionSearchResults && sectionSearchResults.length > 0 ? (
                      sectionSearchResults.map((section: SectionResult) => {
                        const isEnrolled = studentSchedule?.schedule?.some(
                          (s: ScheduleItem) => s.sectionId === section.id
                        );
                        const isFull = section.availableSeats <= 0;

                        return (
                          <div
                            key={section.id}
                            className="flex items-center justify-between rounded-lg border p-3"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  {section.courseCode}
                                </span>
                                <span className="text-sm text-gray-500">
                                  Section {section.sectionNumber}
                                </span>
                                {section.crn && (
                                  <span className="text-xs text-gray-400">
                                    CRN: {section.crn}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">
                                {section.title}
                              </p>
                              <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <BookOpen className="h-3 w-3" />
                                  {section.creditHours} credits
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {section.currentEnrollment}/{section.maxEnrollment}
                                </span>
                                {isFull && (
                                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-600">
                                    Full
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleEnrollStudent(section)}
                              disabled={
                                isEnrolled ||
                                overrideEnrollMutation.isPending ||
                                hasRegistrationHold
                              }
                              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium ${
                                isEnrolled
                                  ? "cursor-not-allowed bg-gray-100 text-gray-400"
                                  : hasRegistrationHold
                                  ? "cursor-not-allowed bg-amber-100 text-amber-600"
                                  : isFull
                                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                  : "bg-blue-600 text-white hover:bg-blue-700"
                              }`}
                            >
                              {isEnrolled ? (
                                <>
                                  <CheckCircle className="h-4 w-4" />
                                  Enrolled
                                </>
                              ) : hasRegistrationHold ? (
                                <>
                                  <AlertCircle className="h-4 w-4" />
                                  Hold
                                </>
                              ) : (
                                <>
                                  <UserPlus className="h-4 w-4" />
                                  {isFull ? "Override Add" : "Add"}
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-center text-sm text-gray-500">
                        No sections found
                      </p>
                    )}
                  </div>
                )}

                {!sectionSearchQuery && (
                  <p className="text-center text-sm text-gray-500">
                    Search for a course to add to the student&apos;s schedule
                  </p>
                )}
              </>
            )}
          </div>

          {/* Quick Stats */}
          {selectedStudent && studentSchedule && (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border bg-white p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {studentSchedule.schedule?.filter(
                    (s: ScheduleItem) => s.status === "registered"
                  ).length ?? 0}
                </p>
                <p className="text-sm text-gray-600">Registered Courses</p>
              </div>
              <div className="rounded-lg border bg-white p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {studentSchedule.totalCredits}
                </p>
                <p className="text-sm text-gray-600">Total Credits</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drop/Withdraw Modal */}
      {showDropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {showDropModal.action === "drop" ? "Drop" : "Withdraw"} from{" "}
              {showDropModal.courseCode}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {showDropModal.action === "drop"
                ? "This will remove the student from the course with no grade recorded."
                : "This will withdraw the student with a W grade on their transcript."}
            </p>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Reason *
              </label>
              <textarea
                value={dropReason}
                onChange={(e) => setDropReason(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter reason for this action..."
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDropModal(null);
                  setDropReason("");
                }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDropWithdraw}
                disabled={
                  !dropReason.trim() ||
                  adminDropMutation.isPending ||
                  adminWithdrawMutation.isPending
                }
                className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                  showDropModal.action === "drop"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-amber-600 hover:bg-amber-700"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {adminDropMutation.isPending || adminWithdrawMutation.isPending
                  ? "Processing..."
                  : showDropModal.action === "drop"
                  ? "Drop Student"
                  : "Withdraw Student"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
