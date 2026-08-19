"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Building2,
  CheckCircle2,
  Cpu,
  Zap,
  Activity,
  Layers,
  KeyRound,
  AlertCircle
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";

export default function AdminLoginPage() {
  const router = useRouter();
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setLoading(true);

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/auth/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: credentials.username.trim(),
          password: credentials.password,
        }),
      });

      const data = await res.json();
      if (res.ok && data.access_token) {
        localStorage.setItem("banca_admin_token", data.access_token);
        if (data.user) {
          localStorage.setItem("banca_admin_user", JSON.stringify(data.user));
        }
        router.push("/admin");
      } else {
        setAuthError(data.message || "Invalid username, email, or password.");
      }
    } catch (err: any) {
      setAuthError(err.message || "Server connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center font-sans bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white relative overflow-hidden p-4 sm:p-6 lg:p-8">
      {/* Dynamic Background Ambient Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-600/15 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-[40%] right-[30%] w-[350px] h-[350px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Glass Container */}
      <div className="w-full max-w-5xl bg-slate-900/80 backdrop-blur-2xl rounded-3xl border border-slate-800 shadow-2xl grid grid-cols-1 lg:grid-cols-12 overflow-hidden relative z-10">
        
        {/* LEFT COLUMN: Enterprise Showcase & Branding (5 cols) */}
        <div className="lg:col-span-6 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-8 sm:p-12 text-white flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/80 relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            {/* Logo Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-white/20">
              <Image
                src="/niva-bupa-logo.png"
                alt="Niva Bupa Health Insurance"
                width={150}
                height={45}
                className="h-8 w-auto object-contain"
                priority
              />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[11px] font-extrabold uppercase tracking-wider mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                Enterprise Assessment Suite
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight">
                Recruitment, Vendor & Proctoring Management
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed mt-2">
                Unified administration gateway for HR Administrators and Authorized Vendor Partners.
              </p>
            </div>

            {/* Feature Cards Grid */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 bg-white/5 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">Multi-Vendor Batch Isolation</h4>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Strict candidate data segregation and test assignment permissions.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white/5 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0 mt-0.5">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">AI Proctoring & Audit</h4>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Real-time webcam tracking, tab-switch monitoring, and auto-flagging.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white/5 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0 mt-0.5">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">Bcrypt 256-Bit Security</h4>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Zero plaintext credentials, encrypted token sessions, and role guards.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Security Badge */}
          <div className="relative z-10 mt-8 pt-6 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span className="flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              TLS 1.3 Encrypted
            </span>
            <span className="text-slate-500">v2.4 Production Suite</span>
          </div>
        </div>

        {/* RIGHT COLUMN: Modern Clean Sign-In Form (6 cols) */}
        <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-center bg-slate-900/60 backdrop-blur-xl">
          <div className="max-w-sm mx-auto w-full space-y-6">
            
            {/* Header Title */}
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mb-4 shadow-inner">
                <Lock className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">Portal Authentication</h1>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Enter your Admin Username or Vendor Login Email
              </p>
            </div>

            {/* Error Message Alert */}
            {authError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold rounded-2xl flex items-center gap-2.5 animate-shake">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Sign In Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Username or Vendor Email */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-1.5">
                  Username or Vendor Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={credentials.username}
                    onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                    placeholder="admin or vendor@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs font-semibold text-white placeholder-slate-500 focus:bg-slate-950 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    placeholder="Enter your secure password"
                    className="w-full pl-10 pr-11 py-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs font-semibold text-white placeholder-slate-500 focus:bg-slate-950 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-5 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white font-black text-xs rounded-2xl hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Secure Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Footer Support Info */}
            <div className="pt-4 border-t border-slate-800/80 text-center">
              <p className="text-[11px] text-slate-500 font-medium">
                Admin or Vendor account issues? Contact system administrator.
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
