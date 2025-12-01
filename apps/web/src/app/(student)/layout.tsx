"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import { StudentSidebar } from "@/components/student/sidebar";
import { LogOut, User } from "lucide-react";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  // Fetch current user's student profile
  const { data: student, isLoading, error } = trpc.student.me.useQuery();

  useEffect(() => {
    // If there's an error (likely UNAUTHORIZED), redirect to login
    if (error?.data?.code === "UNAUTHORIZED") {
      router.push("/login");
    }
  }, [error, router]);

  useEffect(() => {
    // If loaded and no student data, user doesn't have STUDENT role
    if (!isLoading && !error && !student) {
      router.push("/unauthorized");
    }
  }, [student, isLoading, error, router]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if there's an error or no student data
  if (error || !student) {
    return null;
  }

  // Get student name for display
  const studentName = student.preferredFirstName && student.preferredLastName
    ? `${student.preferredFirstName} ${student.preferredLastName}`
    : `${student.legalFirstName} ${student.legalLastName}`;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Sidebar */}
      <StudentSidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white">
          <div className="flex h-16 items-center justify-between px-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Student Portal
              </h2>
            </div>

            {/* User info and actions */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-gray-700">{studentName}</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-500">
                  ID: {student.studentId}
                </span>
              </div>

              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
