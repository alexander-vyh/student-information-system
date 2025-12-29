"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Clock,
  Plus,
  Search,
  Shield,
  User,
  Users,
  XCircle,
} from "lucide-react";

type TabType = "dashboard" | "policies" | "student-lookup" | "appeals";

const standingColors: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
  good_standing: { bg: "bg-green-100", text: "text-green-800", icon: CheckCircle },
  academic_warning: { bg: "bg-yellow-100", text: "text-yellow-800", icon: AlertTriangle },
  academic_probation: { bg: "bg-orange-100", text: "text-orange-800", icon: AlertCircle },
  academic_suspension: { bg: "bg-red-100", text: "text-red-800", icon: XCircle },
  academic_dismissal: { bg: "bg-red-200", text: "text-red-900", icon: XCircle },
  reinstated: { bg: "bg-blue-100", text: "text-blue-800", icon: CheckCircle },
};

function getStandingStyle(standing: string) {
  return standingColors[standing] || { bg: "bg-gray-100", text: "text-gray-800", icon: Clock };
}

function getStandingLabel(standing: string) {
  const labels: Record<string, string> = {
    good_standing: "Good Standing",
    academic_warning: "Academic Warning",
    academic_probation: "Academic Probation",
    academic_suspension: "Academic Suspension",
    academic_dismissal: "Academic Dismissal",
    reinstated: "Reinstated",
  };
  return labels[standing] || standing;
}

// =============================================================================
// Dashboard Panel
// =============================================================================

