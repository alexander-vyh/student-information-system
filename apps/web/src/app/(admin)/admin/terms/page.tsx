"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/trpc/client";

type TermType = "fall" | "spring" | "summer" | "winter" | "quarter";

export default function TermManagementPage() {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showAddTermModal, setShowAddTermModal] = useState(false);
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [expandedTermId, setExpandedTermId] = useState<string | null>(null);
  const [showAddSessionModal, setShowAddSessionModal] = useState<string | null>(null);

  // Fetch terms
  const { data: terms, isLoading, error, refetch } = trpc.admin.getTerms.useQuery({
    includeInactive,
    limit: 100,
  });

  // Get current term
  const { data: currentTermData } = trpc.admin.getCurrentTerm.useQuery();

  // Set current term mutation
  const setCurrentTerm = trpc.admin.setCurrentTerm.useMutation({
    onSuccess: () => refetch(),
  });

  // Delete term mutation
  const deleteTerm = trpc.admin.deleteTerm.useMutation({
    onSuccess: () => refetch(),
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getTermTypeBadge = (type: string) => {
    switch (type) {
      case "fall":
        return "bg-orange-100 text-orange-800";
      case "spring":
        return "bg-green-100 text-green-800";
      case "summer":
        return "bg-yellow-100 text-yellow-800";
      case "winter":
        return "bg-blue-100 text-blue-800";
      case "quarter":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleDeleteTerm = (termId: string) => {
    if (confirm("Are you sure you want to delete this term? This action cannot be undone.")) {
      deleteTerm.mutate({ termId });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                Term Management
              </h1>
              {currentTermData && (
                <p className="mt-1 text-sm text-gray-500">
                  Current Term: <span className="font-medium text-blue-600">{currentTermData.name}</span>
                </p>
              )}
            </div>
            <button
              onClick={() => setShowAddTermModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Term
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow">
          {/* Filters */}
          <div className="p-6 border-b border-gray-200">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Show inactive terms</span>
            </label>
          </div>

          {/* Results */}
          <div className="overflow-x-auto">
            {/* Loading State */}
            {isLoading && (
              <div className="p-6 text-center text-gray-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <p className="mt-2">Loading terms...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-6 text-center text-red-600">
                <p>Error: {error.message}</p>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && terms && terms.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No terms found</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by creating your first term.</p>
              </div>
            )}

            {/* Results Table */}
            {!isLoading && terms && terms.length > 0 && (
              <div className="divide-y divide-gray-200">
                {terms.map((term) => (
                  <div key={term.id} className="hover:bg-gray-50">
                    {/* Term Row */}
                    <div className="px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => setExpandedTermId(expandedTermId === term.id ? null : term.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <svg
                            className={`h-5 w-5 transform transition-transform ${expandedTermId === term.id ? "rotate-90" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">{term.name}</span>
                            <span className="text-sm text-gray-500">({term.code})</span>
                            {term.isCurrent && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-blue-600 text-white rounded-full">Current</span>
                            )}
                            {term.allowRegistration && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">Registration Open</span>
                            )}
                          </div>
                          <div className="mt-1 text-sm text-gray-500">
                            {formatDate(term.startDate)} - {formatDate(term.endDate)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTermTypeBadge(term.termType)}`}>
                          {term.termType}
                        </span>
                        {term.academicYear && (
                          <span className="text-xs text-gray-500">{term.academicYear.name}</span>
                        )}
                        <div className="flex items-center space-x-2">
                          {!term.isCurrent && (
                            <button
                              onClick={() => setCurrentTerm.mutate({ termId: term.id })}
                              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                              disabled={setCurrentTerm.isPending}
                            >
                              Set Current
                            </button>
                          )}
                          <button
                            onClick={() => setEditingTermId(term.id)}
                            className="text-sm text-gray-600 hover:text-gray-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTerm(term.id)}
                            className="text-sm text-red-600 hover:text-red-800"
                            disabled={deleteTerm.isPending}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Sessions (Expanded) */}
                    {expandedTermId === term.id && (
                      <SessionsPanel
                        termId={term.id}
                        onAddSession={() => setShowAddSessionModal(term.id)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Results Count */}
            {!isLoading && terms && terms.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{terms.length}</span> terms
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Term Modal */}
      {showAddTermModal && (
        <TermFormModal
          onClose={() => setShowAddTermModal(false)}
          onSuccess={() => {
            setShowAddTermModal(false);
            refetch();
          }}
        />
      )}

      {/* Edit Term Modal */}
      {editingTermId && (
        <TermFormModal
          termId={editingTermId}
          onClose={() => setEditingTermId(null)}
          onSuccess={() => {
            setEditingTermId(null);
            refetch();
          }}
        />
      )}

      {/* Add Session Modal */}
      {showAddSessionModal && (
        <SessionFormModal
          termId={showAddSessionModal}
          onClose={() => setShowAddSessionModal(null)}
          onSuccess={() => {
            setShowAddSessionModal(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

// Sessions Panel Component
function SessionsPanel({
  termId,
  onAddSession,
}: {
  termId: string;
  onAddSession: () => void;
}) {
  const { data, isLoading, refetch } = trpc.admin.getTermSessions.useQuery({ termId });
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  const deleteSession = trpc.admin.deleteSession.useMutation({
    onSuccess: () => refetch(),
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleDeleteSession = (sessionId: string) => {
    if (confirm("Are you sure you want to delete this session?")) {
      deleteSession.mutate({ sessionId });
    }
  };

  return (
    <div className="px-6 pb-4 pl-14 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700">Sessions</h4>
        <button
          onClick={onAddSession}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          + Add Session
        </button>
      </div>

      {isLoading && (
        <div className="text-sm text-gray-500">Loading sessions...</div>
      )}

      {!isLoading && data && data.length === 0 && (
        <div className="text-sm text-gray-500 italic">
          No sessions. This is a full-term course schedule.
        </div>
      )}

      {!isLoading && data && data.length > 0 && (
        <div className="space-y-2">
          {data.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between bg-white px-4 py-2 rounded border border-gray-200"
            >
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-sm">{session.name}</span>
                  <span className="text-xs text-gray-500">({session.code})</span>
                  {session.isDefault && (
                    <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">Default</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {formatDate(session.startDate)} - {formatDate(session.endDate)}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setEditingSessionId(session.id)}
                  className="text-xs text-gray-600 hover:text-gray-800"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteSession(session.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                  disabled={deleteSession.isPending}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Session Modal */}
      {editingSessionId && (
        <SessionFormModal
          termId={termId}
          sessionId={editingSessionId}
          onClose={() => setEditingSessionId(null)}
          onSuccess={() => {
            setEditingSessionId(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

// Term Form Modal Component
function TermFormModal({
  termId,
  onClose,
  onSuccess,
}: {
  termId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEditing = !!termId;

  // Fetch term data if editing
  const { data: termData, isLoading: loadingTerm } = trpc.admin.getTermById.useQuery(
    { termId: termId! },
    { enabled: isEditing }
  );

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    termType: "fall" as TermType,
    startDate: "",
    endDate: "",
    registrationStartDate: "",
    registrationEndDate: "",
    addDeadline: "",
    dropDeadline: "",
    withdrawalDeadline: "",
    isVisible: true,
    allowRegistration: false,
  });

  // Populate form when editing
  useEffect(() => {
    if (termData) {
      setFormData({
        code: termData.code,
        name: termData.name,
        termType: termData.termType as TermType,
        startDate: termData.startDate?.slice(0, 10) ?? "",
        endDate: termData.endDate?.slice(0, 10) ?? "",
        registrationStartDate: termData.registrationStartDate?.slice(0, 10) ?? "",
        registrationEndDate: termData.registrationEndDate?.slice(0, 10) ?? "",
        addDeadline: termData.addDeadline?.slice(0, 10) ?? "",
        dropDeadline: termData.dropDeadline?.slice(0, 10) ?? "",
        withdrawalDeadline: termData.withdrawalDeadline?.slice(0, 10) ?? "",
        isVisible: termData.isVisible ?? true,
        allowRegistration: termData.allowRegistration ?? false,
      });
    }
  }, [termData]);

  const createTerm = trpc.admin.createTerm.useMutation({
    onSuccess: () => onSuccess(),
  });

  const updateTerm = trpc.admin.updateTerm.useMutation({
    onSuccess: () => onSuccess(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      code: formData.code,
      name: formData.name,
      termType: formData.termType,
      startDate: formData.startDate,
      endDate: formData.endDate,
      registrationStartDate: formData.registrationStartDate || undefined,
      registrationEndDate: formData.registrationEndDate || undefined,
      addDeadline: formData.addDeadline || undefined,
      dropDeadline: formData.dropDeadline || undefined,
      withdrawalDeadline: formData.withdrawalDeadline || undefined,
      isVisible: formData.isVisible,
      allowRegistration: formData.allowRegistration,
    };

    if (isEditing) {
      updateTerm.mutate({ termId: termId!, ...payload });
    } else {
      createTerm.mutate(payload);
    }
  };

  const mutationError = createTerm.error || updateTerm.error;
  const isPending = createTerm.isPending || updateTerm.isPending;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? "Edit Term" : "Add Term"}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {loadingTerm ? (
          <div className="p-6 text-center text-gray-500">Loading term data...</div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Term Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., FA24"
                  maxLength={20}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Term Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Fall 2024"
                  maxLength={100}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Term Type</label>
              <select
                value={formData.termType}
                onChange={(e) => setFormData({ ...formData, termType: e.target.value as TermType })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="fall">Fall</option>
                <option value="spring">Spring</option>
                <option value="summer">Summer</option>
                <option value="winter">Winter</option>
                <option value="quarter">Quarter</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isVisible}
                  onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Visible to students</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.allowRegistration}
                  onChange={(e) => setFormData({ ...formData, allowRegistration: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Allow registration</span>
              </label>
            </div>

            <hr className="border-gray-200" />

            <h3 className="text-sm font-medium text-gray-900">Registration Dates (Optional)</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Registration Start</label>
                <input
                  type="date"
                  value={formData.registrationStartDate}
                  onChange={(e) => setFormData({ ...formData, registrationStartDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Registration End</label>
                <input
                  type="date"
                  value={formData.registrationEndDate}
                  onChange={(e) => setFormData({ ...formData, registrationEndDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Add Deadline</label>
                <input
                  type="date"
                  value={formData.addDeadline}
                  onChange={(e) => setFormData({ ...formData, addDeadline: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Drop Deadline</label>
                <input
                  type="date"
                  value={formData.dropDeadline}
                  onChange={(e) => setFormData({ ...formData, dropDeadline: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Withdrawal Deadline</label>
                <input
                  type="date"
                  value={formData.withdrawalDeadline}
                  onChange={(e) => setFormData({ ...formData, withdrawalDeadline: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Error Message */}
            {mutationError && (
              <div className="text-sm text-red-600">Error: {mutationError.message}</div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isPending ? "Saving..." : isEditing ? "Update Term" : "Create Term"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Session Form Modal Component
function SessionFormModal({
  termId,
  sessionId,
  onClose,
  onSuccess,
}: {
  termId: string;
  sessionId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEditing = !!sessionId;

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    startDate: "",
    endDate: "",
    censusDate: "",
    addDeadline: "",
    dropDeadline: "",
    withdrawalDeadline: "",
    isDefault: false,
  });

  const createSession = trpc.admin.createSession.useMutation({
    onSuccess: () => onSuccess(),
  });

  const updateSession = trpc.admin.updateSession.useMutation({
    onSuccess: () => onSuccess(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      code: formData.code,
      name: formData.name,
      startDate: formData.startDate,
      endDate: formData.endDate,
      censusDate: formData.censusDate || undefined,
      addDeadline: formData.addDeadline || undefined,
      dropDeadline: formData.dropDeadline || undefined,
      withdrawalDeadline: formData.withdrawalDeadline || undefined,
      isDefault: formData.isDefault,
    };

    if (isEditing) {
      updateSession.mutate({ sessionId: sessionId!, ...payload });
    } else {
      createSession.mutate({ termId, ...payload });
    }
  };

  const mutationError = createSession.error || updateSession.error;
  const isPending = createSession.isPending || updateSession.isPending;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? "Edit Session" : "Add Session"}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Session Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., S1"
                maxLength={20}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Session Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Session 1"
                maxLength={100}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Census Date</label>
            <input
              type="date"
              value={formData.censusDate}
              onChange={(e) => setFormData({ ...formData, censusDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Default session for new sections</span>
          </label>

          <hr className="border-gray-200" />

          <h3 className="text-sm font-medium text-gray-900">Deadlines (Optional)</h3>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Add Deadline</label>
              <input
                type="date"
                value={formData.addDeadline}
                onChange={(e) => setFormData({ ...formData, addDeadline: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Drop Deadline</label>
              <input
                type="date"
                value={formData.dropDeadline}
                onChange={(e) => setFormData({ ...formData, dropDeadline: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Withdrawal</label>
              <input
                type="date"
                value={formData.withdrawalDeadline}
                onChange={(e) => setFormData({ ...formData, withdrawalDeadline: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Error Message */}
          {mutationError && (
            <div className="text-sm text-red-600">Error: {mutationError.message}</div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isPending ? "Saving..." : isEditing ? "Update Session" : "Create Session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
