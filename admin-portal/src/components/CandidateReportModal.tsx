"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  X,
  Printer,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ShieldCheck,
  FileText,
  MessageSquare,
  User,
  Calendar,
  Sparkles,
  BarChart3,
  ShieldAlert,
  ChevronRight,
  Send,
  HelpCircle,
  Camera,
  Maximize2,
  FileSpreadsheet,
  RotateCcw,
  Check,
  Building2,
  Sliders,
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";

interface SectionData {
  sectionOrder: number;
  name: string;
  questionRange: string;
  score: number;
  totalMarks: number;
  percentage: number;
}

interface QuestionResponse {
  questionOrder: number;
  sectionName: string;
  questionText: string;
  candidateOption: string | null;
  correctOption: string;
  isCorrect: boolean;
  marks: number;
}

interface ReportData {
  success: boolean;
  candidate: {
    id: string;
    name: string;
    email: string;
    phone: string;
    applicationId: string;
    crmCandidateId: string | null;
    status: string;
  };
  assessment: {
    id: string;
    title: string;
    slug: string;
    durationMins: number;
    passingPercentage: number;
  };
  result: {
    status: "QUALIFIED" | "NOT QUALIFIED" | "LOCKED" | "DISQUALIFIED";
    isPassed: boolean;
    score: number;
    totalMarks: number;
    percentage: number;
  };
  timing: {
    startedAt: string;
    submittedAt: string;
    durationSeconds: number;
    durationFormatted: string;
  };
  sections: SectionData[];
  responses: QuestionResponse[];
  proctoring: {
    warningCount: number;
    maxWarnings: number;
    lockReason?: string;
    events: Array<{ id: string; eventType: string; details?: string; timestamp: string }>;
  };
  screenshots?: Array<{
    id: string;
    type: string;
    eventType: string;
    imageUrl: string;
    capturedAt: string;
  }>;
  remarks: Array<{ id: string; adminId: string; action: string; reason?: string; createdAt: string }>;
}

interface CandidateReportModalProps {
  isOpen: boolean;
  candidateId: string | null;
  onClose: () => void;
  onRefresh?: () => void;
  onResetCandidate?: (candidateId: string, name: string) => void;
}

