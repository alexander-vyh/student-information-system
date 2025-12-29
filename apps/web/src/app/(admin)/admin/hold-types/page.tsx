"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/trpc/client";

type HoldCategory = "academic" | "financial" | "administrative" | "disciplinary";
type HoldSeverity = "low" | "standard" | "high" | "critical";

export default function HoldTypesPage() {
  const [activeOnly, setActiveOnly] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<HoldCategory | "">("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Fetch hold types
  const { data: holdTypes, isLoading, error, refetch } = trpc.holds.listHoldTypes.useQuery({
    activeOnly,
    category: categoryFilter || undefined,
    includeHistory: false,
  });

  // Toggle active mutation
  const toggleActive = trpc.holds.toggleHoldTypeActive.useMutation({
    onSuccess: () => refetch(),
  });

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "academic":
        return "bg-blue-100 text-blue-800";
      case "financial":
        return "bg-green-100 text-green-800";
      case "administrative":
        return "bg-purple-100 text-purple-800";
      case "disciplinary":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "low":
        return "bg-gray-100 text-gray-700";
      case "standard":
        return "bg-yellow-100 text-yellow-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "critical":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleToggleActive = (id: string, currentActive: boolean) => {
    toggleActive.mutate({ id, isActive: !currentActive });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                Hold Types
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Configure types of holds that can be applied to student accounts
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Hold Type
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow">
          {/* Filters */}
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Active only</span>
              </label>
            </div>
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as HoldCategory | "")}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Categories</option>
                <option value="academic">Academic</option>
                <option value="financial">Financial</option>
                <option value="administrative">Administrative</option>
                <option value="disciplinary">Disciplinary</option>
              </select>
            </div>
          </div>

          {/* Results */}
          <div className="overflow-x-auto">
            {/* Loading State */}
            {isLoading && (
              <div className="p-6 text-center text-gray-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <p className="mt-2">Loading hold types...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-6 text-center text-red-600">
                <p>Error: {error.message}</p>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && holdTypes && holdTypes.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hold types found</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by creating your first hold type.</p>
              </div>
            )}

            {/* Results Table */}
            {!isLoading && holdTypes && holdTypes.length > 0 && (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hold Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Blocks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {holdTypes.map((holdType) => (
                    <tr key={holdType.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{holdType.name}</div>
                          <div className="text-sm text-gray-500">{holdType.code}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getCategoryBadge(holdType.category)}`}>
                          {holdType.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getSeverityBadge(holdType.severity ?? "standard")}`}>
                          {holdType.severity ?? "standard"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {holdType.blocksRegistration && (
                            <span className="px-1.5 py-0.5 text-xs bg-red-50 text-red-700 rounded">Reg</span>
                          )}
                          {holdType.blocksGrades && (
                            <span className="px-1.5 py-0.5 text-xs bg-red-50 text-red-700 rounded">Grades</span>
                          )}
                          {holdType.blocksTranscript && (
                            <span className="px-1.5 py-0.5 text-xs bg-red-50 text-red-700 rounded">Trans</span>
                          )}
                          {holdType.blocksDiploma && (
                            <span className="px-1.5 py-0.5 text-xs bg-red-50 text-red-700 rounded">Diploma</span>
                          )}
                          {holdType.blocksGraduation && (
                            <span className="px-1.5 py-0.5 text-xs bg-red-50 text-red-700 rounded">Grad</span>
                          )}
                          {!holdType.blocksRegistration && !holdType.blocksGrades && !holdType.blocksTranscript && !holdType.blocksDiploma && !holdType.blocksGraduation && (
                            <span className="text-xs text-gray-400">None</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${holdType.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                          {holdType.isActive ? "Active" : "Inactive"}
                        </span>
                        {holdType.isAutomated && (
                          <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">Auto</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => setEditingId(holdType.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(holdType.id, holdType.isActive)}
                          className={holdType.isActive ? "text-orange-600 hover:text-orange-900" : "text-green-600 hover:text-green-900"}
                          disabled={toggleActive.isPending}
                        >
                          {holdType.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Results Count */}
            {!isLoading && holdTypes && holdTypes.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{holdTypes.length}</span> hold types
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Hold Type Modal */}
      {showAddModal && (
        <HoldTypeFormModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            refetch();
          }}
        />
      )}

      {/* Edit Hold Type Modal */}
      {editingId && (
        <HoldTypeFormModal
          holdTypeId={editingId}
          onClose={() => setEditingId(null)}
          onSuccess={() => {
            setEditingId(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

// Hold Type Form Modal Component
function HoldTypeFormModal({
  holdTypeId,
  onClose,
  onSuccess,
}: {
  holdTypeId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEditing = !!holdTypeId;

  // Fetch hold type data if editing
  const { data: holdTypeData, isLoading: loadingData } = trpc.holds.getHoldType.useQuery(
    { id: holdTypeId! },
    { enabled: isEditing }
  );

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    category: "academic" as HoldCategory,
    severity: "standard" as HoldSeverity,
    blocksRegistration: true,
    blocksGrades: false,
    blocksTranscript: false,
    blocksDiploma: false,
    blocksGraduation: false,
    releaseAuthority: "",
    releaseAuthorityEmail: "",
    resolutionInstructions: "",
    resolutionUrl: "",
    isAutomated: false,
  });

  // Populate form when editing
  useEffect(() => {
    if (holdTypeData) {
      setFormData({
        code: holdTypeData.code,
        name: holdTypeData.name,
        description: holdTypeData.description ?? "",
        category: holdTypeData.category as HoldCategory,
        severity: holdTypeData.severity as HoldSeverity,
        blocksRegistration: holdTypeData.blocksRegistration ?? true,
        blocksGrades: holdTypeData.blocksGrades ?? false,
        blocksTranscript: holdTypeData.blocksTranscript ?? false,
        blocksDiploma: holdTypeData.blocksDiploma ?? false,
        blocksGraduation: holdTypeData.blocksGraduation ?? false,
        releaseAuthority: holdTypeData.releaseAuthority ?? "",
        releaseAuthorityEmail: holdTypeData.releaseAuthorityEmail ?? "",
        resolutionInstructions: holdTypeData.resolutionInstructions ?? "",
        resolutionUrl: holdTypeData.resolutionUrl ?? "",
        isAutomated: holdTypeData.isAutomated ?? false,
      });
    }
  }, [holdTypeData]);

  const createHoldType = trpc.holds.createHoldType.useMutation({
    onSuccess: () => onSuccess(),
  });

  const updateHoldType = trpc.holds.updateHoldType.useMutation({
    onSuccess: () => onSuccess(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing) {
      updateHoldType.mutate({
        id: holdTypeId!,
        name: formData.name,
        description: formData.description || undefined,
        blocksRegistration: formData.blocksRegistration,
        blocksGrades: formData.blocksGrades,
        blocksTranscript: formData.blocksTranscript,
        blocksDiploma: formData.blocksDiploma,
        blocksGraduation: formData.blocksGraduation,
        releaseAuthority: formData.releaseAuthority || undefined,
        releaseAuthorityEmail: formData.releaseAuthorityEmail || undefined,
        resolutionInstructions: formData.resolutionInstructions || undefined,
        resolutionUrl: formData.resolutionUrl || undefined,
        isAutomated: formData.isAutomated,
      });
    } else {
      createHoldType.mutate({
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
        category: formData.category,
        severity: formData.severity,
        blocksRegistration: formData.blocksRegistration,
        blocksGrades: formData.blocksGrades,
        blocksTranscript: formData.blocksTranscript,
        blocksDiploma: formData.blocksDiploma,
        blocksGraduation: formData.blocksGraduation,
        releaseAuthority: formData.releaseAuthority || undefined,
        releaseAuthorityEmail: formData.releaseAuthorityEmail || undefined,
        resolutionInstructions: formData.resolutionInstructions || undefined,
        resolutionUrl: formData.resolutionUrl || undefined,
        isAutomated: formData.isAutomated,
      });
    }
  };

  const mutationError = createHoldType.error || updateHoldType.error;
  const isPending = createHoldType.isPending || updateHoldType.isPending;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? "Edit Hold Type" : "Add Hold Type"}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {loadingData ? (
          <div className="p-6 text-center text-gray-500">Loading hold type data...</div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., FINBAL"
                  maxLength={30}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={isEditing}
                />
                {isEditing && (
                  <p className="mt-1 text-xs text-gray-500">Code cannot be changed after creation</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Financial Balance Hold"
                  maxLength={100}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe this hold type..."
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as HoldCategory })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={isEditing}
                >
                  <option value="academic">Academic</option>
                  <option value="financial">Financial</option>
                  <option value="administrative">Administrative</option>
                  <option value="disciplinary">Disciplinary</option>
                </select>
                {isEditing && (
                  <p className="mt-1 text-xs text-gray-500">Category cannot be changed after creation</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value as HoldSeverity })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={isEditing}
                >
                  <option value="low">Low</option>
                  <option value="standard">Standard</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* Blocks */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">What does this hold block?</h3>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.blocksRegistration}
                    onChange={(e) => setFormData({ ...formData, blocksRegistration: e.target.checked })}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Registration</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.blocksGrades}
                    onChange={(e) => setFormData({ ...formData, blocksGrades: e.target.checked })}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Grades</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.blocksTranscript}
                    onChange={(e) => setFormData({ ...formData, blocksTranscript: e.target.checked })}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Transcript</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.blocksDiploma}
                    onChange={(e) => setFormData({ ...formData, blocksDiploma: e.target.checked })}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Diploma</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.blocksGraduation}
                    onChange={(e) => setFormData({ ...formData, blocksGraduation: e.target.checked })}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Graduation</span>
                </label>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* Resolution Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Resolution Information</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Release Authority</label>
                    <input
                      type="text"
                      value={formData.releaseAuthority}
                      onChange={(e) => setFormData({ ...formData, releaseAuthority: e.target.value })}
                      placeholder="e.g., Bursar's Office"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
                    <input
                      type="email"
                      value={formData.releaseAuthorityEmail}
                      onChange={(e) => setFormData({ ...formData, releaseAuthorityEmail: e.target.value })}
                      placeholder="e.g., bursar@university.edu"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Resolution Instructions</label>
                  <textarea
                    value={formData.resolutionInstructions}
                    onChange={(e) => setFormData({ ...formData, resolutionInstructions: e.target.value })}
                    placeholder="Instructions for students on how to resolve this hold..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Resolution URL</label>
                  <input
                    type="url"
                    value={formData.resolutionUrl}
                    onChange={(e) => setFormData({ ...formData, resolutionUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* Automation */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isAutomated}
                  onChange={(e) => setFormData({ ...formData, isAutomated: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">This hold is applied automatically by the system</span>
              </label>
              {formData.isAutomated && (
                <p className="mt-2 text-xs text-gray-500">
                  Automated holds require configuration of automation rules (balance thresholds, etc.)
                </p>
              )}
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
                {isPending ? "Saving..." : isEditing ? "Update Hold Type" : "Create Hold Type"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
