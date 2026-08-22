"use client";

import { useState, useEffect } from "react";
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  Coins,
  ShieldAlert,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Sliders,
  UserCheck,
  RotateCcw,
  Building2,
  Copy,
  Check,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Layers,
} from "lucide-react";

export default function ExamActivityLogsPage() {
  const [activeTab, setActiveTab] = useState<"RESETS" | "CREDITS">("RESETS");

  // Tab 1: Candidate Reset Audit Logs State
  const [resetLogs, setResetLogs] = useState<any[]>([]);
  const [resetLoading, setResetLoading] = useState(true);
  const [resetSearch, setResetSearch] = useState("");
  const [resetRoleFilter, setResetRoleFilter] = useState("ALL");
  const [resetReasonFilter, setResetReasonFilter] = useState("ALL");
  const [resetPage, setResetPage] = useState(1);
  const [resetPageSize, setResetPageSize] = useState(25);
  const [resetTotalPages, setResetTotalPages] = useState(1);
  const [resetTotalRecords, setResetTotalRecords] = useState(0);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Tab 2: Credit Logs State
  const [histories, setHistories] = useState<any[]>([]);
  const [creditLoading, setCreditLoading] = useState(true);
  const [creditSearch, setCreditSearch] = useState("");
  const [creditFilterType, setCreditFilterType] = useState<string>("ALL");
  const [creditPage, setCreditPage] = useState(1);
  const [creditPageSize, setCreditPageSize] = useState(50);
  const [creditTotalPages, setCreditTotalPages] = useState(1);
  const [creditTotalRecords, setCreditTotalRecords] = useState(0);
  const [quotaData, setQuotaData] = useState<any>(null);

  const getApiUrl = () => {
    return process.env.NEXT_PUBLIC_API_URL || "https://api.niva.greatcampus.in";
  };

  // Fetch Candidate Reset Logs
  const fetchResetLogs = async () => {
    setResetLoading(true);
    try {
      const apiUrl = getApiUrl();
      const params = new URLSearchParams({
        page: resetPage.toString(),
        limit: resetPageSize.toString(),
        ...(resetRoleFilter !== "ALL" && { performedByRole: resetRoleFilter }),
        ...(resetReasonFilter !== "ALL" && { reasonCode: resetReasonFilter }),
        ...(resetSearch.trim() !== "" && { candidateSearch: resetSearch.trim() }),
      });

      const token = localStorage.getItem("banca_admin_token") || "";
      const res = await fetch(`${apiUrl}/api/v1/candidates/audit-logs/resets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setResetLogs(json.data || []);
        setResetTotalPages(json.pagination?.totalPages || 1);
        setResetTotalRecords(json.pagination?.total || 0);
      }
    } catch {
      /* silent */
    } finally {
      setResetLoading(false);
    }
  };

  // Fetch Credit Activity Logs
  const fetchCreditLogs = async () => {
    setCreditLoading(true);
    try {
      const apiUrl = getApiUrl();
      const params = new URLSearchParams({
        page: creditPage.toString(),
        limit: creditPageSize.toString(),
        ...(creditFilterType !== "ALL" && { type: creditFilterType }),
        ...(creditSearch.trim() !== "" && { search: creditSearch.trim() }),
      });

      const [logRes, quotaRes] = await Promise.all([
        fetch(`${apiUrl}/api/v1/credits/history?${params.toString()}`),
        fetch(`${apiUrl}/api/v1/credits/quota`),
      ]);

      const logData = await logRes.json();
      const qData = await quotaRes.json();

      if (logData.success) {
        setHistories(logData.histories || []);
        setCreditTotalPages(logData.totalPages || 1);
        setCreditTotalRecords(logData.total || 0);
      }

      if (qData.success) {
        setQuotaData(qData);
      }
    } catch {
      /* silent */
    } finally {
      setCreditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "RESETS") {
      fetchResetLogs();
    } else {
      fetchCreditLogs();
    }
  }, [activeTab, resetPage, resetPageSize, resetRoleFilter, resetReasonFilter, creditPage, creditPageSize, creditFilterType]);

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
              <Activity className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Audit Logs & Candidate Lifecycle
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Master chronological audit trail of candidate exam attempts, session resets, triggers, and credit usages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (activeTab === "RESETS") {
                setResetPage(1);
                fetchResetLogs();
              } else {
                setCreditPage(1);
                fetchCreditLogs();
              }
            }}
            title="Refresh Logs"
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(resetLoading || creditLoading) ? "animate-spin text-blue-600" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("RESETS")}
          className={`pb-3 px-4 text-xs font-extrabold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === "RESETS"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <RotateCcw size={15} />
          <span>Candidate Reset & Attempt Audit</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
            {resetTotalRecords}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("CREDITS")}
          className={`pb-3 px-4 text-xs font-extrabold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === "CREDITS"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Coins size={15} />
          <span>Exam Credits & Allocation History</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600">
            {creditTotalRecords}
          </span>
        </button>
      </div>

      {/* TAB 1: CANDIDATE RESET AUDIT LOGS */}
      {activeTab === "RESETS" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search candidate, email, app ID..."
                  value={resetSearch}
                  onChange={(e) => setResetSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setResetPage(1);
                      fetchResetLogs();
                    }
                  }}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Performed By Role Filter */}
              <select
                value={resetRoleFilter}
                onChange={(e) => {
                  setResetRoleFilter(e.target.value);
                  setResetPage(1);
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
                value={resetReasonFilter}
                onChange={(e) => {
                  setResetReasonFilter(e.target.value);
                  setResetPage(1);
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
                      setResetPageSize(size);
                      setResetPage(1);
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      resetPageSize === size
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
                  {resetLoading ? (
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
                Showing {(resetPage - 1) * resetPageSize + 1} - {Math.min(resetPage * resetPageSize, resetTotalRecords)} of {resetTotalRecords} reset events
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setResetPage((p) => Math.max(1, p - 1))}
                  disabled={resetPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-3 py-1 text-xs font-bold text-slate-700">
                  Page {resetPage} of {resetTotalPages}
                </span>
                <button
                  onClick={() => setResetPage((p) => Math.min(resetTotalPages, p + 1))}
                  disabled={resetPage === resetTotalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CREDIT LOGS */}
      {activeTab === "CREDITS" && (
        <div className="space-y-6">
          {/* Credit KPI Overview Bar */}
          {quotaData && quotaData.credit && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Allocated Limit</span>
                  <strong className="text-2xl font-black text-slate-900 font-mono mt-0.5 block">
                    {quotaData.credit.creditLimit.toLocaleString()}
                  </strong>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Coins className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Used</span>
                  <strong className="text-2xl font-black text-rose-600 font-mono mt-0.5 block">
                    {quotaData.credit.creditUsed.toLocaleString()}
                  </strong>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Remaining Balance</span>
                  <strong className="text-2xl font-black text-emerald-600 font-mono mt-0.5 block">
                    {quotaData.remainingCredit.toLocaleString()}
                  </strong>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search description, candidate..."
                  value={creditSearch}
                  onChange={(e) => setCreditSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setCreditPage(1);
                      fetchCreditLogs();
                    }
                  }}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
                />
              </div>

              <select
                value={creditFilterType}
                onChange={(e) => {
                  setCreditFilterType(e.target.value);
                  setCreditPage(1);
                }}
                className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="ALL">All Transaction Types</option>
                <option value="DEDUCTION">Deductions (Exams)</option>
                <option value="ALLOCATION">Allocations (Top-ups)</option>
                <option value="ADJUSTMENT">Adjustments</option>
                <option value="REFUND">Refunds</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Show:</span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {[25, 50, 100].map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setCreditPageSize(size);
                      setCreditPage(1);
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      creditPageSize === size
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

          {/* Credits Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="max-h-[560px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10 shadow-2xs">
                  <tr className="text-slate-700 font-extrabold uppercase">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Change Amount</th>
                    <th className="py-3 px-4">Balance After</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4">Description / Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {creditLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        Loading Credit Audit Logs...
                      </td>
                    </tr>
                  ) : histories.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">
                        No credit activity records found.
                      </td>
                    </tr>
                  ) : (
                    histories.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {new Date(h.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] ${
                              h.type === "DEDUCTION"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : h.type === "ALLOCATION"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {h.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-black">
                          <span className={h.amount < 0 ? "text-rose-600" : "text-emerald-600"}>
                            {h.amount > 0 ? `+${h.amount}` : h.amount}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {h.balanceAfter}
                        </td>
                        <td className="py-3 px-4">
                          {h.vendorName ? (
                            <span className="font-bold text-purple-700">{h.vendorName}</span>
                          ) : (
                            <span className="text-slate-400">Direct / Global</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">
                          {h.description}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs text-slate-500 font-semibold">
                Showing {(creditPage - 1) * creditPageSize + 1} - {Math.min(creditPage * creditPageSize, creditTotalRecords)} of {creditTotalRecords} records
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCreditPage((p) => Math.max(1, p - 1))}
                  disabled={creditPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-3 py-1 text-xs font-bold text-slate-700">
                  Page {creditPage} of {creditTotalPages}
                </span>
                <button
                  onClick={() => setCreditPage((p) => Math.min(creditTotalPages, p + 1))}
                  disabled={creditPage === creditTotalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
