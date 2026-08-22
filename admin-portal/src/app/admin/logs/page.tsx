"use client";

import { useState, useEffect } from "react";
import {
  Coins,
  Search,
  Filter,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Building2,
  User,
  Activity,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";

export default function ExamCreditsHistoryPage() {
  const [histories, setHistories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [quotaData, setQuotaData] = useState<any>(null);

  // Fetch Credit Activity Logs & Tenant Quota
  const fetchCreditLogs = async () => {
    setLoading(true);
    try {
      const apiUrl = getApiBaseUrl();
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...(filterType !== "ALL" && { type: filterType }),
        ...(search.trim() !== "" && { search: search.trim() }),
      });

      const [logRes, quotaRes] = await Promise.all([
        fetch(`${apiUrl}/api/v1/credits/history?${params.toString()}`),
        fetch(`${apiUrl}/api/v1/credits/quota`),
      ]);

      const logData = await logRes.json();
      const qData = await quotaRes.json();

      if (logData.success) {
        setHistories(logData.histories || []);
        setTotalPages(logData.totalPages || 1);
        setTotalRecords(logData.total || 0);
      }

      if (qData.success) {
        setQuotaData(qData);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditLogs();
  }, [page, pageSize, filterType]);

  const allocatedLimit = Number(quotaData?.credit?.creditLimit ?? quotaData?.tenant?.creditLimit ?? 0);
  const usedCredits = Number(quotaData?.credit?.usedCredit ?? quotaData?.tenant?.usedCredit ?? 0);
  const remainingCredits = Number(
    quotaData?.credit?.remainingCredit ??
    quotaData?.remainingCredit ??
    Math.max(0, allocatedLimit - usedCredits)
  );

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Coins className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Exam Credits & Allocation History
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Financial & credit deduction ledger. 1 credit is consumed per candidate exam attempt (-1 per launch).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setPage(1);
              fetchCreditLogs();
            }}
            title="Refresh Logs"
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Credit KPI Overview Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Allocated Limit</span>
            <strong className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-0.5 block">
              {allocatedLimit.toLocaleString()}
            </strong>
            <span className="text-[10px] text-slate-400 font-medium">Total purchased/granted pool</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Coins className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Consumed</span>
            <strong className="text-2xl sm:text-3xl font-black text-rose-600 font-mono mt-0.5 block">
              {usedCredits.toLocaleString()}
            </strong>
            <span className="text-[10px] text-rose-600/80 font-medium">Exam launches & retakes</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Remaining Balance</span>
            <strong className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono mt-0.5 block">
              {remainingCredits.toLocaleString()}
            </strong>
            <span className="text-[10px] text-emerald-600/80 font-medium">Available for new exams</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search candidate, description, reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  fetchCreditLogs();
                }
              }}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-600 cursor-pointer"
          >
            <option value="ALL">All Transaction Types</option>
            <option value="DEDUCTION">Deductions (-1 Exam Starts)</option>
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
                <th className="py-3 px-4">Candidate / Context</th>
                <th className="py-3 px-4">Description / Audit Trail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading Credit Audit Ledger...
                  </td>
                </tr>
              ) : histories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">
                    No credit activity records found matching criteria.
                  </td>
                </tr>
              ) : (
                histories.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/50 transition">
                    {/* Timestamp */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      <div className="font-bold text-slate-800">
                        {new Date(h.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(h.createdAt).toLocaleTimeString()}
                      </div>
                    </td>

                    {/* Transaction Type */}
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] inline-flex items-center gap-1 ${
                          h.type === "DEDUCTION"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : h.type === "ALLOCATION"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {h.type === "DEDUCTION" ? <ArrowDownRight size={11} /> : <ArrowUpRight size={11} />}
                        {h.type}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 font-mono font-black text-xs">
                      <span className={h.amount < 0 ? "text-rose-600" : "text-emerald-600"}>
                        {h.amount > 0 ? `+${h.amount}` : h.amount} Credit
                      </span>
                    </td>

                    {/* Balance After */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {h.balanceAfter}
                    </td>

                    {/* Candidate Details */}
                    <td className="py-3 px-4">
                      {h.candidateDetails ? (
                        <div>
                          <div className="font-bold text-slate-900">{h.candidateDetails.name}</div>
                          <div className="text-[10px] text-slate-400">{h.candidateDetails.email}</div>
                          {h.candidateDetails.applicationId && (
                            <div className="text-[10px] text-blue-600 font-bold font-mono">
                              App ID: {h.candidateDetails.applicationId}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] font-medium">System Pool</span>
                      )}
                    </td>

                    {/* Description */}
                    <td className="py-3 px-4 font-medium text-slate-700 max-w-sm">
                      <p className="leading-relaxed text-[11px]">{h.description}</p>
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
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalRecords)} of {totalRecords} records
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
