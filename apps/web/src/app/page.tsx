export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-4xl text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Student Information System
        </h1>
        <p className="mb-8 text-lg leading-8 text-gray-600">
          A modern, self-hostable SIS for higher education institutions.
          Built with Next.js, tRPC, Drizzle ORM, and PostgreSQL.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            title="Student Records"
            description="Manage student demographics, programs, and academic history."
            icon="👤"
          />
          <FeatureCard
            title="Registration"
            description="Course scheduling, enrollment, and waitlist management."
            icon="📚"
          />
          <FeatureCard
            title="Financial Aid"
            description="Award packaging, SAP tracking, and disbursement."
            icon="💰"
          />
          <FeatureCard
            title="Student Financials"
            description="Billing, payments, payment plans, and 1098-T reporting."
            icon="🧾"
          />
          <FeatureCard
            title="Degree Audit"
            description="Track progress toward graduation requirements."
            icon="🎓"
          />
          <FeatureCard
            title="Reporting"
            description="Institutional analytics and federal compliance reports."
            icon="📊"
          />
        </div>

        <div className="mt-12">
          <a
            href="/login"
            className="rounded-md bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            Sign In
          </a>
        </div>
      </div>
    </main>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 text-left shadow-sm">
      <div className="mb-3 text-3xl">{icon}</div>
      <h3 className="mb-2 font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}
