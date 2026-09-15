"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { frames, type Frame } from "@/components/product-shell/constants";
import { SHOT_COUNT } from "./constants";
import styles from "./solo-photo-booth.module.css";

type CameraState = "idle" | "requesting" | "ready" | "denied" | "unavailable" | "capturing" | "revealing";

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function SoloPhotoBooth() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealHeadingRef = useRef<HTMLHeadingElement>(null);
  const uploadRef = useRef<AbortController | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [photos, setPhotos] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<Frame>(frames[0]);
  const [message, setMessage] = useState("Enable your camera to capture your four-photo moment.");
  const [processingState, setProcessingState] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [processingError, setProcessingError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const requestCamera = useCallback(async () => {
    clearTimer();
    stopStream(streamRef.current);
    streamRef.current = null;
    setCameraState("requesting");
    setMessage("Asking for camera access…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState("ready");
      setMessage("Camera ready. Four photos, three seconds per pose.");
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setCameraState("denied");
        setMessage("Camera access is blocked. Allow it in your browser settings, then try again.");
      } else {
        setCameraState("unavailable");
        setMessage("We couldn’t use a camera. Check that another app is not using it, then try again.");
      }
    }
  }, [clearTimer]);

  useEffect(() => () => {
    clearTimer();
    stopStream(streamRef.current);
    uploadRef.current?.abort();
  }, [clearTimer]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 675;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
    const width = video.videoWidth * scale;
    const height = video.videoHeight * scale;
    context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    return canvas.toDataURL("image/jpeg", 0.92);
  }, []);

  function runShot(shotIndex: number, nextPhotos: string[]) {
    setCountdown(3);
    setMessage(`Photo ${shotIndex + 1} of ${SHOT_COUNT}. Get ready.`);
    let remaining = 3;
    const tick = () => {
      if (remaining === 0) {
        const photo = capturePhoto();
        if (!photo) {
          setCameraState("ready");
          setCountdown(null);
          setMessage("We couldn’t capture that photo. Please try the sequence again.");
          return;
        }
        const updatedPhotos = [...nextPhotos, photo];
        setPhotos(updatedPhotos);
        setCountdown(null);
        if (shotIndex === SHOT_COUNT - 1) {
          stopStream(streamRef.current);
          streamRef.current = null;
          setCameraState("revealing");
          setMessage("Your four-photo keepsake is ready.");
          window.setTimeout(() => revealHeadingRef.current?.focus(), 0);
          return;
        }
        setMessage(`Photo ${shotIndex + 1} captured. Next pose coming up.`);
        timeoutRef.current = setTimeout(() => runShot(shotIndex + 1, updatedPhotos), 850);
        return;
      }
      remaining -= 1;
      setCountdown(remaining);
      timeoutRef.current = setTimeout(tick, 1000);
    };
    timeoutRef.current = setTimeout(tick, 1000);
  }

  const startSequence = () => {
    if (cameraState !== "ready") return;
    setPhotos([]);
    setCameraState("capturing");
    runShot(0, []);
  };

  const cancelSequence = () => {
    clearTimer();
    setCountdown(null);
    setPhotos([]);
    setCameraState("ready");
    setMessage("Sequence cancelled. Your previous completed moment stays untouched.");
  };

  const retake = () => {
    if (uploadRef.current) return;
    setProcessingState("idle");
    setDownloadUrl(null);
    setProcessingError("");
    setPhotos([]);
    setCameraState("idle");
    setMessage("Ready for another little moment.");
  };

  const downloadStrip = async () => {
    if (photos.length !== SHOT_COUNT || uploadRef.current) return;
    const controller = new AbortController();
    uploadRef.current = controller;
    setProcessingState("processing");
    setProcessingError("");
    setDownloadUrl(null);
    const timeout = window.setTimeout(() => controller.abort(), 60_000);
    try {
      const form = new FormData();
      form.append("frameId", selectedFrame.id);
      photos.forEach((photo, index) => {
        const bytes = Uint8Array.from(atob(photo.split(",")[1]), (character) => character.charCodeAt(0));
        form.append("photos", new Blob([bytes], { type: "image/jpeg" }), `photo-${index + 1}.jpg`);
      });
      const response = await fetch("/api/solo-photo-strips", { method: "POST", body: form, signal: controller.signal });
      if (!response.ok) {
        if (response.status === 429) throw new Error("The photo box is busy. Wait a moment, then try again.");
        if (response.status === 413) throw new Error("These photos are too large to process. Please retake your photos and try again.");
        throw new Error("We couldn’t finish your strip. Your photos are still here—please try again.");
      }
      const result: unknown = await response.json();
      if (!result || typeof result !== "object" || !("downloadUrl" in result) || typeof result.downloadUrl !== "string" || !result.downloadUrl.trim()) {
        throw new Error("Your download wasn’t ready. Please try again.");
      }
      const url = new URL(result.downloadUrl, window.location.origin);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Your download wasn’t ready. Please try again.");
      setDownloadUrl(url.href);
      setProcessingState("success");
      const link = document.createElement("a");
      link.download = "e-moment-photo-strip.png";
      link.href = url.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      setProcessingState("error");
      setProcessingError(controller.signal.aborted ? "That took longer than expected. Your photos are still here—please try again." : error instanceof TypeError ? "We couldn’t reach the photo box. Check your connection and try again." : error instanceof Error ? error.message : "We couldn’t finish your strip. Please try again.");
    } finally {
      window.clearTimeout(timeout);
      uploadRef.current = null;
    }
  };

  const isCameraActive = cameraState === "ready" || cameraState === "capturing";

  return <main className={styles.page}>
    <header className={styles.header}><Link href="/" className={styles.brand}><span className={styles.mark} aria-hidden="true"><i /><i /><i /><i /></span>E-moment</Link><Link href="/together">Make one together ↗</Link></header>
    <section className={styles.booth} aria-labelledby="booth-title">
      <div className={styles.intro}><p className={styles.eyebrow}><i /> Your solo moment</p><h1 id="booth-title">Make room for<br />a little moment.</h1><p>Take four photos, pick your favorite frame, and keep a little piece of today.</p></div>
      <div className={styles.cameraArea}>
        <div className={`${styles.cameraFrame} ${cameraState === "capturing" ? styles.capturing : ""}`}>
          {cameraState === "revealing" ? <div className={styles.reveal}><h2 ref={revealHeadingRef} tabIndex={-1}>A little moment, yours.</h2><div className={`${styles.strip} ${styles[`strip${selectedFrame.id}`]}`}>{photos.map((photo, index) => <Image key={photo} src={photo} alt={`Captured photo ${index + 1}`} width={900} height={675} unoptimized />)}<span>e-moment · today</span></div></div> : <>
            <video ref={videoRef} className={isCameraActive ? styles.video : styles.hiddenVideo} autoPlay muted playsInline />
            {!isCameraActive && <div className={styles.permission}><span aria-hidden="true">◉</span><strong>{cameraState === "requesting" ? "Opening your camera" : cameraState === "denied" ? "Camera permission needed" : cameraState === "unavailable" ? "Camera unavailable" : "Make room for a little moment"}</strong><p>{message}</p>{cameraState !== "requesting" && <button onClick={requestCamera}>{cameraState === "idle" ? "Enable camera" : "Try camera again"}</button>}</div>}
            {cameraState === "capturing" && countdown !== null && <div className={styles.countdown} aria-live="polite"><strong>{countdown}</strong><span>Photo {photos.length + 1} of {SHOT_COUNT}</span></div>}
            {isCameraActive && cameraState !== "capturing" && <span className={styles.readyBadge}>● Camera ready</span>}
          </>}
        </div>
        {cameraState === "revealing" ? <>
          <div className={styles.revealActions} aria-busy={processingState === "processing"}>
            <button className={styles.secondaryButton} onClick={retake} disabled={processingState === "processing"}>Retake four photos</button>
            <button className={styles.primaryButton} onClick={downloadStrip} disabled={processingState === "processing"} aria-describedby="strip-download-note">{processingState === "processing" ? <>Preparing your strip <span className={styles.spinner} aria-hidden="true" /></> : processingState === "error" ? <>Try download again <span aria-hidden="true">↻</span></> : <>Download strip <span aria-hidden="true">↓</span></>}</button>
          </div>
          <p id="strip-download-note" className={styles.downloadNote}>When you download, your four photos are uploaded to create and store your finished strip.</p>
          <div className={`${styles.processingStatus} ${processingState === "error" ? styles.processingError : ""}`}>
            <p role="status" aria-atomic="true">{processingState === "processing" ? "Framing your photos. Keep this page open while we prepare your download." : processingState === "success" ? "Your strip is ready. If the download didn’t start, use the link below." : ""}</p>
            {processingState === "error" && <p role="alert">{processingError}</p>}
            {processingState === "success" && downloadUrl && <a href={downloadUrl} download="e-moment-photo-strip.png" target="_blank" rel="noopener noreferrer">Open your photo strip <span aria-hidden="true">↗</span></a>}
          </div>
        </> : <div className={styles.cameraActions}>{cameraState === "ready" && <button className={styles.primaryButton} onClick={startSequence}>Take four photos <span>→</span></button>}{cameraState === "capturing" && <button className={styles.cancelButton} onClick={cancelSequence}>Cancel sequence</button>}<p aria-live="polite">{message}</p></div>}
      </div>
      <aside className={styles.sidePanel}>
        <div><p className={styles.panelLabel}>Your progress</p><div className={styles.shots} aria-label={`${photos.length} of ${SHOT_COUNT} photos captured`}>{Array.from({ length: SHOT_COUNT }, (_, index) => <span key={index} className={photos[index] ? styles.shotFilled : ""}>{photos[index] ? <Image src={photos[index]} alt="" width={120} height={90} unoptimized /> : index + 1}</span>)}</div></div>
        <div><p className={styles.panelLabel}>Choose a frame</p><div className={styles.frameChoices}>{frames.map((frame) => <button key={frame.id} className={selectedFrame.id === frame.id ? styles.frameSelected : ""} onClick={() => { setSelectedFrame(frame); setProcessingState("idle"); setDownloadUrl(null); setProcessingError(""); }} disabled={cameraState === "capturing" || processingState === "processing"} aria-pressed={selectedFrame.id === frame.id}><i className={styles[`swatch${frame.id}`]} /><span><strong>{frame.name}</strong><small>{frame.note}</small></span></button>)}</div></div>
      </aside>
    </section>
  </main>;
}
