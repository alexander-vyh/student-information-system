"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";

type ActiveTab = "programs" | "categories" | "student-audit";

export default function DegreeAuditPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("programs");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Degree Audit
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage program requirements and run student degree audits
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("programs")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "programs"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Program Requirements
            </button>
            <button
              onClick={() => setActiveTab("categories")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "categories"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Requirement Categories
            </button>
            <button
              onClick={() => setActiveTab("student-audit")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "student-audit"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Run Student Audit
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "programs" && <ProgramRequirementsPanel />}
        {activeTab === "categories" && <CategoriesPanel />}
        {activeTab === "student-audit" && <StudentAuditPanel />}
      </main>
    </div>
  );
}

// =============================================================================
// PROGRAM REQUIREMENTS PANEL
// =============================================================================

function ProgramRequirementsPanel() {
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<any | null>(null);

  const { data: programs, isLoading: programsLoading } = trpc.degreeAudit.getPrograms.useQuery();
  const { data: catalogYears } = trpc.degreeAudit.getCatalogYears.useQuery();
  const { data: categories } = trpc.degreeAudit.getCategories.useQuery();

  const { data: requirements, isLoading: requirementsLoading, refetch: refetchRequirements } =
    trpc.degreeAudit.getProgramRequirements.useQuery(
      { programId: selectedProgramId! },
      { enabled: !!selectedProgramId }
    );

  const createRequirement = trpc.degreeAudit.createRequirement.useMutation({
    onSuccess: () => {
      refetchRequirements();
      setShowAddModal(false);
    },
  });

  const updateRequirement = trpc.degreeAudit.updateRequirement.useMutation({
    onSuccess: () => {
      refetchRequirements();
      setEditingRequirement(null);
    },
  });

  const selectedProgram = programs?.find(p => p.id === selectedProgramId);

  return (
    <div className="space-y-6">
      {/* Program Selector */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Program</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
            <select
              value={selectedProgramId || ""}
              onChange={(e) => setSelectedProgramId(e.target.value || null)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Select a program...</option>
              {programs?.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.code} - {program.name}
                </option>
              ))}
            </select>
          </div>
          {selectedProgram && (
            <div className="flex items-end">
              <div className="text-sm text-gray-500">
                <span className="font-medium">Total Credits:</span>{" "}
                {selectedProgram.totalCredits || "Not set"} |{" "}
                <span className="font-medium">Degree:</span>{" "}
                {selectedProgram.degreeType || "N/A"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Requirements List */}
      {selectedProgramId && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Program Requirements
              </h2>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
              >
                Add Requirement
              </button>
            </div>

            {requirementsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading requirements...</div>
            ) : requirements?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No requirements defined for this program yet.
              </div>
            ) : (
              <div className="space-y-4">
                {requirements?.map((req) => (
                  <div
                    key={req.id}
                    className="border rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-md font-medium text-gray-900">{req.name}</h3>
                        {req.categoryName && (
                          <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                            {req.categoryName}
                          </span>
                        )}
                        {req.description && (
                          <p className="mt-1 text-sm text-gray-500">{req.description}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                          {req.minimumCredits && (
                            <span>Min Credits: {req.minimumCredits}</span>
                          )}
                          {req.minimumCourses && (
                            <span>Min Courses: {req.minimumCourses}</span>
                          )}
                          {req.minimumGpa && (
                            <span>Min GPA: {req.minimumGpa}</span>
                          )}
                          {req.allowSharing && (
                            <span className="text-green-600">Sharing allowed</span>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingRequirement(req)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    {/* Required Courses */}
                    {req.courses.length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-sm font-medium text-gray-700">Required Courses:</h4>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {req.courses.map((course) => (
                            <span
                              key={course.courseId}
                              className={`text-xs px-2 py-1 rounded ${
                                course.isRequired
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {course.courseCode}
                              {course.minimumGrade && ` (min: ${course.minimumGrade})`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Course Groups */}
                    {req.courseGroups.length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-sm font-medium text-gray-700">Course Groups:</h4>
                        <div className="mt-1 space-y-2">
                          {req.courseGroups.map((group) => (
                            <div key={group.id} className="text-sm bg-gray-50 p-2 rounded">
                              <span className="font-medium">{group.name}</span>
                              {group.minimumCourses && (
                                <span className="text-gray-500 ml-2">
                                  (min {group.minimumCourses} courses)
                                </span>
                              )}
                              {group.minimumCredits && (
                                <span className="text-gray-500 ml-2">
                                  (min {group.minimumCredits} credits)
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Requirement Modal */}
      {(showAddModal || editingRequirement) && (
        <RequirementModal
          programId={selectedProgramId!}
          requirement={editingRequirement}
          categories={categories || []}
          onClose={() => {
            setShowAddModal(false);
            setEditingRequirement(null);
          }}
          onSave={(data) => {
            if (editingRequirement) {
              updateRequirement.mutate({ id: editingRequirement.id, ...data });
            } else {
              createRequirement.mutate({ programId: selectedProgramId!, ...data });
            }
          }}
          isLoading={createRequirement.isPending || updateRequirement.isPending}
        />
      )}
    </div>
  );
}

// =============================================================================
// REQUIREMENT MODAL
// =============================================================================

interface RequirementModalProps {
  programId: string;
  requirement: any | null;
  categories: Array<{ id: string; code: string; name: string }>;
  onClose: () => void;
  onSave: (data: any) => void;
  isLoading: boolean;
}

function RequirementModal({
  programId,
  requirement,
  categories,
  onClose,
  onSave,
  isLoading,
}: RequirementModalProps) {
  const [formData, setFormData] = useState({
    name: requirement?.name || "",
    description: requirement?.description || "",
    categoryId: requirement?.categoryId || "",
    minimumCredits: requirement?.minimumCredits?.toString() || "",
    maximumCredits: requirement?.maximumCredits?.toString() || "",
    minimumCourses: requirement?.minimumCourses?.toString() || "",
    minimumGpa: requirement?.minimumGpa?.toString() || "",
    allowSharing: requirement?.allowSharing || false,
    displayOrder: requirement?.displayOrder?.toString() || "0",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: formData.name,
      description: formData.description || undefined,
      categoryId: formData.categoryId || undefined,
      minimumCredits: formData.minimumCredits ? parseFloat(formData.minimumCredits) : undefined,
      maximumCredits: formData.maximumCredits ? parseFloat(formData.maximumCredits) : undefined,
      minimumCourses: formData.minimumCourses ? parseInt(formData.minimumCourses) : undefined,
      minimumGpa: formData.minimumGpa ? parseFloat(formData.minimumGpa) : undefined,
      allowSharing: formData.allowSharing,
      displayOrder: parseInt(formData.displayOrder) || 0,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {requirement ? "Edit Requirement" : "Add Requirement"}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">No category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Credits
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.minimumCredits}
                  onChange={(e) => setFormData({ ...formData, minimumCredits: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Credits
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.maximumCredits}
                  onChange={(e) => setFormData({ ...formData, maximumCredits: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Courses
                </label>
                <input
                  type="number"
                  value={formData.minimumCourses}
                  onChange={(e) => setFormData({ ...formData, minimumCourses: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min GPA
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max="4"
                  value={formData.minimumGpa}
                  onChange={(e) => setFormData({ ...formData, minimumGpa: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center pt-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.allowSharing}
                    onChange={(e) => setFormData({ ...formData, allowSharing: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Allow course sharing</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// CATEGORIES PANEL
// =============================================================================

function CategoriesPanel() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);

  const { data: categories, isLoading, refetch } = trpc.degreeAudit.getCategories.useQuery();

  const createCategory = trpc.degreeAudit.createCategory.useMutation({
    onSuccess: () => {
      refetch();
      setShowAddModal(false);
    },
  });

  const updateCategory = trpc.degreeAudit.updateCategory.useMutation({
    onSuccess: () => {
      refetch();
      setEditingCategory(null);
    },
  });

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Requirement Categories
          </h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
          >
            Add Category
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Categories group requirements by type (e.g., Core, General Education, Major, Electives)
        </p>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : categories?.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No categories defined yet. Add a category to get started.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {categories?.map((category) => (
                <tr key={category.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {category.code}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{category.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {category.description || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {category.displayOrder}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <button
                      onClick={() => setEditingCategory(category)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Category Modal */}
      {(showAddModal || editingCategory) && (
        <CategoryModal
          category={editingCategory}
          onClose={() => {
            setShowAddModal(false);
            setEditingCategory(null);
          }}
          onSave={(data) => {
            if (editingCategory) {
              updateCategory.mutate({ id: editingCategory.id, ...data });
            } else {
              createCategory.mutate(data);
            }
          }}
          isLoading={createCategory.isPending || updateCategory.isPending}
        />
      )}
    </div>
  );
}

// =============================================================================
// CATEGORY MODAL
// =============================================================================

interface CategoryModalProps {
  category: any | null;
  onClose: () => void;
  onSave: (data: any) => void;
  isLoading: boolean;
}

function CategoryModal({ category, onClose, onSave, isLoading }: CategoryModalProps) {
  const [formData, setFormData] = useState({
    code: category?.code || "",
    name: category?.name || "",
    description: category?.description || "",
    displayOrder: category?.displayOrder?.toString() || "0",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      code: formData.code,
      name: formData.name,
      description: formData.description || undefined,
      displayOrder: parseInt(formData.displayOrder) || 0,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {category ? "Edit Category" : "Add Category"}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code *
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="e.g., GEN_ED"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="e.g., General Education"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Order
              </label>
              <input
                type="number"
                value={formData.displayOrder}
                onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// STUDENT AUDIT PANEL
// =============================================================================

function StudentAuditPanel() {
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [selectedStudentProgramId, setSelectedStudentProgramId] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<any | null>(null);

  // Search students
  const { data: searchResults, isLoading: isSearching } = trpc.student.search.useQuery(
    { query: studentSearchQuery, limit: 10 },
    { enabled: studentSearchQuery.length >= 2 }
  );

  // Get student details when selected
  const { data: studentDetails } = trpc.student.getWithDetails.useQuery(
    { studentId: selectedStudent?.id },
    { enabled: !!selectedStudent }
  );

  // Run audit mutation
  const runAudit = trpc.degreeAudit.runAudit.useMutation({
    onSuccess: (result) => {
      setAuditResult(result);
    },
  });

  const handleRunAudit = () => {
    if (!selectedStudent || !selectedStudentProgramId) return;
    runAudit.mutate({
      studentId: selectedStudent.id,
      studentProgramId: selectedStudentProgramId,
      includeInProgress: true,
      saveResult: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Student Search */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Find Student</h2>

        <div className="max-w-md">
          <input
            type="text"
            value={studentSearchQuery}
            onChange={(e) => {
              setStudentSearchQuery(e.target.value);
              setSelectedStudent(null);
              setAuditResult(null);
            }}
            placeholder="Search by name, email, or student ID..."
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        {/* Search Results */}
        {isSearching && (
          <p className="mt-2 text-sm text-gray-500">Searching...</p>
        )}

        {searchResults && searchResults.students.length > 0 && !selectedStudent && (
          <div className="mt-4 border rounded-md divide-y">
            {searchResults.students.map((student) => (
              <button
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 flex justify-between items-center"
              >
                <div>
                  <span className="font-medium text-gray-900">
                    {student.preferredFirstName || student.legalFirstName} {student.legalLastName}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">{student.studentId}</span>
                </div>
                <span className="text-sm text-gray-400">{student.primaryEmail}</span>
              </button>
            ))}
          </div>
        )}

        {searchResults?.students.length === 0 && studentSearchQuery.length >= 2 && (
          <p className="mt-2 text-sm text-gray-500">No students found.</p>
        )}
      </div>

      {/* Selected Student & Program Selection */}
      {selectedStudent && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedStudent.preferredFirstName || selectedStudent.legalFirstName}{" "}
                {selectedStudent.legalLastName}
              </h2>
              <p className="text-sm text-gray-500">
                Student ID: {selectedStudent.studentId} | {selectedStudent.primaryEmail}
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedStudent(null);
                setSelectedStudentProgramId(null);
                setAuditResult(null);
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Change Student
            </button>
          </div>

          {/* GPA Summary */}
          {studentDetails?.gpaSummary && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Current Standing</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Cumulative GPA:</span>{" "}
                  <span className="font-medium">{studentDetails.gpaSummary.cumulativeGpa || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-500">Credits Earned:</span>{" "}
                  <span className="font-medium">{studentDetails.gpaSummary.cumulativeEarnedCredits || 0}</span>
                </div>
                <div>
                  <span className="text-gray-500">In Progress:</span>{" "}
                  <span className="font-medium">{studentDetails.gpaSummary.inProgressCredits || 0}</span>
                </div>
                <div>
                  <span className="text-gray-500">Transfer:</span>{" "}
                  <span className="font-medium">{studentDetails.gpaSummary.transferCredits || 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Program Selection - Placeholder since we need studentPrograms query */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Program to Audit
            </label>
            <p className="text-sm text-gray-500 mb-2">
              Enter Student Program ID (from student programs table)
            </p>
            <input
              type="text"
              value={selectedStudentProgramId || ""}
              onChange={(e) => setSelectedStudentProgramId(e.target.value || null)}
              placeholder="Student Program UUID..."
              className="w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleRunAudit}
            disabled={!selectedStudentProgramId || runAudit.isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {runAudit.isPending ? "Running Audit..." : "Run Degree Audit"}
          </button>
        </div>
      )}

      {/* Audit Results */}
      {auditResult && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Audit Results</h2>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-700">
                {auditResult.completionPercentage.toFixed(1)}%
              </div>
              <div className="text-sm text-blue-600">Complete</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-700">
                {auditResult.totalCreditsEarned}
              </div>
              <div className="text-sm text-green-600">Credits Earned</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-700">
                {auditResult.totalCreditsInProgress}
              </div>
              <div className="text-sm text-yellow-600">In Progress</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-gray-700">
                {auditResult.totalCreditsRequired - auditResult.totalCreditsEarned}
              </div>
              <div className="text-sm text-gray-600">Remaining</div>
            </div>
          </div>

          {/* Overall Status */}
          <div className="mb-6">
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                auditResult.status === "complete"
                  ? "bg-green-100 text-green-800"
                  : auditResult.status === "in_progress"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {auditResult.status === "complete"
                ? "All Requirements Complete"
                : auditResult.status === "in_progress"
                ? "In Progress"
                : "Incomplete"}
            </span>
          </div>

          {/* Requirements Breakdown */}
          <h3 className="text-md font-medium text-gray-900 mb-3">Requirements Status</h3>
          <div className="space-y-3">
            {auditResult.requirements.map((req: any) => (
              <div
                key={req.requirementId}
                className={`border rounded-lg p-4 ${
                  req.status === "complete"
                    ? "border-green-200 bg-green-50"
                    : req.status === "in_progress"
                    ? "border-yellow-200 bg-yellow-50"
                    : "border-gray-200"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900">{req.requirementName}</h4>
                    {req.categoryName && (
                      <span className="text-xs text-gray-500">{req.categoryName}</span>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      req.status === "complete"
                        ? "bg-green-200 text-green-800"
                        : req.status === "in_progress"
                        ? "bg-yellow-200 text-yellow-800"
                        : req.status === "not_started"
                        ? "bg-gray-200 text-gray-800"
                        : "bg-red-200 text-red-800"
                    }`}
                  >
                    {req.status.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  Credits: {req.creditsEarned}/{req.creditsRequired} |
                  Courses: {req.coursesCompleted}/{req.coursesRequired}
                  {req.creditsInProgress > 0 && ` (+${req.creditsInProgress} in progress)`}
                </div>
                {req.appliedCourses.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-gray-500">Applied: </span>
                    <span className="text-xs text-gray-700">
                      {req.appliedCourses.map((c: any) => c.courseCode).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Messages */}
          {auditResult.messages?.length > 0 && (
            <div className="mt-6">
              <h3 className="text-md font-medium text-gray-900 mb-3">Messages</h3>
              <div className="space-y-2">
                {auditResult.messages.map((msg: any, idx: number) => (
                  <div
                    key={idx}
                    className={`text-sm p-2 rounded ${
                      msg.type === "error"
                        ? "bg-red-50 text-red-700"
                        : msg.type === "warning"
                        ? "bg-yellow-50 text-yellow-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {msg.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
