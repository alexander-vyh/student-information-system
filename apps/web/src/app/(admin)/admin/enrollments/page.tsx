"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";

export default function TermEnrollmentDashboard() {
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  // Fetch terms
  const { data: termsData, isLoading: termsLoading } = trpc.admin.getTerms.useQuery({
    includeInactive: false,
    limit: 50,
  });

  // Fetch current term to set as default
  const { data: currentTerm } = trpc.admin.getCurrentTerm.useQuery();

  // Set default term when data loads
  if (!selectedTermId && currentTerm?.id) {
    setSelectedTermId(currentTerm.id);
  }

  // Fetch sections for selected term
  const { data: sectionsData, isLoading: sectionsLoading } = trpc.admin.getSections.useQuery(
    {
      termId: selectedTermId,
      searchQuery: searchQuery.trim(),
    },
    {
      enabled: !!selectedTermId,
    }
  );

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "closed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const getCapacityColor = (enrolled: number, max: number) => {
    const percentage = max > 0 ? (enrolled / max) * 100 : 0;
    if (percentage >= 100) return "text-red-600 font-semibold";
    if (percentage >= 90) return "text-orange-600 font-semibold";
    if (percentage >= 75) return "text-yellow-600";
    return "text-gray-900";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Term Enrollment Dashboard
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage enrollments and view section capacity across the institution
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Term Selector */}
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <label htmlFor="term-select" className="block text-sm font-medium text-gray-700 mb-2">
            Select Term
          </label>
          <select
            id="term-select"
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            disabled={termsLoading}
          >
            <option value="">Select a term...</option>
            {termsData?.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name} {term.isCurrent ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Stats Cards */}
        {selectedTermId && sectionsData && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Total Enrolled</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {sectionsData.stats.totalEnrolled.toLocaleString()}
                  </p>
                </div>
                <div className="ml-4">
                  <svg
                    className="h-12 w-12 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Total Sections</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {sectionsData.stats.totalSections}
                  </p>
                </div>
                <div className="ml-4">
                  <svg
                    className="h-12 w-12 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Sections with Waitlist</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {sectionsData.stats.sectionsWithWaitlist}
                  </p>
                </div>
                <div className="ml-4">
                  <svg
                    className="h-12 w-12 text-orange-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Capacity Utilization</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {sectionsData.stats.capacityUtilization}%
                  </p>
                </div>
                <div className="ml-4">
                  <svg
                    className="h-12 w-12 text-purple-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sections Table */}
        <div className="bg-white rounded-lg shadow">
          {/* Search Bar */}
          <div className="p-6 border-b border-gray-200">
            <div className="max-w-md">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search Sections
              </label>
              <input
                type="text"
                id="search"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Search by course code, title, or CRN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={!selectedTermId}
              />
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            {/* No term selected */}
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
                <h3 className="mt-2 text-sm font-medium text-gray-900">No term selected</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Please select a term to view enrollment data
                </p>
              </div>
            )}

            {/* Loading state */}
            {sectionsLoading && selectedTermId && (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <p className="mt-2 text-gray-500">Loading sections...</p>
              </div>
            )}

            {/* Empty state */}
            {!sectionsLoading &&
              selectedTermId &&
              sectionsData &&
              sectionsData.sections.length === 0 && (
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
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No sections found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchQuery
                      ? "Try adjusting your search query"
                      : "No sections available for this term"}
                  </p>
                </div>
              )}

            {/* Sections table */}
            {!sectionsLoading &&
              selectedTermId &&
              sectionsData &&
              sectionsData.sections.length > 0 && (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Course Code
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
                        Enrolled/Max
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Waitlist
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Instructor
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sectionsData.sections.map((section) => (
                      <tr
                        key={section.id}
                        onClick={() => setSelectedSection(section.id)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {section.courseCode}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {section.courseTitle}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {section.sectionNumber}
                          {section.crn && (
                            <span className="ml-2 text-xs text-gray-400">
                              CRN: {section.crn}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className={getCapacityColor(
                              section.enrolled,
                              section.maxEnrollment
                            )}
                          >
                            {section.enrolled}/{section.maxEnrollment}
                          </span>
                          <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                section.enrolled >= section.maxEnrollment
                                  ? "bg-red-600"
                                  : section.enrolled >= section.maxEnrollment * 0.9
                                  ? "bg-orange-500"
                                  : "bg-green-500"
                              }`}
                              style={{
                                width: `${Math.min(
                                  (section.enrolled / section.maxEnrollment) * 100,
                                  100
                                )}%`,
                              }}
                            ></div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {section.waitlist > 0 ? (
                            <span className="text-orange-600 font-medium">
                              {section.waitlist}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {section.instructor}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(
                              section.status
                            )}`}
                          >
                            {section.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

            {/* Results count */}
            {!sectionsLoading &&
              selectedTermId &&
              sectionsData &&
              sectionsData.sections.length > 0 && (
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{sectionsData.sections.length}</span>{" "}
                    section{sectionsData.sections.length !== 1 ? "s" : ""}
                  </p>
                </div>
              )}
          </div>
        </div>

        {/* Section Detail Modal - Placeholder */}
        {selectedSection && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Section Details</h3>
                <button
                  onClick={() => setSelectedSection(null)}
                  className="text-gray-400 hover:text-gray-500"
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
              <p className="text-gray-500">
                Section detail view coming soon...
                <br />
                Section ID: {selectedSection}
              </p>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedSection(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
