"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import CameraProctor from "@/components/CameraProctor";
import "../exam.css";
import {
  Clock, ChevronLeft, ChevronRight, Bookmark, CheckCircle2,
  AlertTriangle, Grid, X, FileText, ShieldAlert, BookOpen, AlertOctagon, RotateCcw
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";

interface ExamQuestion {
  attemptQuestionId: string;
  id: string;
  subjectId: string;
  subjectName: string;
  sectionId: string;
  sectionName: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  marks: number;
  selectedOption: string | null;
}

export default function CandidateTestEngine() {
  const router = useRouter();

  const [candidate, setCandidate] = useState<any>(null);
  const [attemptId, setAttemptId] = useState<string>("");
  const [assessmentName, setAssessmentName] = useState<string>("Assessment Test");
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { selectedOption: string | null; timeTakenSec: number }>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});

  const [timeLeftSec, setTimeLeftSec] = useState(2700); // 45 mins default
  const [timerWarning, setTimerWarning] = useState("");

  // Proctoring States
  const [warningCount, setWarningCount] = useState(0);
  const [maxProctorWarnings, setMaxProctorWarnings] = useState(6);
  const [warningModalMsg, setWarningModalMsg] = useState<string | null>(null);
  const [disqualified, setDisqualified] = useState(false);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Initialize Exam Session
  useEffect(() => {
    const stored = localStorage.getItem("banca_candidate");
    if (!stored) {
      router.push("/exam");
      return;
    }
    const cand = JSON.parse(stored);
    setCandidate(cand);
    initializeExamSession(cand.referenceId || cand.email || cand.id);
  }, [router]);

  const initializeExamSession = async (identifier: string) => {
    setLoading(true);
    setError("");
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/candidates/start-exam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateIdentifier: identifier }),
      });

      const data = await res.json();
      if (data.success) {
        setAttemptId(data.attemptId);
        setAssessmentName(data.assessmentName);
        setQuestions(data.questions || []);
        const calculatedTime = data.remainingTimeSec !== undefined ? data.remainingTimeSec : (data.durationMins || 45) * 60;
        setTimeLeftSec(calculatedTime);
        setMaxProctorWarnings(data.maxProctorWarnings || 6);
        setWarningCount(data.warningCount || 0);

        // Pre-fill answers if returning to active session
        const initAnswers: Record<string, { selectedOption: string | null; timeTakenSec: number }> = {};
        data.questions.forEach((q: ExamQuestion) => {
          if (q.selectedOption) {
            initAnswers[q.id] = { selectedOption: q.selectedOption, timeTakenSec: 0 };
          }
        });
        setAnswers(initAnswers);
      } else {
        setError(data.message || "Failed to initialize exam session.");
      }
    } catch (err: any) {
      console.error("Failed to connect to backend:", err);
      setError("Network connection error. Please ensure the backend server is running.");
    } finally {
      setLoading(false);
    }
  };

  // Timer Countdown
  useEffect(() => {
    if (loading || disqualified || timeLeftSec <= 0) return;
    const interval = setInterval(() => {
      setTimeLeftSec((prev) => {
        const next = prev - 1;
        if (next === 600) setTimerWarning("10 Minutes remaining!");
        else if (next === 300) setTimerWarning("5 Minutes remaining!");
        else if (next === 60) setTimerWarning("CRITICAL: 1 Minute remaining!");
        else if (next <= 0) {
          clearInterval(interval);
          handleSubmitExam();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, disqualified]);

  // Real-Time Proctoring Event Logger & Listener with 3.5s cooldown debounce
  const lastViolationTimeRef = useRef<number>(0);

  const reportProctoringViolation = async (eventType: string, details?: string) => {
    if (!attemptId || disqualified) return;

    const now = Date.now();
    // 3.5s debounce prevents simultaneous events (e.g. TAB_SWITCH and FULLSCREEN_EXIT firing together)
    if (now - lastViolationTimeRef.current < 3500) {
      return;
    }
    lastViolationTimeRef.current = now;

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/candidates/log-proctoring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, eventType, details }),
      });
      const data = await res.json();
      if (data.success) {
        setWarningCount(data.warningCount);
        if (data.disqualified) {
          setDisqualified(true);
          setWarningModalMsg(null);
        } else {
          setWarningModalMsg(data.message);
        }
      }
    } catch (err) {
      console.error("Proctoring log error:", err);
    }
  };

  // Auto-Check Unlock Status when Disqualified/Locked
  const [checkingUnlock, setCheckingUnlock] = useState(false);
  const handleCheckUnlock = async () => {
    if (!attemptId) return;
    setCheckingUnlock(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/candidates/status/${attemptId}`);
      const data = await res.json();
      if (data.success && data.isUnlocked) {
        setDisqualified(false);
        setWarningCount(0);
        if (candidate) {
          await initializeExamSession(candidate.referenceId || candidate.email || candidate.id);
        }
      } else {
        alert("Your exam session is still locked. Please wait for HR Administrator approval.");
      }
    } catch {
      /* silent */
    } finally {
      setCheckingUnlock(false);
    }
  };

  useEffect(() => {
    if (!disqualified || !attemptId) return;
    const pollInterval = setInterval(async () => {
      try {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/candidates/status/${attemptId}`);
        const data = await res.json();
        if (data.success && data.isUnlocked) {
          clearInterval(pollInterval);
          setDisqualified(false);
          setWarningCount(0);
          if (candidate) {
            initializeExamSession(candidate.referenceId || candidate.email || candidate.id);
          }
        }
      } catch {
        /* silent */
      }
    }, 6000);
    return () => clearInterval(pollInterval);
  }, [disqualified, attemptId, candidate]);

  useEffect(() => {
    if (loading || !attemptId || disqualified) return;

    const onVisibilityChange = () => {
      if (document.hidden) {
        reportProctoringViolation("TAB_SWITCH", `Tab switch detected at ${new Date().toLocaleTimeString()}`);
      }
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        reportProctoringViolation("FULLSCREEN_EXIT", `Fullscreen exit detected at ${new Date().toLocaleTimeString()}`);
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      reportProctoringViolation("RIGHT_CLICK", "Right click attempted.");
    };

    const onCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      reportProctoringViolation("COPY_PASTE", `Copy/Paste attempted: ${e.type}`);
    };

    const onPageExit = () => {
      if (!attemptId || disqualified || submitting) return;
      const baseUrl = getApiBaseUrl();
      const payload = JSON.stringify({
        attemptId,
        eventType: "TAB_CLOSE",
        details: `Candidate closed exam window/tab at ${new Date().toLocaleTimeString()}`,
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(`${baseUrl}/api/v1/candidates/log-proctoring`, new Blob([payload], { type: "application/json" }));
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopyPaste);
    document.addEventListener("paste", onCopyPaste);
    window.addEventListener("pagehide", onPageExit);
    window.addEventListener("beforeunload", onPageExit);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopyPaste);
      document.removeEventListener("paste", onCopyPaste);
      window.removeEventListener("pagehide", onPageExit);
      window.removeEventListener("beforeunload", onPageExit);
    };
  }, [loading, attemptId, disqualified, submitting]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const handleSelectOption = (qId: string, opt: string) => {
    // 1. Update React state immediately for snappy UX
    setAnswers((p) => ({
      ...p,
      [qId]: { selectedOption: opt, timeTakenSec: (p[qId]?.timeTakenSec || 0) + 5 },
    }));

    // 2. Real-time background sync to PostgreSQL database
    if (attemptId) {
      const baseUrl = getApiBaseUrl();
      fetch(`${baseUrl}/api/v1/candidates/save-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          questionId: qId,
          selectedOption: opt,
          timeTakenSec: 5,
        }),
      }).catch((err) => console.warn("Background answer save warning:", err));
    }
  };

  const handleSubmitExam = async () => {
    if (submitting || !attemptId) return;
    setSubmitting(true);

    try {
      const baseUrl = getApiBaseUrl();
      await fetch(`${baseUrl}/api/v1/candidates/submit-exam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          answers,
        }),
      });
    } catch (err) {
      console.error("Exam submission error:", err);
    }
    localStorage.removeItem("banca_candidate");
    router.push("/exam/thank-you");
  };

  const qStatus = (qId: string, idx: number) => {
    if (idx === currentIdx) return "current";
    if (flagged[qId]) return "flagged";
    if (answers[qId]?.selectedOption) return "answered";
    return "unvisited";
  };

  const answeredCount = Object.values(answers).filter((a) => a.selectedOption).length;

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner" />
          <p className="loading-text">Initialising Randomized Question Attempt…</p>
        </div>
      </div>
    );
  }

  // LOCKED / DISQUALIFIED SCREEN WITH LIVE RESUME SUPPORT
  if (disqualified) {
    return (
      <div className="loading-screen" style={{ background: "#F8FAFC" }}>
        <div className="loading-content" style={{ maxWidth: "520px", background: "white", padding: "36px 32px", borderRadius: "24px", boxShadow: "0 20px 40px rgba(15,23,42,0.1)", textAlign: "center", border: "1px solid #E2E8F0" }}>
          <div style={{ width: "68px", height: "68px", borderRadius: "20px", background: "#FEF2F2", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: "1px solid #FEE2E2" }}>
            <ShieldAlert size={36} />
          </div>
          <h2 style={{ fontSize: "22px", fontWeight: 900, color: "#0F172A", marginBottom: "8px" }}>Exam Session Locked</h2>
          <p style={{ fontSize: "13px", color: "#64748B", lineHeight: 1.6, marginBottom: "20px" }}>
            You have reached the maximum allowed proctoring violations (<strong>{maxProctorWarnings}/{maxProctorWarnings} Warnings</strong>).
          </p>

          <div style={{ background: "#F1F5F9", padding: "14px 18px", borderRadius: "14px", marginBottom: "24px", textAlign: "left", fontSize: "12px", color: "#334155", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, color: "#64748B" }}>Questions Answered:</span>
              <span style={{ fontWeight: 800, color: "#059669" }}>{answeredCount} / {questions.length} Saved</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, color: "#64748B" }}>Time Remaining:</span>
              <span style={{ fontWeight: 800, color: "#2563EB" }}>{fmt(timeLeftSec)} Preserved</span>
            </div>
          </div>

          <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "20px" }}>
            Please contact your HR Administrator. Once unlocked in the Admin Portal, click Resume below.
          </p>

          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button
              onClick={handleCheckUnlock}
              disabled={checkingUnlock}
              style={{ padding: "12px 24px", background: "#2563EB", color: "white", fontWeight: 800, fontSize: "13px", borderRadius: "12px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <RotateCcw size={14} className={checkingUnlock ? "animate-spin" : ""} />
              {checkingUnlock ? "Checking Approval..." : "Check Status & Resume Exam"}
            </button>
            <button
              onClick={() => {
                localStorage.removeItem("banca_candidate");
                router.push("/");
              }}
              style={{ padding: "12px 18px", background: "#F1F5F9", color: "#475569", fontWeight: 700, fontSize: "13px", borderRadius: "12px", border: "1px solid #CBD5E1", cursor: "pointer" }}
            >
              Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="loading-screen">
        <div className="loading-content" style={{ maxWidth: "480px" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", color: "#DC2626", margin: "0 auto" }}>
            <AlertTriangle size={28} />
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#1A2B40", marginTop: "12px" }}>Exam Configuration Error</h2>
          <p style={{ fontSize: "13px", color: "#4A6580", marginTop: "6px" }}>{error || "No questions found for this exam."}</p>
          <button
            onClick={() => initializeExamSession(candidate?.referenceId || candidate?.email)}
            style={{ marginTop: "16px", padding: "10px 20px", borderRadius: "10px", background: "#00AEEF", color: "white", fontWeight: 800, fontSize: "13px", border: "none", cursor: "pointer" }}
          >
            Retry Loading Exam
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIdx];

  // Group questions by Subject
  const uniqueSubjects = Array.from(new Set(questions.map((q) => q.subjectName)));

  return (
    <div className="test-page">
      <Navbar mode="candidate" candidateName={candidate?.name} />

      {/* Sub-bar Header */}
      <div className="test-subbar">
        <div className="test-subbar-inner">

          {/* Assessment Title */}
          <div className="test-subbar-title-wrap">
            <div className="test-subbar-icon">
              <BookOpen size={18} />
            </div>
            <div className="test-subbar-title-text">
              <div className="test-subbar-title">{assessmentName}</div>
              <div className="test-subbar-sub">45 Mins • 60 Questions</div>
            </div>
          </div>

          {/* Right Stats & Timer */}
          <div className="test-subbar-right">
            {/* Proctoring Warning Indicator */}
            <div className={`test-warning-pill ${warningCount > 0 ? "active-warning" : ""}`}>
              <ShieldAlert size={14} color={warningCount > 0 ? "#DC2626" : "#64748B"} />
              <span>
                Warnings: {warningCount}/{maxProctorWarnings}
              </span>
            </div>

            {/* Timer */}
            <div className={`test-timer ${timeLeftSec <= 300 ? "danger" : ""}`}>
              <Clock size={14} />
              <span>{fmt(timeLeftSec)}</span>
            </div>

            <button
              onClick={() => setPaletteOpen(!paletteOpen)}
              className="test-palette-toggle"
              title="Open Question Palette"
            >
              <Grid size={14} />
              <span>Palette</span>
            </button>
          </div>

        </div>
      </div>

      {/* Timer Warning Banner */}
      {timerWarning && (
        <div style={{ background: "#FEF2F2", borderBottom: "1px solid #FCA5A5", color: "#991B1B", padding: "8px 16px", fontSize: "12px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", letterSpacing: "0.3px" }}>
          <AlertTriangle size={14} color="#DC2626" />
          <span style={{ textTransform: "uppercase" }}>{timerWarning}</span>
        </div>
      )}

      {/* Main Grid */}
      <main className="test-body">
        <div className="test-layout">

          {/* Left Column: Question Card */}
          <div className="test-main-col">
            <div className="test-card">

              {/* Header */}
              <div className="test-card-header">
                <div>
                  <span className="test-q-badge">Question {currentIdx + 1} of {questions.length}</span>
                </div>
                <button
                  onClick={() => setFlagged((p) => ({ ...p, [currentQ.id]: !p[currentQ.id] }))}
                  className={`test-flag-btn ${flagged[currentQ.id] ? "flagged" : ""}`}
                >
                  <Bookmark size={14} />
                  <span>{flagged[currentQ.id] ? "Marked for Review" : "Mark for Review"}</span>
                </button>
              </div>

              {/* Question Text */}
              <div className="test-q-body">
                <h3 className="test-q-text">{currentQ.question}</h3>

                {/* Options List */}
                <div className="options-list test-options-list" style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "20px" }}>
                  {[
                    { key: "A", val: currentQ.optionA },
                    { key: "B", val: currentQ.optionB },
                    { key: "C", val: currentQ.optionC },
                    { key: "D", val: currentQ.optionD },
                  ].map((opt) => {
                    const isSel = answers[currentQ.id]?.selectedOption === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => handleSelectOption(currentQ.id, opt.key)}
                        className={`option-item test-option-btn ${isSel ? "option-item--selected selected" : ""}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          padding: "14px 18px",
                          borderRadius: "14px",
                          border: `2px solid ${isSel ? "#00AEEF" : "#E2EFF8"}`,
                          background: isSel ? "#E8F6FF" : "#F8FCFF",
                          color: isSel ? "#003F72" : "#1A2B40",
                          fontSize: "14px",
                          fontWeight: isSel ? 700 : 600,
                          cursor: "pointer",
                          textAlign: "left",
                          width: "100%",
                          transition: "all 0.18s ease",
                          boxShadow: isSel ? "0 4px 14px rgba(0, 174, 239, 0.15)" : "none",
                        }}
                      >
                        <span
                          className="option-key test-opt-key"
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            border: `2px solid ${isSel ? "#00AEEF" : "#CBD5E1"}`,
                            background: isSel ? "#00AEEF" : "white",
                            color: isSel ? "white" : "#64748B",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "13px",
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {opt.key}
                        </span>
                        <span className="option-val test-opt-val" style={{ flex: 1, lineHeight: "1.5" }}>
                          {opt.val}
                        </span>
                        {isSel && <CheckCircle2 size={20} color="#00AEEF" style={{ flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Navigation Footer */}
              <div className="test-card-footer">
                <button
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx((p) => Math.max(0, p - 1))}
                  className="test-nav-btn"
                >
                  <ChevronLeft size={16} />
                  <span>Previous</span>
                </button>

                <div className="test-nav-progress">
                  Answered: <strong>{answeredCount}</strong> / {questions.length}
                </div>

                {currentIdx < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentIdx((p) => Math.min(questions.length - 1, p + 1))}
                    className="test-nav-btn primary"
                  >
                    <span>Next Question</span>
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitExam}
                    disabled={submitting}
                    className="test-submit-btn"
                  >
                    {submitting ? "Submitting…" : "Submit Assessment"}
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* Right Column: Question Palette & Live Camera Proctor */}
          <div className={`test-sidebar ${paletteOpen ? "open" : ""}`}>
            {/* Live Camera Proctor Widget */}
            <div style={{ marginBottom: "14px" }}>
              <CameraProctor
                mode="exam"
                attemptId={attemptId}
                onWarningTrigger={(evt, msg) => reportProctoringViolation(evt, msg)}
              />
            </div>

            <div className="test-palette-card">
              <div className="test-palette-header">
                <div>
                  <h4 style={{ fontSize: "14px", fontWeight: 800, color: "#1E293B" }}>Question Palette</h4>
                  <p style={{ fontSize: "11px", color: "#64748B" }}>Jump directly to any section question</p>
                </div>
                <button onClick={() => setPaletteOpen(false)} className="test-palette-close">
                  <X size={16} />
                </button>
              </div>

              {/* Subjects & Sections Breakdown */}
              <div className="test-palette-grid" style={{ maxHeight: "calc(100vh - 220px)", overflowY: "auto", paddingRight: "4px" }}>
                {uniqueSubjects.map((subName) => {
                  const subQuestions = questions.filter((q) => q.subjectName === subName);
                  return (
                    <div key={subName} style={{ marginBottom: "16px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 800, color: "#00AEEF", marginBottom: "8px", textTransform: "uppercase" }}>
                        {subName}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
                        {questions.map((q, idx) => {
                          if (q.subjectName !== subName) return null;
                          const st = qStatus(q.id, idx);
                          return (
                            <button
                              key={q.id}
                              onClick={() => {
                                setCurrentIdx(idx);
                                setPaletteOpen(false);
                              }}
                              className={`test-q-item ${st}`}
                            >
                              {idx + 1}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #E2E8F0" }}>
                <button
                  onClick={handleSubmitExam}
                  disabled={submitting}
                  className="test-submit-btn"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  {submitting ? "Submitting…" : "Finish & Submit Exam"}
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* PROCTORING WARNING MODAL */}
      {warningModalMsg && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15,23,42,0.80)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "white", maxWidth: "440px", width: "100%", borderRadius: "20px", overflow: "hidden", boxShadow: "0 32px 64px rgba(0,0,0,0.3)" }}>

            {/* Red top bar */}
            <div style={{ background: "linear-gradient(135deg,#DC2626,#B91C1C)", padding: "24px", textAlign: "center" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <ShieldAlert size={36} color="white" />
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: 900, color: "white", margin: 0, letterSpacing: "-0.3px" }}>Proctoring Violation</h3>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.75)", marginTop: "4px", fontWeight: 600 }}>Identity verification failed</p>
            </div>

            {/* Body */}
            <div style={{ padding: "24px" }}>
              {/* Message */}
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: "12px", padding: "14px" }}>
                <AlertTriangle size={20} color="#DC2626" style={{ flexShrink: 0, marginTop: "1px" }} />
                <p style={{ fontSize: "13px", color: "#7F1D1D", lineHeight: 1.6, margin: 0, fontWeight: 600 }}>
                  {warningModalMsg}
                </p>
              </div>

              {/* Warning progress */}
              <div style={{ marginTop: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>Violation Progress</span>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: warningCount >= 2 ? "#DC2626" : "#92400E" }}>
                    {warningCount} of {maxProctorWarnings} warnings
                  </span>
                </div>
                <div style={{ height: "8px", background: "#F1F5F9", borderRadius: "99px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(warningCount / maxProctorWarnings) * 100}%`, background: warningCount >= 2 ? "#DC2626" : "#F59E0B", borderRadius: "99px", transition: "width 0.4s ease" }} />
                </div>
                <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "6px", fontWeight: 600 }}>
                  {maxProctorWarnings - warningCount} warning(s) remaining before automatic disqualification.
                </p>
              </div>

              {/* Acknowledge button */}
              <button
                onClick={() => setWarningModalMsg(null)}
                style={{ marginTop: "20px", width: "100%", padding: "13px", background: "#1E293B", color: "white", fontWeight: 800, fontSize: "14px", borderRadius: "12px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
              >
                <CheckCircle2 size={18} />
                I Understand — Resume Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIVE CAMERA PROCTORING PIP & SCREENSHOT CAPTURE ENGINE */}
      {!loading && !disqualified && attemptId && (
        <CameraProctor
          mode="exam"
          attemptId={attemptId}
          onWarningTrigger={(type, msg) => {
            reportProctoringViolation(type, msg);
          }}
        />
      )}

    </div>
  );
}
