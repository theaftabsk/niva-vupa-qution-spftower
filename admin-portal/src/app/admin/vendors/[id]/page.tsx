"use client";

import { use, useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Users,
  FileText,
  Activity,
  Terminal,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Mail,
  Phone,
  ShieldCheck,
  Layers,
  ExternalLink,
  Plus,
  Eye,
  Award,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";

interface VendorDashboardData {
  vendor: {
    id: string;
    vendorCode: string;
    name: string;
    email: string;
    phone?: string;
    contactPerson?: string;
    apiKey?: string;
    status: string;
    creditLimit: number;
    creditUsed: number;
    creditRemaining: number;
    createdAt: string;
  };
  stats: {
    totalCandidates: number;
    notStarted: number;
    inProgress: number;
    completed: number;
    disqualified: number;
    totalAssessments: number;
    totalApiCalls: number;
  };
  assignedAssessments: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    durationMins: number;
    assignedAt: string;
    candidatesCount: number;
  }>;
  candidates: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    applicationId: string;
    vendorCandidateId?: string;
    assessmentName: string;
    assessmentSlug: string;
    status: string;
    examUrl: string;
    score: number;
    percentage: number;
    startedAt?: string;
    submittedAt?: string;
    createdAt: string;
  }>;
  apiLogs: Array<{
    id: string;
    apiType: string;
    endpoint: string;
    method: string;
    status: string;
    statusCode: number;
    requestBody?: string;
    responseBody?: string;
    itemsCount: number;
    errorMessage?: string;
    createdAt: string;
  }>;
}

