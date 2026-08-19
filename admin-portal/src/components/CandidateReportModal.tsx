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
  RotateCcw
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
  onClose: () => void;
  candidateId: string | null;
  onRefresh?: () => void;
}

export default function CandidateReportModal({ isOpen, onClose, candidateId, onRefresh }: CandidateReportModalProps) {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "responses" | "proctoring" | "screenshots" | "remarks">("overview");
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [newRemark, setNewRemark] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!isOpen || !candidateId) return;

    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/candidates/${candidateId}/report`);
        const data = await res.json();
        if (data.success) {
          setReport(data);
        } else {
          setError(data.message || "Failed to load report data.");
        }
      } catch (err: any) {
        setError(err.message || "Network error loading candidate report.");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [isOpen, candidateId]);

  const handleSaveRemark = async () => {
    if (!candidateId || !newRemark.trim()) return;
    setSavingRemark(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/candidates/${candidateId}/remarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remark: newRemark }),
      });
      const data = await res.json();
      if (data.success) {
        setReport((prev) =>
          prev
            ? {
                ...prev,
                remarks: [
                  {
                    id: data.remark.id,
                    adminId: "admin",
                    action: "REMARK",
                    reason: newRemark,
                    createdAt: new Date().toISOString(),
                  },
                  ...prev.remarks,
                ],
              }
            : null
        );
        setNewRemark("");
      }
    } catch {
      alert("Failed to save remark.");
    } finally {
      setSavingRemark(false);
    }
  };

  const [isFullscreen, setIsFullscreen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadExcel = () => {
    if (!candidateId) return;
    const baseUrl = getApiBaseUrl();
    window.open(`${baseUrl}/api/v1/candidates/${candidateId}/export-excel`, "_blank");
  };

  const handleResetAttempt = async () => {
    if (!candidateId || !report) return;
    const confirmed = window.confirm(
      `Are you sure you want to completely wipe ${report.candidate.name}'s exam attempt and re-invite them? All previous answers and scores will be deleted so the candidate can retake the test from scratch.`
    );
    if (!confirmed) return;

    setResetting(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/candidates/${candidateId}/reset`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || "Candidate exam session reset successfully.");
        onRefresh?.();
        onClose();
      } else {
        alert(data.message || "Failed to reset candidate attempt.");
      }
    } catch {
      alert("Error resetting candidate attempt.");
    } finally {
      setResetting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isFullscreen ? 'p-0' : 'p-2 sm:p-4 md:p-6'} bg-slate-950/80 backdrop-blur-md overflow-y-auto print:bg-white print:p-0 animate-in fade-in duration-200`}>
      <div className={`w-full ${isFullscreen ? 'w-screen h-screen max-w-none max-h-none rounded-none' : 'max-w-[98vw] xl:max-w-[1550px] max-h-[96vh] rounded-3xl'} bg-slate-50 shadow-2xl border border-slate-200 overflow-hidden my-auto relative flex flex-col print:max-h-none print:shadow-none print:border-none print:rounded-none transition-all duration-300`}>
        
        {/* Top Header Bar */}
        <div className="px-6 py-3.5 bg-gradient-to-r from-[#003F72] via-[#005B94] to-[#00AEEF] text-white flex items-center justify-between shadow-md print:bg-blue-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/95 p-2 rounded-xl shadow-md flex items-center justify-center">
              <Image
                src="/niva-bupa-logo.png"
                alt="Niva Bupa Health Insurance"
                width={130}
                height={35}
                className="h-7 w-auto object-contain"
                priority
              />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                Candidate Diagnostic Scorecard
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] uppercase font-black tracking-wider">
                  Official Record
                </span>
              </h3>
              <p className="text-[11px] text-blue-100/90 font-semibold">
                Niva Bupa Assessment & AI Proctoring System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            {/* Download Individual Candidate Excel Report Button */}
            <button
              onClick={handleDownloadExcel}
              title="Download Individual Candidate Excel Scorecard (4 Sheets)"
              className="px-3.5 py-2 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-100 text-xs font-extrabold transition-all cursor-pointer border border-emerald-400/40 flex items-center gap-1.5 shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span className="hidden sm:inline">Excel Report</span>
            </button>

            {/* Reset & Allow Retake Button */}
            <button
              onClick={handleResetAttempt}
              disabled={resetting}
              title="Reset Candidate Attempt & Allow Retake (Clean & Send)"
              className="px-3.5 py-2 rounded-xl bg-amber-500/25 hover:bg-amber-500/40 text-amber-100 text-xs font-extrabold transition-all cursor-pointer border border-amber-400/40 flex items-center gap-1.5 shadow-sm"
            >
              <RotateCcw className={`w-4 h-4 text-amber-300 ${resetting ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{resetting ? "Resetting..." : "Reset & Retake"}</span>
            </button>

            {/* Toggle Fullscreen / Maximize */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Restore Window Size" : "Full Screen Widescreen View"}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all cursor-pointer border border-white/25"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Close Modal */}
            <button
              onClick={onClose}
              title="Close Report Modal"
              className="p-2 rounded-xl bg-white/15 hover:bg-rose-600 text-white transition-all cursor-pointer border border-white/25"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Container */}
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-center bg-white">
            <div className="relative w-12 h-12 mb-4">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <Sparkles className="w-5 h-5 text-blue-600 absolute inset-0 m-auto animate-pulse" />
            </div>
            <p className="text-sm font-extrabold text-slate-900">Calculating Candidate Diagnostic Report...</p>
            <p className="text-xs text-slate-500 mt-1">Reconstructing 6-Section Performance & Security Audit</p>
          </div>
        ) : error || !report ? (
          <div className="p-12 text-center bg-white">
            <XCircle className="w-12 h-12 text-rose-500 mx-auto mb-3 animate-bounce" />
            <h4 className="text-base font-extrabold text-slate-900">Report Unavailable</h4>
            <p className="text-xs text-slate-500 mt-1">{error || "Candidate report record not found."}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
            
            {/* Top Candidate Hero Banner */}
            <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-blue-900/40">
              <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                
                {/* Candidate Info */}
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-[11px] font-extrabold uppercase tracking-wider mb-3">
                    <User className="w-3.5 h-3.5" />
                    Application ID: {report.candidate.applicationId}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{report.candidate.name}</h2>
                  <p className="text-xs text-blue-200/90 font-medium mt-1">
                    {report.candidate.email} • {report.candidate.phone}
                  </p>
                  <p className="text-xs text-slate-300 font-semibold mt-1">
                    Exam Session: <strong className="text-white">{report.assessment.title}</strong>
                  </p>
                </div>

                {/* Score & Result Cards */}
                <div className="flex flex-wrap items-center gap-3 bg-white/10 backdrop-blur-xl p-4 rounded-2xl border border-white/15 shadow-inner">
                  
                  {/* Score */}
                  <div className="text-center px-3">
                    <span className="block text-[10px] font-extrabold text-blue-200 uppercase tracking-wider">Score Marks</span>
                    <span className="text-3xl font-black text-white">
                      {report.result.score} <span className="text-sm font-medium text-blue-300">/ {report.result.totalMarks}</span>
                    </span>
                  </div>

                  <div className="h-9 w-px bg-white/20" />

                  {/* Percentage */}
                  <div className="text-center px-3">
                    <span className="block text-[10px] font-extrabold text-blue-200 uppercase tracking-wider">Percentage</span>
                    <span className="text-3xl font-black text-cyan-300">{report.result.percentage}%</span>
                  </div>

                  <div className="h-9 w-px bg-white/20" />

                  {/* Evaluation Status */}
                  <div className="text-center px-3">
                    <span className="block text-[10px] font-extrabold text-blue-200 uppercase tracking-wider">Exam Status</span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-white/20 text-white">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      COMPLETED
                    </span>
                  </div>

                </div>
              </div>

              {/* Timing & Security Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-white/15 text-xs text-blue-100/90 font-semibold">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    Started: <strong className="text-white">{new Date(report.timing.startedAt).toLocaleDateString()}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    Duration: <strong className="text-white">{report.timing.durationFormatted}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    Warnings: <strong className="text-white">{report.proctoring.warningCount} / {report.proctoring.maxWarnings}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    Passing Benchmark: <strong className="text-white">{report.assessment.passingPercentage}%</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation Pill Tabs */}
            <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 print:hidden overflow-x-auto">
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
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: 6-Section Diagnostics */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    Section-wise Performance Breakdown
                  </h3>
                  <span className="text-xs font-bold text-slate-500">6 Specialized Modules</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.sections.map((sec, idx) => (
                    <div
                      key={sec.name}
                      className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all space-y-3 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 text-xs font-black flex items-center justify-center border border-blue-100">
                            {idx + 1}
                          </span>
                          <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {sec.name}
                          </h4>
                        </div>
                        <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {sec.questionRange}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between pt-1">
                        <span className="text-xl font-black text-slate-900">
                          {sec.score} <span className="text-xs font-semibold text-slate-400">/ {sec.totalMarks} Marks</span>
                        </span>
                        <span className="text-sm font-black text-blue-600">{sec.percentage}%</span>
                      </div>

                      {/* Animated Gradient Progress Bar */}
                      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            sec.percentage >= 70
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm shadow-emerald-500/30"
                              : sec.percentage >= 50
                              ? "bg-gradient-to-r from-blue-500 to-indigo-600 shadow-sm shadow-blue-500/30"
                              : "bg-gradient-to-r from-rose-500 to-red-600 shadow-sm shadow-rose-500/30"
                          }`}
                          style={{ width: `${sec.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: Detailed Question Responses */}
            {activeTab === "responses" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Detailed Question Response Log
                  </h3>
                  <span className="text-xs font-bold text-slate-500">60 Questions Audited</span>
                </div>

                <div className="space-y-3">
                  {report.responses.map((q) => (
                    <div
                      key={q.questionOrder}
                      className={`p-5 rounded-2xl border transition-all ${
                        q.isCorrect
                          ? "bg-emerald-50/40 border-emerald-200/80 hover:border-emerald-300"
                          : "bg-rose-50/40 border-rose-200/80 hover:border-rose-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-md bg-white text-slate-800 border border-slate-200/80 shadow-xs">
                              Q{q.questionOrder} • {q.sectionName}
                            </span>
                          </div>

                          <p className="text-xs font-extrabold text-slate-900 leading-relaxed pt-1">
                            {q.questionText}
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2">
                            <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                                Candidate Answer
                              </span>
                              <strong className={q.isCorrect ? "text-emerald-700 font-black" : "text-rose-700 font-black"}>
                                {q.candidateOption ? `Option ${q.candidateOption}` : "Not Answered"}
                              </strong>
                            </div>

                            <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                                Correct Answer
                              </span>
                              <strong className="text-slate-900 font-black">Option {q.correctOption}</strong>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase whitespace-nowrap shadow-xs flex items-center gap-1 ${
                            q.isCorrect
                              ? "bg-emerald-600 text-white"
                              : "bg-rose-600 text-white"
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

            {/* TAB 3: Proctoring Audit Timeline */}
            {activeTab === "proctoring" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    Proctoring Violation Audit Logs
                  </h3>
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    Max Threshold: {report.proctoring.maxWarnings} Warnings
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
                  <div className="space-y-3">
                    {report.proctoring.events.map((evt, idx) => (
                      <div
                        key={evt.id || idx}
                        className="p-4 bg-amber-50/70 border border-amber-200/90 rounded-2xl flex items-start gap-3 shadow-xs"
                      >
                        <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-amber-900 uppercase">
                              Warning #{idx + 1}: {evt.eventType}
                            </span>
                            <span className="text-[11px] font-extrabold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200">
                              {new Date(evt.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          {evt.details && <p className="text-xs font-semibold text-amber-800 mt-1.5 leading-relaxed">{evt.details}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: HR Remarks */}
            {activeTab === "remarks" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    HR Admin Interview Remarks & Audit Notes
                  </h3>
                </div>

                {/* Input Textarea */}
                <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-sm print:hidden">
                  <label className="block text-xs font-bold text-slate-700 uppercase">Add HR Assessment Remark</label>
                  <textarea
                    rows={3}
                    value={newRemark}
                    onChange={(e) => setNewRemark(e.target.value)}
                    placeholder="Enter candidate interview remarks, verification notes, or HR approval comments..."
                    className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
                  />
                  <button
                    onClick={handleSaveRemark}
                    disabled={savingRemark || !newRemark.trim()}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-blue-600/25 active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {savingRemark ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Save HR Remark</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Past Remarks Timeline */}
                <div className="space-y-3">
                  {report.remarks.length === 0 ? (
                    <p className="text-xs font-bold text-slate-400 text-center py-6">No HR remarks added yet.</p>
                  ) : (
                    report.remarks.map((rem) => (
                      <div key={rem.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-extrabold text-blue-600 flex items-center gap-1">
                            <User className="w-3.5 h-3.5" /> HR Admin Note
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400">
                            {new Date(rem.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-900 font-semibold leading-relaxed">{rem.reason}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: Camera Captures & Incident Gallery */}
            {activeTab === "screenshots" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                    <Camera className="w-4 h-4 text-blue-600" />
                    Live AI Proctoring Screenshots & Incident Gallery
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    Total Captures: {report.screenshots?.length || 0}
                  </span>
                </div>

                {(!report.screenshots || report.screenshots.length === 0) ? (
                  <div className="p-12 text-center bg-slate-50 border border-slate-200 rounded-2xl">
                    <Camera className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">No proctoring screenshots recorded for this session.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Scheduled 15-min and violation snapshot images will appear here automatically.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {report.screenshots.map((s, idx) => {
                      const baseUrl = getApiBaseUrl();
                      const fullImageUrl = s.imageUrl ? (s.imageUrl.startsWith("http") || s.imageUrl.startsWith("data:") ? s.imageUrl : `${baseUrl}${s.imageUrl.startsWith("/") ? "" : "/"}${s.imageUrl}`) : "";

                      return (
                        <div
                          key={s.id || idx}
                          onClick={() => setZoomImage(fullImageUrl)}
                          className="group bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer relative"
                        >
                          <div className="aspect-video bg-slate-900 relative overflow-hidden flex items-center justify-center">
                            {fullImageUrl ? (
                              <img
                                src={fullImageUrl}
                                alt={`Capture ${idx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%230F172A"><rect width="300" height="200" fill="%231E293B"/><text x="50%" y="50%" fill="%2394A3B8" font-size="11" font-weight="bold" text-anchor="middle" dy=".3em">📸 Snapshot on Server</text></svg>';
                                }}
                              />
                            ) : (
                              <div className="text-slate-500 text-xs font-bold">No Image</div>
                            )}
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Maximize2 className="w-6 h-6 text-white" />
                            </div>
                          </div>
                          <div className="p-2.5 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                                s.type === 'WARNING' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {s.type === 'WARNING' ? 'Violation Snap' : 'Scheduled 15m'}
                              </span>
                            </div>
                            <p className="text-[10px] font-bold text-slate-800 truncate" title={s.eventType}>
                              {s.eventType.replace(/_/g, ' ')}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              {new Date(s.capturedAt).toLocaleTimeString()}
                            </p>
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
