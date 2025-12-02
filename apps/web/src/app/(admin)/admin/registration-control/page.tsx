"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/trpc/client";

type MembershipType = "manual" | "attribute" | "credits" | "standing";
type ActiveTab = "priority-groups" | "appointments";

export default function RegistrationControlPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("priority-groups");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Registration Control
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage priority groups and registration time tickets
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("priority-groups")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "priority-groups"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Priority Groups
            </button>
            <button
              onClick={() => setActiveTab("appointments")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "appointments"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Registration Appointments
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "priority-groups" && <PriorityGroupsPanel />}
        {activeTab === "appointments" && <AppointmentsPanel />}
      </main>
    </div>
  );
}

// =============================================================================
// PRIORITY GROUPS PANEL
// =============================================================================

function PriorityGroupsPanel() {
  const [activeOnly, setActiveOnly] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: groups, isLoading, error, refetch } = trpc.registrationControl.listPriorityGroups.useQuery({
    activeOnly,
  });

  const deletePriorityGroup = trpc.registrationControl.deletePriorityGroup.useMutation({
    onSuccess: () => refetch(),
  });

  const getMembershipTypeBadge = (type: string) => {
    switch (type) {
      case "manual":
        return "bg-gray-100 text-gray-800";
      case "attribute":
        return "bg-blue-100 text-blue-800";
      case "credits":
        return "bg-green-100 text-green-800";
      case "standing":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleDelete = (id: string, isFederallyMandated: boolean) => {
    if (isFederallyMandated) {
      alert("Cannot deactivate federally mandated priority group");
      return;
    }
    if (confirm("Are you sure you want to deactivate this priority group?")) {
      deletePriorityGroup.mutate({ id });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
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
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Priority Group
        </button>
      </div>

      {/* Content */}
      <div className="overflow-x-auto">
        {isLoading && (
          <div className="p-6 text-center text-gray-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2">Loading priority groups...</p>
          </div>
        )}

        {error && (
          <div className="p-6 text-center text-red-600">
            <p>Error: {error.message}</p>
          </div>
        )}

        {!isLoading && groups && groups.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No priority groups found</h3>
            <p className="mt-1 text-sm text-gray-500">Create priority groups for registration time tickets.</p>
          </div>
        )}

        {!isLoading && groups && groups.length > 0 && (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Group
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Membership Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Criteria
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
              {groups.map((group) => (
                <tr key={group.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-semibold text-sm">
                      {group.priorityLevel}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{group.name}</div>
                      <div className="text-sm text-gray-500">{group.code}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getMembershipTypeBadge(group.membershipType ?? "manual")}`}>
                      {group.membershipType ?? "manual"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {group.membershipType === "attribute" && group.membershipAttribute && (
                      <span>Attribute: {group.membershipAttribute}</span>
                    )}
                    {group.membershipType === "credits" && group.minimumCredits && (
                      <span>Min {group.minimumCredits} credits</span>
                    )}
                    {group.membershipType === "manual" && <span className="text-gray-400">Manual assignment</span>}
                    {group.membershipType === "standing" && <span>Academic standing</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-1">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${group.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                        {group.isActive ? "Active" : "Inactive"}
                      </span>
                      {group.isFederallyMandated && (
                        <span className="px-1.5 py-0.5 text-xs bg-red-50 text-red-700 rounded">Federal</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => setEditingId(group.id)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                    {!group.isFederallyMandated && group.isActive && (
                      <button
                        onClick={() => handleDelete(group.id, group.isFederallyMandated ?? false)}
                        className="text-red-600 hover:text-red-900"
                        disabled={deletePriorityGroup.isPending}
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!isLoading && groups && groups.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{groups.length}</span> priority groups
            </p>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <PriorityGroupFormModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            refetch();
          }}
        />
      )}

      {/* Edit Modal */}
      {editingId && (
        <PriorityGroupFormModal
          groupId={editingId}
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

// Priority Group Form Modal
function PriorityGroupFormModal({
  groupId,
  onClose,
  onSuccess,
}: {
  groupId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEditing = !!groupId;

  const { data: groupData, isLoading: loadingData } = trpc.registrationControl.getPriorityGroup.useQuery(
    { id: groupId! },
    { enabled: isEditing }
  );

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    priorityLevel: 100,
    membershipType: "manual" as MembershipType,
    membershipAttribute: "",
    minimumCredits: "",
    isFederallyMandated: false,
  });

  useEffect(() => {
    if (groupData) {
      setFormData({
        code: groupData.code,
        name: groupData.name,
        description: groupData.description ?? "",
        priorityLevel: groupData.priorityLevel,
        membershipType: (groupData.membershipType as MembershipType) ?? "manual",
        membershipAttribute: groupData.membershipAttribute ?? "",
        minimumCredits: groupData.minimumCredits ?? "",
        isFederallyMandated: groupData.isFederallyMandated ?? false,
      });
    }
  }, [groupData]);

  const createPriorityGroup = trpc.registrationControl.createPriorityGroup.useMutation({
    onSuccess: () => onSuccess(),
  });

  const updatePriorityGroup = trpc.registrationControl.updatePriorityGroup.useMutation({
    onSuccess: () => onSuccess(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing) {
      updatePriorityGroup.mutate({
        id: groupId!,
        name: formData.name,
        description: formData.description || undefined,
        priorityLevel: formData.priorityLevel,
        membershipType: formData.membershipType,
        membershipAttribute: formData.membershipAttribute || undefined,
        minimumCredits: formData.minimumCredits ? parseFloat(formData.minimumCredits) : undefined,
        isFederallyMandated: formData.isFederallyMandated,
      });
    } else {
      createPriorityGroup.mutate({
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
        priorityLevel: formData.priorityLevel,
        membershipType: formData.membershipType,
        membershipAttribute: formData.membershipAttribute || undefined,
        minimumCredits: formData.minimumCredits ? parseFloat(formData.minimumCredits) : undefined,
        isFederallyMandated: formData.isFederallyMandated,
      });
    }
  };

  const mutationError = createPriorityGroup.error || updatePriorityGroup.error;
  const isPending = createPriorityGroup.isPending || updatePriorityGroup.isPending;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? "Edit Priority Group" : "Add Priority Group"}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {loadingData ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., VETERAN"
                  maxLength={30}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={isEditing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority Level</label>
                <input
                  type="number"
                  value={formData.priorityLevel}
                  onChange={(e) => setFormData({ ...formData, priorityLevel: parseInt(e.target.value) || 100 })}
                  min={1}
                  max={1000}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">Lower = higher priority (1 = first)</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Veterans Priority Registration"
                maxLength={100}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe this priority group..."
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Membership Type</label>
              <select
                value={formData.membershipType}
                onChange={(e) => setFormData({ ...formData, membershipType: e.target.value as MembershipType })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="manual">Manual - Assigned individually</option>
                <option value="attribute">Attribute - Based on student attribute</option>
                <option value="credits">Credits - Based on earned credits</option>
                <option value="standing">Standing - Based on academic standing</option>
              </select>
            </div>

            {formData.membershipType === "attribute" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Student Attribute</label>
                <select
                  value={formData.membershipAttribute}
                  onChange={(e) => setFormData({ ...formData, membershipAttribute: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select attribute...</option>
                  <option value="isVeteran">Veteran Status</option>
                  <option value="hasDisabilityAccommodation">Disability Accommodation</option>
                  <option value="isAthlete">Student Athlete</option>
                  <option value="isHonors">Honors Program</option>
                </select>
              </div>
            )}

            {formData.membershipType === "credits" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Credits</label>
                <input
                  type="number"
                  value={formData.minimumCredits}
                  onChange={(e) => setFormData({ ...formData, minimumCredits: e.target.value })}
                  min={0}
                  step={0.5}
                  placeholder="e.g., 90 for seniors"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isFederallyMandated}
                onChange={(e) => setFormData({ ...formData, isFederallyMandated: e.target.checked })}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Federally mandated (e.g., VA, ADA)</span>
            </label>

            {mutationError && (
              <div className="text-sm text-red-600">Error: {mutationError.message}</div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300"
              >
                {isPending ? "Saving..." : isEditing ? "Update" : "Create"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// APPOINTMENTS PANEL
// =============================================================================

function AppointmentsPanel() {
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Get terms for dropdown
  const { data: terms } = trpc.admin.getTerms.useQuery({ includeInactive: false, limit: 20 });

  // Get appointment stats
  const { data: stats, refetch: refetchStats } = trpc.registrationControl.getAppointmentStats.useQuery(
    { termId: selectedTermId },
    { enabled: !!selectedTermId }
  );

  // Get appointments list
  const { data: appointments, isLoading, refetch: refetchAppointments } = trpc.registrationControl.listAppointments.useQuery(
    { termId: selectedTermId, limit: 100 },
    { enabled: !!selectedTermId }
  );

  const clearAppointments = trpc.registrationControl.clearAppointments.useMutation({
    onSuccess: () => {
      refetchStats();
      refetchAppointments();
    },
  });

  const handleClear = () => {
    if (confirm("Are you sure you want to clear all generated appointments? Manual overrides will be preserved.")) {
      clearAppointments.mutate({ termId: selectedTermId, includeManualOverrides: false });
    }
  };

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Term Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Select Term:</label>
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a term...</option>
              {terms?.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name} ({term.code})
                </option>
              ))}
            </select>
          </div>
          {selectedTermId && (
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowGenerateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              >
                Generate Appointments
              </button>
              {stats && stats.totalAppointments > 0 && (
                <button
                  onClick={handleClear}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  disabled={clearAppointments.isPending}
                >
                  Clear Generated
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {selectedTermId && stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-medium text-gray-500">Total Appointments</div>
            <div className="mt-1 text-3xl font-semibold text-gray-900">{stats.totalAppointments}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-medium text-gray-500">Manual Overrides</div>
            <div className="mt-1 text-3xl font-semibold text-blue-600">{stats.manualOverrides}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-medium text-gray-500">First Appointment</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">
              {stats.earliestAppointment ? formatDateTime(stats.earliestAppointment) : "—"}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-medium text-gray-500">Last Appointment</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">
              {stats.latestAppointment ? formatDateTime(stats.latestAppointment) : "—"}
            </div>
          </div>
        </div>
      )}

      {/* By Priority Group */}
      {selectedTermId && stats && Object.keys(stats.byPriorityGroup).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">By Priority Group</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byPriorityGroup).map(([group, count]) => (
              <span key={group} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                {group}: <span className="font-semibold">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Appointments Table */}
      {selectedTermId && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Appointments</h3>
          </div>
          <div className="overflow-x-auto">
            {isLoading && (
              <div className="p-6 text-center text-gray-500">Loading appointments...</div>
            )}

            {!isLoading && appointments && appointments.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <p>No appointments generated for this term yet.</p>
                <p className="mt-1 text-sm">Click "Generate Appointments" to create registration time tickets.</p>
              </div>
            )}

            {!isLoading && appointments && appointments.length > 0 && (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Group</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Appointment Window</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Credits</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {appointments.map((appt) => (
                    <tr key={appt.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {appt.student?.firstName} {appt.student?.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{appt.student?.studentId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-semibold text-sm">
                          {appt.effectivePriorityLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {appt.priorityGroup?.name ?? "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDateTime(appt.appointmentStart)}
                        {appt.appointmentEnd && (
                          <span className="text-gray-500"> — {formatDateTime(appt.appointmentEnd)}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {appt.creditsEarnedAtGeneration ?? "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {appt.isManualOverride ? (
                          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">Manual</span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">Auto</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!isLoading && appointments && appointments.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{appointments.length}</span> appointments
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generate Modal */}
      {showGenerateModal && selectedTermId && (
        <GenerateAppointmentsModal
          termId={selectedTermId}
          onClose={() => setShowGenerateModal(false)}
          onSuccess={() => {
            setShowGenerateModal(false);
            refetchStats();
            refetchAppointments();
          }}
        />
      )}
    </div>
  );
}

// Generate Appointments Modal
function GenerateAppointmentsModal({
  termId,
  onClose,
  onSuccess,
}: {
  termId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    registrationStartDate: "",
    registrationStartTime: "08:00",
    registrationEndDate: "",
    registrationEndTime: "17:00",
    slotDurationMinutes: 60,
    studentsPerSlot: 100,
    preserveManualOverrides: true,
  });

  const generateAppointments = trpc.registrationControl.generateAppointments.useMutation({
    onSuccess: (result) => {
      alert(`Generated ${result.generated} appointments. ${result.preserved} manual overrides preserved.`);
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const startDateTime = `${formData.registrationStartDate}T${formData.registrationStartTime}:00.000Z`;
    const endDateTime = `${formData.registrationEndDate}T${formData.registrationEndTime}:00.000Z`;

    generateAppointments.mutate({
      termId,
      registrationStartDate: startDateTime,
      registrationEndDate: endDateTime,
      slotDurationMinutes: formData.slotDurationMinutes,
      studentsPerSlot: formData.studentsPerSlot,
      preserveManualOverrides: formData.preserveManualOverrides,
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Generate Appointments</h2>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={formData.registrationStartDate}
                onChange={(e) => setFormData({ ...formData, registrationStartDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
              <input
                type="time"
                value={formData.registrationStartTime}
                onChange={(e) => setFormData({ ...formData, registrationStartTime: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={formData.registrationEndDate}
                onChange={(e) => setFormData({ ...formData, registrationEndDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
              <input
                type="time"
                value={formData.registrationEndTime}
                onChange={(e) => setFormData({ ...formData, registrationEndTime: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Slot Duration (minutes)</label>
              <input
                type="number"
                value={formData.slotDurationMinutes}
                onChange={(e) => setFormData({ ...formData, slotDurationMinutes: parseInt(e.target.value) || 60 })}
                min={15}
                max={1440}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Students per Slot</label>
              <input
                type="number"
                value={formData.studentsPerSlot}
                onChange={(e) => setFormData({ ...formData, studentsPerSlot: parseInt(e.target.value) || 100 })}
                min={1}
                max={1000}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.preserveManualOverrides}
              onChange={(e) => setFormData({ ...formData, preserveManualOverrides: e.target.checked })}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Preserve existing manual overrides</span>
          </label>

          {generateAppointments.error && (
            <div className="text-sm text-red-600">Error: {generateAppointments.error.message}</div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generateAppointments.isPending}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
            >
              {generateAppointments.isPending ? "Generating..." : "Generate Appointments"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