function DashboardPanel() {
  const { data: stats, isLoading } = trpc.academicStanding.getStandingStats.useQuery({});
  const { data: atRiskStudents } = trpc.academicStanding.getAtRiskStudents.useQuery({});

  if (isLoading) {
    return <div className="p-4 text-gray-500">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-sm text-gray-500">Total Evaluated</div>
          <div className="text-2xl font-bold">{stats?.totalEvaluated || 0}</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-sm text-gray-500">Standing Changes</div>
          <div className="text-2xl font-bold text-orange-600">{stats?.standingChanges || 0}</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-sm text-gray-500">Pending Appeals</div>
          <div className="text-2xl font-bold text-blue-600">{stats?.pendingAppeals || 0}</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-sm text-gray-500">On Probation</div>
          <div className="text-2xl font-bold text-red-600">
            {stats?.standingCounts?.["academic_probation"] || 0}
          </div>
        </div>
      </div>

      {/* Standing Distribution */}
      <div className="rounded-lg bg-white p-4 shadow">
        <h3 className="mb-4 font-semibold">Standing Distribution</h3>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          {Object.entries(stats?.standingCounts || {}).map(([standing, count]) => {
            const style = getStandingStyle(standing);
            return (
              <div
                key={standing}
                className={`rounded p-3 ${style.bg}`}
              >
                <div className={`text-xs ${style.text}`}>{getStandingLabel(standing)}</div>
                <div className={`text-xl font-bold ${style.text}`}>{count as number}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* At-Risk Students */}
      <div className="rounded-lg bg-white p-4 shadow">
        <h3 className="mb-4 font-semibold">
          <AlertTriangle className="mr-2 inline h-5 w-5 text-orange-500" />
          At-Risk Students (Probation)
        </h3>
        {atRiskStudents && atRiskStudents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Student
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    ID
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Cum GPA
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Probation Terms
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Terms Remaining
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {atRiskStudents.map((student) => (
                  <tr key={student.studentId}>
                    <td className="whitespace-nowrap px-4 py-2 text-sm">
                      {student.studentName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                      {student.studentIdNumber}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm">
                      {student.cumulativeGpa ? parseFloat(student.cumulativeGpa).toFixed(3) : "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm">
                      {student.consecutiveProbationTerms} / {student.maxTermsAllowed}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm">
                      <span
                        className={`font-medium ${
                          student.termsRemaining === 0
                            ? "text-red-600"
                            : student.termsRemaining === 1
                            ? "text-orange-600"
                            : "text-gray-600"
                        }`}
                      >
                        {student.termsRemaining}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No students currently at risk.</p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Policy Panel
// =============================================================================

function PolicyPanel() {
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<{
    id?: string;
    name: string;
    code: string;
    description: string;
    goodStandingMinGpa: number;
    warningMinGpa?: number;
    probationMinGpa?: number;
    probationMaxTerms: number;
    suspensionDurationTerms: number;
    maxSuspensions: number;
    isActive: boolean;
  } | null>(null);

  const utils = trpc.useUtils();
  const { data: policies, isLoading } = trpc.academicStanding.getPolicies.useQuery({
    activeOnly: false,
  });

  const createPolicy = trpc.academicStanding.createPolicy.useMutation({
    onSuccess: () => {
      utils.academicStanding.getPolicies.invalidate();
      setShowModal(false);
      setEditingPolicy(null);
    },
  });

  const updatePolicy = trpc.academicStanding.updatePolicy.useMutation({
    onSuccess: () => {
      utils.academicStanding.getPolicies.invalidate();
      setShowModal(false);
      setEditingPolicy(null);
    },
  });

  const handleSubmit = () => {
    if (!editingPolicy) return;

    if (editingPolicy.id) {
      const { id, ...updates } = editingPolicy;
      updatePolicy.mutate({
        policyId: id,
        updates,
      });
    } else {
      createPolicy.mutate(editingPolicy);
    }
  };

  if (isLoading) {
    return <div className="p-4 text-gray-500">Loading policies...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Academic Standing Policies</h3>
        <button
          onClick={() => {
            setEditingPolicy({
              name: "",
              code: "",
              description: "",
              goodStandingMinGpa: 2.0,
              probationMaxTerms: 2,
              suspensionDurationTerms: 1,
              maxSuspensions: 2,
              isActive: true,
            });
            setShowModal(true);
          }}
          className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Policy
        </button>
      </div>

      {policies && policies.length > 0 ? (
        <div className="rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Policy
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Min GPA
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Max Probation
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {policies.map((policy) => (
                <tr key={policy.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{policy.name}</div>
                    {policy.description && (
                      <div className="text-xs text-gray-500">{policy.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{policy.code}</td>
                  <td className="px-4 py-3 text-sm">{policy.goodStandingMinGpa}</td>
                  <td className="px-4 py-3 text-sm">{policy.probationMaxTerms} terms</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        policy.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {policy.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setEditingPolicy({
                          id: policy.id,
                          name: policy.name,
                          code: policy.code,
                          description: policy.description || "",
                          goodStandingMinGpa: parseFloat(policy.goodStandingMinGpa),
                          warningMinGpa: policy.warningMinGpa
                            ? parseFloat(policy.warningMinGpa)
                            : undefined,
                          probationMinGpa: policy.probationMinGpa
                            ? parseFloat(policy.probationMinGpa)
                            : undefined,
                          probationMaxTerms: policy.probationMaxTerms ?? 2,
                          suspensionDurationTerms: policy.suspensionDurationTerms ?? 1,
                          maxSuspensions: policy.maxSuspensions ?? 2,
                          isActive: policy.isActive,
                        });
                        setShowModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg bg-gray-50 p-8 text-center">
          <Shield className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-gray-500">No policies defined yet.</p>
          <p className="text-sm text-gray-400">Create a policy to define academic standing rules.</p>
        </div>
      )}

      {/* Policy Modal */}
      {showModal && editingPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">
              {editingPolicy.id ? "Edit Policy" : "Create Policy"}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={editingPolicy.name}
                    onChange={(e) =>
                      setEditingPolicy({ ...editingPolicy, name: e.target.value })
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                    placeholder="Standard Undergraduate"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Code</label>
                  <input
                    type="text"
                    value={editingPolicy.code}
                    onChange={(e) =>
                      setEditingPolicy({ ...editingPolicy, code: e.target.value })
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                    placeholder="UNDERGRAD"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={editingPolicy.description}
                  onChange={(e) =>
                    setEditingPolicy({ ...editingPolicy, description: e.target.value })
                  }
                  rows={2}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Min GPA (Good Standing)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max="4"
                    value={editingPolicy.goodStandingMinGpa}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        goodStandingMinGpa: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Warning Min GPA
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max="4"
                    value={editingPolicy.warningMinGpa || ""}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        warningMinGpa: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Probation Min GPA
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max="4"
                    value={editingPolicy.probationMinGpa || ""}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        probationMinGpa: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Max Probation Terms
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editingPolicy.probationMaxTerms}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        probationMaxTerms: parseInt(e.target.value) || 2,
                      })
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Suspension Duration
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={editingPolicy.suspensionDurationTerms}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        suspensionDurationTerms: parseInt(e.target.value) || 1,
                      })
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Max Suspensions
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={editingPolicy.maxSuspensions}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        maxSuspensions: parseInt(e.target.value) || 2,
                      })
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editingPolicy.isActive}
                  onChange={(e) =>
                    setEditingPolicy({ ...editingPolicy, isActive: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Active
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingPolicy(null);
                }}
                className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={createPolicy.isPending || updatePolicy.isPending}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createPolicy.isPending || updatePolicy.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Student Lookup Panel
// =============================================================================

function StudentLookupPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>("");

  const utils = trpc.useUtils();

  const { data: searchResults } = trpc.academicStanding.searchStudents.useQuery(
    { query: searchQuery, limit: 10 },
    { enabled: searchQuery.length > 1 }
  );

  const { data: terms } = trpc.academicStanding.getTerms.useQuery();
  const { data: policies } = trpc.academicStanding.getPolicies.useQuery({});

  const { data: currentStanding } = trpc.academicStanding.getCurrentStanding.useQuery(
    { studentId: selectedStudentId! },
    { enabled: !!selectedStudentId }
  );

  const { data: history } = trpc.academicStanding.getStudentHistory.useQuery(
    { studentId: selectedStudentId!, limit: 10 },
    { enabled: !!selectedStudentId }
  );

  const calculateStanding = trpc.academicStanding.calculateStanding.useMutation({
    onSuccess: () => {
      utils.academicStanding.getCurrentStanding.invalidate();
      utils.academicStanding.getStudentHistory.invalidate();
    },
  });

  const handleCalculate = () => {
    if (!selectedStudentId || !selectedTermId) return;

    calculateStanding.mutate({
      studentId: selectedStudentId,
      termId: selectedTermId,
      policyId: selectedPolicyId || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="rounded-lg bg-white p-4 shadow">
        <h3 className="mb-4 font-semibold">Student Lookup</h3>
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ID, or email..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4"
            />
            {searchResults && searchResults.length > 0 && searchQuery.length > 1 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                {searchResults.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => {
                      setSelectedStudentId(student.id);
                      setSearchQuery("");
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-gray-50"
                  >
                    <User className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium">{student.name}</div>
                      <div className="text-xs text-gray-500">
                        {student.studentId} - {student.email}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Student */}
      {selectedStudentId && currentStanding && (
        <>
          {/* Current Standing */}
          <div className="rounded-lg bg-white p-4 shadow">
            <h3 className="mb-4 font-semibold">Current Standing</h3>
            <div className="flex items-center gap-4">
              {(() => {
                const style = getStandingStyle(currentStanding.standing);
                const Icon = style.icon;
                return (
                  <div className={`flex items-center gap-2 rounded-lg px-4 py-2 ${style.bg}`}>
                    <Icon className={`h-6 w-6 ${style.text}`} />
                    <span className={`text-lg font-semibold ${style.text}`}>
                      {currentStanding.standingDisplayName}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Calculate New Standing */}
            <div className="mt-4 border-t pt-4">
              <h4 className="mb-2 text-sm font-medium text-gray-700">Calculate Standing</h4>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500">Term</label>
                  <select
                    value={selectedTermId}
                    onChange={(e) => setSelectedTermId(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  >
                    <option value="">Select term...</option>
                    {terms?.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500">Policy</label>
                  <select
                    value={selectedPolicyId}
                    onChange={(e) => setSelectedPolicyId(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  >
                    <option value="">Default policy</option>
                    {policies?.map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleCalculate}
                  disabled={!selectedTermId || calculateStanding.isPending}
                  className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {calculateStanding.isPending ? "Calculating..." : "Calculate"}
                </button>
              </div>
            </div>

            {/* Calculation Result */}
            {calculateStanding.data && (
              <div className="mt-4 rounded-lg bg-blue-50 p-4">
                <h4 className="font-medium text-blue-900">Calculation Result</h4>
                <div className="mt-2 space-y-2 text-sm">
                  <p>
                    <strong>Standing:</strong>{" "}
                    {calculateStanding.data.result.standingDisplayName}
                  </p>
                  <p>
                    <strong>Reason:</strong> {calculateStanding.data.result.reason}
                  </p>
                  {calculateStanding.data.result.actionItems.length > 0 && (
                    <div>
                      <strong>Action Items:</strong>
                      <ul className="ml-4 list-disc">
                        {calculateStanding.data.result.actionItems.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Standing History */}
          <div className="rounded-lg bg-white p-4 shadow">
            <h3 className="mb-4 font-semibold">Standing History</h3>
            {history && history.length > 0 ? (
              <div className="space-y-3">
                {history.map((entry) => {
                  const style = getStandingStyle(entry.standing);
                  const Icon = style.icon;
                  return (
                    <div key={entry.id} className="flex items-start gap-3 border-b pb-3">
                      <div className={`rounded p-1 ${style.bg}`}>
                        <Icon className={`h-4 w-4 ${style.text}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{entry.standingDisplayName}</span>
                          {entry.term && (
                            <span className="text-sm text-gray-500">{entry.term.name}</span>
                          )}
                        </div>
                        {entry.reason && (
                          <p className="mt-1 text-sm text-gray-600">{entry.reason}</p>
                        )}
                        <div className="mt-1 text-xs text-gray-400">
                          GPA: {entry.cumulativeGpa ? parseFloat(entry.cumulativeGpa).toFixed(3) : "-"}
                          {" | "}
                          {new Date(entry.determinedAt).toLocaleDateString()}
                          {!entry.isAutomatic && " (Manual)"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500">No standing history found.</p>
            )}
          </div>
        </>
      )}

      {!selectedStudentId && (
        <div className="rounded-lg bg-gray-50 p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-gray-500">Search for a student to view their academic standing.</p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Appeals Panel
// =============================================================================

function AppealsPanel() {
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [reviewingAppeal, setReviewingAppeal] = useState<{
    id: string;
    studentName: string;
    standing: string;
    reason: string;
  } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [resultingStanding, setResultingStanding] = useState("");
  const [approvalConditions, setApprovalConditions] = useState("");

  const utils = trpc.useUtils();

  const { data: appeals, isLoading } = trpc.academicStanding.getAppeals.useQuery({
    status: selectedStatus as "pending" | "under_review" | "approved" | "denied" | "withdrawn" | undefined,
  });

  const reviewAppeal = trpc.academicStanding.reviewAppeal.useMutation({
    onSuccess: () => {
      utils.academicStanding.getAppeals.invalidate();
      setReviewingAppeal(null);
      setReviewNotes("");
      setResultingStanding("");
      setApprovalConditions("");
    },
  });

  const handleReview = (decision: "approved" | "denied") => {
    if (!reviewingAppeal) return;

    reviewAppeal.mutate({
      appealId: reviewingAppeal.id,
      status: decision,
      reviewNotes,
      resultingStanding: decision === "approved" ? (resultingStanding as "good_standing" | "reinstated" | "academic_probation") : undefined,
      approvalConditions: decision === "approved" ? approvalConditions : undefined,
    });
  };

  if (isLoading) {
    return <div className="p-4 text-gray-500">Loading appeals...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Academic Standing Appeals</h3>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="rounded border border-gray-300 px-3 py-1.5"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="denied">Denied</option>
        </select>
      </div>

      {appeals && appeals.length > 0 ? (
        <div className="rounded-lg bg-white shadow">
          <div className="divide-y">
            {appeals.map((appeal) => (
              <div key={appeal.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">
                      {appeal.student.legalFirstName} {appeal.student.legalLastName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {appeal.student.studentId} | Appealing:{" "}
                      {getStandingLabel(appeal.standingHistory.standing)}
                    </div>
                    <div className="mt-2 text-sm">
                      <strong>Reason:</strong> {appeal.appealReason}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      Submitted: {new Date(appeal.appealDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        appeal.status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : appeal.status === "approved"
                          ? "bg-green-100 text-green-800"
                          : appeal.status === "denied"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {appeal.status}
                    </span>
                    {appeal.status === "pending" && (
                      <button
                        onClick={() =>
                          setReviewingAppeal({
                            id: appeal.id,
                            studentName: `${appeal.student.legalFirstName} ${appeal.student.legalLastName}`,
                            standing: appeal.standingHistory.standing,
                            reason: appeal.appealReason,
                          })
                        }
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Review
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-gray-50 p-8 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-gray-500">No appeals to review.</p>
        </div>
      )}

      {/* Review Modal */}
      {reviewingAppeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Review Appeal</h3>

            <div className="mb-4 rounded bg-gray-50 p-3">
              <p>
                <strong>Student:</strong> {reviewingAppeal.studentName}
              </p>
              <p>
                <strong>Appealing:</strong> {getStandingLabel(reviewingAppeal.standing)}
              </p>
              <p className="mt-2">
                <strong>Reason:</strong> {reviewingAppeal.reason}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Review Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  placeholder="Enter your review notes..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Resulting Standing (if approved)
                </label>
                <select
                  value={resultingStanding}
                  onChange={(e) => setResultingStanding(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                >
                  <option value="">No change</option>
                  <option value="reinstated">Reinstated</option>
                  <option value="good_standing">Good Standing</option>
                  <option value="academic_probation">Academic Probation</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Approval Conditions (if any)
                </label>
                <textarea
                  value={approvalConditions}
                  onChange={(e) => setApprovalConditions(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  placeholder="e.g., Must meet with advisor weekly..."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setReviewingAppeal(null)}
                className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReview("denied")}
                disabled={!reviewNotes || reviewAppeal.isPending}
                className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                Deny
              </button>
              <button
                onClick={() => handleReview("approved")}
                disabled={!reviewNotes || reviewAppeal.isPending}
                className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Page
// =============================================================================

export default function AcademicStandingPage() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

  const tabs: { id: TabType; label: string; icon: typeof Shield }[] = [
    { id: "dashboard", label: "Dashboard", icon: Shield },
    { id: "policies", label: "Policies", icon: Shield },
    { id: "student-lookup", label: "Student Lookup", icon: User },
    { id: "appeals", label: "Appeals", icon: AlertCircle },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Academic Standing</h1>
        <p className="text-gray-600">
          Manage academic standing policies, calculate student standing, and review appeals.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "dashboard" && <DashboardPanel />}
      {activeTab === "policies" && <PolicyPanel />}
      {activeTab === "student-lookup" && <StudentLookupPanel />}
      {activeTab === "appeals" && <AppealsPanel />}
    </div>
  );
}
