"use client";

import { Plus, Calendar, Users, Clock, MapPin } from "lucide-react";

interface Section {
  id: string;
  courseCode: string;
  title: string;
  subjectCode: string;
  sectionNumber: string;
  crn: string;
  creditHours: string;
  instructionalMethod: string;
  maxEnrollment: number;
  currentEnrollment: number;
  availableSeats: number;
  hasWaitlist: boolean;
  waitlistAvailable: number;
  status: string;
}

interface SectionSearchResultsProps {
  sections: Section[];
  isLoading: boolean;
  cart: Array<{ sectionId: string }>;
  onAddToCart: (section: Section) => void;
}

export function SectionSearchResults({
  sections,
  isLoading,
  cart,
  onAddToCart,
}: SectionSearchResultsProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600">Searching sections...</p>
        </div>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12">
        <div className="text-center text-gray-500">
          <Calendar className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-sm font-medium text-gray-900">
            No sections found
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Try adjusting your search criteria
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-medium text-gray-900">
          Available Sections ({sections.length})
        </h2>
      </div>

      <div className="divide-y divide-gray-200">
        {sections.map((section) => {
          const isInCart = cart.some((c) => c.sectionId === section.id);

          return (
            <div
              key={section.id}
              className="px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Course Title */}
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-base font-semibold text-gray-900">
                      {section.courseCode}
                    </h3>
                    <span className="text-sm text-gray-500">
                      Section {section.sectionNumber}
                    </span>
                    <span className="text-xs text-gray-400">
                      CRN: {section.crn}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-gray-700">{section.title}</p>

                  {/* Section Details */}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {section.creditHours} credits
                    </div>

                    <div className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {section.instructionalMethod === "in_person" && "In Person"}
                      {section.instructionalMethod === "online" && "Online"}
                      {section.instructionalMethod === "hybrid" && "Hybrid"}
                      {section.instructionalMethod === "hyflex" && "HyFlex"}
                    </div>

                    <div className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {section.availableSeats} of {section.maxEnrollment} seats
                      available
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="mt-2">
                    {section.status === "open" && (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        Open
                      </span>
                    )}
                    {section.status === "waitlist" && (
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                        Waitlist Available ({section.waitlistAvailable} spots)
                      </span>
                    )}
                    {section.status === "closed" && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                        Closed
                      </span>
                    )}
                  </div>
                </div>

                {/* Add to Cart Button */}
                <div className="ml-4">
                  {isInCart ? (
                    <button
                      disabled
                      className="flex items-center gap-2 rounded-md border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
                    >
                      In Cart
                    </button>
                  ) : section.status === "closed" ? (
                    <button
                      disabled
                      className="flex items-center gap-2 rounded-md border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
                    >
                      Closed
                    </button>
                  ) : (
                    <button
                      onClick={() => onAddToCart(section)}
                      className="flex items-center gap-2 rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
