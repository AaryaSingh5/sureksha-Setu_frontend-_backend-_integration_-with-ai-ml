import React, { useRef, useState, useCallback, useEffect } from "react";
import { Camera, CheckCircle, RefreshCw, AlertCircle, Sparkles, Video, ShieldCheck } from "lucide-react";
import { faceMatch, FaceMatchStatus } from "../lib/verificationApi";

interface FaceCaptureProps {
  verificationId: string;
  onMatchSuccess: () => void;
  onMatchFailed: (reason: string) => void;
}

export const FaceCapture: React.FC<FaceCaptureProps> = ({
  verificationId,
  onMatchSuccess,
  onMatchFailed,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [status, setStatus] = useState<FaceMatchStatus>("PENDING");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Start webcam
  const startCamera = useCallback(async () => {
    try {
      setErrorMsg(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setErrorMsg("Camera access denied or unavailable. Please grant webcam permissions to continue.");
    }
  }, []);

  // Cleanup camera on stream changes and unmount
  useEffect(() => {
    if (stream && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const captureFrame = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current) return resolve(null);
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
    });
  };

  const startLivenessCapture = async () => {
    setIsCapturing(true);
    setErrorMsg(null);

    try {
      const capturedFrames: Blob[] = [];

      // Capture frame 1
      const blob1 = await captureFrame();
      if (blob1) capturedFrames.push(blob1);

      // 1-second interval for liveness movement check
      setCountdown(1);
      await new Promise((r) => setTimeout(r, 1000));
      setCountdown(null);

      // Capture frame 2
      const blob2 = await captureFrame();
      if (blob2) capturedFrames.push(blob2);

      if (capturedFrames.length < 2) {
        throw new Error("Failed to capture video frames for liveness.");
      }

      setStatus("PENDING");
      const res = await faceMatch(verificationId, capturedFrames);

      setStatus(res.status);
      if (res.status === "MATCHED") {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
          setStream(null);
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
        }
        onMatchSuccess();
      } else {
        setErrorMsg(res.message || "Facial comparison failed. Please ensure good lighting and face visibility.");
        onMatchFailed(res.message);
      }
    } catch (error: any) {
      const msg = error.message || "Failed to process face match";
      setErrorMsg(msg);
      setStatus("MISMATCH");
      onMatchFailed(msg);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-slate-900/90 border border-slate-700/70 rounded-2xl shadow-xl text-white">
      <div className="text-center mb-3">
        <div className="inline-flex items-center justify-center p-2 rounded-xl bg-indigo-500/20 text-indigo-400 mb-1 border border-indigo-500/30">
          <Camera className="w-5 h-5 text-indigo-300" />
        </div>
        <h3 className="text-sm font-black text-white flex items-center justify-center gap-1.5">
          Biometric Liveness & Face Match
        </h3>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Dual-frame neural comparison against ID photo
        </p>
      </div>

      {!stream && status === "PENDING" ? (
        <div className="flex flex-col items-center p-5 bg-slate-800/80 border border-slate-700/60 rounded-xl">
          <p className="text-slate-300 text-xs text-center mb-3 leading-relaxed">
            Please allow camera access to perform an automated liveness check and match against your uploaded document.
          </p>
          <button
            type="button"
            onClick={startCamera}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-2"
          >
            <Video className="w-4 h-4" />
            <span>Enable Camera</span>
          </button>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video mb-3 flex items-center justify-center border border-slate-700 shadow-inner">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Oval Face Guide */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-36 h-48 border-2 border-dashed border-indigo-400/70 rounded-[50%] animate-pulse shadow-sm" />
          </div>

          {/* Overlay elements */}
          {countdown !== null && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-xs">
              <span className="text-4xl font-extrabold text-amber-400 animate-bounce">{countdown}</span>
              <span className="text-xs font-bold mt-1 text-slate-200">Look directly at camera & blink slightly...</span>
            </div>
          )}

          {isCapturing && countdown === null && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-xs gap-2">
              <RefreshCw className="w-7 h-7 text-indigo-400 animate-spin" />
              <span className="text-xs font-bold text-slate-200">Analyzing neural face landmarks...</span>
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="mb-3 p-3 bg-red-950/70 border border-red-800/80 text-red-300 text-xs rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {status === "MATCHED" && (
        <div className="mb-3 p-3 bg-emerald-950/70 border border-emerald-800/80 text-emerald-300 text-xs rounded-xl flex items-center gap-2 font-bold">
          <ShieldCheck className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <span>Biometric Match Verified: Face successfully matched with ID photo!</span>
        </div>
      )}

      {status !== "MATCHED" && (
        <button
          type="button"
          onClick={startLivenessCapture}
          disabled={!stream || isCapturing}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-extrabold transition shadow-md flex justify-center items-center gap-2"
        >
          {isCapturing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Verifying Liveness & Match...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{stream ? "Capture & Verify Face Match" : "Awaiting Camera Access"}</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};
