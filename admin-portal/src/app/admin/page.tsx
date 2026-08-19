"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Users, Award, TrendingUp, BookOpen, ChevronRight, ShieldCheck, Building2, FileText, Mail, CheckCircle2 } from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";

export default function AdminOverviewDashboard() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>("ADMIN");
  const [userName, setUserName] = useState<string>("HR Administrator");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const baseUrl = getApiBaseUrl();
    const token = localStorage.getItem("banca_admin_token") || "";
    const userStr = localStorage.getItem("banca_admin_user");
    let activeRole = "ADMIN";
    let activeVendorId: string | null = null;

    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        activeRole = u.role || "ADMIN";
        activeVendorId = u.vendorId || null;
        setUserRole(activeRole);
        setUserName(u.name || "Administrator");
      } catch {}
    }

    const headers: any = {
      Authorization: `Bearer ${token}`,
      ...(activeRole === "VENDOR" && activeVendorId ? { "x-vendor-id": activeVendorId, "x-user-role": "VENDOR" } : {}),
    };

    const candUrl = activeRole === "VENDOR" && activeVendorId
      ? `${baseUrl}/api/v1/candidates?vendorId=${activeVendorId}`
      : `${baseUrl}/api/v1/candidates`;

    Promise.all([
      fetch(candUrl, { headers }).then((r) => r.json()),
      fetch(`${baseUrl}/api/v1/assessments`, { headers }).then((r) => r.json()),
      activeRole !== "VENDOR" ? fetch(`${baseUrl}/api/v1/questions`, { headers }).then((r) => r.json()) : Promise.resolve({ questions: [] }),
    ])
      .then(([cRes, aRes, qRes]) => {
        if (cRes?.success) setCandidates(cRes.candidates || []);
        if (aRes?.success) setAssessments(aRes.assessments || []);
        if (qRes?.success) setQuestions(qRes.questions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-bold">Loading Dashboard Analytics...</p>
      </div>
    );
  }

  const isVendor = userRole === "VENDOR";
  const totalCand = candidates.length;
  const completedCand = candidates.filter((c) => c.status === "COMPLETED");
  const inProgressCand = candidates.filter((c) => c.status === "IN_PROGRESS");
  const lockedCand = candidates.filter((c) => c.status === "LOCKED" || c.attempt?.status === "LOCKED");
  const registeredCand = candidates.filter((c) => c.status === "REGISTERED" || !c.attempt);

  const avgScore = completedCand.length > 0
    ? Math.round(completedCand.reduce((acc, c) => acc + (c.attempt?.percentage || c.percentage || 0), 0) / completedCand.length)
    : 0;
  const passedCount = completedCand.filter((c) => c.attempt?.isPassed || c.attempt?.percentage >= 50).length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Welcome Banner for Vendor / Admin */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[11px] font-extrabold text-blue-600 uppercase tracking-wider">
            {isVendor ? "Vendor Control Panel" : "Recruitment & Evaluation Center"}
          </span>
          <h1 className="text-xl font-black text-slate-900 mt-0.5">
            Welcome back, {userName}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {isVendor
              ? "Manage your assigned candidate batches, bulk upload via Excel, and monitor live exam diagnostics."
              : "Overview of all active assessments, candidate evaluations, vendor allocations, and exam integrity logs."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isVendor ? (
            <Link
              href="/admin/assessments"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20"
            >
              <FileText size={14} />
              <span>My Assessments ({assessments.length})</span>
            </Link>
          ) : (
            <Link
              href="/admin/vendors"
              className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Building2 size={14} />
              <span>Manage Vendors</span>
            </Link>
          )}
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {isVendor ? "My Candidates" : "Total Candidates"}
            </p>
            <p className="text-2xl font-black text-slate-900 mt-1">{totalCand}</p>
            <span className="text-[11px] font-bold text-emerald-600 mt-0.5 inline-block">
              {isVendor ? "Your Registered Batch" : "Registered Pool"}
            </span>
          </div>
          <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Average Score</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{avgScore}%</p>
            <span className="text-[11px] font-bold text-blue-600 mt-0.5 inline-block">{completedCand.length} Completed</span>
          </div>
          <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Completed Exams</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{completedCand.length}</p>
            <span className="text-[11px] font-bold text-slate-500 mt-0.5 inline-block">Evaluated Sessions</span>
          </div>
          <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {isVendor ? "Assigned Assessments" : "Question Bank"}
            </p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {isVendor ? assessments.length : questions.length}
            </p>
            <span className="text-[11px] font-bold text-slate-500 mt-0.5 inline-block">
              {isVendor ? "Active Test Sessions" : "Shared Questions Pool"}
            </span>
          </div>
          <div className="w-11 h-11 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
            {isVendor ? <FileText className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
          </div>
        </div>

      </div>

      {/* Candidate Performance Summary Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-extrabold text-slate-900">
              {isVendor ? "My Candidates Exam Progress" : "Candidate Performance Status Summary"}
            </h2>
          </div>
          <Link href="/admin/candidates" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-1">
            <span>View Full Directory</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Status Breakdown Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
            <span className="text-[10px] font-extrabold uppercase text-emerald-600 tracking-wider">Completed</span>
            <p className="text-xl font-black text-emerald-800 mt-1">{completedCand.length}</p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
              {totalCand > 0 ? `${Math.round((completedCand.length / totalCand) * 100)}%` : "0%"} of Total
            </p>
          </div>

          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <span className="text-[10px] font-extrabold uppercase text-blue-600 tracking-wider">In Progress</span>
            <p className="text-xl font-black text-blue-800 mt-1">{inProgressCand.length}</p>
            <p className="text-[11px] text-blue-600 font-semibold mt-0.5">Live Exam Sessions</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Not Started</span>
            <p className="text-xl font-black text-slate-700 mt-1">{registeredCand.length}</p>
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Pending Candidate Login</p>
          </div>

          <div className="p-4 bg-red-50 rounded-xl border border-red-100">
            <span className="text-[10px] font-extrabold uppercase text-red-600 tracking-wider">Locked / Flagged</span>
            <p className="text-xl font-black text-red-800 mt-1">{lockedCand.length}</p>
            <p className="text-[11px] text-red-600 font-semibold mt-0.5">Proctoring Violations</p>
          </div>
        </div>
      </div>

    </div>
  );
}
