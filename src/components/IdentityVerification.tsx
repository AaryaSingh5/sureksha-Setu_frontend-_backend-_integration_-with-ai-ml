/**
 * Suraksha Setu - Identity Document Verification React Component.
 *
 * Self-contained, accessible 3-step verification workflow:
 * 1. Document Upload & Preview (with live demo filename hints)
 * 2. OCR Extraction Review (confidence gauge, locked masked doc number, editable fields)
 * 3. Tourist Safety Shield decision & verified credentials badge
 */

import React, { useState, useRef, ChangeEvent, FormEvent } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  FileCheck,
  Upload,
  RefreshCw,
  AlertTriangle,
  Check,
  Lock,
  ArrowRight,
  ArrowLeft,
  X,
  FileText,
  UserCheck
} from "lucide-react";
import {
  DocumentType,
  DocumentUploadResponse,
  DocumentConfirmResponse,
  ConfirmedDocumentFields,
  uploadDocument,
  confirmDocument,
  faceExtract,
  VerificationApiError,
  getDefaultVerificationBaseUrl
} from "../lib/verificationApi";
import { FaceCapture } from "./FaceCapture";

export interface IdentityVerificationProps {
  /** Optional callback fired when verification completes with final decision */
  onVerificationComplete?: (result: DocumentConfirmResponse, extracted?: DocumentUploadResponse) => void;
  /** Optional existing tourist ID to attach to this verification */
  touristId?: string;
  /** Base URL of the verification backend API */
  apiUrl?: string;
  /** Optional custom CSS class for outer container */
  className?: string;
  /** Optional close button handler if inside a modal */
  onClose?: () => void;
}

type WizardStep = "UPLOAD" | "REVIEW" | "COMPLETED";

