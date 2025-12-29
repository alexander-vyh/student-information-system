"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Calendar, Search, ShoppingCart, AlertCircle } from "lucide-react";
import { SectionSearchResults } from "@/components/registration/section-search-results";
import { RegistrationCart } from "@/components/registration/registration-cart";

export default function RegistrationPage() {
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [cart, setCart] = useState<
    Array<{
      sectionId: string;
      courseCode: string;
      title: string;
      sectionNumber: string;
      creditHours: string;
      gradeMode: "standard" | "pass_fail" | "audit";
    }>
  >([]);

  // Fetch student data
  const { data: student } = trpc.student.me.useQuery();

  // Fetch available terms
  const { data: terms, isLoading: termsLoading } =
    trpc.enrollment.getAvailableTerms.useQuery();

  // Fetch current schedule to show what's already registered
  const { data: currentSchedule } = trpc.enrollment.getSchedule.useQuery(
    {
      studentId: student?.id ?? "",
      termId: selectedTermId,
    },
    {
      enabled: !!student?.id && !!selectedTermId,
    }
  );

  // Search sections when term is selected
  const { data: sections, isLoading: sectionsLoading } =
    trpc.enrollment.searchAvailableSections.useQuery(
      {
        termId: selectedTermId,
        query: searchQuery || undefined,
        subjectCode: subjectFilter || undefined,
        availableOnly: true,
        limit: 50,
      },
      {
        enabled: !!selectedTermId,
      }
    );

  // Validate cart
  const { data: validation, isLoading: validating } =
    trpc.enrollment.validateRegistrationCart.useQuery(
      {
        studentId: student?.id ?? "",
        termId: selectedTermId,
        sectionIds: cart.map((c) => c.sectionId),
      },
      {
        enabled: !!student?.id && !!selectedTermId && cart.length > 0,
      }
    );

  // Register mutation
  const registerMutation = trpc.enrollment.registerForSections.useMutation({
    onSuccess: () => {
      // Clear cart on success
      setCart([]);
      alert("Successfully registered for courses!");
    },
    onError: (error) => {
      alert(`Registration failed: ${error.message}`);
    },
  });

  const handleAddToCart = (section: any) => {
    // Check if already in cart
    if (cart.some((c) => c.sectionId === section.id)) {
      alert("Section already in cart");
      return;
    }

    setCart([
      ...cart,
      {
        sectionId: section.id,
        courseCode: section.courseCode,
        title: section.title,
        sectionNumber: section.sectionNumber,
        creditHours: section.creditHours,
        gradeMode: "standard",
      },
    ]);
  };

  const handleRemoveFromCart = (sectionId: string) => {
    setCart(cart.filter((c) => c.sectionId !== sectionId));
  };

  const handleUpdateGradeMode = (
    sectionId: string,
    gradeMode: "standard" | "pass_fail" | "audit"
  ) => {
    setCart(
      cart.map((c) =>
        c.sectionId === sectionId ? { ...c, gradeMode } : c
      )
    );
  };

  const handleRegister = () => {
    if (!student?.id || !selectedTermId) return;

    registerMutation.mutate({
      studentId: student.id,
      termId: selectedTermId,
      sections: cart.map((c) => ({
        sectionId: c.sectionId,
        gradeMode: c.gradeMode,
      })),
    });
  };

  // Calculate total credits in cart
  const totalCredits = cart.reduce(
    (sum, c) => sum + parseFloat(c.creditHours),
    0
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Course Registration
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Search for courses and add them to your cart
        </p>
      </div>

      {/* Term Selection */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-gray-400" />
          <label
            htmlFor="term-select"
            className="text-sm font-medium text-gray-700"
          >
            Select Term
          </label>
        </div>

        {termsLoading ? (
          <div className="mt-3 text-sm text-gray-500">Loading terms...</div>
        ) : terms && terms.length > 0 ? (
          <select
            id="term-select"
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            className="mt-3 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:max-w-md"
          >
            <option value="">Choose a term...</option>
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name} ({term.code})
              </option>
            ))}
          </select>
        ) : (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-yellow-50 p-3">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <div className="text-sm text-yellow-700">
              No registration periods are currently open. Please check back
              later.
            </div>
          </div>
        )}
      </div>

      {/* Search and Results */}
      {selectedTermId && (
        <>
          {/* Search Controls */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-gray-400" />
              <h2 className="text-lg font-medium text-gray-900">
                Search Courses
              </h2>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="search"
                  className="block text-sm font-medium text-gray-700"
                >
                  Course Code or Title
                </label>
                <input
                  type="text"
                  id="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g., MATH 101 or Calculus"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="subject"
                  className="block text-sm font-medium text-gray-700"
                >
                  Subject (optional)
                </label>
                <input
                  type="text"
                  id="subject"
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  placeholder="e.g., MATH, CSCI"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Current Schedule */}
          {currentSchedule && currentSchedule.schedule.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="text-sm font-medium text-gray-900">
                Current Schedule ({currentSchedule.totalCredits} credits)
              </h3>
              <div className="mt-3 space-y-2">
                {currentSchedule.schedule.map((reg) => (
                  <div
                    key={reg.registrationId}
                    className="flex items-center justify-between rounded-md bg-green-50 px-3 py-2"
                  >
                    <div className="text-sm">
                      <span className="font-medium text-green-900">
                        {reg.course?.courseCode}
                      </span>{" "}
                      <span className="text-green-700">
                        {reg.course?.title}
                      </span>
                    </div>
                    <span className="text-xs text-green-600">
                      {reg.creditHours} credits
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shopping Cart */}
          {cart.length > 0 && (
            <RegistrationCart
              cart={cart}
              totalCredits={totalCredits}
              validation={validation}
              validating={validating}
              onRemove={handleRemoveFromCart}
              onUpdateGradeMode={handleUpdateGradeMode}
              onRegister={handleRegister}
              isRegistering={registerMutation.isPending}
            />
          )}

          {/* Search Results */}
          <SectionSearchResults
            sections={sections ?? []}
            isLoading={sectionsLoading}
            cart={cart}
            onAddToCart={handleAddToCart}
          />
        </>
      )}
    </div>
  );
}
