"use client";

import { trpc } from "@/trpc/client";
import { Download, FileText, CheckCircle, HelpCircle } from "lucide-react";
import { useState } from "react";
import { LoadingSpinner, Alert } from "@/components/ui";

export default function TranscriptsPage() {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showDecisionHelper, setShowDecisionHelper] = useState(false);

  // Fetch student profile
  const { data: student } = trpc.student.me.useQuery();

  // Check for transcript holds
  const { data: holdCheck, isLoading: holdsLoading } =
    trpc.transcript.checkTranscriptHolds.useQuery(
      { studentId: student?.id ?? "" },
      { enabled: !!student?.id }
    );

  // Get transcript request history
  const { data: requests } = trpc.transcript.getMyRequests.useQuery(undefined, {
    enabled: !!student?.id,
  });

  // Generate PDF mutation
  const generatePDF = trpc.transcript.generateUnofficialPDF.useMutation({
    onSuccess: (data) => {
      setGenerating(false);
      setSuccess(true);
      setError(null);

      // Convert base64 to blob and trigger download
      if (data.pdfBase64) {
        const byteCharacters = atob(data.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `unofficial-transcript-${data.metadata.studentId}-${new Date().toISOString().split("T")[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      // Reset success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000);
    },
    onError: (err) => {
      setGenerating(false);
      setError(err.message);
      setSuccess(false);
    },
  });

  const handleGenerateTranscript = async () => {
    if (!student?.id) return;

    setGenerating(true);
    setError(null);
    setSuccess(false);

    try {
      await generatePDF.mutateAsync({ studentId: student.id });
    } catch (err) {
      // Error handled by onError callback
    }
  };

  if (!student) {
    return <LoadingSpinner size="md" text="Loading..." centered minHeight="min-h-96" />;
  }

  const hasBlockingHolds = holdCheck?.hasBlockingHolds ?? false;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-blue-600" aria-hidden="true" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Academic Transcripts
            </h1>
            <p className="mt-1 text-gray-600">
              Request and download your official and unofficial transcripts
            </p>
          </div>
        </div>
      </div>

      {/* Decision Helper */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <button
          onClick={() => setShowDecisionHelper(!showDecisionHelper)}
          className="flex items-center gap-2 text-blue-900 font-medium hover:text-blue-700 transition-colors w-full text-left"
          aria-expanded={showDecisionHelper}
        >
          <HelpCircle className="h-5 w-5" aria-hidden="true" />
          <span>Which transcript do I need?</span>
          <span className="ml-auto text-2xl" aria-hidden="true">
            {showDecisionHelper ? "−" : "+"}
          </span>
        </button>

        {showDecisionHelper && (
          <div className="mt-4 space-y-4 text-sm text-blue-900">
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <h4 className="font-semibold mb-2">✓ Choose Unofficial if you need:</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>A quick copy for personal reference</li>
                <li>To check your GPA or degree progress</li>
                <li>An informal copy to share with advisors</li>
                <li>A preview before ordering official copies</li>
              </ul>
              <p className="mt-2 text-blue-700 italic">
                Unofficial transcripts are free, instant, and watermarked.
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <h4 className="font-semibold mb-2">✓ Choose Official if you need:</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>To apply to graduate school or professional programs</li>
                <li>To submit to employers for verification</li>
                <li>To transfer credits to another institution</li>
                <li>For professional licensing or certification</li>
              </ul>
              <p className="mt-2 text-blue-700 italic">
                Official transcripts are sealed, verified, and accepted by institutions ($10-$15).
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="font-medium text-yellow-900">
                💡 Pro tip: Download an unofficial copy first to review before ordering official transcripts.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Blocking Holds Warning */}
      {hasBlockingHolds && (
        <Alert variant="error" title="Transcript Hold Active">
          <p className="mb-2">
            You have {holdCheck?.holds.length} hold(s) blocking official
            transcript requests:
          </p>
          <ul className="list-disc list-inside space-y-1">
            {holdCheck?.holds.map((hold) => (
              <li key={hold.holdId}>
                <strong>{hold.holdName}</strong>
                {hold.resolutionInstructions && (
                  <span className="block ml-5">
                    {hold.resolutionInstructions}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Unofficial transcripts are still available for download.
          </p>
        </Alert>
      )}

      {/* Success Message */}
      {success && (
        <Alert variant="success" title="Transcript Generated Successfully">
          <p>
            Your unofficial transcript has been generated. Check your
            downloads folder.
          </p>
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert variant="error" title="Error Generating Transcript">
          <p>{error}</p>
        </Alert>
      )}

      {/* Unofficial Transcript Card */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">
                Unofficial Transcript
              </h2>
              <div className="mt-3 bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                <p className="text-sm font-medium text-yellow-800">
                  ⚠️ <strong>NOT ACCEPTED</strong> by employers, graduate schools, or other institutions
                </p>
                <p className="mt-1 text-xs text-yellow-700">
                  This watermarked copy is for personal reference only. For official verification, request an official transcript below.
                </p>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Download an unofficial copy of your academic transcript for
                personal use, advising appointments, or to preview your records before ordering official copies.
              </p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" aria-hidden="true" />
                  Free and instant download
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" aria-hidden="true" />
                  Includes all completed coursework
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" aria-hidden="true" />
                  Shows current GPA and credits earned
                </div>
              </div>
            </div>
            <div className="ml-6">
              <button
                onClick={handleGenerateTranscript}
                disabled={generating}
                aria-label={generating ? "Generating unofficial transcript PDF" : "Download unofficial transcript PDF"}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" aria-hidden="true"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                    Download PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Official Transcript Card */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">
                Official Transcript
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Request an official transcript to be sent to employers,
                graduate schools, or other institutions. Official transcripts
                are sealed and include institutional verification.
              </p>

              {/* Pricing Table */}
              <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Pricing</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Electronic delivery (PDF)</span>
                    <span className="font-medium text-gray-900">$10.00</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Mailed delivery (sealed)</span>
                    <span className="font-medium text-gray-900">$15.00</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-gray-300 pt-2">
                    <span className="text-gray-600">Rush processing (1 business day)</span>
                    <span className="font-medium text-orange-600">+$20.00</span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  Standard processing: 2-3 business days
                </p>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 mr-2 text-blue-500" aria-hidden="true" />
                  Electronic or mailed delivery
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 mr-2 text-blue-500" aria-hidden="true" />
                  Digitally signed and verified
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 mr-2 text-blue-500" aria-hidden="true" />
                  Accepted by all institutions
                </div>
              </div>
            </div>
            <div className="ml-6">
              <button
                disabled={hasBlockingHolds}
                aria-label="Request official transcript"
                aria-describedby={hasBlockingHolds ? "hold-warning" : undefined}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="h-4 w-4 mr-2" aria-hidden="true" />
                Request Official
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Request History */}
      {requests && requests.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Request History
            </h2>
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Delivery
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(request.requestedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {request.transcriptType === "official"
                          ? "Official"
                          : "Unofficial"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            request.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : request.status === "hold_blocked"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {request.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {request.deliveryMethod}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Information Box */}
      <Alert variant="info" title="Important Information">
        <ul className="space-y-1 list-disc list-inside">
          <li>
            Unofficial transcripts are watermarked and not accepted by most
            institutions
          </li>
          <li>
            Official transcript requests are processed within 2-3 business days
          </li>
          <li>
            Rush processing is available for an additional $20 fee (1 business
            day)
          </li>
          <li>
            Transcripts show all coursework, including withdrawals and repeated
            courses
          </li>
          <li>
            Contact the Registrar's Office at registrar@university.edu for
            questions
          </li>
        </ul>
      </Alert>
    </div>
  );
}
