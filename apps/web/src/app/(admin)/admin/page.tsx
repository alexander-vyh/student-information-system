import { auth } from "@/lib/auth";
import { Users, BookOpen, AlertCircle, TrendingUp } from "lucide-react";

// Placeholder data - will be replaced with real data from tRPC
const stats = {
  totalStudents: 1248,
  currentTermEnrollment: 892,
  activeHolds: 23,
  courseSections: 156,
};

export default async function AdminDashboard() {
  const session = await auth();

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {session?.user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Here's what's happening with your institution today.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Students */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats.totalStudents.toLocaleString()}
              </p>
            </div>
            <div className="rounded-full bg-blue-100 p-3">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="mr-1 h-4 w-4 text-green-500" />
            <span className="text-green-600">4.5%</span>
            <span className="ml-1 text-gray-600">from last term</span>
          </div>
        </div>

        {/* Current Term Enrollment */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Current Term Enrollment
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats.currentTermEnrollment.toLocaleString()}
              </p>
            </div>
            <div className="rounded-full bg-green-100 p-3">
              <BookOpen className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-600">
              {Math.round((stats.currentTermEnrollment / stats.totalStudents) * 100)}%
              enrollment rate
            </span>
          </div>
        </div>

        {/* Active Holds */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Holds</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats.activeHolds}
              </p>
            </div>
            <div className="rounded-full bg-red-100 p-3">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-600">Requiring attention</span>
          </div>
        </div>

        {/* Course Sections */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Course Sections</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats.courseSections}
              </p>
            </div>
            <div className="rounded-full bg-purple-100 p-3">
              <BookOpen className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-600">Active this term</span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button className="rounded-md border border-gray-300 bg-white px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50">
            Add New Student
          </button>
          <button className="rounded-md border border-gray-300 bg-white px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50">
            Process Enrollment
          </button>
          <button className="rounded-md border border-gray-300 bg-white px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50">
            Generate Report
          </button>
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <p className="text-sm font-medium text-gray-900">
                New student registration
              </p>
              <p className="text-xs text-gray-600">Sarah Johnson - CS Major</p>
            </div>
            <span className="text-xs text-gray-500">2 hours ago</span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Enrollment processed
              </p>
              <p className="text-xs text-gray-600">
                24 students enrolled in CSCI-301
              </p>
            </div>
            <span className="text-xs text-gray-500">5 hours ago</span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Hold resolved</p>
              <p className="text-xs text-gray-600">
                Financial hold cleared for Michael Chen
              </p>
            </div>
            <span className="text-xs text-gray-500">1 day ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}
