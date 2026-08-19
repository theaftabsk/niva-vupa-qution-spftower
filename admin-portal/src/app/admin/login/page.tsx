"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, User, Eye, EyeOff, ArrowRight, AlertCircle, ShieldCheck } from "lucide-react";
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
    <div className="min-h-screen w-full flex flex-col justify-between font-sans bg-gradient-to-br from-slate-50 via-white to-blue-50/40 text-slate-900 selection:bg-blue-600 selection:text-white p-6 sm:p-10">
      
      {/* Top Header Logo & CCE Programme Team */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3 p-2 sm:p-2.5 pr-4 rounded-2xl bg-white shadow-xs border border-slate-200/80">
          <Image
            src="/niva-bupa-logo.png"
            alt="Niva Bupa Health Insurance"
            width={140}
            height={38}
            className="h-8 sm:h-9 w-auto object-contain"
            priority
          />
          <div className="h-6 w-px bg-slate-200" />
          <span className="text-xs sm:text-sm font-extrabold text-[#003F72] tracking-tight">
            CCE Programme Team
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-white px-3.5 py-2 rounded-full border border-slate-200 shadow-2xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Secure Portal</span>
        </div>
      </div>

      {/* Center Clean Login Card */}
      <div className="w-full max-w-md mx-auto my-auto py-8">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 p-8 sm:p-10 space-y-6">
          
          {/* Title Area */}
          <div className="text-center space-y-2">
            <div className="w-13 h-13 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto shadow-2xs">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Sign In
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Administrator & Vendor Management Portal
            </p>
          </div>

          {/* Error Alert */}
          {authError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2.5 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username / Vendor Email Input */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                Username or Vendor Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                  placeholder="Enter username or email"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-blue-500/20 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-all pt-3.5 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>
      </div>

      {/* Bottom Footer */}
      <div className="w-full max-w-6xl mx-auto text-center pt-4">
        <p className="text-xs text-slate-500 font-semibold">
          © {new Date().getFullYear()} Niva Bupa Health Insurance Company Limited. All rights reserved.
        </p>
      </div>

    </div>
  );
}
