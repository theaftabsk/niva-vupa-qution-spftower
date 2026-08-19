"use client";

import { useState, useEffect } from "react";
import {
  Archive,
  RotateCcw,
  Search,
  RefreshCw,
  FileText,
  UserX,
  Building2,
  Calendar,
  Clock,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import CandidateReportModal from "@/components/CandidateReportModal";

const getApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.includes("niva.greatcampus.in")) {
      return "https://api.niva.greatcampus.in";
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
};

interface ArchivedCandidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  applicationId?: string;
  referenceId: string;
  status: string;
  assessment?: {
    id: string;
    name: string;
    slug: string;
  };
  vendor?: {
    id: string;
    name: string;
    vendorCode: string;
    email: string;
  };
  deletedAt: string;
  deletedByRole: string; // "VENDOR" | "ADMIN"
  deletedById?: string;
  deletedByName?: string;
  deletedReason?: string;
  latestAttempt?: {
    id: string;
    status: string;
    score: number;
    totalPossibleScore: number;
    percentage: number;
  };
}

export default function ArchivePage() {
  const [archivedList, setArchivedList] = useState<ArchivedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "VENDOR" | "ADMIN">("ALL");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const fetchArchived = async () => {
    setLoading(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/candidates/archive/list`);
      if (res.ok) {
        const data = await res.json();
        setArchivedList(data.candidates || []);
      }
    } catch (err) {
      console.error("Failed to load archive:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchived();
  }, []);

  const handleRestore = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to RESTORE candidate "${name}" back to active status?`)) {
      return;
    }

    setRestoringId(id);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/candidates/${id}/restore`, {
        method: "POST",
      });

      if (res.ok) {
        setActionSuccess(`Candidate "${name}" has been restored successfully.`);
        setTimeout(() => setActionSuccess(null), 4000);
        fetchArchived();
      } else {
        alert("Failed to restore candidate.");
      }
    } catch (err) {
      console.error("Restore failed:", err);
      alert("Error restoring candidate.");
    } finally {
      setRestoringId(null);
    }
  };

  const filteredList = archivedList.filter((c) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(term)) ||
      (c.applicationId && c.applicationId.toLowerCase().includes(term)) ||
      c.referenceId.toLowerCase().includes(term) ||
      (c.vendor?.name && c.vendor.name.toLowerCase().includes(term)) ||
      (c.deletedByName && c.deletedByName.toLowerCase().includes(term));

    if (!matchesSearch) return false;
    if (roleFilter === "VENDOR") return c.deletedByRole === "VENDOR";
    if (roleFilter === "ADMIN") return c.deletedByRole === "ADMIN";
    return true;
  });

  const vendorDeletedCount = archivedList.filter((c) => c.deletedByRole === "VENDOR").length;
  const adminDeletedCount = archivedList.filter((c) => c.deletedByRole === "ADMIN").length;
  const withScoresCount = archivedList.filter((c) => c.latestAttempt && c.latestAttempt.status === "COMPLETED").length;

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {actionSuccess && (
        <div className="fixed top-20 right-8 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in text-sm font-bold">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 rounded-2xl text-white shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/10 text-amber-300 text-xs font-extrabold uppercase tracking-wider mb-2">
            <Archive className="w-3.5 h-3.5" /> Zero Permanent Deletion • Enterprise Archive
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Archive & Recycle Bin
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl font-medium">
            Complete audit trail of all deleted candidates. No exam results, submissions, or candidate records are ever permanently lost.
          </p>
        </div>

        <button
          onClick={fetchArchived}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-xs font-black transition-all border border-white/15 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Archive
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Total Archived</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{archivedList.length}</p>
          <span className="text-[11px] font-bold text-slate-500 mt-0.5 inline-block">Protected in Storage</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Deleted by Vendors</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{vendorDeletedCount}</p>
          <span className="text-[11px] font-bold text-amber-600/80 mt-0.5 inline-block">Hidden from Vendor UI</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Deleted by Admin</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{adminDeletedCount}</p>
          <span className="text-[11px] font-bold text-blue-600/80 mt-0.5 inline-block">Admin Soft Deletes</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Completed Exam Records</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{withScoresCount}</p>
          <span className="text-[11px] font-bold text-slate-500 mt-0.5 inline-block">Scores 100% Safe</span>
        </div>
      </div>

      {/* Control Bar: Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search candidate, email, ID, vendor..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-500 shrink-0">Filter By:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-blue-500 shadow-2xs"
          >
            <option value="ALL">All Deletions ({archivedList.length})</option>
            <option value="VENDOR">Vendor Deletions ({vendorDeletedCount})</option>
            <option value="ADMIN">Admin Deletions ({adminDeletedCount})</option>
          </select>
        </div>
      </div>

      {/* Archive Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Candidate Details</th>
                <th className="py-3.5 px-4">App / Ref ID</th>
                <th className="py-3.5 px-4">Assessment & Vendor</th>
                <th className="py-3.5 px-4">Deleted By (Audit)</th>
                <th className="py-3.5 px-4">Deleted Timestamp</th>
                <th className="py-3.5 px-4">Exam Score</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading archived candidates...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <UserX className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-bold text-slate-700">No Archived Candidates</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchTerm || roleFilter !== "ALL"
                        ? "No candidates matched your search filter."
                        : "No deleted candidates exist in the archive bin."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredList.map((c) => {
                  const isVendor = c.deletedByRole === "VENDOR";
                  const att = c.latestAttempt;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Candidate Name & Contact */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{c.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{c.email}</div>
                        <div className="text-[10px] text-slate-400">{c.phone}</div>
                      </td>

                      {/* App ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {c.applicationId || c.referenceId}
                      </td>

                      {/* Assessment & Vendor */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{c.assessment?.name || "Standard Assessment"}</div>
                        {c.vendor ? (
                          <div className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-bold mt-0.5">
                            <Building2 className="w-3 h-3" /> {c.vendor.name} ({c.vendor.vendorCode})
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Direct / Headstart</span>
                        )}
                      </td>

                      {/* Deleted By Audit */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                            isVendor
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-blue-100 text-blue-800 border border-blue-200"
                          }`}
                        >
                          {isVendor ? <UserX className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                          {isVendor ? `Vendor: ${c.deletedByName || c.vendor?.name || "Vendor"}` : `Admin: ${c.deletedByName || "HR Admin"}`}
                        </span>
                      </td>

                      {/* Deletion Date */}
                      <td className="py-3.5 px-4 text-[11px] text-slate-600">
                        <div className="flex items-center gap-1 font-semibold">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {c.deletedAt ? new Date(c.deletedAt).toLocaleDateString() : "—"}
                        </div>
                        <div className="flex items-center gap-1 text-slate-400 text-[10px] mt-0.5">
                          <Clock className="w-3 h-3" />
                          {c.deletedAt ? new Date(c.deletedAt).toLocaleTimeString() : "—"}
                        </div>
                      </td>

                      {/* Score */}
                      <td className="py-3.5 px-4">
                        {att ? (
                          <div>
                            <span className="font-bold text-slate-900">{att.score} / {att.totalPossibleScore || 60}</span>
                            <span className="text-[11px] text-slate-500 ml-1">({att.percentage}%)</span>
                            <span className={`block text-[10px] font-bold mt-0.5 ${
                              att.status === "COMPLETED" ? "text-emerald-600" : "text-amber-600"
                            }`}>
                              {att.status}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Not Attempted</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {att && (
                            <button
                              onClick={() => {
                                setSelectedCandidateId(c.id);
                                setIsReportModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                              title="View Candidate Report"
                            >
                              <FileText className="w-3.5 h-3.5" /> Report
                            </button>
                          )}

                          <button
                            onClick={() => handleRestore(c.id, c.name)}
                            disabled={restoringId === c.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                            title="Restore Candidate to Active List"
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${restoringId === c.id ? "animate-spin" : ""}`} />
                            {restoringId === c.id ? "Restoring..." : "Restore"}
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
      </div>

      {/* Candidate Scorecard & Proctoring Modal */}
      {selectedCandidateId && (
        <CandidateReportModal
          candidateId={selectedCandidateId}
          isOpen={isReportModalOpen}
          onClose={() => {
            setIsReportModalOpen(false);
            setSelectedCandidateId(null);
          }}
        />
      )}
    </div>
  );
}
