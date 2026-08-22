"use client";

import { useState, useEffect } from "react";
import {
  Search, RefreshCw, Lock, Unlock, Trash2, CheckCircle2,
  AlertTriangle, ShieldAlert, Download, Table, FileText, Award,
  Filter, ChevronLeft, ChevronRight, BookOpen, FileSpreadsheet, RotateCcw, Building2, History
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";
import CandidateReportModal from "@/components/CandidateReportModal";
import CandidateResetHistoryModal from "@/components/CandidateResetHistoryModal";
import ConfirmModal from "@/components/ConfirmModal";
import ToastContainer, { ToastMessage } from "@/components/Toast";

export default function CandidatesManagementPage() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>("ALL");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("ALL");
  const [userRole, setUserRole] = useState<string>("ADMIN");
  const [loggedVendorId, setLoggedVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Pagination (50 candidates per page by default)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Modal Report Card State
  const [selectedReportCandidateId, setSelectedReportCandidateId] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Modal Reset & Attempt History State
  const [selectedHistoryCandidate, setSelectedHistoryCandidate] = useState<{ id: string; name: string } | null>(null);

  // Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: "success" | "error" | "warning" | "info", message: string, title?: string) => {
    setToasts((prev) => [...prev, { id: Math.random().toString(36).substring(2, 9), type, message, title }]);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Delete Candidate Modal State
  const [deleteCandidateTarget, setDeleteCandidateTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingCandidate, setDeletingCandidate] = useState(false);

  // Reset Candidate Attempt Modal State
  const [resetCandidateTarget, setResetCandidateTarget] = useState<{ id: string; name: string; email: string } | null>(null);
  const [resettingCandidate, setResettingCandidate] = useState(false);
  const [resetReasonCode, setResetReasonCode] = useState("DISQUALIFICATION_RECOVERY");
  const [resetReasonText, setResetReasonText] = useState("");

  // Assign Vendor Modal State
  const [assignCandidateTarget, setAssignCandidateTarget] = useState<any | null>(null);
  const [targetVendorId, setTargetVendorId] = useState<string>("");
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Bulk Selection State
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [bulkVendorModal, setBulkVendorModal] = useState(false);
  const [bulkTargetVendorId, setBulkTargetVendorId] = useState<string>("");
  const [savingBulkAssignment, setSavingBulkAssignment] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("banca_admin_token") || "";
      const userStr = localStorage.getItem("banca_admin_user");
      let activeRole = "ADMIN";
      let activeVendorId: string | null = null;

      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          activeRole = u.role || "ADMIN";
          activeVendorId = u.vendorId || u.id || u.vendorCode || u.email || null;
          setUserRole(activeRole);
          setLoggedVendorId(activeVendorId);
        } catch {}
      }

      // Query params
      const params = new URLSearchParams();
      if (selectedAssessmentId !== "ALL") params.append("assessmentId", selectedAssessmentId);
      
      const effectiveVendor = activeRole === "VENDOR" ? activeVendorId : (selectedVendorId !== "ALL" ? selectedVendorId : null);
      if (effectiveVendor) params.append("vendorId", effectiveVendor);

      // Fetch candidates
      const candRes = await fetch(`${baseUrl}/api/v1/candidates?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const candData = await candRes.json();
      if (candData.success) {
        setCandidates(candData.candidates || []);
      }

      // Fetch assessment list for dropdown
      const assessRes = await fetch(`${baseUrl}/api/v1/assessments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const assessData = await assessRes.json();
      if (assessData.success) {
        setAssessments(assessData.assessments || []);
      }

      // Fetch vendors list if Admin
      if (activeRole !== "VENDOR") {
        const vRes = await fetch(`${baseUrl}/api/v1/vendors`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const vData = await vRes.json();
        if (Array.isArray(vData)) {
          setVendors(vData);
        }
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setCurrentPage(1);
  }, [selectedAssessmentId, selectedVendorId]);

  const handleUnlock = async (candidateId: string, name: string) => {
    setActionLoadingId(candidateId);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/candidates/${candidateId}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminName: "HR Administrator", reason: "Admin approved to resume session" }),
      });
      const data = await res.json();
      if (data.success) {
        addToast("success", `Candidate '${name}' unlocked successfully. All answers and time preserved.`, "Candidate Unlocked");
        await loadData();
      } else {
        addToast("error", data.message || "Failed to unlock candidate.", "Unlock Error");
      }
    } catch {
      addToast("error", "Network error unlocking candidate.", "Error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmDeleteCandidate = async () => {
    if (!deleteCandidateTarget) return;
    setDeletingCandidate(true);
    try {
      const baseUrl = getApiBaseUrl();
      const userStr = localStorage.getItem("banca_admin_user");
      let activeRole = "ADMIN";
      let activeName = "HR Administrator";
      let activeId = "";
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          activeRole = u.role || "ADMIN";
          activeName = u.name || "Administrator";
          activeId = u.id || "";
        } catch {}
      }

      await fetch(`${baseUrl}/api/v1/candidates/${deleteCandidateTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: activeRole,
          name: activeName,
          id: activeId,
          reason: "Archived from Candidates evaluation list",
        }),
      });
      addToast("success", `Candidate '${deleteCandidateTarget.name}' has been moved to Archive & Bin.`, "Candidate Archived");
      setDeleteCandidateTarget(null);
      await loadData();
    } catch {
      addToast("error", "Failed to delete candidate.", "Error");
    } finally {
      setDeletingCandidate(false);
    }
  };

  const confirmResetCandidate = async () => {
    if (!resetCandidateTarget) return;
    setResettingCandidate(true);
    try {
      const baseUrl = getApiBaseUrl();
      const userStr = localStorage.getItem("banca_admin_user");
      let activeName = "HR Administrator";
      let activeRole = "ADMIN";
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          activeName = u.name || "Administrator";
          activeRole = u.role || "ADMIN";
        } catch {}
      }

      const res = await fetch(`${baseUrl}/api/v1/candidates/${resetCandidateTarget.id}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          performedBy: `${activeRole}:${activeName}`,
          performedByRole: activeRole,
          reasonCode: resetReasonCode,
          reasonText: resetReasonCode === "OTHER" ? resetReasonText : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        addToast(
          "success",
          data.message || `Candidate '${resetCandidateTarget.name}' exam attempt wiped, fresh link generated and logged.`,
          "Exam Reset & Re-invited"
        );
        setResetCandidateTarget(null);
        setResetReasonCode("DISQUALIFICATION_RECOVERY");
        setResetReasonText("");
        await loadData();
      } else {
        addToast("error", data.message || "Failed to reset candidate attempt.", "Reset Error");
      }
    } catch {
      addToast("error", "Network error resetting candidate attempt.", "Error");
    } finally {
      setResettingCandidate(false);
    }
  };

  const handleOpenReport = (candidateId: string) => {
    setSelectedReportCandidateId(candidateId);
    setIsReportModalOpen(true);
  };

  const handleDownloadSingleExcel = (candidateId: string) => {
    const baseUrl = getApiBaseUrl();
    window.open(`${baseUrl}/api/v1/candidates/${candidateId}/export-excel`, "_blank");
  };

  const handleOpenAssignVendor = (cand: any) => {
    setAssignCandidateTarget(cand);
    setTargetVendorId(cand.vendorId || "");
  };

  const handleSaveVendorAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignCandidateTarget) return;
    setSavingAssignment(true);
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("banca_admin_token") || "";
      const res = await fetch(`${baseUrl}/api/v1/candidates/${assignCandidateTarget.id}/assign-vendor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ vendorId: targetVendorId || null }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast("success", data.message || "Candidate vendor assigned successfully.", "Vendor Assigned");
        setAssignCandidateTarget(null);
        await loadData();
      } else {
        addToast("error", data.message || "Failed to assign vendor.", "Assignment Error");
      }
    } catch {
      addToast("error", "Error connecting to server.", "Network Error");
    } finally {
      setSavingAssignment(false);
    }
  };

  const downloadExcelReport = () => {
    const baseUrl = getApiBaseUrl();
    const target = selectedAssessmentId === "ALL" ? "all" : selectedAssessmentId;
    window.open(`${baseUrl}/api/v1/candidates/export-comprehensive/${target}`, "_blank");
  };

  // Filter candidates
  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.applicationId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.includes(searchTerm);

    if (statusFilter === "ALL") return matchesSearch;
    if (statusFilter === "LOCKED") return matchesSearch && (c.status === "LOCKED" || c.attempt?.status === "LOCKED");
    if (statusFilter === "COMPLETED") return matchesSearch && c.status === "COMPLETED";
    if (statusFilter === "IN_PROGRESS") return matchesSearch && c.status === "IN_PROGRESS";
    if (statusFilter === "REGISTERED") return matchesSearch && (c.status === "REGISTERED" || !c.attempt);
    if (statusFilter === "DISQUALIFIED") return matchesSearch && c.status === "DISQUALIFIED";
    return matchesSearch && c.status === statusFilter;
  });

  // 50 Candidates Per Page Slicing
  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredCandidates.length);
  const paginatedCandidates = filteredCandidates.slice(startIndex, endIndex);

  const completedCount = candidates.filter((c) => c.status === "COMPLETED").length;
  const lockedCount = candidates.filter((c) => c.status === "LOCKED" || c.attempt?.status === "LOCKED").length;
  const inProgressCount = candidates.filter((c) => c.status === "IN_PROGRESS").length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Clean Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Candidate Evaluation</h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Monitor candidate assessment progress, scores, proctoring warnings, and unlock accounts.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={downloadExcelReport}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-2xs flex items-center space-x-2 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download 5-Sheet Excel Report</span>
          </button>

          <button
            onClick={loadData}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition border border-slate-200 shadow-2xs flex items-center space-x-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Row: Search + Assessment Filter + Status Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search candidate name, email, phone or application ID..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Assessment Dropdown Filter */}
          <div className="flex items-center gap-2 min-w-[240px]">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" /> Assessment:
            </span>
            <select
              value={selectedAssessmentId}
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Assessments</option>
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.slug || a.id.slice(0, 8)})
                </option>
              ))}
            </select>
          </div>

          {/* Vendor Dropdown Filter (Admin only) */}
          {userRole !== "VENDOR" && (
            <div className="flex items-center gap-2 min-w-[220px]">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-600" /> Vendor:
              </span>
              <select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Vendors (All)</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.vendorCode})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
          <div className="flex items-center space-x-1.5 overflow-x-auto py-1">
            {[
              { id: "ALL", label: `All (${candidates.length})` },
              { id: "LOCKED", label: `Locked (${lockedCount})` },
              { id: "COMPLETED", label: `Completed (${completedCount})` },
              { id: "IN_PROGRESS", label: `In Progress (${inProgressCount})` },
              { id: "REGISTERED", label: `Registered` },
              { id: "DISQUALIFIED", label: `Disqualified` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.id
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Rows per page selector */}
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Data Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-500 font-bold">Loading Candidate Records...</p>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <Table className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-800">No Candidates Found</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {candidates.length === 0
                ? "The candidate database is currently empty for this assessment. Use 'Upload Excel Candidates' in Exams & Assessments to add candidate batches."
                : "No candidates match your search term or filter selection."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[1250px] text-left border-collapse border-spacing-0 font-sans text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-3.5 px-4 text-center w-12 whitespace-nowrap">#</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Candidate Details</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">CRM Application ID</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Exam Session</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Vendor</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Security Warnings</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Status</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Score Marks</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {paginatedCandidates.map((c, idx) => {
                  const rowNumber = startIndex + idx + 1;
                  const isLocked = c.status === "LOCKED" || c.attempt?.status === "LOCKED";
                  const isCompleted = c.status === "COMPLETED";
                  const warnings = c.attempt?.warningCount || 0;
                  const maxWarnings = c.assessment?.maxProctorWarnings || c.attempt?.maxProctorWarningsSnapshot || 3;

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isLocked ? "bg-red-50/40" : ""
                      }`}
                    >
                      {/* Row Index */}
                      <td className="py-3.5 px-4 text-center font-mono text-[11px] text-slate-400 font-bold">
                        {rowNumber}
                      </td>

                      {/* Candidate Name & Contact */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900">{c.name}</div>
                        <div className="text-[11px] text-slate-400">{c.email} • {c.phone}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <button
                            onClick={() => setSelectedHistoryCandidate({ id: c.id, name: c.name })}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 transition cursor-pointer"
                            title="Click to view attempt & reset logs"
                          >
                            <History size={10} className="text-blue-600" />
                            <span>Attempt #{c.totalAttemptsCount || (c.attempts?.length > 0 ? c.attempts.length : 1)}</span>
                            {c.resetsCount > 0 && (
                              <span className="text-[9px] bg-rose-100 text-rose-700 px-1 rounded font-bold">
                                {c.resetsCount} reset
                              </span>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Application ID */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                          {c.applicationId || c.referenceId || "N/A"}
                        </span>
                      </td>

                      {/* Assessment */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{c.assessment?.name || "Niva Bupa Assessment"}</div>
                        <div className="text-[10px] text-blue-600 font-bold">{c.assessment?.slug}</div>
                      </td>

                      {/* Vendor / Agency */}
                      <td className="py-3.5 px-4">
                        {c.vendor ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200">
                            <Building2 size={11} />
                            <span>{c.vendor.name}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">Direct / Admin</span>
                        )}
                      </td>

                      {/* Warnings */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center space-x-1.5 font-bold text-xs">
                          {isLocked ? (
                            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                          <span className={isLocked ? "text-red-700 font-black" : warnings > 0 ? "text-amber-700" : "text-slate-600"}>
                            {warnings} / {maxWarnings}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
                            <Lock className="w-3 h-3" /> LOCKED
                          </span>
                        ) : c.status === "COMPLETED" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Completed
                          </span>
                        ) : c.status === "IN_PROGRESS" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                            In Progress
                          </span>
                        ) : c.status === "DISQUALIFIED" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
                            Disqualified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            Registered
                          </span>
                        )}
                      </td>

                      {/* Score Marks */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        {c.status === "COMPLETED" ? (
                          <div>
                            <span className="font-extrabold text-xs text-slate-900">
                              {c.attempt?.score || 0} / {c.attempt?.totalPossibleScore || 60}
                            </span>
                            <div className="text-[10px] font-bold text-emerald-600">
                              ({c.attempt?.percentage || 0}%)
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {/* View Report Card Button for Completed Candidates */}
                          {isCompleted && (
                            <>
                              <button
                                onClick={() => handleDownloadSingleExcel(c.id)}
                                title="Download Individual Candidate Excel Report (4 Sheets)"
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-[11px] rounded-lg border border-emerald-200 transition flex items-center space-x-1 cursor-pointer"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Excel</span>
                              </button>

                              <button
                                onClick={() => handleOpenReport(c.id)}
                                title="View Detailed Diagnostic Report Card"
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-[11px] rounded-lg border border-blue-200 transition flex items-center space-x-1 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                                <span>Report Card</span>
                              </button>
                            </>
                          )}

                          {/* View Audit Report Button for Locked / Disqualified Candidates */}
                          {isLocked && (
                            <>
                              <button
                                onClick={() => handleOpenReport(c.id)}
                                title="View Security Audit Report"
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-extrabold text-[11px] rounded-lg border border-amber-200 transition flex items-center space-x-1 cursor-pointer"
                              >
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                                <span>Audit Log</span>
                              </button>

                              <button
                                onClick={() => handleUnlock(c.id, c.name)}
                                disabled={actionLoadingId === c.id}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg transition shadow-2xs flex items-center space-x-1 cursor-pointer"
                              >
                                <Unlock className="w-3 h-3" />
                                <span>{actionLoadingId === c.id ? "Unlocking..." : "Unlock"}</span>
                              </button>
                            </>
                          )}

                          {/* Assign Vendor Button for HR Admin */}
                          {userRole !== "VENDOR" && (
                            <button
                              onClick={() => handleOpenAssignVendor(c)}
                              title="Assign / Reassign Candidate to Vendor"
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-[11px] rounded-lg border border-blue-200 transition flex items-center space-x-1 cursor-pointer"
                            >
                              <Building2 className="w-3.5 h-3.5 text-blue-600" />
                              <span>Assign Vendor</span>
                            </button>
                          )}

                          {/* Reset Candidate Attempt & Re-invite Button */}
                          <button
                            onClick={() => setSelectedHistoryCandidate({ id: c.id, name: c.name })}
                            title="View Full Attempt & Reset Audit Logs"
                            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-200 transition flex items-center space-x-1 cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5 text-blue-600" />
                            <span>History</span>
                          </button>

                          <button
                            onClick={() => setResetCandidateTarget({ id: c.id, name: c.name, email: c.email })}
                            title="Reset Candidate Attempt & Resend Invitation (Clean & Send)"
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-extrabold text-[11px] rounded-lg border border-amber-200 transition flex items-center space-x-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                            <span>Reset & Send</span>
                          </button>

                          <button
                            onClick={() => setDeleteCandidateTarget({ id: c.id, name: c.name })}
                            title="Delete Candidate Record"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 50 Per Page Pagination Footer */}
        {filteredCandidates.length > 0 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-slate-600">
            <div>
              Showing <span className="text-slate-900 font-black">{startIndex + 1}</span> to{" "}
              <span className="text-slate-900 font-black">{endIndex}</span> of{" "}
              <span className="text-slate-900 font-black">{filteredCandidates.length}</span> candidates
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>

              <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-blue-600 font-black">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Candidate Diagnostic Report Modal Component */}
      <CandidateReportModal
        isOpen={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setSelectedReportCandidateId(null);
        }}
        candidateId={selectedReportCandidateId}
      />

      {/* Modern Confirm Delete Candidate Modal */}
      <ConfirmModal
        isOpen={!!deleteCandidateTarget}
        title="Delete Candidate Record"
        message={`Are you sure you want to permanently delete candidate '${deleteCandidateTarget?.name}' and all associated exam attempt and proctoring records?`}
        confirmText="Delete Candidate"
        cancelText="Cancel"
        isDanger={true}
        loading={deletingCandidate}
        onConfirm={confirmDeleteCandidate}
        onCancel={() => { if (!deletingCandidate) setDeleteCandidateTarget(null); }}
      />

      {/* 🔄 Interactive Reset Exam Attempt & Select Reason Modal */}
      {resetCandidateTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Reset Exam & Resend Link</h3>
                  <p className="text-xs text-slate-500 font-medium">Select reason trigger for audit log</p>
                </div>
              </div>
              <button
                onClick={() => { if (!resettingCandidate) setResetCandidateTarget(null); }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900">{resetCandidateTarget.name}</span>
                <span className="font-mono text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {resetCandidateTarget.email}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                Wipes past exam attempts, scores, and proctoring warnings (resets warning count to 0). Generates a fresh secure exam URL and sends a new invitation email.
              </p>
            </div>

            {/* Reason & Trigger Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                Select Reason & Trigger *
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {[
                  {
                    code: "DISQUALIFICATION_RECOVERY",
                    label: "Disqualification Recovery (3 Warnings / Tab Switches)",
                    desc: "Proctoring violations reset after verification",
                  },
                  {
                    code: "TECHNICAL_GLITCH",
                    label: "Technical / Network / Browser Interruption",
                    desc: "Power cut, system crash, or browser freeze",
                  },
                  {
                    code: "EXPIRED_WINDOW",
                    label: "Assessment Window Expired / Re-invite Request",
                    desc: "Candidate could not take test before expiration",
                  },
                  {
                    code: "RETAKE_APPROVAL",
                    label: "Management / Vendor Retake Approval",
                    desc: "Official approval for a second chance attempt",
                  },
                  {
                    code: "TESTING_VERIFICATION",
                    label: "Internal Testing & QA Verification",
                    desc: "Platform validation or test simulation",
                  },
                  {
                    code: "OTHER",
                    label: "Other / Custom Reason",
                    desc: "Provide custom notes below",
                  },
                ].map((r) => (
                  <label
                    key={r.code}
                    onClick={() => setResetReasonCode(r.code)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      resetReasonCode === r.code
                        ? "bg-blue-50/70 border-blue-500 text-blue-950 font-bold shadow-2xs"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-medium"
                    }`}
                  >
                    <input
                      type="radio"
                      name="resetReason"
                      value={r.code}
                      checked={resetReasonCode === r.code}
                      onChange={() => setResetReasonCode(r.code)}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="space-y-0.5">
                      <div className="text-xs">{r.label}</div>
                      <div className="text-[10px] text-slate-400">{r.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom Notes input if OTHER is selected */}
            {resetReasonCode === "OTHER" && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Custom Notes / Reason *</label>
                <textarea
                  rows={2}
                  placeholder="Enter detailed reason for candidate session reset..."
                  value={resetReasonText}
                  onChange={(e) => setResetReasonText(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={resettingCandidate}
                onClick={() => setResetCandidateTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resettingCandidate || (resetReasonCode === "OTHER" && !resetReasonText.trim())}
                onClick={confirmResetCandidate}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {resettingCandidate ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <RotateCcw size={14} />
                )}
                <span>{resettingCandidate ? "Resetting..." : "Confirm Reset & Log"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Candidate to Vendor Modal */}
      {assignCandidateTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Building2 size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Assign Candidate to Vendor</h3>
                  <p className="text-xs text-slate-500 font-medium">Link candidate batch to a partner vendor</p>
                </div>
              </div>
              <button
                onClick={() => setAssignCandidateTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="my-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="font-extrabold text-slate-800">{assignCandidateTarget.name}</div>
              <div className="text-slate-500">{assignCandidateTarget.email} • {assignCandidateTarget.phone}</div>
              <div className="text-[11px] text-blue-700 font-bold">App ID: {assignCandidateTarget.applicationId || "N/A"}</div>
            </div>

            <form onSubmit={handleSaveVendorAssignment} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">Select Target Vendor *</label>
                <select
                  value={targetVendorId}
                  onChange={(e) => setTargetVendorId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="">Direct / Admin (No Vendor)</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.vendorCode}) — {v.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignCandidateTarget(null)}
                  disabled={savingAssignment}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAssignment}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingAssignment ? "Saving..." : "Save Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Candidate Attempt & Reset Audit History Modal */}
      {selectedHistoryCandidate && (
        <CandidateResetHistoryModal
          candidateId={selectedHistoryCandidate.id}
          candidateName={selectedHistoryCandidate.name}
          isOpen={!!selectedHistoryCandidate}
          onClose={() => setSelectedHistoryCandidate(null)}
        />
      )}

      {/* Modern Floating Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
