"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { frames, type Frame } from "@/data/product-shell";
import styles from "./solo-photo-booth.module.css";

type CameraState = "idle" | "requesting" | "ready" | "denied" | "unavailable" | "capturing" | "revealing";

const SHOT_COUNT = 4;

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.width, height / image.height);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  context.drawImage(image, (image.width - cropWidth) / 2, (image.height - cropHeight) / 2, cropWidth, cropHeight, x, y, width, height);
}

export function SoloPhotoBooth() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealHeadingRef = useRef<HTMLHeadingElement>(null);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [photos, setPhotos] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<Frame>(frames[0]);
  const [message, setMessage] = useState("Enable your camera to make a local-only photo strip.");

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
    setPhotos([]);
    setCameraState("idle");
    setMessage("Ready for another little moment.");
  };

  const downloadStrip = async () => {
    if (photos.length !== SHOT_COUNT) return;
    const imageElements = await Promise.all(photos.map((source) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = source;
    })));
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1950;
    const context = canvas.getContext("2d");
    if (!context) return;
    const isMidnight = selectedFrame.id === "midnight";
    context.fillStyle = selectedFrame.id === "cherry" ? "#f9d7d2" : isMidnight ? "#332c45" : "#e0d5f1";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = isMidnight ? "#f6e8d8" : selectedFrame.id === "cherry" ? "#6e2534" : "#3c3154";
    context.font = "italic 66px Georgia";
    context.textAlign = "center";
    context.fillText("e-moment", canvas.width / 2, 105);
    const padding = 70;
    const gap = 24;
    const photoWidth = canvas.width - padding * 2;
    const photoHeight = 390;
    imageElements.forEach((image, index) => drawCover(context, image, padding, 155 + index * (photoHeight + gap), photoWidth, photoHeight));
    context.font = "28px Arial";
    context.letterSpacing = "3px";
    context.fillText("A LITTLE MOMENT, YOURS", canvas.width / 2, 1880);
    const link = document.createElement("a");
    link.download = "e-moment-photo-strip.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const isCameraActive = cameraState === "ready" || cameraState === "capturing";

  return <main className={styles.page}>
    <header className={styles.header}><Link href="/" className={styles.brand}><span className={styles.mark} aria-hidden="true"><i /><i /><i /><i /></span>E-moment</Link><span>Solo photo box</span></header>
    <section className={styles.booth} aria-labelledby="booth-title">
      <div className={styles.intro}><p className={styles.eyebrow}><i /> Your solo moment</p><h1 id="booth-title">Make room for<br />a little moment.</h1><p>Nothing leaves your device in this prototype. Take four photos, pick a frame, and keep the strip.</p></div>
      <div className={styles.cameraArea}>
        <div className={`${styles.cameraFrame} ${cameraState === "capturing" ? styles.capturing : ""}`}>
          {cameraState === "revealing" ? <div className={styles.reveal}><h2 ref={revealHeadingRef} tabIndex={-1}>A little moment, yours.</h2><div className={`${styles.strip} ${styles[`strip${selectedFrame.id}`]}`}>{photos.map((photo, index) => <Image key={photo} src={photo} alt={`Captured photo ${index + 1}`} width={900} height={675} unoptimized />)}<span>e-moment · today</span></div></div> : <>
            <video ref={videoRef} className={isCameraActive ? styles.video : styles.hiddenVideo} autoPlay muted playsInline />
            {!isCameraActive && <div className={styles.permission}><span aria-hidden="true">◉</span><strong>{cameraState === "requesting" ? "Opening your camera" : cameraState === "denied" ? "Camera permission needed" : cameraState === "unavailable" ? "Camera unavailable" : "Make room for a little moment"}</strong><p>{message}</p>{cameraState !== "requesting" && <button onClick={requestCamera}>{cameraState === "idle" ? "Enable camera" : "Try camera again"}</button>}</div>}
            {cameraState === "capturing" && countdown !== null && <div className={styles.countdown} aria-live="polite"><strong>{countdown}</strong><span>Photo {photos.length + 1} of {SHOT_COUNT}</span></div>}
            {isCameraActive && cameraState !== "capturing" && <span className={styles.readyBadge}>● Camera ready</span>}
          </>}
        </div>
        {cameraState === "revealing" ? <div className={styles.revealActions}><button className={styles.secondaryButton} onClick={retake}>Retake four photos</button><button className={styles.primaryButton} onClick={downloadStrip}>Download strip <span>↓</span></button></div> : <div className={styles.cameraActions}>{cameraState === "ready" && <button className={styles.primaryButton} onClick={startSequence}>Take four photos <span>→</span></button>}{cameraState === "capturing" && <button className={styles.cancelButton} onClick={cancelSequence}>Cancel sequence</button>}<p aria-live="polite">{message}</p></div>}
      </div>
      <aside className={styles.sidePanel}>
        <div><p className={styles.panelLabel}>Your progress</p><div className={styles.shots} aria-label={`${photos.length} of ${SHOT_COUNT} photos captured`}>{Array.from({ length: SHOT_COUNT }, (_, index) => <span key={index} className={photos[index] ? styles.shotFilled : ""}>{photos[index] ? <Image src={photos[index]} alt="" width={120} height={90} unoptimized /> : index + 1}</span>)}</div></div>
        <div><p className={styles.panelLabel}>Choose a frame</p><div className={styles.frameChoices}>{frames.map((frame) => <button key={frame.id} className={selectedFrame.id === frame.id ? styles.frameSelected : ""} onClick={() => setSelectedFrame(frame)} disabled={cameraState === "capturing"} aria-pressed={selectedFrame.id === frame.id}><i className={styles[`swatch${frame.id}`]} /><span><strong>{frame.name}</strong><small>{frame.note}</small></span></button>)}</div></div>
      </aside>
    </section>
  </main>;
}
