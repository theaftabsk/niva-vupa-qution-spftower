"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  KeyRound,
  FileText,
  Copy,
  Check,
  RefreshCw,
  Edit2,
  Trash2,
  ShieldCheck,
  UserCheck,
  Building2,
  Phone,
  Mail,
  AlertCircle,
  Activity,
  Layers,
} from "lucide-react";

interface AssessmentItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  durationMins: number;
}

interface VendorItem {
  id: string;
  vendorCode: string;
  name: string;
  email: string;
  phone?: string;
  contactPerson?: string;
  status: string;
  creditUsed: number;
  totalCandidates: number;
  totalAssessments: number;
  assignedAssessments: AssessmentItem[];
  createdAt: string;
}

export default function VendorsManagementPage() {
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorItem | null>(null);

  // Add Vendor Form
  const [newVendor, setNewVendor] = useState({
    name: "",
    email: "",
    password: "Vendor@" + Math.floor(100 + Math.random() * 900),
    phone: "",
    contactPerson: "",
    assignedAssessmentIds: [] as string[],
  });

  // Edit / Reset Password Form
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    contactPerson: "",
    status: "ACTIVE",
    newPassword: "",
  });

  // Assign Assessment Checkboxes
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const getApiBaseUrl = () => {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("banca_admin_token") || "";

      // 1. Fetch Vendors
      const vRes = await fetch(`${baseUrl}/api/v1/vendors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const vData = await vRes.json();
      if (Array.isArray(vData)) {
        setVendors(vData);
      }

      // 2. Fetch Assessments
      const aRes = await fetch(`${baseUrl}/api/v1/assessments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const aData = await aRes.json();
      if (aData.success && Array.isArray(aData.assessments)) {
        setAssessments(aData.assessments);
      }
    } catch (err: any) {
      showToast("error", err.message || "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(text);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendor.name || !newVendor.email) {
      showToast("error", "Vendor Name and Unique Email are required.");
      return;
    }

    setSaving(true);
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("banca_admin_token") || "";

      const res = await fetch(`${baseUrl}/api/v1/vendors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newVendor),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create vendor");
      }

      showToast("success", `Vendor "${newVendor.name}" created successfully!`);
      setShowAddModal(false);
      setNewVendor({
        name: "",
        email: "",
        password: "Vendor@" + Math.floor(100 + Math.random() * 900),
        phone: "",
        contactPerson: "",
        assignedAssessmentIds: [],
      });
      await loadData();
    } catch (err: any) {
      showToast("error", err.message || "Error creating vendor");
    } finally {
      setSaving(false);
    }
  };

  const openAssignModal = async (vendor: VendorItem) => {
    setSelectedVendor(vendor);
    setSelectedAssessmentIds(vendor.assignedAssessments.map((a) => a.id));
    setShowAssignModal(true);
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("banca_admin_token") || "";
      const aRes = await fetch(`${baseUrl}/api/v1/assessments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const aData = await aRes.json();
      if (aData.success && Array.isArray(aData.assessments)) {
        setAssessments(aData.assessments);
      }
    } catch {}
  };

  const handleSaveAssignments = async () => {
    if (!selectedVendor) return;
    setSaving(true);
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("banca_admin_token") || "";

      const res = await fetch(`${baseUrl}/api/v1/vendors/${selectedVendor.id}/assign-assessments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          assessmentIds: selectedAssessmentIds,
          assignedBy: "Admin",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to assign assessments");

      showToast("success", `Updated assigned assessments for "${selectedVendor.name}"`);
      setShowAssignModal(false);
      await loadData();
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (vendor: VendorItem) => {
    setSelectedVendor(vendor);
    setEditForm({
      name: vendor.name,
      phone: vendor.phone || "",
      contactPerson: vendor.contactPerson || "",
      status: vendor.status || "ACTIVE",
      newPassword: "",
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor) return;

    setSaving(true);
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("banca_admin_token") || "";

      const payload: any = {
        name: editForm.name,
        phone: editForm.phone,
        contactPerson: editForm.contactPerson,
        status: editForm.status,
      };

      if (editForm.newPassword.trim()) {
        payload.password = editForm.newPassword.trim();
      }

      const res = await fetch(`${baseUrl}/api/v1/vendors/${selectedVendor.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update vendor");

      showToast("success", `Vendor "${editForm.name}" updated successfully!`);
      setShowEditModal(false);
      await loadData();
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVendor = async (vendor: VendorItem) => {
    if (!confirm(`Are you sure you want to remove Vendor "${vendor.name}"? Candidates will remain safe but will be unlinked from this vendor.`)) {
      return;
    }

    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("banca_admin_token") || "";

      const res = await fetch(`${baseUrl}/api/v1/vendors/${vendor.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete vendor");

      showToast("success", data.message || "Vendor deleted");
      await loadData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const filteredVendors = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.vendorCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.contactPerson && v.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalCandidatesAll = vendors.reduce((acc, v) => acc + (v.totalCandidates || 0), 0);
  const totalCreditAll = vendors.reduce((acc, v) => acc + (v.creditUsed || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold text-white transition-all ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Building2 size={22} />
            </span>
            <div>
              <h1 className="text-xl font-black text-slate-900">Vendors Management</h1>
              <p className="text-xs text-slate-500 font-medium">
                Create vendor logins, assign specific assessments, and monitor isolated candidate batches.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition-all font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            title="Refresh Vendors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Add New Vendor</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Vendors</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{vendors.length}</h3>
            <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 mt-1">
              <ShieldCheck size={12} /> {vendors.filter((v) => v.status === "ACTIVE").length} Active
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Users size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor Candidates</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalCandidatesAll}</h3>
            <span className="text-[11px] font-semibold text-slate-500 mt-1">Uploaded across vendors</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <UserCheck size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor Exam Usage</p>
            <h3 className="text-2xl font-black text-blue-600 mt-1">{totalCreditAll}</h3>
            <span className="text-[11px] font-semibold text-slate-500 mt-1">Exams launched</span>
          </div>
          <div className="p-3 bg-cyan-50 text-cyan-600 rounded-2xl">
            <Activity size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Assessments</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{assessments.length}</h3>
            <span className="text-[11px] font-semibold text-slate-500 mt-1">Available to assign</span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
            <Layers size={24} />
          </div>
        </div>
      </div>

      {/* Vendors Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Search & Filter Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search vendor name, code, email, contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="text-xs font-bold text-slate-500">
            Showing {filteredVendors.length} of {vendors.length} Vendor(s)
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-700 font-extrabold uppercase tracking-wider">
                <th className="py-3 px-4">Vendor Code & Name</th>
                <th className="py-3 px-4">Login Credentials</th>
                <th className="py-3 px-4">Assigned Assessments</th>
                <th className="py-3 px-4 text-center">Candidates</th>
                <th className="py-3 px-4 text-center">Exam Credits</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading vendor accounts...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-medium">
                    <div className="flex flex-col items-center gap-2">
                      <Building2 size={32} className="text-slate-300" />
                      <span className="font-bold text-sm text-slate-700">No vendors found</span>
                      <span className="text-xs text-slate-400">Click &quot;Add New Vendor&quot; above to create the first vendor account.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-blue-50/30 transition-colors">
                    {/* Name & Code */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 font-black flex items-center justify-center text-xs shrink-0">
                          {vendor.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-black text-slate-900 flex items-center gap-1.5">
                            <span>{vendor.name}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              {vendor.vendorCode}
                            </span>
                          </div>
                          {vendor.contactPerson && (
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Contact: {vendor.contactPerson}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Email & Phone */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Mail size={12} className="text-blue-500 shrink-0" />
                          <span>{vendor.email}</span>
                          <button
                            onClick={() => handleCopy(vendor.email)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Copy email"
                          >
                            {copiedEmail === vendor.email ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                          </button>
                        </div>
                        {vendor.phone && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
                            <Phone size={11} className="text-slate-400 shrink-0" />
                            <span>{vendor.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Assigned Assessments */}
                    <td className="py-3.5 px-4">
                      {vendor.assignedAssessments && vendor.assignedAssessments.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {vendor.assignedAssessments.map((a) => (
                            <span
                              key={a.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200"
                            >
                              <FileText size={10} />
                              <span className="truncate max-w-[120px]">{a.name}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          No Tests Assigned
                        </span>
                      )}
                    </td>

                    {/* Candidates Count */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-extrabold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {vendor.totalCandidates || 0}
                      </span>
                    </td>

                    {/* Credit Used */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                        {vendor.creditUsed || 0}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          vendor.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {vendor.status === "ACTIVE" ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                        {vendor.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openAssignModal(vendor)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                          title="Assign Assessments"
                        >
                          <FileText size={12} />
                          <span>Assign</span>
                        </button>

                        <button
                          onClick={() => openEditModal(vendor)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-all cursor-pointer"
                          title="Edit Details / Reset Password"
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          onClick={() => handleDeleteVendor(vendor)}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-all cursor-pointer"
                          title="Remove Vendor"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL 1: ADD NEW VENDOR ────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Building2 size={18} />
                </span>
                <h3 className="font-black text-base text-slate-900">Create New Vendor Account</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVendor} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-extrabold text-slate-700 mb-1">
                  Vendor Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Recruitment Solutions"
                  value={newVendor.name}
                  onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-extrabold text-slate-700 mb-1">
                    Unique Login Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="vendor1@example.com"
                    value={newVendor.email}
                    onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-slate-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Vendor@123"
                    value={newVendor.password}
                    onChange={(e) => setNewVendor({ ...newVendor, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-extrabold text-slate-700 mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Kumar"
                    value={newVendor.contactPerson}
                    onChange={(e) => setNewVendor({ ...newVendor, contactPerson: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +91 9876543210"
                    value={newVendor.phone}
                    onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Assign Initial Tests */}
              <div>
                <label className="block font-extrabold text-slate-700 mb-1">
                  Assign Initial Assessments (Optional)
                </label>
                <div className="max-h-36 overflow-y-auto p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                  {assessments.length === 0 ? (
                    <p className="text-slate-400 text-center py-2">No assessments available.</p>
                  ) : (
                    assessments.map((a) => (
                      <label
                        key={a.id}
                        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={newVendor.assignedAssessmentIds.includes(a.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewVendor({
                                ...newVendor,
                                assignedAssessmentIds: [...newVendor.assignedAssessmentIds, a.id],
                              });
                            } else {
                              setNewVendor({
                                ...newVendor,
                                assignedAssessmentIds: newVendor.assignedAssessmentIds.filter((id) => id !== a.id),
                              });
                            }
                          }}
                          className="rounded text-blue-600"
                        />
                        <span className="font-bold text-slate-800">{a.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({a.durationMins}m)</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5"
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>{saving ? "Creating..." : "Create Vendor Account"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: ASSIGN ASSESSMENTS ────────────────────────────────────── */}
      {showAssignModal && selectedVendor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-900">
                  Assign Assessments to {selectedVendor.name}
                </h3>
                <p className="text-[11px] text-slate-500 font-semibold">
                  Vendor will only see and upload candidates to checked assessments.
                </p>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-700">Available Assessments ({assessments.length})</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAssessmentIds(assessments.map((a) => a.id))}
                    className="text-blue-600 font-bold hover:underline cursor-pointer text-[11px]"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedAssessmentIds([])}
                    className="text-slate-500 font-bold hover:underline cursor-pointer text-[11px]"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                {assessments.length === 0 ? (
                  <p className="text-slate-400 text-center py-4">No assessments found.</p>
                ) : (
                  assessments.map((a) => {
                    const isChecked = selectedAssessmentIds.includes(a.id);
                    return (
                      <label
                        key={a.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isChecked
                            ? "bg-blue-50 border-blue-300 text-blue-900"
                            : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAssessmentIds([...selectedAssessmentIds, a.id]);
                              } else {
                                setSelectedAssessmentIds(selectedAssessmentIds.filter((id) => id !== a.id));
                              }
                            }}
                            className="rounded text-blue-600 w-4 h-4"
                          />
                          <div>
                            <span className="font-bold block">{a.name}</span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              Duration: {a.durationMins} mins • Slug: {a.slug}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            a.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-700"
                              : a.status === "UPCOMING"
                              ? "bg-sky-100 text-sky-700"
                              : a.status === "EXPIRED"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {a.status}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignments}
                  disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5"
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>{saving ? "Saving..." : "Save Assessment Assignments"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: EDIT VENDOR & RESET PASSWORD ─────────────────────────── */}
      {showEditModal && selectedVendor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-900">
                  Edit Vendor & Reset Password
                </h3>
                <p className="text-[11px] text-slate-500 font-semibold">{selectedVendor.vendorCode} • {selectedVendor.email}</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 mt-4 text-xs">
              <div>
                <label className="block font-extrabold text-slate-700 mb-1">Vendor Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-extrabold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={editForm.contactPerson}
                    onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-extrabold text-slate-700 mb-1">Vendor Account Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-600 bg-white"
                >
                  <option value="ACTIVE">ACTIVE (Can log in & manage candidates)</option>
                  <option value="SUSPENDED">SUSPENDED (Login temporarily blocked)</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1.5">
                <div className="flex items-center gap-1.5 font-extrabold text-amber-900">
                  <KeyRound size={14} />
                  <span>Reset Vendor Password (Optional)</span>
                </div>
                <p className="text-[11px] text-amber-700">Leave blank to keep the current password unchanged.</p>
                <input
                  type="text"
                  placeholder="Enter new password (e.g. NewPass@2026)"
                  value={editForm.newPassword}
                  onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-amber-300 font-semibold text-slate-900 bg-white focus:outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5"
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>{saving ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
