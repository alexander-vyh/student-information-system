"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/trpc/client";

interface StudentCourseRegistrationModalProps {
  studentId: string;
  studentName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function StudentCourseRegistrationModal({
  studentId,
  studentName,
  isOpen,
  onClose,
  onSuccess,
}: StudentCourseRegistrationModalProps) {
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [gradeMode, setGradeMode] = useState<"standard" | "pass_fail" | "audit">("standard");

  const utils = trpc.useUtils();

  // Fetch available terms
  const { data: terms, isLoading: termsLoading } = trpc.enrollment.getTerms.useQuery({
    includeInactive: false,
  });

  // Set default term when loaded
  useEffect(() => {
    if (terms && terms.length > 0 && !selectedTermId) {
      setSelectedTermId(terms[0].id);
    }
  }, [terms, selectedTermId]);

  // Search sections
  const { data: sections, isLoading: sectionsLoading } = trpc.enrollment.searchAvailableSections.useQuery(
    {
      termId: selectedTermId,
      query: searchQuery || undefined,
      availableOnly: true,
      limit: 20,
    },
    {
      enabled: !!selectedTermId && searchQuery.length >= 2,
    }
  );

  // Check eligibility for selected section
  const { data: eligibility, isLoading: eligibilityLoading } = trpc.enrollment.checkEligibility.useQuery(
    {
      studentId,
      sectionId: selectedSectionId!,
    },
    {
      enabled: !!selectedSectionId,
    }
  );

  // Enroll mutation
  const enrollMutation = trpc.enrollment.enroll.useMutation({
    onSuccess: () => {
      // Invalidate all enrollment queries for this student
      utils.enrollment.getHistory.invalidate({ studentId });
      utils.enrollment.getSchedule.invalidate(); // Clear ALL schedule queries
      onSuccess();
      handleClose();
    },
    onError: (error) => {
      alert(`Registration failed: ${error.message}`);
    },
  });

  // Override enroll mutation (for admin)
  const overrideEnrollMutation = trpc.enrollment.overrideEnroll.useMutation({
    onSuccess: () => {
      // Invalidate all enrollment queries for this student
      utils.enrollment.getHistory.invalidate({ studentId });
      utils.enrollment.getSchedule.invalidate(); // Clear ALL schedule queries
      onSuccess();
      handleClose();
    },
    onError: (error) => {
      alert(`Override registration failed: ${error.message}`);
    },
  });

  const handleEnroll = () => {
    if (!selectedSectionId) return;

    enrollMutation.mutate({
      studentId,
      sectionId: selectedSectionId,
      gradeMode,
    });
  };

  const handleOverrideEnroll = () => {
    if (!selectedSectionId) return;

    const reason = prompt("Enter override reason:");
    if (!reason) return;

    overrideEnrollMutation.mutate({
      studentId,
      sectionId: selectedSectionId,
      gradeMode,
      overrideReason: reason,
      prerequisiteOverride: true,
      capacityOverride: true,
    });
  };

  const handleClose = () => {
    setSearchQuery("");
    setSelectedSectionId(null);
    setGradeMode("standard");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b">
          <h3 className="text-xl font-semibold text-gray-900">
            Register Course for {studentName}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="mt-4 space-y-4">
          {/* Term Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Term
            </label>
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              disabled={termsLoading}
            >
              <option value="">Select a term...</option>
              {terms?.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name} ({term.code})
                </option>
              ))}
            </select>
          </div>

          {/* Course Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Course
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter course code or title (e.g., MATH 101)..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              disabled={!selectedTermId}
            />
            {!selectedTermId && (
              <p className="text-xs text-gray-500 mt-1">Select a term first</p>
            )}
          </div>

          {/* Search Results */}
          {searchQuery.length >= 2 && selectedTermId && (
            <div className="border rounded-md max-h-64 overflow-y-auto">
              {sectionsLoading ? (
                <div className="p-4 text-center text-gray-500">Searching...</div>
              ) : sections && sections.length > 0 ? (
                <div className="divide-y">
                  {sections.map((section) => (
                    <div
                      key={section.id}
                      className={`p-3 hover:bg-gray-50 cursor-pointer ${
                        selectedSectionId === section.id ? "bg-blue-50" : ""
                      }`}
                      onClick={() => setSelectedSectionId(section.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {section.courseCode} - {section.sectionNumber}
                          </p>
                          <p className="text-xs text-gray-600">{section.title}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            CRN: {section.crn} | {section.creditHours} credits |{" "}
                            {section.instructionalMethod}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded ${
                              section.status === "open"
                                ? "bg-green-100 text-green-800"
                                : section.status === "waitlist"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {section.availableSeats} / {section.maxEnrollment} seats
                          </span>
                          {section.hasWaitlist && (
                            <p className="text-xs text-gray-500 mt-1">
                              Waitlist: {section.waitlistAvailable} available
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchQuery.length >= 2 ? (
                <div className="p-4 text-center text-gray-500">
                  No sections found matching "{searchQuery}"
                </div>
              ) : null}
            </div>
          )}

          {/* Selected Section Details */}
          {selectedSectionId && eligibility && (
            <div className="border rounded-md p-4 bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">
                Registration Eligibility
              </h4>

              {!eligibility.eligible && eligibility.reasons.length > 0 && (
                <div className="mb-3 space-y-1">
                  {eligibility.reasons.map((reason, idx) => (
                    <div key={idx} className="flex items-start text-sm text-red-600">
                      <svg
                        className="h-5 w-5 mr-1 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {reason}
                    </div>
                  ))}
                </div>
              )}

              {eligibility.eligible && (
                <div className="flex items-center text-sm text-green-600 mb-3">
                  <svg className="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Student is eligible to register
                </div>
              )}

              {/* Grade Mode Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grade Mode
                </label>
                <select
                  value={gradeMode}
                  onChange={(e) => setGradeMode(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="standard">Standard (Letter Grade)</option>
                  <option value="pass_fail">Pass/Fail</option>
                  <option value="audit">Audit</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end space-x-3 pt-4 border-t">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>

          {selectedSectionId && eligibility && !eligibility.eligible && (
            <button
              onClick={handleOverrideEnroll}
              disabled={overrideEnrollMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {overrideEnrollMutation.isPending ? "Registering..." : "Override & Register"}
            </button>
          )}

          <button
            onClick={handleEnroll}
            disabled={
              !selectedSectionId ||
              !eligibility?.eligible ||
              enrollMutation.isPending
            }
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enrollMutation.isPending ? "Registering..." : "Register"}
          </button>
        </div>
      </div>
    </div>
  );
}
