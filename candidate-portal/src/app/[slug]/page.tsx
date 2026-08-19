"use client";

import { use, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import CameraProctor from "@/components/CameraProctor";
import "../exam/exam.css";
import { User, Mail, Phone, Hash, ArrowRight, BookOpen, AlertTriangle, ShieldCheck, Clock, CheckCircle2 } from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";

interface AssessmentOption {
  id: string;
  name: string;
  description: string;
}

function AssessmentContent({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>("");
  const [formData, setFormData] = useState({
    applicationId: "",
    name: "",
    email: "",
    phone: "",
    referenceId: "",
  });
  const [loading, setLoading] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [tokenVerified, setTokenVerified] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState("");
  const [activeAssessment, setActiveAssessment] = useState<any>(null);
  const [isAssessmentExpired, setIsAssessmentExpired] = useState<boolean>(false);
  const [isAssessmentNotStarted, setIsAssessmentNotStarted] = useState<boolean>(false);

  useEffect(() => {
    async function loadAssessmentAndToken() {
      try {
        const baseUrl = getApiBaseUrl();

        // If secure assignment token is present in URL
        if (token) {
          setVerifyingToken(true);
          try {
            const tokenRes = await fetch(`${baseUrl}/api/v1/candidates/verify-token`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
            });
            const tokenData = await tokenRes.json();
            if (tokenData.success && tokenData.candidate) {
              setTokenVerified(true);
              setFormData({
                name: tokenData.candidate.name || "",
                email: tokenData.candidate.email || "",
                phone: tokenData.candidate.phone || "",
                applicationId: tokenData.candidate.applicationId || tokenData.candidate.referenceId || "",
                referenceId: tokenData.candidate.referenceId || "",
              });
              if (tokenData.assessment) {
                setActiveAssessment(tokenData.assessment);
                setSelectedAssessmentId(tokenData.assessment.id);
              }
              if (tokenData.isCompleted) {
                setIsCompleted(true);
              }
              setVerifyingToken(false);
              return;
            } else if (tokenData.code === "EXPIRED") {
              setIsAssessmentExpired(true);
              setError(tokenData.message || "This assessment session link has expired.");
              setVerifyingToken(false);
              return;
            } else if (tokenData.code === "UPCOMING") {
              setIsAssessmentNotStarted(true);
              setError(tokenData.message || "This assessment session has not started yet.");
              setVerifyingToken(false);
              return;
            }
          } catch {
            /* continue to regular load */
          } finally {
            setVerifyingToken(false);
          }
        }

        // Regular slug lookup
        if (slug) {
          const res = await fetch(`${baseUrl}/api/v1/candidates/assessments/details/${slug}`);
          const data = await res.json();
          if (data.success && data.assessment) {
            setActiveAssessment(data.assessment);
            setSelectedAssessmentId(data.assessment.id);
            if (data.assessment.isExpired) {
              setIsAssessmentExpired(true);
              setError("This assessment session link is no longer active or has expired. Please contact your HR Administrator for a valid link.");
            } else if (data.assessment.isNotStarted) {
              setIsAssessmentNotStarted(true);
              const fromTime = data.assessment.activeFrom
                ? new Date(data.assessment.activeFrom).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                : "a scheduled time";
              setError(`This assessment session hasn't started yet. It will be accessible from ${fromTime}.`);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load target assessment details:", err);
      }
    }
    loadAssessmentAndToken();
  }, [slug, token]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.email.trim()) {
      setError("Please enter your registered email address.");
      return;
    }
    if (!formData.name || !formData.name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const baseUrl = getApiBaseUrl();

      const res = await fetch(`${baseUrl}/api/v1/candidates/verify-and-start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: formData.applicationId || undefined,
          name: formData.name,
          email: formData.email,
          phone: formData.phone || undefined,
          assessmentId: selectedAssessmentId || slug,
        }),
      });

      const data = await res.json();

      if (data.success && data.candidate) {
        localStorage.setItem("banca_candidate", JSON.stringify(data.candidate));
        if (data.questions) {
          localStorage.setItem("banca_exam_session", JSON.stringify(data));
        }
        router.push("/exam/test");
      } else {
        // STRICT REJECTION: Display authorized error message, DO NOT BYPASS!
        setError(
          data.message ||
          `Access Denied: The email '${formData.email}' is not assigned to this assessment session. Please contact your HR Administrator to be invited.`
        );
      }
    } catch (err: any) {
      setError(err.message || "Unable to connect to Assessment Server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(160deg, #E8F6FD 0%, #F4FAFF 50%, #FFF8EE 100%)", display: "flex", flexDirection: "column" }}>
      <Navbar mode="public" />

      <main style={{ flex: 1, padding: "clamp(16px, 4vw, 36px) 16px 48px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: "860px", background: "white", borderRadius: "24px", border: "1.5px solid #C8E8F8", boxShadow: "0 16px 48px rgba(0,63,114,0.12)", overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(135deg, #003F72, #00AEEF)", padding: "28px 32px", color: "white" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.18)", padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", marginBottom: "10px" }}>
              <BookOpen size={12} /> OFFICIAL ASSESSMENT SESSION
            </div>
            <h1 style={{ fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 900, marginBottom: "6px" }}>
              {activeAssessment?.name || "Niva Bupa Health Insurance Assessment"}
            </h1>
            <p style={{ fontSize: "13px", opacity: 0.9, margin: 0 }}>
              {activeAssessment?.description || "Enter your Application ID to begin candidate verification & proctored assessment"}
            </p>
          </div>

          <div style={{ padding: "clamp(20px, 4vw, 36px)" }}>
            {error && (
              <div style={{ background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: "12px", padding: "14px 18px", color: "#B91C1C", fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
                <AlertTriangle size={18} color="#DC2626" />
                <span>{error}</span>
              </div>
            )}

            {tokenVerified && (
              <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: "12px", padding: "12px 16px", color: "#166534", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <ShieldCheck size={18} color="#16A34A" />
                <span>Authenticated Candidate Record: Details are verified and locked to prevent data discrepancy.</span>
              </div>
            )}

            <form onSubmit={handleStart} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 800, color: "#1A2B40", marginBottom: "6px", textTransform: "uppercase" }}>
                  Application / Enrolment ID * {tokenVerified && <span style={{ color: "#16A34A", fontSize: "11px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "3px" }}><CheckCircle2 size={11} /> (Verified)</span>}
                </label>
                <div style={{ position: "relative" }}>
                  <Hash size={16} color="#00AEEF" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type="text"
                    required
                    readOnly={tokenVerified}
                    placeholder="e.g. BMU-CCE/2026/Udaan/111111"
                    value={formData.applicationId}
                    onChange={(e) => !tokenVerified && setFormData({ ...formData, applicationId: e.target.value })}
                    disabled={isAssessmentExpired || isAssessmentNotStarted}
                    style={{ width: "100%", padding: "12px 14px 12px 42px", borderRadius: "10px", border: "1.5px solid #CBD5E1", fontSize: "14px", fontWeight: 600, color: "#0F172A", background: tokenVerified ? "#F8FAFC" : "white", cursor: tokenVerified ? "default" : "text" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 800, color: "#1A2B40", marginBottom: "6px", textTransform: "uppercase" }}>
                    Candidate Name * {tokenVerified && <span style={{ color: "#16A34A", fontSize: "11px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "3px" }}><CheckCircle2 size={11} /> (Verified)</span>}
                  </label>
                  <div style={{ position: "relative" }}>
                    <User size={16} color="#00AEEF" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="text"
                      required
                      readOnly={tokenVerified}
                      placeholder="Full Name"
                      value={formData.name}
                      onChange={(e) => !tokenVerified && setFormData({ ...formData, name: e.target.value })}
                      disabled={isAssessmentExpired || isAssessmentNotStarted}
                      style={{ width: "100%", padding: "12px 14px 12px 42px", borderRadius: "10px", border: "1.5px solid #CBD5E1", fontSize: "14px", fontWeight: 600, color: "#0F172A", background: tokenVerified ? "#F8FAFC" : "white", cursor: tokenVerified ? "default" : "text" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 800, color: "#1A2B40", marginBottom: "6px", textTransform: "uppercase" }}>
                    Email Address * {tokenVerified && <span style={{ color: "#16A34A", fontSize: "11px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "3px" }}><CheckCircle2 size={11} /> (Verified)</span>}
                  </label>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} color="#00AEEF" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="email"
                      required
                      readOnly={tokenVerified}
                      placeholder="candidate@example.com"
                      value={formData.email}
                      onChange={(e) => !tokenVerified && setFormData({ ...formData, email: e.target.value })}
                      disabled={isAssessmentExpired || isAssessmentNotStarted}
                      style={{ width: "100%", padding: "12px 14px 12px 42px", borderRadius: "10px", border: "1.5px solid #CBD5E1", fontSize: "14px", fontWeight: 600, color: "#0F172A", background: tokenVerified ? "#F8FAFC" : "white", cursor: tokenVerified ? "default" : "text" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 800, color: "#1A2B40", marginBottom: "6px", textTransform: "uppercase" }}>
                    Phone Number * {tokenVerified && <span style={{ color: "#16A34A", fontSize: "11px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "3px" }}><CheckCircle2 size={11} /> (Verified)</span>}
                  </label>
                  <div style={{ position: "relative" }}>
                    <Phone size={16} color="#00AEEF" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="tel"
                      required
                      readOnly={tokenVerified}
                      placeholder="Mobile Number"
                      value={formData.phone}
                      onChange={(e) => !tokenVerified && setFormData({ ...formData, phone: e.target.value })}
                      disabled={isAssessmentExpired || isAssessmentNotStarted}
                      style={{ width: "100%", padding: "12px 14px 12px 42px", borderRadius: "10px", border: "1.5px solid #CBD5E1", fontSize: "14px", fontWeight: 600, color: "#0F172A", background: tokenVerified ? "#F8FAFC" : "white", cursor: tokenVerified ? "default" : "text" }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "12px", paddingTop: "20px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  disabled={loading || isAssessmentExpired || isAssessmentNotStarted}
                  style={{ padding: "14px 32px", borderRadius: "12px", background: isAssessmentExpired || isAssessmentNotStarted ? "#94A3B8" : "linear-gradient(135deg, #003F72, #00AEEF)", color: "white", fontWeight: 800, fontSize: "15px", border: "none", cursor: isAssessmentExpired || isAssessmentNotStarted ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: "10px", boxShadow: "0 6px 20px rgba(0,63,114,0.2)" }}
                >
                  {loading ? "Verifying..." : "Start Assessment"}
                  <ArrowRight size={18} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DynamicAssessmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-500">Loading Assessment Session...</div>}>
      <AssessmentContent slug={resolvedParams.slug} />
    </Suspense>
  );
}

