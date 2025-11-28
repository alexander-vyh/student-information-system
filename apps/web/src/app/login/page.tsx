/**
 * Login Page
 *
 * Simple login form for credential authentication.
 */

import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { LoginForm } from "./form";

export const metadata = {
  title: "Sign In - Student Information System",
  description: "Sign in to access your student portal",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  // Await searchParams (Next.js 15 async pattern)
  const params = await searchParams;

  // Redirect if already logged in
  const session = await auth();
  if (session) {
    redirect(params.callbackUrl ?? "/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold text-gray-900">
            Student Information System
          </h1>
          <h2 className="mt-6 text-center text-2xl font-semibold text-gray-900">
            Sign in to your account
          </h2>
        </div>

        {params.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {params.error === "CredentialsSignin"
              ? "Invalid email or password"
              : "An error occurred during sign in"}
          </div>
        )}

        <LoginForm callbackUrl={params.callbackUrl} />
      </div>
    </div>
  );
}
