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
  const lastWarningTimeRef = useRef<number>(0);
  const totalShotsTakenRef = useRef<number>(0); // Strictly max 3 screenshots per exam

  const [cameraActive, setCameraActive] = useState(false);
  const [faceStatus, setFaceStatus] = useState<"FACE_OK" | "NO_FACE" | "MULTIPLE_FACES" | "CAMERA_OFF">("CAMERA_OFF");
  const [isMinimized, setIsMinimized] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Stable callback refs — avoids React hook dependency size mismatch
  const onVerificationRef = useRef(onVerificationChange);
  const onWarningRef = useRef(onWarningTrigger);
  useEffect(() => { onVerificationRef.current = onVerificationChange; });
  useEffect(() => { onWarningRef.current = onWarningTrigger; });

  const WARNING_COOLDOWN_MS = 30000; // 30 seconds cooldown between warnings (minimal disruption)

  // ── Helper: Upload screenshot (Strictly Max 3 Screenshots Total) ─────────
  const uploadScreenshot = useCallback(async (type: "SCHEDULED" | "WARNING", eventType?: string) => {
    if (!attemptId || !videoRef.current || !cameraActive) return;
    if (totalShotsTakenRef.current >= 3) {
      console.log("📸 Maximum 3 screenshots limit reached for this session.");
      return;
    }

    try {
      const video = videoRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;
      const offCanvas = document.createElement("canvas");
      offCanvas.width = video.videoWidth || 640;
      offCanvas.height = video.videoHeight || 480;
      const ctx = offCanvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, offCanvas.width, offCanvas.height);
      const dataUrl = offCanvas.toDataURL("image/jpeg", 0.65);

      totalShotsTakenRef.current += 1;
      const currentShotNumber = totalShotsTakenRef.current;
      console.log(`📸 Successfully uploading screenshot [${currentShotNumber}/3] (${eventType})...`);

      const baseUrl = getApiBaseUrl();
      await fetch(`${baseUrl}/api/v1/proctoring/upload-screenshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          screenshotDataUrl: dataUrl,
          imageBase64: dataUrl,
          type,
          eventType: eventType || `SHOT_${currentShotNumber}`,
        }),
      });
    } catch (e) {
      console.warn("Could not upload proctoring screenshot:", e);
    }
  }, [attemptId, cameraActive]);

  const uploadScreenshotRef = useRef(uploadScreenshot);
  useEffect(() => { uploadScreenshotRef.current = uploadScreenshot; });

  // ── Load face-api.js TinyFaceDetector model ────────────────────────────
  useEffect(() => {
    let isMounted = true;
    async function loadModels() {
      try {
        const faceapi = await import("face-api.js");
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        if (isMounted) {
          setModelsLoaded(true);
          console.log("✅ face-api.js TinyFaceDetector model loaded");
        }
      } catch (err) {
        if (isMounted) {
          console.error("Failed to load face-api models:", err);
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

  // ── Face detection loop (face-api.js TinyFaceDetector - Forgiving Mode) ─
  useEffect(() => {
    if (!cameraActive || !modelsLoaded) return;

    async function runDetection() {
      const faceapi = await import("face-api.js");
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

            // 10 seconds continuous absence triggers UI warning
            if (noFaceStreakRef.current >= 10) {
              setFaceStatus("NO_FACE");
              if (onVerificationRef.current) onVerificationRef.current(false, "No face detected in camera.");

              const now = Date.now();
              if (now - lastWarningTimeRef.current > WARNING_COOLDOWN_MS) {
                lastWarningTimeRef.current = now;
                if (onWarningRef.current) {
                  onWarningRef.current("FACE_NOT_DETECTED", "⚠️ Face not detected for 10+ seconds. Please stay in front of the camera.");
                }
              }
            }

          } else if (count > 1) {
            multiFaceStreakRef.current += 1;
            noFaceStreakRef.current = 0;

            // 6 seconds of multiple faces triggers UI warning
            if (multiFaceStreakRef.current >= 6) {
              setFaceStatus("MULTIPLE_FACES");
              if (onVerificationRef.current) onVerificationRef.current(false, "Multiple faces detected.");

              const now = Date.now();
              if (now - lastWarningTimeRef.current > WARNING_COOLDOWN_MS) {
                lastWarningTimeRef.current = now;
                if (onWarningRef.current) {
                  onWarningRef.current("MULTIPLE_FACES", "⚠️ Multiple faces detected! Only the candidate should be in front of the camera.");
                }
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

  // ── Scheduled 15-Minute 3-Screenshot Engine ──────────────────────────
  // Photo 1: Initial Baseline at ~3 seconds (Start of Exam)
  // Photo 2: At 15 minutes (15:00)
  // Photo 3: At 30 minutes (30:00)
  // Strictly 3 photos total in the entire 45-minute exam!
  useEffect(() => {
    if (mode !== "exam" || !attemptId || !cameraActive) return;

    // Shot 1: Initial Baseline (3s after start)
    const shot1Timer = setTimeout(() => {
      if (totalShotsTakenRef.current < 3) {
        uploadScreenshotRef.current("SCHEDULED", "EXAM_START_BASELINE");
      }
    }, 3000);

    // Shot 2: 15-minute mark (15 * 60 * 1000 ms)
    const shot2Timer = setTimeout(() => {
      if (totalShotsTakenRef.current < 3) {
        uploadScreenshotRef.current("SCHEDULED", "PERIODIC_15_MIN");
      }
    }, 15 * 60 * 1000);

    // Shot 3: 30-minute mark (30 * 60 * 1000 ms)
    const shot3Timer = setTimeout(() => {
      if (totalShotsTakenRef.current < 3) {
        uploadScreenshotRef.current("SCHEDULED", "PERIODIC_30_MIN");
      }
    }, 30 * 60 * 1000);

    return () => {
      clearTimeout(shot1Timer);
      clearTimeout(shot2Timer);
      clearTimeout(shot3Timer);
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

      {/* PIP Camera Badge */}
      <div
        className={`nb-camera-pip ${isMinimized ? "minimized" : ""}`}
        style={{
          border: `2.5px solid ${borderColor}`,
          transition: "all 0.25s ease",
        }}
      >
        {!isMinimized && (
          <div
            className="nb-camera-status-banner"
            style={{
              backgroundColor: bannerBg,
              transition: "background-color 0.3s ease",
            }}
          >
            {faceStatus === "FACE_OK" && (
              <>
                <CheckCircle2 size={12} className="text-white shrink-0" />
                <span className="text-white font-semibold">Face Verified</span>
              </>
            )}
            {faceStatus === "MULTIPLE_FACES" && (
              <>
                <ShieldAlert size={12} className="text-white shrink-0 animate-bounce" />
                <span className="text-white font-semibold">Multiple Faces</span>
              </>
            )}
            {faceStatus === "NO_FACE" && (
              <>
                <AlertTriangle size={12} className="text-white shrink-0 animate-pulse" />
                <span className="text-white font-semibold">No Face</span>
              </>
            )}
            {faceStatus === "CAMERA_OFF" && (
              <>
                <Video size={12} className="text-white shrink-0" />
                <span className="text-white font-semibold">Connecting...</span>
              </>
            )}
          </div>
        )}

        {/* Video feed */}
        <div className="relative w-full h-full bg-slate-950 overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover mirror-mode"
          />

          <button
            type="button"
            onClick={() => setIsMinimized((prev) => !prev)}
            className="nb-camera-minimize-btn"
            title={isMinimized ? "Expand Camera" : "Minimize Camera"}
          >
            {isMinimized ? <Maximize2 size={10} /> : <Minimize2 size={10} />}
          </button>
        </div>
      </div>
    </>
  );
}