export default function VendorDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const vendorId = resolvedParams.id;
  const router = useRouter();

  const [data, setData] = useState<VendorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "assessments" | "candidates" | "results" | "apilogs">("overview");

  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [regeneratingKey, setRegeneratingKey] = useState(false);

  // Filter & Pagination States
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateStatusFilter, setCandidateStatusFilter] = useState("ALL");
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidatePageSize, setCandidatePageSize] = useState<number>(20);

  const [resultsSearch, setResultsSearch] = useState("");
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsPageSize, setResultsPageSize] = useState<number>(20);

  const [apiLogsPage, setApiLogsPage] = useState(1);
  const [apiLogsPageSize, setApiLogsPageSize] = useState<number>(20);

  const getApiBaseUrl = () => {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  };

  const loadVendorDetails = async () => {
    setLoading(true);
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("banca_admin_token") || "";

      const res = await fetch(`${baseUrl}/api/v1/vendors/${vendorId}/dashboard-details`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (e) {
      console.error("Failed to load vendor details:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendorDetails();
  }, [vendorId]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleRegenerateKey = async () => {
    if (!confirm("Are you sure you want to regenerate this Vendor API Key? Existing integrations using the old key will need to be updated.")) {
      return;
    }
    setRegeneratingKey(true);
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("banca_admin_token") || "";
      const res = await fetch(`${baseUrl}/api/v1/vendors/${vendorId}/regenerate-api-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const resData = await res.json();
      if (resData.success && resData.apiKey) {
        if (data) {
          setData({
            ...data,
            vendor: { ...data.vendor, apiKey: resData.apiKey },
          });
        }
      }
    } catch (e) {
      console.error("Failed to regenerate API key:", e);
    } finally {
      setRegeneratingKey(false);
    }
  };

  const [resettingCandidateId, setResettingCandidateId] = useState<string | null>(null);

  const handleResetCandidate = async (candidateId: string, candidateName: string) => {
    if (!confirm(`Are you sure you want to Reset & Resend exam for "${candidateName}"? This will clear any past disqualification/attempts and generate a fresh link.`)) {
      return;
    }
    setResettingCandidateId(candidateId);
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("banca_admin_token") || "";
      const res = await fetch(`${baseUrl}/api/v1/candidates/${candidateId}/reset`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (result.success) {
        alert(`Candidate "${candidateName}" has been successfully reset! Fresh exam link generated.`);
        await loadVendorDetails();
      } else {
        alert(result.message || "Failed to reset candidate");
      }
    } catch (e: any) {
      alert(e.message || "Failed to reset candidate");
    } finally {
      setResettingCandidateId(null);
    }
  };

  // Filtered Candidates with pagination
  const filteredCandidates = useMemo(() => {
    if (!data?.candidates) return [];
    return data.candidates.filter((c) => {
      const matchesSearch =
        !candidateSearch ||
        c.name.toLowerCase().includes(candidateSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(candidateSearch.toLowerCase()) ||
        c.applicationId?.toLowerCase().includes(candidateSearch.toLowerCase()) ||
        c.assessmentName?.toLowerCase().includes(candidateSearch.toLowerCase());

      const matchesStatus =
        candidateStatusFilter === "ALL" || c.status === candidateStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [data?.candidates, candidateSearch, candidateStatusFilter]);

  const paginatedCandidates = useMemo(() => {
    const start = (candidatePage - 1) * candidatePageSize;
    return filteredCandidates.slice(start, start + candidatePageSize);
  }, [filteredCandidates, candidatePage, candidatePageSize]);

  const totalCandidatePages = Math.ceil(filteredCandidates.length / candidatePageSize) || 1;

  // Filtered Results with pagination
  const completedCandidates = useMemo(() => {
    if (!data?.candidates) return [];
    return data.candidates
      .filter((c) => c.status === "COMPLETED")
      .filter((c) => {
        if (!resultsSearch) return true;
        const q = resultsSearch.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.applicationId?.toLowerCase().includes(q)
        );
      });
  }, [data?.candidates, resultsSearch]);

  const paginatedResults = useMemo(() => {
    const start = (resultsPage - 1) * resultsPageSize;
    return completedCandidates.slice(start, start + resultsPageSize);
  }, [completedCandidates, resultsPage, resultsPageSize]);

  const totalResultsPages = Math.ceil(completedCandidates.length / resultsPageSize) || 1;

  // Paginated API Logs
  const paginatedApiLogs = useMemo(() => {
    if (!data?.apiLogs) return [];
    const start = (apiLogsPage - 1) * apiLogsPageSize;
    return data.apiLogs.slice(start, start + apiLogsPageSize);
  }, [data?.apiLogs, apiLogsPage, apiLogsPageSize]);

  const totalApiLogPages = Math.ceil((data?.apiLogs?.length || 0) / apiLogsPageSize) || 1;

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-bold text-xs text-slate-500 mt-3">Loading vendor profile & logs...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-center space-y-4">
        <h2 className="text-xl font-black text-slate-800">Vendor Not Found</h2>
        <Link href="/admin/vendors" className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Back to Vendors List
        </Link>
      </div>
    );
  }

  const { vendor, stats, assignedAssessments, apiLogs } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back Link */}
      <div>
        <Link
          href="/admin/vendors"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to All Vendors</span>
        </Link>
      </div>

      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 font-black flex items-center justify-center text-lg shrink-0 shadow-xs">
            {vendor.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-slate-900">{vendor.name}</h1>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                {vendor.vendorCode}
              </span>
              <span
                className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                  vendor.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {vendor.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-medium pt-1">
              <span className="flex items-center gap-1">
                <Mail size={13} className="text-blue-500" />
                {vendor.email}
              </span>
              {vendor.phone && (
                <span className="flex items-center gap-1">
                  <Phone size={13} className="text-slate-400" />
                  {vendor.phone}
                </span>
              )}
              {vendor.contactPerson && (
                <span className="text-slate-500 font-semibold">Contact: {vendor.contactPerson}</span>
              )}
            </div>

            {/* API Key Chip */}
            {vendor.apiKey && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Vendor API Key:</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 font-mono text-xs font-bold border border-purple-200">
                  <KeyRound size={12} className="text-purple-600" />
                  <span>{vendor.apiKey}</span>
                </span>
                <button
                  onClick={() => handleCopy(vendor.apiKey || "", "top-api-key")}
                  className="p-1 hover:bg-purple-100 rounded-md text-purple-600 hover:text-purple-900 cursor-pointer"
                  title="Copy API Key"
                >
                  {copiedText === "top-api-key" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
                <button
                  onClick={handleRegenerateKey}
                  disabled={regeneratingKey}
                  className="text-[11px] text-purple-700 hover:underline font-semibold cursor-pointer disabled:opacity-50"
                >
                  {regeneratingKey ? "Regenerating..." : "Regenerate Key"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Credit Gauge Box */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 min-w-[240px] space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-600 uppercase tracking-wider">Exam Credits</span>
            <span className="text-blue-700">{vendor.creditUsed} / {vendor.creditLimit} Used</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all"
              style={{
                width: `${Math.min(100, Math.round((vendor.creditUsed / (vendor.creditLimit || 1)) * 100))}%`,
              }}
            ></div>
          </div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>Remaining: <strong className="text-slate-800">{vendor.creditRemaining}</strong></span>
            <span>Allocated: {vendor.creditLimit}</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-4 rounded-t-2xl shadow-2xs">
        <button
          onClick={() => setActiveTab("overview")}
          className={`py-3.5 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "overview"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Activity size={14} />
          <span>Overview & KPIs</span>
        </button>

        <button
          onClick={() => setActiveTab("assessments")}
          className={`py-3.5 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "assessments"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText size={14} />
          <span>Assigned Assessments ({assignedAssessments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("candidates")}
          className={`py-3.5 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "candidates"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users size={14} />
          <span>Candidates ({filteredCandidates.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("results")}
          className={`py-3.5 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "results"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Award size={14} />
          <span>Exam Results ({completedCandidates.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("apilogs")}
          className={`py-3.5 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "apilogs"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Terminal size={14} />
          <span>API Logs ({apiLogs.length})</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Total Candidates</p>
              <h3 className="text-xl font-black text-slate-900 mt-1">{stats.totalCandidates}</h3>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Not Started</p>
              <h3 className="text-xl font-black text-amber-600 mt-1">{stats.notStarted}</h3>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase">In Progress</p>
              <h3 className="text-xl font-black text-blue-600 mt-1">{stats.inProgress}</h3>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Completed</p>
              <h3 className="text-xl font-black text-emerald-600 mt-1">{stats.completed}</h3>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Disqualified</p>
              <h3 className="text-xl font-black text-rose-600 mt-1">{stats.disqualified}</h3>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase">API Calls</p>
              <h3 className="text-xl font-black text-purple-600 mt-1">{stats.totalApiCalls}</h3>
            </div>
          </div>

          {/* Quick Summary Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Candidates */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">Recent Candidates</h3>
                <button
                  onClick={() => setActiveTab("candidates")}
                  className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  View All ({data.candidates.length})
                </button>
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {data.candidates.slice(0, 6).map((c) => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between pr-1">
                    <div>
                      <p className="font-bold text-xs text-slate-900">{c.name}</p>
                      <p className="text-[11px] text-slate-500">{c.email} | App: {c.applicationId}</p>
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        c.status === "COMPLETED"
                          ? "bg-emerald-50 text-emerald-700"
                          : c.status === "IN_PROGRESS"
                          ? "bg-blue-50 text-blue-700"
                          : c.status === "DISQUALIFIED"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent API Requests */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">Recent API Invocations</h3>
                <button
                  onClick={() => setActiveTab("apilogs")}
                  className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  View All Logs ({apiLogs.length})
                </button>
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {apiLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between pr-1">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="font-bold text-blue-700">{log.method}</span>
                        <span className="text-slate-700">{log.endpoint}</span>
                      </div>
                      <p className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleTimeString()}</p>
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        log.status === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {log.statusCode || 200}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Assigned Assessments */}
      {activeTab === "assessments" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Assigned Assessments ({assignedAssessments.length})
            </h3>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10">
                <tr className="text-slate-700 font-extrabold uppercase">
                  <th className="py-3 px-4">Assessment Name</th>
                  <th className="py-3 px-4">Slug & Link</th>
                  <th className="py-3 px-4 text-center">Duration</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Candidates Enrolled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignedAssessments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold">
                      No assessments assigned to this vendor yet.
                    </td>
                  </tr>
                ) : (
                  assignedAssessments.map((a) => (
                    <tr key={a.id} className="hover:bg-blue-50/30">
                      <td className="py-3 px-4 font-bold text-slate-900">{a.name}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-blue-600">/{a.slug}</td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-600">{a.durationMins || 45} mins</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-black text-slate-800">{a.candidatesCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Candidates */}
      {activeTab === "candidates" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Controls Bar: Search, Status Filter & Page Size */}
          <div className="p-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search candidate, app id..."
                  value={candidateSearch}
                  onChange={(e) => {
                    setCandidateSearch(e.target.value);
                    setCandidatePage(1);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
                <Filter size={13} className="text-slate-400" />
                <select
                  value={candidateStatusFilter}
                  onChange={(e) => {
                    setCandidateStatusFilter(e.target.value);
                    setCandidatePage(1);
                  }}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Statuses ({data.candidates.length})</option>
                  <option value="NOT_STARTED">Not Started</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="DISQUALIFIED">Disqualified</option>
                </select>
              </div>
            </div>

            {/* Page Size Selector (20 / 50 per page) */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Show:</span>
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-0.5">
                {[10, 20, 50].map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setCandidatePageSize(size);
                      setCandidatePage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                      candidatePageSize === size
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table Container with max-height & clean scrolling */}
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10 shadow-2xs">
                <tr className="text-slate-700 font-extrabold uppercase">
                  <th className="py-3 px-4">Candidate Details</th>
                  <th className="py-3 px-4">App ID / Reference</th>
                  <th className="py-3 px-4">Assessment</th>
                  <th className="py-3 px-4">Unique Exam Link</th>
                  <th className="py-3 px-4 text-center">Exam Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-semibold">
                      No candidates match the filter.
                    </td>
                  </tr>
                ) : (
                  paginatedCandidates.map((c) => (
                    <tr key={c.id} className="hover:bg-blue-50/30">
                      <td className="py-2.5 px-4">
                        <div className="font-bold text-slate-900">{c.name}</div>
                        <div className="text-[11px] text-slate-500">{c.email} {c.phone ? `• ${c.phone}` : ''}</div>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] font-bold text-slate-700">
                        {c.applicationId}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{c.assessmentName}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <input
                            readOnly
                            value={c.examUrl}
                            className="px-2 py-1 bg-slate-50 rounded border border-slate-200 text-[10px] font-mono text-slate-600 max-w-[180px] truncate"
                          />
                          <button
                            onClick={() => handleCopy(c.examUrl, c.id)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 cursor-pointer shrink-0"
                            title="Copy Exam URL"
                          >
                            {copiedText === c.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] ${
                            c.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : c.status === "IN_PROGRESS"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : c.status === "DISQUALIFIED"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => handleResetCandidate(c.id, c.name)}
                          disabled={resettingCandidateId === c.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-200 transition-colors cursor-pointer disabled:opacity-50"
                          title="Clear past attempts & generate fresh exam link"
                        >
                          <RotateCcw size={11} className={resettingCandidateId === c.id ? "animate-spin text-amber-600" : "text-amber-600"} />
                          <span>Reset & Resend</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs text-slate-500 font-semibold">
              Showing {(candidatePage - 1) * candidatePageSize + 1} - {Math.min(candidatePage * candidatePageSize, filteredCandidates.length)} of {filteredCandidates.length} candidates
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCandidatePage((p) => Math.max(1, p - 1))}
                disabled={candidatePage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-3 py-1 text-xs font-bold text-slate-700">
                Page {candidatePage} of {totalCandidatePages}
              </span>
              <button
                onClick={() => setCandidatePage((p) => Math.min(totalCandidatePages, p + 1))}
                disabled={candidatePage >= totalCandidatePages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Results */}
      {activeTab === "results" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Controls Bar */}
          <div className="p-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
            <div className="relative w-full sm:w-64">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search result by candidate..."
                value={resultsSearch}
                onChange={(e) => {
                  setResultsSearch(e.target.value);
                  setResultsPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Show:</span>
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-0.5">
                {[10, 20, 50].map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setResultsPageSize(size);
                      setResultsPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                      resultsPageSize === size
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10 shadow-2xs">
                <tr className="text-slate-700 font-extrabold uppercase">
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">Assessment</th>
                  <th className="py-3 px-4 text-center">Obtained Marks</th>
                  <th className="py-3 px-4 text-center">Percentage</th>
                  <th className="py-3 px-4">Submitted Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedResults.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold">
                      No candidates have completed the exam yet.
                    </td>
                  </tr>
                ) : (
                  paginatedResults.map((c) => (
                    <tr key={c.id} className="hover:bg-blue-50/30">
                      <td className="py-2.5 px-4 font-bold text-slate-900">{c.name}</td>
                      <td className="py-2.5 px-4 text-slate-700 font-medium">{c.assessmentName}</td>
                      <td className="py-2.5 px-4 text-center font-black text-slate-900">{c.score} / 60</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[11px]">
                          {c.percentage}%
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 font-medium">
                        {c.submittedAt ? new Date(c.submittedAt).toLocaleString() : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Results Pagination */}
          {completedCandidates.length > 0 && (
            <div className="p-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs text-slate-500 font-semibold">
                Showing {(resultsPage - 1) * resultsPageSize + 1} - {Math.min(resultsPage * resultsPageSize, completedCandidates.length)} of {completedCandidates.length} results
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setResultsPage((p) => Math.max(1, p - 1))}
                  disabled={resultsPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-3 py-1 text-xs font-bold text-slate-700">
                  Page {resultsPage} of {totalResultsPages}
                </span>
                <button
                  onClick={() => setResultsPage((p) => Math.min(totalResultsPages, p + 1))}
                  disabled={resultsPage >= totalResultsPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: API Logs */}
      {activeTab === "apilogs" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              API Requests from {vendor.name} ({apiLogs.length})
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Show:</span>
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-0.5">
                {[10, 20, 50].map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setApiLogsPageSize(size);
                      setApiLogsPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                      apiLogsPageSize === size
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10 shadow-2xs">
                <tr className="text-slate-700 font-extrabold uppercase">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Endpoint</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedApiLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-semibold">
                      No API logs recorded for this vendor yet.
                    </td>
                  </tr>
                ) : (
                  paginatedApiLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-blue-50/30">
                      <td className="py-2.5 px-4 text-slate-600 font-medium whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="py-2.5 px-4 font-bold text-blue-700">{log.apiType}</td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-700">{log.method} {log.endpoint}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            log.status === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {log.statusCode || 200}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-slate-800">{log.itemsCount}</td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 font-bold text-[11px] cursor-pointer"
                        >
                          Inspect JSON
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* API Logs Pagination */}
          {apiLogs.length > 0 && (
            <div className="p-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs text-slate-500 font-semibold">
                Showing {(apiLogsPage - 1) * apiLogsPageSize + 1} - {Math.min(apiLogsPage * apiLogsPageSize, apiLogs.length)} of {apiLogs.length} logs
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setApiLogsPage((p) => Math.max(1, p - 1))}
                  disabled={apiLogsPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-3 py-1 text-xs font-bold text-slate-700">
                  Page {apiLogsPage} of {totalApiLogPages}
                </span>
                <button
                  onClick={() => setApiLogsPage((p) => Math.min(totalApiLogPages, p + 1))}
                  disabled={apiLogsPage >= totalApiLogPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* JSON Payload Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900">API Payload: {selectedLog.apiType}</h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <XCircle size={18} />
              </button>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase">Request Body</span>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono mt-1 overflow-x-auto max-h-40">
                {selectedLog.requestBody ? JSON.stringify(JSON.parse(selectedLog.requestBody), null, 2) : "None"}
              </pre>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase">Response Body</span>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono mt-1 overflow-x-auto max-h-40">
                {selectedLog.responseBody ? JSON.stringify(JSON.parse(selectedLog.responseBody), null, 2) : "None"}
              </pre>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
