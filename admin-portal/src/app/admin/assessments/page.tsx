"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BookOpen, Plus, Clock, Link2, Copy, CheckCircle2, Trash2,
  Edit2, RefreshCw, X, Calendar, AlertCircle, Zap, Users,
  Eye, EyeOff, ExternalLink, Search, Filter, ChevronLeft, ChevronRight,
  Building2, ShieldCheck, Terminal
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import ToastContainer, { ToastMessage } from "@/components/Toast";
import { getApiBaseUrl } from "@/lib/config";

interface AssessmentSession {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
  activeFrom?: string;
  activeUntil?: string;
  durationMins: number;
  totalQuestions: number;
  totalCandidates: number;
  passingPercentage: number;
  maxProctorWarnings: number;
  uniqueCandidateLink: string;
  vendorAssignments?: Array<{
    vendorId?: string;
    vendorName?: string;
    vendorCode?: string;
    assignedBy?: string;
    assignedAt?: string;
  }>;
  assignedVendors?: Array<{
    id: string;
    name: string;
    vendorCode: string;
  }>;
  createdAt: string;
}

const EXAM_DURATION_MINS = 45;
const TOTAL_QUESTIONS = 60;

function getComputedStatus(session: AssessmentSession): "ACTIVE" | "UPCOMING" | "EXPIRED" | "INACTIVE" | "DRAFT" {
  if (session.status === "INACTIVE") return "INACTIVE";
  if (session.status === "DRAFT") return "DRAFT";
  const now = new Date();
  if (session.activeFrom && now < new Date(session.activeFrom)) return "UPCOMING";
  if (session.activeUntil && now > new Date(session.activeUntil)) return "EXPIRED";
  return "ACTIVE";
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ACTIVE:   { label: "Active",   cls: "status-active" },
    UPCOMING: { label: "Upcoming", cls: "status-upcoming" },
    EXPIRED:  { label: "Expired",  cls: "status-expired" },
    INACTIVE: { label: "Inactive", cls: "status-inactive" },
    DRAFT:    { label: "Draft",    cls: "status-draft" },
  };
  const s = map[status] || map["INACTIVE"];
  return <span className={`session-status-badge ${s.cls}`}>{s.label}</span>;
}