export default function CandidateReportModal({
  isOpen,
  candidateId,
  onClose,
  onRefresh,
  onResetCandidate,
}: CandidateReportModalProps) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "responses" | "proctoring" | "screenshots" | "remarks">(
    "overview"
  );
  const [newRemark, setNewRemark] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && candidateId) {
      fetchReport(candidateId);
      setActiveTab("overview");
    } else {
      setReport(null);
      setError("");
    }
  }, [isOpen, candidateId]);

  const fetchReport = async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("banca_admin_token") || "";
      const res = await fetch(`${baseUrl}/api/v1/candidates/${id}/report`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setReport(data);
      } else {
        setError(data.message || "Failed to load candidate report.");
      }
    } catch {
      setError("Network error loading candidate report.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRemark = async () => {
    if (!newRemark.trim() || !candidateId) return;
    setSavingRemark(true);
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("banca_admin_token") || "";
      const userStr = localStorage.getItem("banca_admin_user");
      const user = userStr ? JSON.parse(userStr) : {};

      const res = await fetch(`${baseUrl}/api/v1/candidates/${candidateId}/remarks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          adminId: user.username || user.name || "HR Admin",
          remark: newRemark.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNewRemark("");
        fetchReport(candidateId);
      }
    } catch {
      /* silent */
    } finally {
      setSavingRemark(false);
    }
  };

  const handleDownloadSingleExcel = async (id: string) => {
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("banca_admin_token") || "";
      const res = await fetch(`${baseUrl}/api/v1/candidates/${id}/export-excel`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        alert("Failed to download individual scorecard.");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Candidate_Scorecard_${report?.candidate?.name || id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error downloading scorecard file.");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 print:p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-50 rounded-3xl shadow-2xl border border-slate-200/80 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* ── Top Modal Bar ── */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-200/80 flex items-center justify-between shadow-2xs z-20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xs shadow-sm">
              NB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 tracking-tight">Candidate Diagnostic Scorecard</h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">
                  Official Record
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Niva Bupa Assessment & AI Proctoring System</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {report && (
              <>
                <button
                  onClick={() => handleDownloadSingleExcel(report.candidate.id)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Download Individual Excel Report"
                >
                  <FileSpreadsheet size={14} />
                  <span className="hidden sm:inline">Excel Report</span>
                </button>

                {onResetCandidate && (
                  <button
                    onClick={() => {
                      onResetCandidate(report.candidate.id, report.candidate.name);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Reset Candidate Attempt & Resend Invitation"
                  >
                    <RotateCcw size={14} className="text-amber-600" />
                    <span className="hidden sm:inline">Reset & Retake</span>
                  </button>
                )}

                <button
                  onClick={() => window.print()}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer print:hidden"
                  title="Print Report"
                >
                  <Printer size={15} />
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 transition cursor-pointer"
              title="Close Modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Main Content Area ── */}
        {loading ? (
          <div className="py-28 text-center bg-white flex-1 flex flex-col items-center justify-center">
            <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-extrabold text-slate-900">Calculating Candidate Diagnostic Report...</p>
            <p className="text-xs text-slate-400 mt-1">Reconstructing 6-Section Performance & Security Audit</p>
          </div>
        ) : error || !report ? (
          <div className="p-16 text-center bg-white flex-1 flex flex-col items-center justify-center">
            <XCircle className="w-12 h-12 text-rose-500 mb-3" />
            <h4 className="text-base font-extrabold text-slate-900">Report Unavailable</h4>
            <p className="text-xs text-slate-500 mt-1">{error || "Candidate report record not found."}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* ── Top Candidate Hero Banner ── */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl p-5 sm:p-6 shadow-md relative overflow-hidden border border-slate-700/50">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
                {/* Candidate Information */}
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] font-black uppercase tracking-wider">
                    <User className="w-3 h-3" />
                    Application ID: {report.candidate.applicationId}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">{report.candidate.name}</h2>
                  <p className="text-xs text-slate-300 font-medium">
                    {report.candidate.email} • {report.candidate.phone}
                  </p>
                  <p className="text-xs text-slate-400 font-medium">
                    Exam Session: <strong className="text-white font-bold">{report.assessment.title}</strong>
                  </p>
                </div>

                {/* Score & KPI Overview Cards */}
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15 shadow-inner">
                  {/* Score Marks */}
                  <div className="text-center px-3">
                    <span className="block text-[10px] font-extrabold text-slate-300 uppercase tracking-wider">
                      Score Marks
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-white font-mono mt-0.5">
                      {report.result.score}{" "}
                      <span className="text-xs font-semibold text-slate-300 font-sans">
                        / {report.result.totalMarks}
                      </span>
                    </div>
                  </div>

                  <div className="h-8 w-px bg-white/20" />

                  {/* Percentage */}
                  <div className="text-center px-3">
                    <span className="block text-[10px] font-extrabold text-slate-300 uppercase tracking-wider">
                      Percentage
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-cyan-300 font-mono mt-0.5">
                      {report.result.percentage}%
                    </div>
                  </div>

                  <div className="h-8 w-px bg-white/20" />

                  {/* Exam Status */}
                  <div className="text-center px-3">
                    <span className="block text-[10px] font-extrabold text-slate-300 uppercase tracking-wider">
                      Exam Status
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      COMPLETED
                    </span>
                  </div>
                </div>
              </div>

              {/* Timing & Security Specs Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/10 text-xs text-slate-300 font-semibold">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>
                    Started:{" "}
                    <strong className="text-white">
                      {new Date(report.timing.startedAt).toLocaleDateString()}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>
                    Duration: <strong className="text-white">{report.timing.durationFormatted}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>
                    Warnings:{" "}
                    <strong className="text-white">
                      {report.proctoring.warningCount} / {report.proctoring.maxWarnings || 6}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>
                    Exam Format: <strong className="text-white">60 Qs (45 Mins)</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* ── Navigation Pill Tabs ── */}
            <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-1.5 print:hidden overflow-x-auto">
              {[
                { id: "overview", label: "6-Section Diagnostics", icon: BarChart3 },
                { id: "responses", label: `Question Responses (${report.responses.length})`, icon: FileText },
                { id: "proctoring", label: `Proctoring Audit (${report.proctoring.events.length})`, icon: ShieldAlert },
                { id: "screenshots", label: `Camera Screenshots (${report.screenshots?.length || 0})`, icon: Camera },
                { id: "remarks", label: `HR Remarks (${report.remarks.length})`, icon: MessageSquare },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-slate-400"}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* ── TAB 1: 6-Section Diagnostics ── */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    Section-wise Performance Breakdown
                  </h3>
                  <span className="text-[11px] font-bold text-slate-400">6 Specialized Modules (10 Qs Each)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {report.sections.map((sec, idx) => (
                    <div
                      key={sec.name}
                      className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs hover:shadow-sm hover:border-blue-300 transition-all space-y-2.5 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-black flex items-center justify-center border border-blue-100">
                            {idx + 1}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {sec.name}
                          </h4>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {sec.questionRange}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between pt-0.5">
                        <span className="text-lg font-black text-slate-900 font-mono">
                          {sec.score}{" "}
                          <span className="text-xs font-semibold text-slate-400 font-sans">/ {sec.totalMarks} Marks</span>
                        </span>
                        <span className="text-xs font-black text-blue-600 font-mono">{sec.percentage}%</span>
                      </div>

                      {/* Smooth Dual-Tone Gradient Progress Bar */}
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            sec.percentage >= 70
                              ? "bg-emerald-500 shadow-xs"
                              : sec.percentage >= 40
                              ? "bg-blue-600 shadow-xs"
                              : "bg-rose-500 shadow-xs"
                          }`}
                          style={{ width: `${Math.max(4, sec.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB 2: Question Responses ── */}
            {activeTab === "responses" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Detailed Question Response Log
                  </h3>
                  <span className="text-[11px] font-bold text-slate-500">60 Questions Audited</span>
                </div>

                <div className="space-y-2.5">
                  {report.responses.map((q) => (
                    <div
                      key={q.questionOrder}
                      className={`p-4 rounded-2xl border transition-all ${
                        q.isCorrect
                          ? "bg-white border-slate-200 hover:border-emerald-300"
                          : "bg-white border-slate-200 hover:border-rose-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                              Q{q.questionOrder} • {q.sectionName}
                            </span>
                          </div>

                          <p className="text-xs font-bold text-slate-900 leading-relaxed pt-0.5">
                            {q.questionText}
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                                Candidate Answer
                              </span>
                              <strong className={q.isCorrect ? "text-emerald-700 font-extrabold" : "text-rose-700 font-extrabold"}>
                                {q.candidateOption ? `Option ${q.candidateOption}` : "Not Answered"}
                              </strong>
                            </div>

                            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                                Correct Answer
                              </span>
                              <strong className="text-slate-900 font-extrabold">Option {q.correctOption}</strong>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-black uppercase whitespace-nowrap flex items-center gap-1 shrink-0 ${
                            q.isCorrect
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {q.isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {q.isCorrect ? "Correct" : "Incorrect"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB 3: Proctoring Audit Timeline ── */}
            {activeTab === "proctoring" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    Proctoring Violation Audit Logs
                  </h3>
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    Max Threshold: {report.proctoring.maxWarnings || 6} Warnings
                  </span>
                </div>

                {report.proctoring.events.length === 0 ? (
                  <div className="p-10 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl text-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                    <h4 className="text-sm font-black text-emerald-900">Zero Security Warnings Logged</h4>
                    <p className="text-xs text-emerald-700 font-medium max-w-md mx-auto">
                      Candidate completed the assessment session cleanly without any tab-switch or face detection security violations.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {report.proctoring.events.map((evt, idx) => (
                      <div
                        key={evt.id || idx}
                        className="p-3.5 bg-white border border-amber-200 rounded-2xl flex items-start gap-3 shadow-2xs"
                      >
                        <div className="p-1.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-amber-900 uppercase">
                              Warning #{idx + 1}: {evt.eventType}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 font-mono">
                              {new Date(evt.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          {evt.details && (
                            <p className="text-xs font-medium text-slate-600 mt-1 leading-relaxed">{evt.details}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 4: HR Remarks ── */}
            {activeTab === "remarks" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    HR Admin Interview Remarks & Notes
                  </h3>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-2xs print:hidden">
                  <label className="block text-xs font-bold text-slate-700 uppercase">Add HR Assessment Remark</label>
                  <textarea
                    rows={3}
                    value={newRemark}
                    onChange={(e) => setNewRemark(e.target.value)}
                    placeholder="Enter candidate interview remarks, verification notes, or HR approval comments..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                  <button
                    onClick={handleSaveRemark}
                    disabled={savingRemark || !newRemark.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {savingRemark ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{savingRemark ? "Saving..." : "Save Remark"}</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {report.remarks.length === 0 ? (
                    <p className="text-xs font-bold text-slate-400 text-center py-6">No HR remarks added yet.</p>
                  ) : (
                    report.remarks.map((rem) => (
                      <div key={rem.id} className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                            <User className="w-3.5 h-3.5" /> HR Admin Note
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {new Date(rem.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-800 font-medium leading-relaxed">{rem.reason}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── TAB 5: Camera Captures & Incident Gallery ── */}
            {activeTab === "screenshots" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                    <Camera className="w-4 h-4 text-blue-600" />
                    Live AI Proctoring Screenshots & Incident Gallery
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    Total Captures: {report.screenshots?.length || 0}
                  </span>
                </div>

                {!report.screenshots || report.screenshots.length === 0 ? (
                  <div className="p-12 text-center bg-slate-50 border border-slate-200 rounded-2xl">
                    <Camera className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">
                      No proctoring screenshots recorded for this session.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Scheduled 15-min snapshots will appear here automatically.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                    {report.screenshots.map((s, idx) => {
                      const baseUrl = getApiBaseUrl();
                      const fullImageUrl = s.imageUrl
                        ? s.imageUrl.startsWith("http") || s.imageUrl.startsWith("data:")
                          ? s.imageUrl
                          : `${baseUrl}${s.imageUrl.startsWith("/") ? "" : "/"}${s.imageUrl}`
                        : "";

                      return (
                        <div
                          key={s.id || idx}
                          onClick={() => setZoomImage(fullImageUrl)}
                          className="group bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md transition-all cursor-pointer relative"
                        >
                          <div className="aspect-video bg-slate-900 relative overflow-hidden flex items-center justify-center">
                            {fullImageUrl ? (
                              <img
                                src={fullImageUrl}
                                alt={`Capture ${idx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src =
                                    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%230F172A"><rect width="300" height="200" fill="%231E293B"/><text x="50%" y="50%" fill="%2394A3B8" font-size="11" font-weight="bold" text-anchor="middle" dy=".3em">📸 Snapshot on Server</text></svg>';
                                }}
                              />
                            ) : (
                              <div className="text-slate-500 text-xs font-bold">No Image</div>
                            )}
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Maximize2 className="w-6 h-6 text-white" />
                            </div>
                          </div>
                          <div className="p-2 space-y-0.5">
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase bg-blue-100 text-blue-700 inline-block">
                              Scheduled 15m
                            </span>
                            <p className="text-[10px] font-bold text-slate-800 truncate" title={s.eventType}>
                              {s.eventType.replace(/_/g, " ")}
                            </p>
                            <p className="text-[9px] text-slate-400">{new Date(s.capturedAt).toLocaleTimeString()}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox Zoom Modal */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-2 border border-white/20">
            <img src={zoomImage} alt="Zoomed Capture" className="w-full h-full object-contain max-h-[80vh] rounded-xl" />
            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
