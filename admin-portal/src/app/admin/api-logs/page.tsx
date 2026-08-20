"use client";

import { useState, useEffect } from "react";
import {
  Terminal,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Building2,
  Eye,
  Copy,
  Check,
  Code,
  Activity,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface VendorApiLogItem {
  id: string;
  vendorId: string;
  vendor: {
    id: string;
    name: string;
    vendorCode: string;
    email: string;
  };
  apiType: string;
  endpoint: string;
  method: string;
  ipAddress?: string;
  status: string;
  statusCode: number;
  requestBody?: string;
  responseBody?: string;
  itemsCount: number;
  errorMessage?: string;
  createdAt: string;
}

interface VendorOption {
  id: string;
  name: string;
  vendorCode: string;
}

export default function VendorApiLogsPage() {
  const [logs, setLogs] = useState<VendorApiLogItem[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Filters
  const [selectedVendorId, setSelectedVendorId] = useState<string>("ALL");
  const [selectedApiType, setSelectedApiType] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Inspect Payload Modal
  const [selectedLog, setSelectedLog] = useState<VendorApiLogItem | null>(null);
  const [copiedPayload, setCopiedPayload] = useState<string | null>(null);

  const getApiBaseUrl = () => {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  };

  const fetchVendors = async () => {
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("banca_admin_token") || "";
      const res = await fetch(`${baseUrl}/api/v1/vendors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setVendors(data.map((v) => ({ id: v.id, name: v.name, vendorCode: v.vendorCode })));
      }
    } catch (e) {
      console.error("Failed to load vendors for filter:", e);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("banca_admin_token") || "";

      const params = new URLSearchParams();
      if (selectedVendorId !== "ALL") params.append("vendorId", selectedVendorId);
      if (selectedApiType !== "ALL") params.append("apiType", selectedApiType);
      if (selectedStatus !== "ALL") params.append("status", selectedStatus);
      params.append("page", String(page));
      params.append("limit", String(pageSize));

      const res = await fetch(`${baseUrl}/api/v1/vendors/api-logs/all?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setLogs(data.logs);
        setTotalLogs(data.total || 0);
      }
    } catch (e) {
      console.error("Failed to load API logs:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [selectedVendorId, selectedApiType, selectedStatus, page, pageSize]);

  const handleCopyJson = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPayload(type);
    setTimeout(() => setCopiedPayload(null), 2000);
  };

  // Stats calculation
  const successCount = logs.filter((l) => l.status === "SUCCESS" || l.statusCode < 400).length;
  const failedCount = logs.filter((l) => l.status === "FAILED" || l.statusCode >= 400).length;
  const totalItemsProcessed = logs.reduce((acc, l) => acc + (l.itemsCount || 0), 0);

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.vendor?.name?.toLowerCase().includes(q) ||
      log.vendor?.vendorCode?.toLowerCase().includes(q) ||
      log.apiType?.toLowerCase().includes(q) ||
      log.endpoint?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(totalLogs / pageSize) || 1;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Terminal size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">Vendor API Logs & Monitoring</h1>
              <p className="text-xs text-slate-500 font-medium">
                Live audit trail of all Vendor / Agency integration requests across assessments & candidates.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Requests</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalLogs}</h3>
            <span className="text-[11px] font-semibold text-slate-400">All recorded calls</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Activity size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Successful Calls</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{successCount}</h3>
            <span className="text-[11px] font-semibold text-emerald-600">200 OK / processed</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <CheckCircle2 size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Failed / Errors</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1">{failedCount}</h3>
            <span className="text-[11px] font-semibold text-rose-500">4xx / 5xx rejected</span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <XCircle size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Entities Processed</p>
            <h3 className="text-2xl font-black text-purple-600 mt-1">{totalItemsProcessed}</h3>
            <span className="text-[11px] font-semibold text-purple-600">Candidates & assessments</span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
            <Layers size={24} />
          </div>
        </div>
      </div>

      {/* Main Filter & Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Vendor Filter */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
              <Building2 size={13} className="text-slate-400" />
              <select
                value={selectedVendorId}
                onChange={(e) => {
                  setSelectedVendorId(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Vendors</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    [{v.vendorCode}] {v.name}
                  </option>
                ))}
              </select>
            </div>

            {/* API Type Filter */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
              <Code size={13} className="text-slate-400" />
              <select
                value={selectedApiType}
                onChange={(e) => {
                  setSelectedApiType(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All API Types</option>
                <option value="ASSESSMENT_CREATE">1. Assessment Create</option>
                <option value="CANDIDATE_ADD">2. Candidate Add / Links</option>
                <option value="ACTIVE_ASSESSMENTS">3. Active Assessments</option>
                <option value="CANDIDATE_STATUS">4. Candidate Status</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
              <Filter size={13} className="text-slate-400" />
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="SUCCESS">Success Only</option>
                <option value="FAILED">Failed / Error Only</option>
              </select>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-56">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Page Size Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Show:</span>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-0.5">
              {[10, 20, 50].map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setPageSize(size);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                    pageSize === size ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Content with fixed max-height & sticky header */}
        <div className="max-h-[520px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10 shadow-2xs">
              <tr className="text-slate-700 font-extrabold uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">API Action</th>
                <th className="py-3 px-4">Endpoint & Method</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Entities</th>
                <th className="py-3 px-4 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading API logs...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-medium">
                    <div className="flex flex-col items-center gap-2">
                      <Terminal size={32} className="text-slate-300" />
                      <span className="font-bold text-sm text-slate-700">No API logs found</span>
                      <span className="text-xs text-slate-400">
                        When vendors invoke integration APIs, all requests and payloads will appear here.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isSuccess = log.status === "SUCCESS" || log.statusCode < 400;
                  return (
                    <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
                      {/* Timestamp */}
                      <td className="py-2.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-slate-400" />
                          <span>{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                      </td>

                      {/* Vendor */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {log.vendor?.vendorCode || "VND"}
                          </span>
                          <span className="font-bold text-slate-900 truncate max-w-[150px]">
                            {log.vendor?.name || "Unknown"}
                          </span>
                        </div>
                      </td>

                      {/* API Action */}
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[11px] bg-blue-50 text-blue-700 border border-blue-200">
                          {log.apiType}
                        </span>
                      </td>

                      {/* Endpoint & Method */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                              log.method === "POST" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"
                            }`}
                          >
                            {log.method}
                          </span>
                          <span className="text-slate-700 truncate max-w-[200px]">{log.endpoint}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-extrabold text-[10px] ${
                            isSuccess
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {isSuccess ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                          <span>{log.statusCode || 200}</span>
                        </span>
                      </td>

                      {/* Entities Count */}
                      <td className="py-2.5 px-4 text-center font-black text-slate-800">
                        {log.itemsCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold text-[11px] border border-purple-200">
                            {log.itemsCount}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Payload Inspect Action */}
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 font-bold text-[11px] border border-slate-200 transition-colors cursor-pointer"
                        >
                          <Eye size={12} />
                          <span>View JSON</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="text-xs text-slate-500 font-semibold">
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalLogs)} of {totalLogs} requests
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
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* JSON Payload Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-xs font-mono">
                    {selectedLog.method} {selectedLog.endpoint}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Vendor: [{selectedLog.vendor?.vendorCode}] {selectedLog.vendor?.name}
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 mt-1">API Payload & Response Details</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
              {/* Request Payload */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Incoming Request Payload
                  </span>
                  {selectedLog.requestBody && (
                    <button
                      onClick={() => handleCopyJson(selectedLog.requestBody || "", "request")}
                      className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      {copiedPayload === "request" ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>Copy Request</span>
                    </button>
                  )}
                </div>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48">
                  {selectedLog.requestBody
                    ? JSON.stringify(JSON.parse(selectedLog.requestBody), null, 2)
                    : "No request body provided (GET Request)"}
                </pre>
              </div>

              {/* Response Payload */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    API Response Summary
                  </span>
                  {selectedLog.responseBody && (
                    <button
                      onClick={() => handleCopyJson(selectedLog.responseBody || "", "response")}
                      className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      {copiedPayload === "response" ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>Copy Response</span>
                    </button>
                  )}
                </div>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48">
                  {selectedLog.responseBody
                    ? JSON.stringify(JSON.parse(selectedLog.responseBody), null, 2)
                    : "No response body recorded"}
                </pre>
              </div>

              {/* Error Details (if failed) */}
              {selectedLog.errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs">
                    <AlertTriangle size={14} />
                    <span>Error Message</span>
                  </div>
                  <p className="text-xs text-rose-600 mt-1 font-mono">{selectedLog.errorMessage}</p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
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