function formatDatetimeLocal(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDisplay(iso?: string | null) {
  if (!iso) return "Not set";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function getDisplayExamLink(rawLink: string) {
  if (!rawLink) return "";
  if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    let slugOrId = rawLink;
    if (rawLink.includes("assessment=")) {
      slugOrId = rawLink.split("assessment=")[1];
    } else if (rawLink.includes("/")) {
      const parts = rawLink.split("/");
      slugOrId = parts[parts.length - 1];
    }
    return `http://localhost:3000/${slugOrId}`;
  }
  return rawLink;
}

export default function AdminAssessmentsPage() {
  const [sessions, setSessions] = useState<AssessmentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("ADMIN");
  const [vendorId, setVendorId] = useState<string | null>(null);

  // Toast state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: "success" | "error" | "warning" | "info", message: string, title?: string) => {
    setToasts((prev) => [...prev, { id: Math.random().toString(36).substring(2, 9), type, message, title }]);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Delete Confirm Modal State
  const [deleteTarget, setDeleteTarget] = useState<AssessmentSession | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal]     = useState(false);
  const [editTarget, setEditTarget]           = useState<AssessmentSession | null>(null);

  // Form
  const emptyForm = {
    name: "",
    description: "",
    durationMins: 45,
    activeFrom: "",
    activeUntil: "",
    passingPercentage: 50,
    maxProctorWarnings: 3,
    status: "ACTIVE",
  };
  const [form, setForm]     = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
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
          setVendorId(activeVendorId);
        } catch {}
      }

      const headers: any = { Authorization: `Bearer ${token}` };
      const params = new URLSearchParams();
      if (activeRole === "VENDOR" && activeVendorId) {
        params.append("vendorId", activeVendorId);
      }

      const queryStr = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${getApiBaseUrl()}/api/v1/assessments${queryStr}`, { headers });
      const data = await res.json();
      if (data.success) setSessions(data.assessments || []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const copyLink = (session: AssessmentSession) => {
    const linkToCopy = getDisplayExamLink(session.uniqueCandidateLink);
    navigator.clipboard.writeText(linkToCopy).then(() => {
      setCopiedId(session.id);
      addToast("info", "Candidate exam link copied to clipboard.", "Link Copied");
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const openCreate = () => {
    setForm({ ...emptyForm });
    setFormError("");
    setShowCreateModal(true);
  };

  const openEdit = (session: AssessmentSession) => {
    setEditTarget(session);
    setForm({
      name: session.name,
      description: session.description || "",
      durationMins: session.durationMins || 45,
      activeFrom: formatDatetimeLocal(session.activeFrom),
      activeUntil: formatDatetimeLocal(session.activeUntil),
      passingPercentage: session.passingPercentage,
      maxProctorWarnings: session.maxProctorWarnings,
      status: (session.status === "INACTIVE" || session.status === "DRAFT") ? session.status : "ACTIVE",
    });
    setFormError("");
    setShowEditModal(true);
  };

  const handleSave = async (isEdit: boolean) => {
    if (!form.name.trim()) { setFormError("Session name is required."); return; }
    setSaving(true);
    setFormError("");
    try {
      let isoActiveFrom: string | null | undefined = undefined;
      if (form.activeFrom && form.activeFrom.trim() !== "") {
        const d = new Date(form.activeFrom);
        if (!isNaN(d.getTime())) {
          isoActiveFrom = d.toISOString();
        }
      } else if (isEdit) {
        isoActiveFrom = null;
      }

      let isoActiveUntil: string | null | undefined = undefined;
      if (form.activeUntil && form.activeUntil.trim() !== "") {
        const d = new Date(form.activeUntil);
        if (!isNaN(d.getTime())) {
          isoActiveUntil = d.toISOString();
        }
      } else if (isEdit) {
        isoActiveUntil = null;
      }

      const payload: any = {
        name: form.name.trim(),
        description: form.description || undefined,
        durationMins: 45,
        activeFrom: isoActiveFrom,
        activeUntil: isoActiveUntil,
        passingPercentage: Number(form.passingPercentage),
        maxProctorWarnings: Number(form.maxProctorWarnings),
        status: form.status,
      };
      if (isEdit && editTarget) payload.id = editTarget.id;

      const res  = await fetch(`${getApiBaseUrl()}/api/v1/assessments/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Save failed");

      setShowCreateModal(false);
      setShowEditModal(false);
      addToast("success", isEdit ? "Assessment session updated successfully." : "New assessment session created successfully.", "Success");
      await loadSessions();
    } catch (err: any) {
      setFormError(err.message || "Failed to save session.");
    } finally { setSaving(false); }
  };

  const confirmDeleteSession = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`${getApiBaseUrl()}/api/v1/assessments/${deleteTarget.id}`, { method: "DELETE" });
      addToast("success", `Assessment session '${deleteTarget.name}' deleted.`, "Session Deleted");
      setDeleteTarget(null);
      await loadSessions();
    } catch {
      addToast("error", "Failed to delete assessment session.", "Error");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (session: AssessmentSession) => {
    const computed = getComputedStatus(session);
    if (computed === "EXPIRED" && session.status !== "ACTIVE") {
      addToast("warning", "This assessment session has expired. To activate it, click Edit and set a future 'Until' end date.", "Session Expired");
      openEdit(session);
      return;
    }
    const newStatus = session.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/assessments/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id, name: session.name, status: newStatus }),
      });
      const data = await res.json();
      if (!data.success) {
        addToast("error", data.message || "Failed to update status.", "Status Error");
      } else {
        addToast("success", `Session status updated to ${newStatus}.`, "Status Updated");
      }
      await loadSessions();
    } catch {
      addToast("error", "Connection error updating status.", "Network Error");
    }
  };

  // Filter and Pagination State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const filteredSessions = sessions.filter((s) => {
    const computed = getComputedStatus(s);
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      s.name.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      s.vendorAssignments?.some(va => va.vendorName?.toLowerCase().includes(q) || va.vendorCode?.toLowerCase().includes(q));

    const matchesStatus = statusFilter === "ALL" || computed === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredSessions.length / pageSize) || 1;
  const paginatedSessions = filteredSessions.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="assess-container">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="assess-header">
        <div>
          <h1>Exams & Assessments</h1>
          <p>
            {userRole === "VENDOR"
              ? "View and access assessment sessions assigned to your agency"
              : "Create unique candidate exam links with scheduled access windows"}
          </p>
        </div>
        <div className="assess-header-actions">
          <button className="assess-refresh-btn" onClick={loadSessions} title="Refresh Sessions">
            <RefreshCw size={15} /> Refresh List
          </button>
          {userRole !== "VENDOR" && (
            <button className="assess-create-btn" onClick={openCreate}>
              <Plus size={16} /> New Assessment Session
            </button>
          )}
        </div>
      </div>

      {/* Fixed Exam Info Banner */}
      <div className="assess-fixed-banner">
        <div className="assess-fixed-item"><Zap size={15} /> <strong>60 Questions</strong> — Shared Bank</div>
        <div className="assess-fixed-divider" />
        <div className="assess-fixed-item"><Clock size={15} /> <strong>45 Mins Default</strong> — Configurable</div>
        <div className="assess-fixed-divider" />
        <div className="assess-fixed-item"><BookOpen size={15} /> All sessions generate unique exam URLs</div>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", background: "#fff", padding: "12px 16px", borderRadius: "14px", border: "1px solid #E2E8F0", marginBottom: "16px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", flex: 1 }}>
          <div style={{ position: "relative", minWidth: "220px" }}>
            <Search size={13} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
            <input
              type="text"
              placeholder="Search assessment, slug, vendor..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              style={{ width: "100%", paddingLeft: "30px", paddingRight: "10px", paddingTop: "6px", paddingBottom: "6px", fontSize: "12px", fontWeight: "600", borderRadius: "10px", border: "1px solid #CBD5E1", outline: "none" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: "10px", padding: "4px 10px" }}>
            <Filter size={12} color="#64748B" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ background: "transparent", border: "none", fontSize: "12px", fontWeight: "700", color: "#334155", outline: "none", cursor: "pointer" }}
            >
              <option value="ALL">All Statuses ({sessions.length})</option>
              <option value="ACTIVE">Active</option>
              <option value="UPCOMING">Upcoming</option>
              <option value="EXPIRED">Expired</option>
              <option value="INACTIVE">Inactive</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>
        </div>

        {/* Page Size Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748B" }}>Show:</span>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#F1F5F9", padding: "2px", borderRadius: "8px" }}>
            {[25, 50, 100].map((size) => (
              <button
                key={size}
                onClick={() => { setPageSize(size); setPage(1); }}
                style={{
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: "800",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  background: pageSize === size ? "#0F172A" : "transparent",
                  color: pageSize === size ? "#FFFFFF" : "#475569",
                  transition: "all 0.15s ease",
                }}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Session Grid */}
      {loading ? (
        <div className="assess-loading">
          <div className="assess-spinner"></div>
          <p>Loading assessment sessions...</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="assess-empty">
          <BookOpen size={42} className="assess-empty-icon" />
          <p>
            {userRole === "VENDOR"
              ? "No assessments assigned to your vendor account yet. Please contact HR Administrator."
              : "No assessment sessions match your search/filter."}
          </p>
          {userRole !== "VENDOR" && sessions.length === 0 && (
            <button className="assess-create-btn" onClick={openCreate} style={{ margin: "16px auto 0" }}>
              <Plus size={15} /> Create First Session
            </button>
          )}
        </div>
      ) : (
        <div className="assess-excel-wrapper" style={{ maxHeight: "560px", overflowY: "auto", border: "1px solid #E2E8F0", borderRadius: "14px", background: "#fff" }}>
          <table className="assess-excel-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
              <tr>
                <th style={{ minWidth: "240px", padding: "12px 16px" }}>Session Details & Creator</th>
                <th style={{ width: "100px", minWidth: "100px" }}>Status</th>
                <th style={{ minWidth: "140px" }}>Configuration</th>
                <th style={{ minWidth: "180px" }}>Access Schedule Window</th>
                <th style={{ minWidth: "260px" }}>Unique Candidate Link</th>
                <th style={{ width: "140px", minWidth: "140px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSessions.map((session) => {
                const computedStatus = getComputedStatus(session);
                const isCopied = copiedId === session.id;
                const displayLink = getDisplayExamLink(session.uniqueCandidateLink);

                // Determine Creator Origin
                const isApiCreated = session.vendorAssignments?.[0]?.assignedBy?.startsWith("API:");
                const vendorName = session.vendorAssignments?.[0]?.vendorName || session.assignedVendors?.[0]?.name;
                const vendorCode = session.vendorAssignments?.[0]?.vendorCode || session.assignedVendors?.[0]?.vendorCode;

                return (
                  <tr key={session.id} className={`assess-excel-row assess-excel-row--${computedStatus.toLowerCase()}`}>
                    
                    {/* Col 1: Session Name & Creator Origin */}
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={`/admin/assessments/${session.id}`} style={{ textDecoration: "none" }}>
                        <div className="excel-session-name" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#003F72", cursor: "pointer", fontWeight: "800" }}>
                          {session.name}
                          <ExternalLink size={12} color="#00AEEF" />
                        </div>
                      </Link>
                      
                      {/* Creator Badge & Timestamp */}
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                        {isApiCreated ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "800", background: "#F3E8FF", color: "#7E22CE", border: "1px solid #D8B4FE" }}>
                            <Terminal size={10} /> API: {vendorName || vendorCode || "Vendor"}
                          </span>
                        ) : vendorName ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "800", background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
                            <Building2 size={10} /> Vendor: {vendorName}
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "800", background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1" }}>
                            <ShieldCheck size={10} /> Super Admin
                          </span>
                        )}

                        <span style={{ fontSize: "10px", color: "#94A3B8", fontWeight: "600" }}>
                          • Created: {new Date(session.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                      </div>

                      {session.description && <div className="excel-session-desc" style={{ marginTop: "4px", fontSize: "11px", color: "#64748B" }}>{session.description}</div>}
                    </td>

                    {/* Col 2: Status */}
                    <td>
                      <StatusBadge status={computedStatus} />
                    </td>

                    {/* Col 3: Configuration Specs */}
                    <td>
                      <div className="excel-specs">
                        <span className="excel-spec-tag"><BookOpen size={12} /> {TOTAL_QUESTIONS} Qs</span>
                        <span className="excel-spec-tag"><Clock size={12} /> {session.durationMins || EXAM_DURATION_MINS} Mins</span>
                        <span className="excel-spec-tag"><Users size={12} /> {session.totalCandidates} Users</span>
                      </div>
                    </td>

                    {/* Col 4: Active Schedule Window */}
                    <td>
                      <div className="excel-window-box">
                        <div><span className="excel-window-lbl">From:</span> {formatDisplay(session.activeFrom)}</div>
                        <div><span className="excel-window-lbl">Until:</span> {formatDisplay(session.activeUntil)}</div>
                      </div>
                    </td>

                    {/* Col 5: Candidate Exam Link */}
                    <td>
                      <div className="excel-link-cell">
                        <div className="excel-link-box" title={displayLink}>
                          <Link2 size={12} className="text-blue-600 flex-shrink-0" />
                          <span className="excel-link-text">{displayLink}</span>
                        </div>
                        <button
                          className={`excel-copy-btn ${isCopied ? "excel-copy-btn--copied" : ""}`}
                          onClick={() => copyLink(session)}
                        >
                          {isCopied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                          {isCopied ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </td>

                    {/* Col 6: Actions */}
                    <td>
                      <div className="excel-actions">
                        <Link href={`/admin/assessments/${session.id}`} className="excel-act-btn excel-act-edit" title="Open Assessment Dashboard" style={{ textDecoration: "none", background: "#EFF6FF", color: "#00AEEF", borderColor: "#BFDBFE" }}>
                          <ExternalLink size={13} />
                        </Link>
                        {userRole !== "VENDOR" && (
                          <>
                            <button className="excel-act-btn excel-act-edit" onClick={() => openEdit(session)} title="Edit Session">
                              <Edit2 size={13} />
                            </button>
                            {computedStatus !== "EXPIRED" && (
                              <button
                                className={`excel-act-btn ${session.status === "ACTIVE" ? "excel-act-deactivate" : "excel-act-activate"}`}
                                onClick={() => handleToggleStatus(session)}
                                title={session.status === "ACTIVE" ? "Deactivate" : "Activate"}
                              >
                                {session.status === "ACTIVE" ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                            )}
                            <button className="excel-act-btn excel-act-delete" onClick={() => setDeleteTarget(session)} title="Delete Session">
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination Footer */}
          {filteredSessions.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0" }}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>
                Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filteredSessions.length)} of {filteredSessions.length} sessions
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#fff", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: "12px", fontWeight: "800", color: "#1E293B", padding: "0 8px" }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#fff", cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.4 : 1 }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {(showCreateModal || showEditModal) && (
        <div className="assess-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowCreateModal(false); setShowEditModal(false); }}}>
          <div className="assess-modal">
            <div className="assess-modal-header">
              <h2>{showCreateModal ? "Create Assessment Session" : "Edit Session"}</h2>
              <button className="assess-modal-close" onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}>
                <X size={18} />
              </button>
            </div>

            {/* Banner */}
            <div className="assess-modal-fixed-info">
              <Zap size={14} /> Shared Question Bank · <strong>60 Questions</strong> per candidate attempt
            </div>

            <div className="assess-modal-body">
              {formError && (
                <div className="assess-form-error">
                  <AlertCircle size={15} /> {formError}
                </div>
              )}

              <div className="assess-form-group">
                <label>Session Title / Role *</label>
                <input
                  type="text"
                  placeholder="e.g. Agency Unit Manager & ARM Banca Assessment"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="assess-form-input font-bold"
                />
              </div>

              <div className="assess-form-group">
                <label>Description (optional)</label>
                <input
                  type="text"
                  placeholder="Brief note for candidates or internal record"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="assess-form-input"
                />
              </div>

              <div className="assess-form-row">
                <div className="assess-form-group">
                  <label><Calendar size={13} /> Active From (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.activeFrom}
                    onChange={(e) => setForm({ ...form, activeFrom: e.target.value })}
                    className="assess-form-input"
                  />
                  <span className="assess-form-hint">Leave blank to start immediately</span>
                </div>

                <div className="assess-form-group">
                  <label><Calendar size={13} /> Active Until (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.activeUntil}
                    onChange={(e) => setForm({ ...form, activeUntil: e.target.value })}
                    className="assess-form-input"
                  />
                  <span className="assess-form-hint">Leave blank for no expiration</span>
                </div>
              </div>

              <div className="assess-form-row assess-form-row--3">
                <div className="assess-form-group">
                  <label><Clock size={13} /> Duration (Mins)</label>
                  <input
                    type="number"
                    value={45}
                    disabled
                    readOnly
                    className="assess-form-input font-bold bg-slate-100 cursor-not-allowed opacity-90"
                  />
                  <span className="assess-form-hint text-[10px] text-emerald-600 font-bold">Fixed 45 Mins (60 Questions)</span>
                </div>

                <div className="assess-form-group">
                  <label>Passing %</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={form.passingPercentage}
                    onChange={(e) => setForm({ ...form, passingPercentage: Number(e.target.value) })}
                    className="assess-form-input"
                  />
                </div>

                <div className="assess-form-group">
                  <label>Max Warnings</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={form.maxProctorWarnings}
                    onChange={(e) => setForm({ ...form, maxProctorWarnings: Number(e.target.value) })}
                    className="assess-form-input"
                  />
                </div>
              </div>

              <div className="assess-form-group">
                <label>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="assess-form-input font-bold text-blue-600"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>

            <div className="assess-modal-footer">
              <button className="assess-modal-cancel" onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}>
                Cancel
              </button>
              <button
                className="assess-modal-save"
                onClick={() => handleSave(showEditModal)}
                disabled={saving}
              >
                {saving ? "Saving..." : showCreateModal ? "Create Session" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Assessment Session"
        message={`Are you sure you want to permanently delete '${deleteTarget?.name}'? This will also remove all candidate records and exam attempts associated with this session.`}
        confirmText="Delete Session"
        cancelText="Cancel"
        isDanger={true}
        loading={deleting}
        onConfirm={confirmDeleteSession}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
      />

      {/* Floating Modern Toast Alerts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <style>{`
        .assess-page { padding: 28px 36px; width: 100%; max-width: 100%; margin: 0; background-color: #f8fafc; min-height: calc(100vh - 64px); box-sizing: border-box; }
        
        .assess-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; width: 100%; }
        .assess-header-left { display: flex; align-items: center; gap: 14px; }
        .assess-header-icon { width: 44px; height: 44px; border-radius: 12px; background: #2563eb; display: flex; align-items: center; justify-content: center; color: #ffffff; flex-shrink: 0; box-shadow: 0 4px 12px rgba(37,99,235,0.25); }
        .assess-title { font-size: 1.4rem; font-weight: 800; color: #0f172a; margin: 0; tracking: -0.02em; }
        .assess-subtitle { font-size: 0.84rem; color: #64748b; margin-top: 2px; font-weight: 500; }
        .assess-header-actions { display: flex; gap: 10px; align-items: center; }
        .assess-refresh-btn { background: #ffffff; border: 1px solid #cbd5e1; color: #334155; border-radius: 10px; padding: 9px 16px; font-size: 0.84rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 7px; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .assess-refresh-btn:hover { background: #f1f5f9; border-color: #94a3b8; color: #0f172a; }
        .assess-create-btn { background: #2563eb; border: none; color: #ffffff; border-radius: 10px; padding: 9px 18px; font-size: 0.86rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 7px; transition: background 0.2s; box-shadow: 0 4px 12px rgba(37,99,235,0.25); }
        .assess-create-btn:hover { background: #1d4ed8; }

        .assess-fixed-banner { display: flex; align-items: center; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 14px; padding: 12px 20px; margin-bottom: 24px; flex-wrap: wrap; gap: 10px; width: 100%; box-sizing: border-box; }
        .assess-fixed-item { display: flex; align-items: center; gap: 7px; font-size: 0.85rem; color: #1d4ed8; font-weight: 600; }
        .assess-fixed-divider { width: 1px; height: 16px; background: #93c5fd; margin: 0 8px; }

        .assess-loading { text-align: center; padding: 60px; color: #64748b; font-size: 0.9rem; font-weight: 600; display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; }
        .assess-spinner { width: 28px; height: 28px; border: 3px solid #2563eb; border-top-color: transparent; border-radius: 50%; animation: assessSpin 0.8s linear infinite; }
        @keyframes assessSpin { to { transform: rotate(360deg); } }

        .assess-empty { text-align: center; padding: 80px 20px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; color: #64748b; width: 100%; box-sizing: border-box; }
        .assess-empty-icon { margin: 0 auto 12px; color: #94a3b8; }

        .assess-excel-wrapper { width: 100%; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 14px; overflow-x: auto; -webkit-overflow-scrolling: touch; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .assess-excel-table { width: 100%; min-width: 1050px; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
        .assess-excel-table th { background: #f1f5f9; color: #334155; font-size: 0.76rem; font-weight: 800; text-transform: uppercase; padding: 14px 16px; border-bottom: 2px solid #cbd5e1; letter-spacing: 0.5px; white-space: nowrap; }
        .assess-excel-table td { padding: 14px 16px; vertical-align: middle; border-bottom: 1px solid #e2e8f0; }
        .assess-excel-row { transition: background 0.15s; }
        .assess-excel-row:hover { background: #f8fafc; }
        .assess-excel-row--expired { opacity: 0.85; }

        .excel-session-name { font-weight: 800; color: #0f172a; font-size: 0.95rem; }
        .excel-session-desc { font-size: 0.76rem; color: #64748b; font-weight: 500; margin-top: 3px; max-width: 320px; line-height: 1.4; }

        .excel-specs { display: flex; flex-wrap: wrap; gap: 6px; }
        .excel-spec-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; font-weight: 700; background: #f1f5f9; color: #334155; padding: 4px 9px; border-radius: 6px; border: 1px solid #cbd5e1; white-space: nowrap; }

        .excel-window-box { font-size: 0.78rem; display: flex; flex-direction: column; gap: 3px; color: #0f172a; font-weight: 600; }
        .excel-window-lbl { color: #64748b; font-weight: 500; font-size: 0.75rem; }

        .excel-link-cell { display: flex; align-items: center; gap: 8px; }
        .excel-link-box { display: flex; align-items: center; gap: 6px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 10px; font-family: monospace; font-size: 0.75rem; color: #1e293b; font-weight: 600; overflow: hidden; flex: 1; min-width: 0; max-width: 300px; }
        .excel-link-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .excel-copy-btn { display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; font-weight: 700; padding: 6px 12px; border-radius: 8px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; cursor: pointer; transition: all 0.2s; white-space: nowrap; flex-shrink: 0; }
        .excel-copy-btn:hover { background: #dbeafe; }
        .excel-copy-btn--copied { border-color: #86efac; background: #f0fdf4; color: #166534; }

        .excel-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; min-width: 130px; }
        .excel-act-btn { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; border: 1px solid transparent; cursor: pointer; transition: all 0.2s; }
        .excel-act-edit       { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
        .excel-act-edit:hover { background: #dbeafe; }
        .excel-act-deactivate       { background: #fef3c7; color: #92400e; border-color: #fde68a; }
        .excel-act-deactivate:hover { background: #fde68a; }
        .excel-act-activate       { background: #dcfce7; color: #166534; border-color: #86efac; }
        .excel-act-activate:hover { background: #bbf7d0; }
        .excel-act-delete       { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
        .excel-act-delete:hover { background: #fecaca; }
        .assess-action-btn { display: flex; align-items: center; gap: 5px; font-size: 0.78rem; font-weight: 700; padding: 7px 13px; border-radius: 9px; border: 1px solid transparent; cursor: pointer; transition: all 0.2s; }
        .assess-action-btn--edit       { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
        .assess-action-btn--edit:hover { background: #dbeafe; }
        .assess-action-btn--deactivate       { background: #fef3c7; border-color: #fde68a; color: #92400e; }
        .assess-action-btn--deactivate:hover { background: #fde68a; }
        .assess-action-btn--activate       { background: #dcfce7; border-color: #86efac; color: #166534; }
        .assess-action-btn--activate:hover { background: #bbf7d0; }
        .assess-action-btn--delete       { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }
        .assess-action-btn--delete:hover { background: #fecaca; }

        /* Modal */
        .assess-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; backdrop-filter: blur(4px); }
        .assess-modal { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; width: 100%; max-width: 540px; max-height: 92vh; overflow-y: auto; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); }
        .assess-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; }
        .assess-modal-header h2 { font-size: 1.1rem; font-weight: 800; color: #0f172a; margin: 0; }
        .assess-modal-close { background: #f1f5f9; border: none; color: #64748b; cursor: pointer; padding: 5px; border-radius: 8px; display: flex; align-items: center; }
        .assess-modal-close:hover { color: #0f172a; background: #e2e8f0; }
        .assess-modal-fixed-info { display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: #eff6ff; border-bottom: 1px solid #bfdbfe; font-size: 0.8rem; color: #1d4ed8; font-weight: 600; }
        .assess-modal-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; }
        .assess-form-group { display: flex; flex-direction: column; gap: 4px; }
        .assess-form-group label { font-size: 0.78rem; font-weight: 700; color: #475569; display: flex; align-items: center; gap: 5px; }
        .assess-form-input { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 9px; padding: 8px 12px; color: #0f172a; font-size: 0.85rem; font-weight: 500; outline: none; transition: border-color 0.2s, box-shadow 0.2s; width: 100%; box-sizing: border-box; }
        .assess-form-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.15); }
        .assess-form-hint { font-size: 0.72rem; color: #64748b; font-weight: 500; }
        .assess-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .assess-form-row--3 { grid-template-columns: 1fr 1fr 1fr; }
        .assess-form-error { display: flex; align-items: center; gap: 8px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 9px 12px; font-size: 0.8rem; color: #dc2626; font-weight: 600; }
        .assess-modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid #e2e8f0; background: #f8fafc; border-bottom-left-radius: 20px; border-bottom-right-radius: 20px; }
        .assess-modal-cancel { background: #ffffff; border: 1px solid #cbd5e1; color: #475569; border-radius: 9px; padding: 8px 16px; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
        .assess-modal-save { background: #2563eb; border: none; color: #ffffff; border-radius: 9px; padding: 8px 20px; font-size: 0.85rem; font-weight: 700; cursor: pointer; box-shadow: 0 2px 6px rgba(37,99,235,0.3); }
        .assess-modal-save:hover { background: #1d4ed8; }
        .assess-modal-save:disabled { opacity: 0.6; cursor: not-allowed; }
        
        @media (max-width: 600px) {
          .assess-form-row { grid-template-columns: 1fr; }
          .assess-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
