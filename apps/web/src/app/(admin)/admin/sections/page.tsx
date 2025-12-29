"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";

export default function SectionsPage() {
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  // Fetch terms
  const { data: terms } = trpc.enrollment.getTerms.useQuery({
    includeInactive: true,
  });

  // Set default term when data loads
  const firstTerm = terms?.[0];
  if (!selectedTermId && firstTerm) {
    setSelectedTermId(firstTerm.id);
  }

  // Fetch sections for selected term
  const { data: sectionsData, isLoading: sectionsLoading } = trpc.enrollment.searchSections.useQuery(
    {
      termId: selectedTermId,
      query: searchQuery.trim() || ".", // Require at least something to search
      limit: 50,
    },
    {
      enabled: !!selectedTermId && searchQuery.length >= 1,
    }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sections & Grade Entry</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage section rosters and enter grades
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="term-select" className="block text-sm font-medium text-gray-700 mb-2">
              Term
            </label>
            <select
              id="term-select"
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a term...</option>
              {terms?.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Sections
            </label>
            <input
              type="text"
              id="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by course code, title..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Sections List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {!selectedTermId && (
          <div className="p-12 text-center text-gray-500">
            <p>Please select a term to view sections</p>
          </div>
        )}

        {selectedTermId && searchQuery.length < 1 && (
          <div className="p-12 text-center text-gray-500">
            <p>Enter a search query to find sections</p>
          </div>
        )}

        {sectionsLoading && (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-500">Loading sections...</p>
          </div>
        )}

        {!sectionsLoading && sectionsData && sectionsData.length === 0 && searchQuery.length >= 1 && (
          <div className="p-12 text-center text-gray-500">
            <p>No sections found matching "{searchQuery}"</p>
          </div>
        )}

        {!sectionsLoading && sectionsData && sectionsData.length > 0 && (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Course
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Section
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Credits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Enrollment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sectionsData.map((section) => (
                <tr key={section.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{section.courseCode}</div>
                    <div className="text-sm text-gray-500">{section.title}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {section.sectionNumber}
                    {section.crn && (
                      <span className="ml-2 text-xs text-gray-400">CRN: {section.crn}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {section.creditHours}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {section.currentEnrollment}/{section.maxEnrollment}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        section.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {section.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => setSelectedSectionId(section.id)}
                      className="text-blue-600 hover:text-blue-900 font-medium"
                    >
                      Grade Entry
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Grade Entry Modal */}
      {selectedSectionId && (
        <GradeEntryModal
          sectionId={selectedSectionId}
          onClose={() => setSelectedSectionId(null)}
        />
      )}
    </div>
  );
}

// Grade Entry Modal Component
function GradeEntryModal({
  sectionId,
  onClose,
}: {
  sectionId: string;
  onClose: () => void;
}) {
  const [gradeEntries, setGradeEntries] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch roster and grades
  const { data: rosterData, isLoading, refetch } = trpc.enrollment.getSectionGradeRoster.useQuery({
    sectionId,
  });

  // Fetch available grades
  const { data: gradesData } = trpc.enrollment.getGrades.useQuery();

  // Submit grades mutation
  const submitGrades = trpc.enrollment.submitBatchGrades.useMutation({
    onSuccess: (result) => {
      setMessage({ type: "success", text: result.message });
      setGradeEntries({});
      refetch();
    },
    onError: (error) => {
      setMessage({ type: "error", text: error.message });
    },
  });

  const handleGradeChange = (registrationId: string, gradeCode: string) => {
    setGradeEntries((prev) => ({
      ...prev,
      [registrationId]: gradeCode,
    }));
  };

  const handleSubmit = () => {
    const gradesToSubmit = Object.entries(gradeEntries)
      .filter(([_, grade]) => grade !== "")
      .map(([registrationId, gradeCode]) => ({
        registrationId,
        gradeCode,
      }));

    if (gradesToSubmit.length === 0) {
      setMessage({ type: "error", text: "No grades to submit" });
      return;
    }

    submitGrades.mutate({
      sectionId,
      grades: gradesToSubmit,
    });
  };

  const pendingGradesCount = Object.values(gradeEntries).filter((g) => g !== "").length;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Grade Entry
              </h2>
              {rosterData?.section && (
                <p className="text-sm text-gray-600">
                  {rosterData.section.courseCode} - {rosterData.section.title} (Section{" "}
                  {rosterData.section.sectionNumber})
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mx-6 mt-4 px-4 py-3 rounded-md text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Stats */}
        {rosterData?.stats && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center space-x-6 text-sm">
              <span>
                <span className="font-medium">{rosterData.stats.total}</span> students
              </span>
              <span>
                <span className="font-medium text-green-600">{rosterData.stats.graded}</span> graded
              </span>
              <span>
                <span className="font-medium text-orange-600">{rosterData.stats.ungraded}</span> ungraded
              </span>
              {pendingGradesCount > 0 && (
                <span className="text-blue-600 font-medium">
                  {pendingGradesCount} pending submission
                </span>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-gray-500">Loading roster...</p>
            </div>
          )}

          {!isLoading && rosterData && rosterData.roster.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              <p>No students enrolled in this section</p>
            </div>
          )}

          {!isLoading && rosterData && rosterData.roster.length > 0 && (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Grade Mode
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Grade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    New Grade
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rosterData.roster.map((student) => (
                  <tr key={student.registrationId} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {student.lastName}, {student.firstName}
                      </div>
                      <div className="text-xs text-gray-500">{student.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {student.studentIdNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.gradeMode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {student.gradeCode ? (
                        <span className="px-2 py-1 text-sm font-semibold bg-green-100 text-green-800 rounded">
                          {student.gradeCode}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {student.status === "registered" ? (
                        <select
                          value={gradeEntries[student.registrationId] || ""}
                          onChange={(e) => handleGradeChange(student.registrationId, e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">—</option>
                          {gradesData?.grades.map((grade) => (
                            <option key={grade.id} value={grade.code}>
                              {grade.code} {grade.points ? `(${grade.points})` : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {student.status === "completed" ? "Graded" : student.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
          <div className="text-sm text-gray-500">
            {gradesData?.scaleName && `Using grade scale: ${gradesData.scaleName}`}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
            <button
              onClick={handleSubmit}
              disabled={pendingGradesCount === 0 || submitGrades.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {submitGrades.isPending
                ? "Submitting..."
                : `Submit ${pendingGradesCount} Grade${pendingGradesCount !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
