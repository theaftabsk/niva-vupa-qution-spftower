"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, Printer, Award, CheckCircle2, XCircle, Clock,
  AlertTriangle, ShieldCheck, FileText, MessageSquare, User,
  Calendar, Sparkles, BarChart3, ShieldAlert, Send, Camera, Maximize2,
  FileSpreadsheet
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";

export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const candidateId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "responses" | "proctoring" | "screenshots" | "remarks">("overview");
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [newRemark, setNewRemark] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);

  useEffect(() => {
    if (!candidateId) return;

    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/candidates/${candidateId}/report`);
        const data = await res.json();
        if (data.success) {
          setReport(data);
        } else {
          setError(data.message || "Failed to load candidate diagnostic report.");
        }
      } catch (err: any) {
        setError(err.message || "Network error loading report.");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [candidateId]);

  const handleSaveRemark = async () => {
    if (!candidateId || !newRemark.trim()) return;
    setSavingRemark(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/candidates/${candidateId}/remarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remark: newRemark }),
      });
      const data = await res.json();
      if (data.success) {
        setReport((prev: any) =>
          prev
            ? {
                ...prev,
                remarks: [
                  {
                    id: data.remark.id,
                    adminId: "admin",
                    action: "REMARK",
                    reason: newRemark,
                    createdAt: new Date().toISOString(),
                  },
                  ...prev.remarks,
                ],
              }
            : null
        );
        setNewRemark("");
      }
    } catch {
      alert("Failed to save remark.");
    } finally {
      setSavingRemark(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-extrabold text-slate-600">Generating Candidate Diagnostic Report...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-12 text-center max-w-lg mx-auto">
        <XCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-black text-slate-900">Report Unavailable</h2>
        <p className="text-xs text-slate-500 mt-1">{error || "Candidate record not found."}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
        >
          Return to Candidates
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* Top Breadcrumb & Print Bar */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <Link href="/admin/candidates" className="hover:text-blue-600 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> All Candidates
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-extrabold">{report.candidate.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const baseUrl = getApiBaseUrl();
              window.open(`${baseUrl}/api/v1/candidates/${candidateId}/export-excel`, '_blank');
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> Download Excel
          </button>
        </div>
      </div>

      {/* Main Candidate Scorecard Banner */}
      <div className="bg-gradient-to-br from-[#003F72] via-[#005B94] to-[#00AEEF] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-[11px] font-black uppercase tracking-wider mb-3">
              <User className="w-3.5 h-3.5" />
              Application ID: {report.candidate.applicationId}
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">{report.candidate.name}</h1>
            <p className="text-xs sm:text-sm text-blue-100 font-medium mt-1">
              {report.candidate.email} • {report.candidate.phone}
            </p>
            <p className="text-xs text-blue-200 font-semibold mt-1">
              Exam Session: <strong className="text-white">{report.assessment.title}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-white/10 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-white/20">
            <div className="text-center px-3">
              <span className="block text-[10px] font-black text-blue-200 uppercase">Score Marks</span>
              <span className="text-3xl sm:text-4xl font-black text-white">
                {report.result.score} <span className="text-sm font-medium text-blue-200">/ {report.result.totalMarks}</span>
              </span>
            </div>

            <div className="h-10 w-px bg-white/20" />

            <div className="text-center px-3">
              <span className="block text-[10px] font-black text-blue-200 uppercase">Percentage</span>
              <span className="text-3xl sm:text-4xl font-black text-white">{report.result.percentage}%</span>
            </div>

            <div className="h-10 w-px bg-white/20" />

            <div className="text-center px-3">
              <span className="block text-[10px] font-black text-blue-200 uppercase">Exam Status</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-white/20 text-white">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                COMPLETED
              </span>
            </div>
          </div>
        </div>

        {/* Timers & Warnings Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/20 text-xs text-blue-100 font-semibold">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-300" />
            <span>Started: <strong className="text-white">{new Date(report.timing.startedAt).toLocaleDateString()}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-300" />
            <span>Duration: <strong className="text-white">{report.timing.durationFormatted}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-300" />
            <span>Warnings: <strong className="text-white">{report.proctoring.warningCount} / {report.proctoring.maxWarnings}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-300" />
            <span>Format: <strong className="text-white">60 Qs (45 Mins)</strong></span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2 print:hidden overflow-x-auto">
        {[
          { id: "overview", label: "6-Section Diagnostics", icon: BarChart3 },
          { id: "responses", label: `Question Responses (${report.responses.length})`, icon: FileText },
          { id: "proctoring", label: `Proctoring Audit (${report.proctoring.events.length})`, icon: ShieldAlert },
          { id: "screenshots", label: `Camera Screenshots (${report.screenshots?.length || 0})`, icon: Camera },
          { id: "remarks", label: `HR Remarks (${report.remarks.length})`, icon: MessageSquare },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                isActive ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: 6-Section Performance Matrix */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {report.sections.map((sec: any) => (
            <div key={sec.sectionOrder} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 font-black text-xs flex items-center justify-center">
                    {sec.sectionOrder}
                  </span>
                  <h4 className="text-xs font-black text-slate-900">{sec.name}</h4>
                </div>
                <span className="text-[10px] font-bold text-slate-400">{sec.questionRange}</span>
              </div>

              <div className="flex items-end justify-between">
                <div className="text-xl font-black text-slate-900">
                  {sec.score} <span className="text-xs font-semibold text-slate-400">/ {sec.totalMarks} Marks</span>
                </div>
                <div className={`text-sm font-black ${sec.percentage >= 60 ? 'text-emerald-600' : sec.percentage >= 40 ? 'text-blue-600' : 'text-rose-600'}`}>
                  {sec.percentage}%
                </div>
              </div>

              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    sec.percentage >= 60 ? 'bg-emerald-500' : sec.percentage >= 40 ? 'bg-blue-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${sec.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: Question Responses */}
      {activeTab === "responses" && (
        <div className="space-y-3">
          {report.responses.map((r: any) => (
            <div key={r.questionOrder} className={`p-4 bg-white border rounded-2xl ${r.isCorrect ? 'border-emerald-200' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                <span>Question #{r.questionOrder} • {r.sectionName}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${r.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {r.isCorrect ? '+1 Correct' : '0 Incorrect'}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900">{r.questionText}</p>
              <div className="mt-2 flex gap-4 text-xs font-semibold">
                <div>Candidate: <strong className={r.isCorrect ? 'text-emerald-700' : 'text-rose-700'}>{r.candidateOption || 'Unanswered'}</strong></div>
                <div>Correct Answer: <strong className="text-emerald-700">{r.correctOption}</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: Proctoring Violations */}
      {activeTab === "proctoring" && (
        <div className="space-y-3">
          {report.proctoring.events.length === 0 ? (
            <p className="text-center py-10 text-xs font-bold text-slate-400">No proctoring violations recorded for this candidate.</p>
          ) : (
            report.proctoring.events.map((evt: any, idx: number) => (
              <div key={evt.id || idx} className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-900 uppercase">Warning #{idx + 1}: {evt.eventType}</span>
                    <span className="text-[10px] font-bold text-amber-700">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                  </div>
                  {evt.details && <p className="text-xs text-amber-800 mt-1">{evt.details}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: Screenshots Gallery */}
      {activeTab === "screenshots" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase">Live AI Proctoring Screenshots</h3>
            <span className="text-xs font-bold text-slate-500">Total Captures: {report.screenshots?.length || 0}</span>
          </div>

          {(!report.screenshots || report.screenshots.length === 0) ? (
            <div className="p-12 text-center bg-slate-50 border border-slate-200 rounded-2xl">
              <Camera className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600">No proctoring screenshots recorded for this session.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {report.screenshots.map((s: any, idx: number) => {
                const baseUrl = getApiBaseUrl();
                const fullImageUrl = s.imageUrl ? (s.imageUrl.startsWith("http") || s.imageUrl.startsWith("data:") ? s.imageUrl : `${baseUrl}${s.imageUrl.startsWith("/") ? "" : "/"}${s.imageUrl}`) : "";

                return (
                  <div
                    key={s.id || idx}
                    onClick={() => setZoomImage(fullImageUrl)}
                    className="group bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition cursor-pointer"
                  >
                    <div className="aspect-video bg-slate-900 relative overflow-hidden flex items-center justify-center">
                      {fullImageUrl ? (
                        <img
                          src={fullImageUrl}
                          alt={`Capture ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%230F172A"><rect width="300" height="200" fill="%231E293B"/><text x="50%" y="50%" fill="%2394A3B8" font-size="11" font-weight="bold" text-anchor="middle" dy=".3em">📸 Snapshot on Server</text></svg>';
                          }}
                        />
                      ) : (
                        <div className="text-slate-500 text-xs font-bold">No Image</div>
                      )}
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <Maximize2 className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="p-2.5 space-y-1">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${s.type === 'WARNING' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                        {s.type === 'WARNING' ? 'Violation Snap' : 'Scheduled 15m'}
                      </span>
                      <p className="text-[10px] font-bold text-slate-800 truncate">{s.eventType.replace(/_/g, ' ')}</p>
                      <p className="text-[9px] text-slate-400">{new Date(s.capturedAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: HR Remarks */}
      {activeTab === "remarks" && (
        <div className="space-y-4">
          <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-xs print:hidden">
            <label className="block text-xs font-bold text-slate-700 uppercase">Add HR Assessment Remark</label>
            <textarea
              rows={3}
              value={newRemark}
              onChange={(e) => setNewRemark(e.target.value)}
              placeholder="Enter candidate interview remarks, verification notes, or HR approval comments..."
              className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 outline-none"
            />
            <button
              onClick={handleSaveRemark}
              disabled={savingRemark || !newRemark.trim()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{savingRemark ? "Saving..." : "Save HR Remark"}</span>
            </button>
          </div>

          <div className="space-y-3">
            {report.remarks.map((rem: any) => (
              <div key={rem.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-extrabold text-blue-600 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> HR Admin Note
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {new Date(rem.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-900 font-semibold leading-relaxed">{rem.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox Zoom Modal */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-2 border border-white/20">
            <img src={zoomImage} alt="Zoomed Capture" className="w-full h-full object-contain max-h-[80vh] rounded-xl" />
          </div>
        </div>
      )}

    </div>
  );
}