export const IdentityVerification: React.FC<IdentityVerificationProps> = ({
  onVerificationComplete,
  touristId,
  apiUrl = getDefaultVerificationBaseUrl(),
  className = "",
  onClose,
}) => {
  // Wizard State
  const [step, setStep] = useState<WizardStep>("UPLOAD");
  const [documentType, setDocumentType] = useState<DocumentType>("PASSPORT");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Async & Processing States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // OCR Response & Form Data
  const [uploadResult, setUploadResult] = useState<DocumentUploadResponse | null>(null);
  const [confirmedFields, setConfirmedFields] = useState<ConfirmedDocumentFields>({
    full_name: "",
    nationality: "",
    date_of_birth: "",
    expiry_date: "",
  });

  // Final Confirmation Result
  const [decisionResult, setDecisionResult] = useState<DocumentConfirmResponse | null>(null);

  // Face Capture State
  const [faceExtractDone, setFaceExtractDone] = useState(false);
  const [faceMatchSuccess, setFaceMatchSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle File Selection
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (file.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  // Handle Upload & OCR Processing
  const handleUploadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage("Please select a valid document file to upload.");
      return;
    }

    setIsLoading(true);
    setLoadingMessage("Encrypting, executing preprocessing, and running OCR extraction...");
    setErrorMessage(null);
    setFaceExtractDone(false);
    setFaceMatchSuccess(false);

    try {
      const result = await uploadDocument(
        selectedFile,
        documentType,
        touristId,
        apiUrl
      );
      setUploadResult(result);

      // Pre-fill editable fields from OCR extraction
      setConfirmedFields({
        full_name: result.extracted.full_name?.value || "",
        nationality: result.extracted.nationality?.value || "",
        date_of_birth: result.extracted.date_of_birth?.value || "",
        expiry_date: result.extracted.expiry_date?.value || "",
      });

      // If document was completely unreadable, stay on upload step with error
      if (result.status === "REUPLOAD_REQUIRED") {
        setErrorMessage(result.message);
      } else {
        // Trigger background face extract
        faceExtract(result.verification_id, apiUrl)
          .then((res) => {
            setFaceExtractDone(true);
            if (res.status === "NO_FACE_DETECTED") {
              setErrorMessage(
                "No clear portrait photo was detected in the document. Please ensure your document shows a clear face photo, or re-upload."
              );
            }
          })
          .catch(() => {
            setFaceExtractDone(true);
          });
        setStep("REVIEW");
      }
    } catch (err) {
      const apiErr = err as VerificationApiError;
      setErrorMessage(apiErr.message || "Failed to process document upload.");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  // Handle Final Confirmation
  const handleConfirmSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!uploadResult) return;

    if (!faceMatchSuccess) {
      setErrorMessage("Please complete the live face verification step before confirming.");
      return;
    }

    if (confirmedFields.date_of_birth && new Date(confirmedFields.date_of_birth) >= new Date()) {
      setErrorMessage("Date of birth cannot be in the future. Please correct your date of birth before confirming.");
      return;
    }

    if (documentType === "AADHAAR" && uploadResult.extracted.document_number.value?.includes("-")) {
      setErrorMessage("Aadhaar number format is invalid: Hyphens ('-') are not permitted in official UIDAI Aadhaar cards.");
      return;
    }

    setIsLoading(true);
    setLoadingMessage("Validating identity against Suraksha Setu security rules...");
    setErrorMessage(null);

    try {
      const result = await confirmDocument(
        {
          verification_id: uploadResult.verification_id,
          confirmed_fields: confirmedFields,
        },
        apiUrl
      );

      setDecisionResult(result);
      setStep("COMPLETED");
      if (onVerificationComplete) {
        onVerificationComplete(result, uploadResult);
      }
    } catch (err) {
      const apiErr = err as VerificationApiError;
      setErrorMessage(apiErr.message || "Failed to confirm verification details.");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  // Reset to Upload Step
  const handleReset = () => {
    setStep("UPLOAD");
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadResult(null);
    setDecisionResult(null);
    setErrorMessage(null);
    setFaceExtractDone(false);
    setFaceMatchSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Helpers for Confidence Meter
  const getConfidenceLevel = (score: number) => {
    if (score >= 0.75) return { label: "High Confidence", color: "bg-emerald-500", text: "text-emerald-400" };
    if (score >= 0.50) return { label: "Moderate (Needs Review)", color: "bg-amber-500", text: "text-amber-400" };
    return { label: "Low Quality", color: "bg-rose-500", text: "text-rose-400" };
  };

  return (
    <div
      className={`max-w-2xl mx-auto bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden font-sans text-slate-100 ${className}`}
      style={{ minHeight: "560px" }}
    >
      {/* Header & Brand Banner */}
      <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-5 sm:p-6 relative border-b border-slate-800">
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-black tracking-wide text-white">OCR Identity & Biometric Verification</h1>
              </div>
              <p className="text-xs text-slate-400">Suraksha Setu Smart Tourist Safety Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {uploadResult?.mock_mode ? "⚡ Demo OCR Engine" : "🛡️ AI Engine v1.0"}
            </span>
            {onClose && (
              <button
                onClick={onClose}
                type="button"
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Step Indicator */}
        <nav aria-label="Verification Steps" className="mt-5 flex justify-between items-center text-xs">
          {[
            { id: "UPLOAD", label: "1. Upload ID" },
            { id: "REVIEW", label: "2. Face & Fields" },
            { id: "COMPLETED", label: "3. Safety Badge" },
          ].map((s, idx) => {
            const isActive = step === s.id;
            const isDone = (s.id === "UPLOAD" && step !== "UPLOAD") || (s.id === "REVIEW" && step === "COMPLETED");
            return (
              <div key={s.id} className="flex items-center space-x-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    isDone
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                      : isActive
                      ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/40 ring-2 ring-indigo-400/40"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </span>
                <span className={`font-extrabold text-xs hidden sm:inline ${isActive ? "text-white" : isDone ? "text-emerald-400" : "text-slate-500"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </nav>
      </header>

      {/* Main Body */}
      <main className="p-5 sm:p-6">
        {/* Error Alert Box */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-5 p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-200 flex items-start space-x-3 text-xs animate-fade-in shadow-lg"
          >
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-extrabold text-rose-300">Verification Notice</p>
              <p className="text-rose-200 mt-0.5 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div
            role="status"
            aria-live="polite"
            className="my-10 text-center py-8 flex flex-col items-center justify-center space-y-3"
          >
            <div className="w-12 h-12 border-4 border-slate-700 border-t-emerald-400 rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-slate-200">{loadingMessage}</p>
            <p className="text-xs text-slate-400">Processing identity document with neural OCR & liveness model...</p>
          </div>
        )}

        {/* STEP 1: UPLOAD DOCUMENT */}
        {!isLoading && step === "UPLOAD" && (
          <form onSubmit={handleUploadSubmit} className="space-y-5">
            <div>
              <label htmlFor="document-type-select" className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-2">
                Select Document Type
              </label>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[
                  { id: "PASSPORT", label: "Passport", icon: "🛂" },
                  { id: "DRIVING_LICENCE", label: "Driving Licence", icon: "🪪" },
                  { id: "VOTER_ID", label: "Voter ID", icon: "🗳️" },
                  { id: "AADHAAR", label: "Aadhaar Card", icon: "🆔" },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setDocumentType(item.id as DocumentType)}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                      documentType === item.id
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-300 ring-2 ring-emerald-500/30 font-bold shadow-lg"
                        : "border-slate-700/80 hover:border-slate-600 bg-slate-800/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-2xl mb-1">{item.icon}</span>
                    <span className="text-xs">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-2">
                Upload Identity Document
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                  selectedFile
                    ? "border-emerald-500 bg-emerald-950/20"
                    : "border-slate-700 hover:border-emerald-500 bg-slate-800/40 hover:bg-slate-800/70"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  id="document-type-select"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {previewUrl ? (
                  <div className="flex flex-col items-center space-y-2.5">
                    <img
                      src={previewUrl}
                      alt="Document scan preview"
                      className="max-h-40 rounded-xl shadow-lg border border-slate-700 object-contain"
                    />
                    <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4" />
                      <span>{selectedFile?.name} ({(selectedFile?.size ? (selectedFile.size / 1024).toFixed(1) : 0)} KB)</span>
                    </div>
                    <span className="text-[11px] text-indigo-400 hover:underline">Click to change document file</span>
                  </div>
                ) : selectedFile ? (
                  <div className="space-y-2 py-3">
                    <FileText className="w-10 h-10 text-emerald-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-200">{selectedFile.name}</p>
                    <p className="text-[11px] text-slate-400">PDF Document Ready for OCR Scan</p>
                  </div>
                ) : (
                  <div className="space-y-2 py-5">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-200">
                      Click to browse or drag & drop document
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Supports JPEG, PNG, or PDF (up to 8MB)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Test Helper Guide for Demo Mode */}
            <div className="p-3 bg-slate-800/80 border border-slate-700/70 rounded-2xl text-[11px] text-slate-300">
              <p className="font-extrabold text-slate-200 mb-1 flex items-center gap-1.5">
                <span>💡</span> <strong>Demo Engine Filename Triggers:</strong>
              </p>
              <p className="leading-relaxed text-slate-400">
                • <code className="bg-slate-950 px-1 py-0.5 rounded text-emerald-400 font-mono">clear_passport.jpg</code> → Auto-verified (0.93 confidence)
                <br />• <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-400 font-mono">blurry_id.png</code> → Low confidence warning
                <br />• <code className="bg-slate-950 px-1 py-0.5 rounded text-rose-400 font-mono">expired_dl.jpg</code> → Expiry rule rejection
              </p>
            </div>

            <button
              type="submit"
              disabled={!selectedFile}
              className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider text-white transition-all shadow-lg flex items-center justify-center gap-2 ${
                selectedFile
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-900/30 active:scale-[0.99]"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed shadow-none border border-slate-700/50"
              }`}
            >
              <span>Scan & Extract Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2: REVIEW & CONFIRM OCR DETAILS */}
        {!isLoading && step === "REVIEW" && uploadResult && (
          <form onSubmit={handleConfirmSubmit} className="space-y-4">
            {/* Confidence & Quality Meter */}
            <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-300">OCR Scan Confidence</span>
                <span className={`font-extrabold ${getConfidenceLevel(uploadResult.confidence).text}`}>
                  {getConfidenceLevel(uploadResult.confidence).label} ({(uploadResult.confidence * 100).toFixed(0)}%)
                </span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-700">
                <div
                  className={`h-full ${getConfidenceLevel(uploadResult.confidence).color} transition-all duration-500`}
                  style={{ width: `${Math.max(10, uploadResult.confidence * 100)}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{uploadResult.message}</p>
            </div>

            {/* Read-Only Masked Document Number (Anti-Spoofing Protected) */}
            {(() => {
              const rawDocVal = uploadResult.extracted.document_number.value || "";
              const hasHyphenOrDash = /[\-\–\—\−\_\.]/.test(rawDocVal);
              const isAadhaarHyphenInvalid =
                documentType === "AADHAAR" &&
                Boolean(
                  hasHyphenOrDash ||
                  uploadResult.extracted.document_number.is_invalid ||
                  uploadResult.extracted.document_number.warning?.toLowerCase().includes("hyphen")
                );

              const isDocIdInvalid = Boolean(
                isAadhaarHyphenInvalid ||
                uploadResult.extracted.document_number.is_invalid ||
                uploadResult.extracted.document_number.status === "NOT_FOUND" ||
                !uploadResult.extracted.document_number.value
              );

              return (
                <div
                  className={`p-3 rounded-2xl border ${
                    isDocIdInvalid
                      ? "bg-rose-950/50 border-rose-700/80 text-rose-200"
                      : "bg-slate-800/60 border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Document ID (Anti-Spoofing Locked)</span>
                      </span>
                      <p className="text-sm font-mono font-black mt-0.5 text-white">
                        {uploadResult.extracted.document_number.value || "Not Detected"}
                      </p>
                    </div>
                    {isDocIdInvalid ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-900 text-rose-200 font-extrabold border border-rose-700">
                        {isAadhaarHyphenInvalid ? "INVALID FORMAT (NO HYPHENS ALLOWED)" : "INVALID FORMAT"}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                        {uploadResult.extracted.document_number.status || "VERIFIED"}
                      </span>
                    )}
                  </div>
                  {isAadhaarHyphenInvalid && (
                    <p className="text-[10px] text-rose-400 font-bold mt-1.5 pt-1.5 border-t border-rose-900/60">
                      ⚠️ Official UIDAI Aadhaar cards do not use hyphens ('-'). Aadhaar format must be 4 4 4 digits separated by spaces.
                    </p>
                  )}
                </div>
              );
            })()}


            {/* User-Editable Fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Full Legal Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={confirmedFields.full_name || ""}
                  onChange={(e) => setConfirmedFields({ ...confirmedFields, full_name: e.target.value })}
                  placeholder="e.g. Aarav Rajesh Sharma"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Nationality
                  </label>
                  <input
                    type="text"
                    value={confirmedFields.nationality || ""}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, nationality: e.target.value })}
                    placeholder="e.g. Indian"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-300">
                      Date of Birth <span className="text-red-400">*</span>
                    </label>
                    {confirmedFields.date_of_birth && new Date(confirmedFields.date_of_birth) >= new Date(new Date().setHours(0,0,0,0)) && (
                      <span className="text-[10px] text-rose-400 font-extrabold">
                        ⚠️ Must not be future date
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    required
                    max={new Date().toISOString().split("T")[0]}
                    value={confirmedFields.date_of_birth || ""}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, date_of_birth: e.target.value })}
                    className={`w-full px-3 py-2 bg-slate-800 border rounded-xl text-xs font-bold text-white focus:ring-2 outline-none ${
                      confirmedFields.date_of_birth && new Date(confirmedFields.date_of_birth) >= new Date(new Date().setHours(0,0,0,0))
                        ? "border-rose-500 focus:ring-rose-500"
                        : "border-slate-700 focus:ring-emerald-500 focus:border-emerald-500"
                    }`}
                  />
                </div>
              </div>

              {(documentType === "PASSPORT" || documentType === "DRIVING_LICENCE") && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Expiry Date (YYYY-MM-DD) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={confirmedFields.expiry_date || ""}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              )}
            </div>

            {/* Liveness Face Verification Step */}
            <div className="pt-2 border-t border-slate-800">
              {!faceExtractDone ? (
                <div className="p-4 bg-slate-800/60 text-center text-xs text-slate-400 rounded-2xl flex items-center justify-center gap-2 border border-slate-700">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Extracting face portrait from document...</span>
                </div>
              ) : (
                <FaceCapture 
                  verificationId={uploadResult.verification_id}
                  onMatchSuccess={() => {
                    setFaceMatchSuccess(true);
                    setErrorMessage(null);
                  }}
                  onMatchFailed={(err) => {
                    setFaceMatchSuccess(false);
                    setErrorMessage(err);
                  }}
                />
              )}
            </div>

            {/* 3-Tier Verification Gate Checklist */}
            {(() => {
              const rawDocVal = uploadResult.extracted.document_number.value || "";
              const hasHyphenOrDash = /[\-\–\—\−\_\.]/.test(rawDocVal);
              const isAadhaarHyphenInvalid =
                documentType === "AADHAAR" &&
                Boolean(
                  hasHyphenOrDash ||
                  uploadResult.extracted.document_number.is_invalid ||
                  uploadResult.extracted.document_number.warning?.toLowerCase().includes("hyphen")
                );

              const isDocIdInvalid = Boolean(
                isAadhaarHyphenInvalid ||
                uploadResult.extracted.document_number.is_invalid ||
                uploadResult.extracted.document_number.status === "NOT_FOUND" ||
                !uploadResult.extracted.document_number.value
              );


              const isDobInFuture = Boolean(
                confirmedFields.date_of_birth &&
                new Date(confirmedFields.date_of_birth) >= new Date(new Date().setHours(0,0,0,0))
              );

              const isDobValid = Boolean(
                confirmedFields.date_of_birth &&
                !isDobInFuture &&
                !isNaN(new Date(confirmedFields.date_of_birth).getTime())
              );

              const canConfirm = Boolean(
                !isDocIdInvalid &&
                isDobValid &&
                faceMatchSuccess &&
                confirmedFields.full_name?.trim()
              );

              return (
                <>
                  <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-700/80 space-y-2 text-xs">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Verification Requirements (All 3 Required)
                    </div>

                    {/* 1. Document Format Check */}
                    <div className="flex items-center justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-300 font-bold flex items-center gap-1.5 text-[11px]">
                        {isDocIdInvalid ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        1. Document ID Format
                      </span>
                      {isDocIdInvalid ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 font-black border border-rose-700">
                          {isAadhaarHyphenInvalid ? "INVALID (NO HYPHENS ALLOWED)" : "INVALID"}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-700">
                          VALID ✅
                        </span>
                      )}
                    </div>

                    {/* 2. Past Date of Birth Check */}
                    <div className="flex items-center justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-300 font-bold flex items-center gap-1.5 text-[11px]">
                        {isDobInFuture || !isDobValid ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        2. Date of Birth (Not in Future)
                      </span>
                      {isDobInFuture ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 font-black border border-rose-700">
                          INVALID (FUTURE DATE)
                        </span>
                      ) : isDobValid ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-700">
                          VALID PAST DATE ✅
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-bold border border-amber-700">
                          REQUIRED
                        </span>
                      )}
                    </div>

                    {/* 3. Live Face Match Check */}
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-300 font-bold flex items-center gap-1.5 text-[11px]">
                        {faceMatchSuccess ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                        )}
                        3. Live Webcam Face Match
                      </span>
                      {faceMatchSuccess ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-700">
                          MATCHED ✅
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-bold border border-amber-700">
                          PENDING MATCH
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="flex-1 py-3 px-4 rounded-xl font-bold text-xs border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Re-upload</span>
                    </button>
                    <button
                      type="submit"
                      disabled={!canConfirm}
                      className={`flex-2 py-3 px-5 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-lg transition-all flex items-center justify-center gap-1.5 ${
                        canConfirm 
                          ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-900/40 active:scale-[0.99]" 
                          : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Confirm & Verify Identity</span>
                    </button>
                  </div>
                </>
              );
            })()}
          </form>
        )}


        {/* STEP 3: OUTCOME & SAFETY DECISION BADGE */}
        {!isLoading && step === "COMPLETED" && decisionResult && (
          <div className="text-center py-5 space-y-5">
            {decisionResult.status === "VERIFIED" ? (
              <div className="space-y-4">
                <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl shadow-lg">
                  <UserCheck className="w-7 h-7" />
                </div>
                <div>
                  <span className="inline-block px-3 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black text-[10px] rounded-full uppercase tracking-wider mb-1.5">
                    Suraksha Setu Verified
                  </span>
                  <h2 className="text-xl font-black text-white">Identity Verification Successful</h2>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                    Your tourist identity has been verified via OCR and facial biometrics, and cryptographically anchored to the audit ledger.
                  </p>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 text-left max-w-md mx-auto space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-700/60">
                    <span className="text-slate-400">Tourist ID</span>
                    <span className="font-mono font-bold text-emerald-400">{decisionResult.tourist_id || touristId || "TR-PENDING"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-700/60">
                    <span className="text-slate-400">Verification Ref</span>
                    <span className="font-mono text-slate-300 text-[11px]">{decisionResult.verification_id}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Ledger Security</span>
                    <span className="font-bold text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Immutable DID Anchored
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose || handleReset}
                  className="py-2.5 px-6 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg"
                >
                  {onClose ? "Complete & Return to Portal" : "Done"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-14 h-14 bg-rose-500/20 border border-rose-500/40 text-rose-400 rounded-full flex items-center justify-center mx-auto text-2xl shadow-lg">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <div>
                  <span className="inline-block px-3 py-0.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 font-black text-[10px] rounded-full uppercase tracking-wider mb-1.5">
                    Verification Rejected
                  </span>
                  <h2 className="text-xl font-black text-white">Document Verification Incomplete</h2>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    The submitted document does not satisfy Suraksha Setu identity and validity criteria.
                  </p>
                </div>

                {decisionResult.reasons.length > 0 && (
                  <div className="bg-rose-950/40 border border-rose-800/80 rounded-2xl p-4 text-left max-w-md mx-auto space-y-1.5 text-xs text-rose-200">
                    <p className="font-bold text-rose-300 mb-1">Rejection Reasons:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      {decisionResult.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleReset}
                  className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg"
                >
                  Try Again with Clear Document
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default IdentityVerification;
