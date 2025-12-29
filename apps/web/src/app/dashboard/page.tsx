import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Dashboard
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Welcome, {session.user.name}!</h2>
          <div className="space-y-2 text-gray-600">
            <p><strong>Email:</strong> {session.user.email}</p>
            <p><strong>Roles:</strong> {session.user.roles?.join(", ") || "None"}</p>
            <p><strong>Institution ID:</strong> {session.user.institutionId}</p>
          </div>
          <div className="mt-6">
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
