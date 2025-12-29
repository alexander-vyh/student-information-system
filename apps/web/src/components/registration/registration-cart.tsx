"use client";

import { ShoppingCart, Trash2, CheckCircle, AlertCircle, XCircle } from "lucide-react";

interface CartItem {
  sectionId: string;
  courseCode: string;
  title: string;
  sectionNumber: string;
  creditHours: string;
  gradeMode: "standard" | "pass_fail" | "audit";
}

interface ValidationResult {
  canRegister: boolean;
  globalErrors: Array<{ type: string; message: string }>;
  sectionValidations: Array<{
    sectionId: string;
    courseCode?: string;
    isValid: boolean;
    errors: Array<{ type: string; message: string }>;
    warnings: Array<{ type: string; message: string }>;
  }>;
}

interface RegistrationCartProps {
  cart: CartItem[];
  totalCredits: number;
  validation?: ValidationResult;
  validating: boolean;
  onRemove: (sectionId: string) => void;
  onUpdateGradeMode: (
    sectionId: string,
    gradeMode: "standard" | "pass_fail" | "audit"
  ) => void;
  onRegister: () => void;
  isRegistering: boolean;
}

export function RegistrationCart({
  cart,
  totalCredits,
  validation,
  validating,
  onRemove,
  onUpdateGradeMode,
  onRegister,
  isRegistering,
}: RegistrationCartProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 bg-blue-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-medium text-gray-900">
              Registration Cart
            </h2>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
              {cart.length} {cart.length === 1 ? "section" : "sections"}
            </span>
          </div>
          <div className="text-sm font-medium text-gray-700">
            {totalCredits.toFixed(1)} Total Credits
          </div>
        </div>
      </div>

      {/* Global Errors */}
      {validation?.globalErrors && validation.globalErrors.length > 0 && (
        <div className="border-b border-gray-200 bg-red-50 px-6 py-4">
          <div className="flex gap-3">
            <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">
                Registration Blocked
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-red-700">
                {validation.globalErrors.map((error, idx) => (
                  <li key={idx}>• {error.message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-200">
        {cart.map((item) => {
          const sectionValidation = validation?.sectionValidations.find(
            (v) => v.sectionId === item.sectionId
          );

          return (
            <div key={item.sectionId} className="px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Course Info */}
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-base font-semibold text-gray-900">
                      {item.courseCode}
                    </h3>
                    <span className="text-sm text-gray-500">
                      Section {item.sectionNumber}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{item.title}</p>

                  {/* Grade Mode Selector */}
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-xs font-medium text-gray-700">
                      Grade Mode:
                    </label>
                    <select
                      value={item.gradeMode}
                      onChange={(e) =>
                        onUpdateGradeMode(
                          item.sectionId,
                          e.target.value as "standard" | "pass_fail" | "audit"
                        )
                      }
                      className="rounded-md border-gray-300 py-1 pl-3 pr-10 text-xs focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    >
                      <option value="standard">Letter Grade</option>
                      <option value="pass_fail">Pass/Fail</option>
                      <option value="audit">Audit</option>
                    </select>
                    <span className="text-xs text-gray-500">
                      {item.creditHours} credits
                    </span>
                  </div>

                  {/* Validation Messages */}
                  {sectionValidation && (
                    <div className="mt-3 space-y-2">
                      {/* Errors */}
                      {sectionValidation.errors.length > 0 && (
                        <div className="rounded-md bg-red-50 p-3">
                          <div className="flex gap-2">
                            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <ul className="space-y-1 text-xs text-red-700">
                                {sectionValidation.errors.map((error, idx) => (
                                  <li key={idx}>• {error.message}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Warnings */}
                      {sectionValidation.warnings.length > 0 && (
                        <div className="rounded-md bg-yellow-50 p-3">
                          <div className="flex gap-2">
                            <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <ul className="space-y-1 text-xs text-yellow-700">
                                {sectionValidation.warnings.map((warning, idx) => (
                                  <li key={idx}>• {warning.message}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Success */}
                      {sectionValidation.isValid && (
                        <div className="flex items-center gap-2 text-xs text-green-700">
                          <CheckCircle className="h-4 w-4" />
                          <span>Ready to register</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => onRemove(item.sectionId)}
                  className="ml-4 rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  title="Remove from cart"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart Footer with Register Button */}
      <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {validating ? (
              <span className="flex items-center gap-2">
                <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
                Validating...
              </span>
            ) : validation?.canRegister ? (
              <span className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-4 w-4" />
                Ready to register
              </span>
            ) : validation && !validation.canRegister ? (
              <span className="flex items-center gap-2 text-red-700">
                <XCircle className="h-4 w-4" />
                Cannot register - fix errors above
              </span>
            ) : (
              <span>Add sections to register</span>
            )}
          </div>

          <button
            onClick={onRegister}
            disabled={
              !validation?.canRegister || validating || isRegistering || cart.length === 0
            }
            className={`rounded-md px-6 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              validation?.canRegister && !validating && !isRegistering && cart.length > 0
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isRegistering ? "Registering..." : "Register Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
