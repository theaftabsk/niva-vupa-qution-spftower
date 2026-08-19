"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { CheckCircle2, ShieldAlert, AlertTriangle, Minimize2, Maximize2, Video } from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";

interface CameraProctorProps {
  mode: "pre-exam" | "exam";
  attemptId?: string;
  onVerificationChange?: (isVerified: boolean, message: string) => void;
  onWarningTrigger?: (eventType: string, message: string) => void;
}

export default function CameraProctor({
  mode,
  attemptId,
  onVerificationChange,
  onWarningTrigger,
}: CameraProctorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scheduledTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastWarningTimeRef = useRef<number>(0);

  const [cameraActive, setCameraActive] = useState(false);
  const [faceStatus, setFaceStatus] = useState<"FACE_OK" | "NO_FACE" | "MULTIPLE_FACES" | "CAMERA_OFF">("CAMERA_OFF");
  const [isMinimized, setIsMinimized] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Stable callback refs — avoids React hook dependency size mismatch
  const onVerificationRef = useRef(onVerificationChange);
  const onWarningRef = useRef(onWarningTrigger);
  useEffect(() => { onVerificationRef.current = onVerificationChange; });
  useEffect(() => { onWarningRef.current = onWarningTrigger; });

  const SCHEDULED_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes interval
  const WARNING_COOLDOWN_MS = 30000; // 30 seconds cooldown between warnings (minimal disruption)

  // ── Helper: Upload screenshot ──────────────────────────────────────────
  const uploadScreenshot = useCallback(async (type: "SCHEDULED" | "WARNING", eventType?: string) => {
    if (!attemptId || !videoRef.current || !cameraActive) return;
    try {
      const video = videoRef.current;
      const offCanvas = document.createElement("canvas");
      offCanvas.width = video.videoWidth || 640;
      offCanvas.height = video.videoHeight || 480;
      const ctx = offCanvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, offCanvas.width, offCanvas.height);
      const dataUrl = offCanvas.toDataURL("image/jpeg", 0.65);

      const baseUrl = getApiBaseUrl();
      await fetch(`${baseUrl}/api/v1/candidates/proctoring/upload-screenshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          screenshotDataUrl: dataUrl,
          type,
          eventType: eventType || "ROUTINE",
        }),
      });
    } catch {
      // non-critical — ignore network error on screenshot upload
    }
  }, [attemptId, cameraActive]);

  const uploadScreenshotRef = useRef(uploadScreenshot);
  useEffect(() => { uploadScreenshotRef.current = uploadScreenshot; });

  // ── Load face-api.js TinyFaceDetector model ────────────────────────────
  useEffect(() => {
    let isMounted = true;
    async function loadModels() {
      try {
        // Dynamically import face-api.js only on client side
        const faceapi = await import("face-api.js");
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        if (isMounted) {
          setModelsLoaded(true);
          console.log("✅ face-api.js TinyFaceDetector model loaded");
        }
      } catch (err) {
        if (isMounted) {
          console.error("Failed to load face-api models:", err);
          // Fallback: allow exam even if model fails to load
          setModelsLoaded(true);
        }
      }
    }
    loadModels();
    return () => { isMounted = false; };
  }, []);

  // ── Start Webcam ───────────────────────────────────────────────────────
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setCameraActive(true);
      } catch (err) {
        console.error("Webcam access error:", err);
        setCameraActive(false);
        setFaceStatus("CAMERA_OFF");
        if (onVerificationRef.current) {
          onVerificationRef.current(false, "Camera access denied. Please allow camera permissions.");
        }
      }
    }

    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const noFaceStreakRef = useRef<number>(0);
  const multiFaceStreakRef = useRef<number>(0);

  // ── Face detection loop (face-api.js TinyFaceDetector - Forgiving / Lenient Mode) ─
  useEffect(() => {
    if (!cameraActive || !modelsLoaded) return;

    async function runDetection() {
      const faceapi = await import("face-api.js");
      // Lenient Threshold: scoreThreshold 0.20 (handles dim light, glasses, slight tilts gracefully)
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.20 });

      detectionLoopRef.current = setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.paused || video.ended || video.readyState < 2) return;

        try {
          const detections = await faceapi.detectAllFaces(video, options);
          const count = detections.length;

          if (count === 0) {
            noFaceStreakRef.current += 1;
            multiFaceStreakRef.current = 0;

            // Require 10 consecutive failed checks (10 full seconds of complete absence) before triggering NO_FACE alert
            if (noFaceStreakRef.current >= 10) {
              setFaceStatus("NO_FACE");
              if (onVerificationRef.current) onVerificationRef.current(false, "No face detected in camera.");

              const now = Date.now();
              if (now - lastWarningTimeRef.current > WARNING_COOLDOWN_MS) {
                lastWarningTimeRef.current = now;
                if (onWarningRef.current) {
                  onWarningRef.current("FACE_NOT_DETECTED", "⚠️ Face not detected for 10+ seconds. Please stay in front of the camera.");
                }
                uploadScreenshotRef.current("WARNING", "FACE_NOT_DETECTED");
              }
            }

          } else if (count > 1) {
            multiFaceStreakRef.current += 1;
            noFaceStreakRef.current = 0;

            // Require 6 consecutive checks (6 seconds) of multiple faces before triggering MULTIPLE_FACES alert
            if (multiFaceStreakRef.current >= 6) {
              setFaceStatus("MULTIPLE_FACES");
              if (onVerificationRef.current) onVerificationRef.current(false, "Multiple faces detected.");

              const now = Date.now();
              if (now - lastWarningTimeRef.current > WARNING_COOLDOWN_MS) {
                lastWarningTimeRef.current = now;
                if (onWarningRef.current) {
                  onWarningRef.current("MULTIPLE_FACES", "⚠️ Multiple faces detected! Only the candidate should be in front of the camera.");
                }
                uploadScreenshotRef.current("WARNING", "MULTIPLE_FACES");
              }
            }

          } else {
            // Face detected — All Good!
            noFaceStreakRef.current = 0;
            multiFaceStreakRef.current = 0;
            setFaceStatus("FACE_OK");
            if (onVerificationRef.current) onVerificationRef.current(true, "Face verified ✅");
          }
        } catch (err) {
          console.error("Face detection error:", err);
        }
      }, 1000); // Check every 1 second
    }

    runDetection();

    return () => {
      if (detectionLoopRef.current) clearInterval(detectionLoopRef.current);
    };
  }, [cameraActive, modelsLoaded]);

  // ── Scheduled 20-minute screenshot (Initial baseline at 3s + every 20 mins) ──
  useEffect(() => {
    if (mode !== "exam" || !attemptId || !cameraActive) return;

    // Take initial baseline verification screenshot 3 seconds after camera start
    const initialCaptureTimer = setTimeout(() => {
      console.log("📸 Capturing initial baseline proctoring screenshot...");
      uploadScreenshotRef.current("SCHEDULED", "EXAM_START_BASELINE");
    }, 3000);

    // Recurring 20-minute interval screenshot capture
    scheduledTimerRef.current = setInterval(() => {
      console.log("📸 Scheduled 20-min proctoring screenshot capture...");
      uploadScreenshotRef.current("SCHEDULED", "PERIODIC_20_MIN");
    }, SCHEDULED_INTERVAL_MS);

    return () => {
      clearTimeout(initialCaptureTimer);
      if (scheduledTimerRef.current) clearInterval(scheduledTimerRef.current);
    };
  }, [mode, attemptId, cameraActive]);

  // ── PIP Badge render ───────────────────────────────────────────────────
  const borderColor =
    faceStatus === "FACE_OK" ? "#22C55E" :
    faceStatus === "MULTIPLE_FACES" ? "#F59E0B" : "#EF4444";

  const bannerBg =
    faceStatus === "FACE_OK" ? "rgba(22,101,52,0.92)" :
    faceStatus === "MULTIPLE_FACES" ? "rgba(146,64,14,0.92)" : "rgba(185,28,28,0.92)";


  return (
    <>
      {/* Hidden canvas for screenshot capture */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* PIP Camera Badge (Responsive with class nb-camera-pip) */}
      <div
        className={`nb-camera-pip ${isMinimized ? "minimized" : ""}`}
        style={{
          border: `2.5px solid ${borderColor}`,
          transition: "all 0.25s ease",
        }}
      >
        {!isMinimized && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="nb-camera-video"
              style={{ transform: "scaleX(-1)", display: "block" }}
            />

            {/* Model loading spinner overlay */}
            {!modelsLoaded && (
              <div style={{
                position: "absolute", inset: 0, background: "rgba(15,23,42,0.85)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px"
              }}>
                <div style={{
                  width: "22px", height: "22px", border: "3px solid #334155",
                  borderTopColor: "#38BDF8", borderRadius: "50%",
                  animation: "spin 0.8s linear infinite"
                }} />
                <span style={{ color: "#94A3B8", fontSize: "9px", fontWeight: 700 }}>Loading AI...</span>
              </div>
            )}
          </>
        )}

        {/* Status Banner & Minimize Toggle */}
        <div style={{
          background: bannerBg, color: "white",
          padding: "4px 8px", fontSize: "10px", fontWeight: 800,
          textAlign: "center", display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: "4px",
          transition: "background 0.25s",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1, justifyContent: "center" }}>
            {faceStatus === "FACE_OK" ? (
              <><CheckCircle2 size={11} color="#4ADE80" /> Live</>
            ) : faceStatus === "MULTIPLE_FACES" ? (
              <><AlertTriangle size={11} color="#FCD34D" /> Multiple</>
            ) : (
              <><ShieldAlert size={11} color="#FCA5A5" /> Alert</>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(!isMinimized);
            }}
            title={isMinimized ? "Expand Camera" : "Minimize Camera"}
            style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "4px", padding: "2px", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {isMinimized ? <Maximize2 size={10} /> : <Minimize2 size={10} />}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
