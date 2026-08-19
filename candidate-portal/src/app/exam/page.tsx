"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import CameraProctor from "@/components/CameraProctor";
import "../exam/exam.css";
import { User, Mail, Phone, Hash, ArrowRight, BookOpen, AlertTriangle, ShieldCheck, Lock } from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";

export default function CandidateRegistration() {
  const router = useRouter();
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>("");
  const [formData, setFormData] = useState({
    applicationId: "",
    name: "",
    email: "",
    phone: "",
    referenceId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeAssessment, setActiveAssessment] = useState<any>(null);
  const [isAssessmentExpired, setIsAssessmentExpired] = useState<boolean>(false);
  const [isAssessmentNotStarted, setIsAssessmentNotStarted] = useState<boolean>(false);
  const [hasValidLink, setHasValidLink] = useState<boolean>(false);

  useEffect(() => {
    async function loadAssessmentFromUrl() {
      try {
        const baseUrl = getApiBaseUrl();
        const searchParams = new URLSearchParams(window.location.search);
        const targetIdentifier = searchParams.get("assessment") || searchParams.get("assessmentId") || searchParams.get("id");

        if (!targetIdentifier) {
          const activeRes = await fetch(`${baseUrl}/api/v1/integration/headstart/assessments/active`);
          const activeData = await activeRes.json();
          if (activeData?.success && activeData?.data?.[0]?.assessmentSlug) {
            router.replace(`/${activeData.data[0].assessmentSlug}`);
          } else {
            router.replace("/aa-2812");
          }
          return;
        }

        const res = await fetch(`${baseUrl}/api/v1/candidates/assessments/details/${targetIdentifier}`);
        const data = await res.json();

        if (data.success && data.assessment) {
          setActiveAssessment(data.assessment);
          setSelectedAssessmentId(data.assessment.id);
          setHasValidLink(true);

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
        } else {
          setHasValidLink(false);
          setError(`Invalid or Inactive Assessment Link (${targetIdentifier}). Please contact HR or use your official exam URL.`);
        }
      } catch (err) {
        console.error("Failed to load target assessment details:", err);
        setHasValidLink(false);
        setError("Unable to connect to Assessment Server. Please try again.");
      }
    }
    loadAssessmentFromUrl();
  }, []);

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
          assessmentId: selectedAssessmentId,
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
          `Access Denied: The email '${formData.email}' is not assigned to this assessment session. Please contact your HR Administrator to receive an invitation.`
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
              {activeAssessment?.description || "Candidate Verification & Proctored Assessment Engine"}
            </p>
          </div>

          <div style={{ padding: "clamp(20px, 4vw, 36px)" }}>
            {!hasValidLink ? (
              <div style={{ textAlign: "center", padding: "32px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#FEF2F2", border: "2px solid #FCA5A5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Lock size={32} color="#DC2626" />
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                  Assessment Access Restricted
                </h3>
                <p style={{ fontSize: "14px", color: "#475569", maxWidth: "540px", textAlign: "center", lineHeight: "1.6", margin: 0 }}>
                  Candidates cannot access generic exam pages directly. You must click the official exam URL provided in your candidate invitation email or Headstart CRM (e.g. <strong style={{ color: "#0284C7" }}>http://localhost:3000/session-slug</strong>).
                </p>
              </div>
            ) : (
              <>
                {error && (
                  <div style={{ background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: "12px", padding: "14px 18px", color: "#B91C1C", fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
                    <AlertTriangle size={18} color="#DC2626" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleStart} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 800, color: "#1A2B40", marginBottom: "6px", textTransform: "uppercase" }}>
                      Application / Enrolment ID *
                    </label>
                    <div style={{ position: "relative" }}>
                      <Hash size={16} color="#00AEEF" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                      <input
                        type="text"
                        required
                        placeholder="e.g. BMU-CCE/2026/Udaan/111111"
                        value={formData.applicationId}
                        onChange={(e) => setFormData({ ...formData, applicationId: e.target.value })}
                        disabled={isAssessmentExpired || isAssessmentNotStarted}
                        style={{ width: "100%", padding: "12px 14px 12px 42px", borderRadius: "10px", border: "1.5px solid #CBD5E1", fontSize: "14px", fontWeight: 600, color: "#0F172A" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 800, color: "#1A2B40", marginBottom: "6px", textTransform: "uppercase" }}>
                        Candidate Name *
                      </label>
                      <div style={{ position: "relative" }}>
                        <User size={16} color="#00AEEF" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                        <input
                          type="text"
                          required
                          placeholder="Full Name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          disabled={isAssessmentExpired || isAssessmentNotStarted}
                          style={{ width: "100%", padding: "12px 14px 12px 42px", borderRadius: "10px", border: "1.5px solid #CBD5E1", fontSize: "14px", fontWeight: 600, color: "#0F172A" }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 800, color: "#1A2B40", marginBottom: "6px", textTransform: "uppercase" }}>
                        Email Address *
                      </label>
                      <div style={{ position: "relative" }}>
                        <Mail size={16} color="#00AEEF" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                        <input
                          type="email"
                          required
                          placeholder="candidate@example.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          disabled={isAssessmentExpired || isAssessmentNotStarted}
                          style={{ width: "100%", padding: "12px 14px 12px 42px", borderRadius: "10px", border: "1.5px solid #CBD5E1", fontSize: "14px", fontWeight: 600, color: "#0F172A" }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 800, color: "#1A2B40", marginBottom: "6px", textTransform: "uppercase" }}>
                        Phone Number *
                      </label>
                      <div style={{ position: "relative" }}>
                        <Phone size={16} color="#00AEEF" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                        <input
                          type="tel"
                          required
                          placeholder="Mobile Number"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          disabled={isAssessmentExpired || isAssessmentNotStarted}
                          style={{ width: "100%", padding: "12px 14px 12px 42px", borderRadius: "10px", border: "1.5px solid #CBD5E1", fontSize: "14px", fontWeight: 600, color: "#0F172A" }}
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
                      {loading ? "Verifying with CRM..." : "Start Assessment"}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
