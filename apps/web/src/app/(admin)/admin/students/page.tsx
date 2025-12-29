"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { useRouter } from "next/navigation";

export default function StudentSearchPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search to avoid excessive API calls
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    // Simple debounce implementation
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  // Only search when we have at least 2 characters
  const { data, isLoading, error } = trpc.student.search.useQuery(
    {
      query: debouncedQuery,
      limit: 50,
      offset: 0,
    },
    {
      enabled: debouncedQuery.length >= 2,
    }
  );

  const handleRowClick = (studentId: string) => {
    router.push(`/admin/students/${studentId}`);
  };

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

  const getDisplayName = (student: any) => {
    const firstName = student.preferredFirstName || student.legalFirstName;
    const lastName = student.preferredLastName || student.legalLastName;
    return `${firstName} ${lastName}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Student Search
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow">
          {/* Search Input */}
          <div className="p-6 border-b border-gray-200">
            <div className="max-w-md">
              <label
                htmlFor="search"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Search Students
              </label>
              <input
                type="text"
                id="search"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Search by name, ID, or email..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                autoComplete="off"
              />
              <p className="mt-1 text-sm text-gray-500">
                Enter at least 2 characters to search
              </p>
            </div>
          </div>

          {/* Results */}
          <div className="overflow-x-auto">
            {/* Loading State */}
            {isLoading && debouncedQuery.length >= 2 && (
              <div className="p-6 text-center text-gray-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <p className="mt-2">Searching...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-6 text-center text-red-600">
                <p>Error: {error.message}</p>
              </div>
            )}

            {/* Empty State - No Query */}
            {!isLoading && debouncedQuery.length < 2 && (
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
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Search for students
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Start typing to search by name, student ID, or email address
                </p>
              </div>
            )}

            {/* Empty State - No Results */}
            {!isLoading &&
              debouncedQuery.length >= 2 &&
              data?.students.length === 0 && (
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
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No students found
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Try adjusting your search query
                  </p>
                </div>
              )}

            {/* Results Table */}
            {!isLoading && data && data.students.length > 0 && (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Student ID
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Name
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Email
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
                  {data.students.map((student) => (
                    <tr
                      key={student.id}
                      onClick={() => handleRowClick(student.id)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.studentId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getDisplayName(student)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.primaryEmail}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(
                            student.status
                          )}`}
                        >
                          {student.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Results Count */}
            {!isLoading && data && data.students.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{data.students.length}</span>{" "}
                  of <span className="font-medium">{data.total}</span> results
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
