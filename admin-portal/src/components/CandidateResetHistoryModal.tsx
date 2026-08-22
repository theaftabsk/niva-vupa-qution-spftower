"use client";

import { useState, useEffect } from "react";
import {
  X,
  RotateCcw,
  Clock,
  Building2,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  User,
  ExternalLink,
  History,
  MailCheck,
  CheckCircle2,
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";

interface ResetLogItem {
  id: string;
  candidateId: string;
  performedBy: string;
  performedByRole: string;
  action: string;
  reasonCode: string;
  reasonText?: string;
  previousStatus?: string;
  previousScore?: number;
  previousWarnings?: number;
  attemptNumber: number;
  newSecureToken: string;
  newExamUrl: string;
  emailDispatched: boolean;
  createdAt: string;
  candidate?: {
    name: string;
    email: string;
    phone: string;
    applicationId?: string;
    referenceId: string;
    assessment?: { name: string; slug: string };
  };
  vendor?: {
    name: string;
    vendorCode: string;
  };
}

interface CandidateResetHistoryModalProps {
  candidateId: string | null;
  candidateName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function CandidateResetHistoryModal({
  candidateId,
  candidateName,
  isOpen,
  onClose,
}: CandidateResetHistoryModalProps) {
  const [logs, setLogs] = useState<ResetLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && candidateId) {
      fetchCandidateLogs();
    }
  }, [isOpen, candidateId]);

  const fetchCandidateLogs = async () => {
    if (!candidateId) return;
    setLoading(true);
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("banca_admin_token") || "";
      const res = await fetch(`${baseUrl}/api/v1/candidates/audit-logs/resets?candidateId=${candidateId}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.data || []);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const copyExamUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getReasonBadge = (code: string) => {
    switch (code) {
      case "DISQUALIFICATION_RECOVERY":
        return { bg: "bg-rose-50 text-rose-700 border-rose-200", label: "Disqualification Recovery" };
      case "TECHNICAL_GLITCH":
        return { bg: "bg-amber-50 text-amber-700 border-amber-200", label: "Technical Glitch" };
      case "EXPIRED_WINDOW":
        return { bg: "bg-purple-50 text-purple-700 border-purple-200", label: "Window Expired" };
      case "RETAKE_APPROVAL":
        return { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Retake Approval" };
      case "TESTING_VERIFICATION":
        return { bg: "bg-sky-50 text-sky-700 border-sky-200", label: "Testing & QA" };
      default:
        return { bg: "bg-slate-100 text-slate-700 border-slate-200", label: "Custom Note" };
    }
  };

  if (!isOpen || !candidateId) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Candidate Exam Attempt & Reset Audit</h2>
              <p className="text-xs text-slate-500 font-medium">
                {candidateName ? `Candidate: ${candidateName}` : "Chronological lifecycle & reset events"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs font-bold text-slate-500">Loading attempt history...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center space-y-2 bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6">
              <History className="w-8 h-8 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">Initial Attempt (No Resets)</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                This candidate is on their initial exam attempt and has not been reset by Admin or Vendor API.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
                <span>Total Reset Actions Recorded: <strong className="text-blue-600">{logs.length}</strong></span>
                <span className="text-[11px] text-slate-400 font-mono">1 Credit consumed per new attempt</span>
              </div>

              {logs.map((log, idx) => {
                const badge = getReasonBadge(log.reasonCode);
                const isCopied = copiedId === log.id;

                return (
                  <div
                    key={log.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-all space-y-3 shadow-2xs"
                  >
                    {/* Top Row: Attempt #, Timestamp, Actor */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono font-black text-xs">
                          Attempt #{log.attemptNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <Clock size={12} className="text-slate-400" />
                        <span>{new Date(log.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                      </div>
                    </div>

                    {/* Reason Text / Notes */}
                    {log.reasonText && (
                      <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed font-medium">
                        "{log.reasonText}"
                      </p>
                    )}

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1 border-t border-slate-100">
                      <div>
                        <span className="text-slate-400 block font-bold text-[10px]">Action Performer:</span>
                        <span className="font-bold text-slate-800 inline-flex items-center gap-1 mt-0.5">
                          <ShieldCheck size={11} className="text-blue-600" />
                          {log.performedBy}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block font-bold text-[10px]">Prior State:</span>
                        <span className="font-bold text-slate-800 block mt-0.5">
                          {log.previousStatus || "N/A"}{" "}
                          {log.previousWarnings && log.previousWarnings > 0 ? `(${log.previousWarnings} warnings)` : ""}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block font-bold text-[10px]">Email Dispatch:</span>
                        <span className={`font-bold inline-flex items-center gap-1 mt-0.5 ${log.emailDispatched ? "text-emerald-600" : "text-slate-500"}`}>
                          <MailCheck size={11} />
                          {log.emailDispatched ? "Re-invitation Sent" : "Link Generated"}
                        </span>
                      </div>
                    </div>

                    {/* Generated Link */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">New Exam URL:</span>
                      <input
                        readOnly
                        value={log.newExamUrl}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-mono text-slate-600 select-all focus:outline-none truncate"
                      />
                      <button
                        onClick={() => copyExamUrl(log.newExamUrl, log.id)}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 shrink-0 border cursor-pointer ${
                          isCopied
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
                        }`}
                        title="Copy Exam URL"
                      >
                        {isCopied ? <Check size={12} /> : <Copy size={12} />}
                        <span>{isCopied ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
