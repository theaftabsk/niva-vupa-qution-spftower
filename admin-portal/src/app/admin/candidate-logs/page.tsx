"use client";

import { useState, useEffect } from "react";
import {
  RotateCcw,
  Search,
  Filter,
  RefreshCw,
  Clock,
  ChevronLeft,
  ChevronRight,
  Building2,
  Copy,
  Check,
  ShieldCheck,
  ExternalLink,
  ShieldAlert,
  Sliders,
  UserCheck,
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";

export default function CandidateLifecycleLogsPage() {
  const [resetLogs, setResetLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [reasonFilter, setReasonFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Fetch Candidate Reset Logs
  const fetchResetLogs = async () => {
    setLoading(true);
    try {
      const apiUrl = getApiBaseUrl();
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...(roleFilter !== "ALL" && { performedByRole: roleFilter }),
        ...(reasonFilter !== "ALL" && { reasonCode: reasonFilter }),
        ...(search.trim() !== "" && { candidateSearch: search.trim() }),
      });

      const token = localStorage.getItem("banca_admin_token") || "";
      const res = await fetch(`${apiUrl}/api/v1/candidates/audit-logs/resets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setResetLogs(json.data || []);
        setTotalPages(json.pagination?.totalPages || 1);
        setTotalRecords(json.pagination?.total || 0);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResetLogs();
  }, [page, pageSize, roleFilter, reasonFilter]);

  const handleCopyExamLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const getReasonBadge = (code: string) => {
    switch (code) {
      case "DISQUALIFICATION_RECOVERY":
        return {
          bg: "bg-rose-50 text-rose-700 border-rose-200",
          label: "Disqualification Recovery",
        };
      case "TECHNICAL_GLITCH":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-200",
          label: "Technical Glitch",
        };
      case "EXPIRED_WINDOW":
        return {
          bg: "bg-purple-50 text-purple-700 border-purple-200",
          label: "Window Expired",
        };
      case "RETAKE_APPROVAL":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          label: "Retake Approval",
        };
      case "TESTING_VERIFICATION":
        return {
          bg: "bg-sky-50 text-sky-700 border-sky-200",
          label: "Testing & QA",
        };
      default:
        return {
          bg: "bg-slate-100 text-slate-700 border-slate-200",
          label: "Custom Reason",
        };
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <RotateCcw className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Candidate Lifecycle & Reset Audit Logs
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Chronological audit trail of candidate exam resets, attempts, reason triggers, and re-invitations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setPage(1);
              fetchResetLogs();
            }}
            title="Refresh Logs"
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search candidate, email, app ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  fetchResetLogs();
                }
              }}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Performed By Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-600 cursor-pointer"
          >
            <option value="ALL">All Actors (Admin & API)</option>
            <option value="VENDOR_API">Vendor API</option>
            <option value="ADMIN">HR Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>

          {/* Reason Code Filter */}
          <select
            value={reasonFilter}
            onChange={(e) => {
              setReasonFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-600 cursor-pointer"
          >
            <option value="ALL">All Reasons & Triggers</option>
            <option value="DISQUALIFICATION_RECOVERY">Disqualification Recovery</option>
            <option value="TECHNICAL_GLITCH">Technical Glitch</option>
            <option value="EXPIRED_WINDOW">Window Expired</option>
            <option value="RETAKE_APPROVAL">Retake Approval</option>
            <option value="TESTING_VERIFICATION">Testing & QA</option>
            <option value="OTHER">Custom Reason</option>
          </select>
        </div>

        {/* Page Size selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Show:</span>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[25, 50, 100].map((size) => (
              <button
                key={size}
                onClick={() => {
                  setPageSize(size);
                  setPage(1);
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  pageSize === size
                    ? "bg-white text-blue-600 shadow-2xs"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="max-h-[560px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10 shadow-2xs">
              <tr className="text-slate-700 font-extrabold uppercase">
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Candidate Information</th>
                <th className="py-3 px-4">Vendor Partner</th>
                <th className="py-3 px-4">Attempt # & Prior State</th>
                <th className="py-3 px-4">Action Performer</th>
                <th className="py-3 px-4">Reason & Trigger</th>
                <th className="py-3 px-4 text-center">New Secure Exam URL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading Candidate Reset Audit Logs...
                  </td>
                </tr>
              ) : resetLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                    No reset or re-attempt logs recorded matching your filter criteria.
                  </td>
                </tr>
              ) : (
                resetLogs.map((log) => {
                  const badge = getReasonBadge(log.reasonCode);
                  return (
                    <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        <div className="font-bold text-slate-800">
                          {new Date(log.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </div>
                      </td>

                      {/* Candidate Info */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{log.candidate?.name || "Unknown"}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {log.candidate?.email}
                        </div>
                        <div className="text-[10px] text-blue-600 font-bold">
                          App ID: {log.candidate?.applicationId || log.candidate?.referenceId}
                        </div>
                      </td>

                      {/* Vendor Partner */}
                      <td className="py-3 px-4">
                        {log.vendor ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 font-bold text-[11px] border border-purple-200">
                            <Building2 size={12} />
                            <span>{log.vendor.name} ({log.vendor.vendorCode})</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Direct / Super Admin</span>
                        )}
                      </td>

                      {/* Attempt Count & Previous Status */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono font-black text-[11px] border border-slate-200">
                            Attempt #{log.attemptNumber}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              log.previousStatus === "DISQUALIFIED"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : log.previousStatus === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            Prior: {log.previousStatus}
                          </span>
                          {log.previousWarnings > 0 && (
                            <span className="text-[10px] text-rose-600 font-bold">
                              ({log.previousWarnings} warnings)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action Performer */}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 border ${
                            log.performedByRole === "VENDOR_API"
                              ? "bg-sky-50 text-sky-800 border-sky-200"
                              : log.performedByRole === "SUPER_ADMIN"
                              ? "bg-purple-50 text-purple-800 border-purple-200"
                              : "bg-blue-50 text-blue-800 border-blue-200"
                          }`}
                        >
                          <ShieldCheck size={12} />
                          <span>{log.performedBy}</span>
                        </span>
                      </td>

                      {/* Reason & Trigger */}
                      <td className="py-3 px-4 max-w-xs">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${badge.bg} inline-block mb-1`}>
                          {badge.label}
                        </span>
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          {log.reasonText || "Candidate session wiped and link regenerated."}
                        </p>
                      </td>

                      {/* New Exam Link */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            readOnly
                            value={log.newExamUrl}
                            className="px-2 py-1 bg-slate-50 rounded border border-slate-200 text-[10px] font-mono text-slate-600 max-w-[160px] truncate"
                          />
                          <button
                            onClick={() => handleCopyExamLink(log.newExamUrl, log.id)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-900 cursor-pointer shrink-0 border border-slate-200"
                            title="Copy New Exam URL"
                          >
                            {copiedLink === log.id ? (
                              <Check size={12} className="text-emerald-600" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="text-xs text-slate-500 font-semibold">
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalRecords)} of {totalRecords} reset events
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-3 py-1 text-xs font-bold text-slate-700">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
