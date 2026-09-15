"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { frames } from "@/components/product-shell/constants";
import { BoothHeader } from "./together-setup";
import { readMembership, roomRequest, RoomError, saveMembership, watchRoom, type Admission, type Membership, type Room, type Snapshot } from "./room-client";
import styles from "./shared-photo-booth.module.css";

type LocalPhoto = { blob: Blob; url: string; state: "uploading" | "uploaded" | "error" };
const stopCamera = (stream: MediaStream | null) => stream?.getTracks().forEach((track) => track.stop());

function capture(video: HTMLVideoElement): Promise<Blob> {
  if (video.readyState < 2 || !video.videoWidth) return Promise.reject(new Error("Your camera stopped. Please create a fresh room to try again."));
  const canvas = document.createElement("canvas");
  canvas.width = 900; canvas.height = 675;
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("Your browser couldn’t capture this photo."));
  const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
  const width = video.videoWidth * scale, height = video.videoHeight * scale;
  context.translate(canvas.width, 0); context.scale(-1, 1);
  context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Your browser couldn’t save this photo.")), "image/jpeg", 0.92));
}

export function SharedPhotoBooth({ token }: { token: string }) {
  const path = `/api/rooms/${encodeURIComponent(token)}`;
  const [membership, setMembership] = useState<Membership | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [fatal, setFatal] = useState(false);
  const [captureFailed, setCaptureFailed] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState<"idle" | "requesting" | "ready" | "error">("idle");
  const [cameraError, setCameraError] = useState("");
  const [photos, setPhotos] = useState<Record<number, LocalPhoto>>({});
  const [countdown, setCountdown] = useState<{ slot: number; seconds: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const aliveRef = useRef(true);
  const busyRef = useRef(false);
  const roomRef = useRef<Room | null>(null);
  const clockOffset = useRef(0);
  const claimedSlots = useRef(new Set<number>());
  const localPhotos = useRef(new Map<number, LocalPhoto>());
  const uploads = useRef(new Map<number, AbortController>());
  const failedCapture = useRef(false);
  const joinKey = useRef<string | null>(null);

  const acceptSnapshot = useCallback((snapshot: Snapshot) => {
    if (!aliveRef.current || (roomRef.current && snapshot.room.revision < roomRef.current.revision)) return;
    roomRef.current = snapshot.room;
    setRoom(snapshot.room);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    const activeUploads = uploads.current;
    const capturedPhotos = localPhotos.current;
    const saved = readMembership(token);
    Promise.resolve().then(() => {
      if (!aliveRef.current) return;
      setMembership(saved); setLoaded(true);
      setInviteUrl(`${window.location.origin}/room/${encodeURIComponent(token)}`);
    });
    return () => {
      aliveRef.current = false;
      stopCamera(streamRef.current);
      activeUploads.forEach((controller) => controller.abort());
      capturedPhotos.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, [token]);

  useEffect(() => {
    if (!membership) return;
    const controller = new AbortController();
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    async function connect() {
      try {
        let bestRoundTrip = Infinity;
        const sampleCount = roomRef.current?.captureId ? 1 : 3;
        for (let sample = 0; sample < sampleCount; sample++) {
          const before = Date.now();
          const snapshot = await roomRequest<Snapshot>(path, membership, { signal: controller.signal });
          if (controller.signal.aborted) return;
          const after = Date.now();
          // Minimum RTT avoids treating a cold route compilation as network latency.
          // Once capture has started, keep its clock fixed even across reconnects.
          if (!roomRef.current?.captureId && after - before < bestRoundTrip) {
            bestRoundTrip = after - before;
            clockOffset.current = Date.parse(snapshot.serverTime) - (before + after) / 2;
          }
          acceptSnapshot(snapshot);
        }
        await watchRoom(path, membership!, controller.signal, (snapshot) => {
          if (controller.signal.aborted) return;
          attempts = 0; setConnected(true); acceptSnapshot(snapshot);
        });
        if (!controller.signal.aborted) throw new Error("Disconnected");
      } catch (error) {
        if (controller.signal.aborted) return;
        setConnected(false);
        if (error instanceof RoomError && [401, 403, 404, 410].includes(error.status)) {
          setFatal(true);
          setError("This private room has expired or your access is no longer available. Create a new room and invite your person again.");
          return;
        }
        reconnect = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 8000));
      }
    }
    void connect();
    return () => { controller.abort(); if (reconnect) clearTimeout(reconnect); };
  }, [membership, path, acceptSnapshot]);

  async function join(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      sessionStorage.setItem("e-moment-storage-check", "ok"); sessionStorage.removeItem("e-moment-storage-check");
      joinKey.current ||= crypto.randomUUID();
      const result = await roomRequest<Admission>(`${path}/join`, null, { method: "POST", headers: { "Idempotency-Key": joinKey.current }, body: JSON.stringify({ displayName: name.trim() || "Guest" }) });
      saveMembership(token, result.participant);
      acceptSnapshot(result); setMembership(result.participant);
    } catch (error) { setError(error instanceof Error ? error.message : "We couldn’t join this room. Please try again."); }
    finally { busyRef.current = false; if (aliveRef.current) setBusy(false); }
  }

  const abortCapture = useCallback(async (message: string) => {
    if (failedCapture.current) return;
    failedCapture.current = true;
    stopCamera(streamRef.current); streamRef.current = null;
    if (aliveRef.current) { setCaptureFailed(true); setError(message); setCamera("error"); setCountdown(null); }
    const current = roomRef.current;
    if (current?.captureId && membership) {
      try { await roomRequest(`${path}/abort`, membership, { method: "POST", body: JSON.stringify({ captureId: current.captureId }) }); }
      catch { /* Reconnection still exposes the stopped sequence; never recapture missed slots. */ }
    }
  }, [membership, path]);

  async function enableCamera() {
    if (camera === "requesting") return;
    setCamera("requesting"); setCameraError("");
    stopCamera(streamRef.current);
    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access needs a supported browser and a secure HTTPS connection.");
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } } });
      if (!aliveRef.current) { stopCamera(stream); return; }
      streamRef.current = stream;
      if (!videoRef.current) { stopCamera(stream); return; }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      if (!aliveRef.current) { stopCamera(stream); return; }
      stream.getVideoTracks().forEach((track) => track.addEventListener("ended", () => {
        if (!aliveRef.current) return;
        setCamera("error"); setCameraError("Your camera disconnected. Reconnect it and try again.");
        if (roomRef.current?.status === "capturing") void abortCapture("Your camera disconnected during capture. Start a fresh room to try again together.");
        else void roomRequest(path, membership, { method: "PATCH", body: JSON.stringify({ ready: false }) }).catch(() => {});
      }));
      setCamera("ready");
    } catch (error) {
      stopCamera(stream); streamRef.current = null;
      if (!aliveRef.current) return;
      setCamera("error");
      setCameraError(error instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(error.name) ? "Allow camera access in your browser settings, then try again." : error instanceof Error && !(error instanceof DOMException) ? error.message : "We couldn’t open your camera. Check that another app is not using it, then try again.");
    }
  }

  const uploadPhoto = useCallback(async (slot: number, photo: LocalPhoto) => {
    const current = roomRef.current;
    if (!membership || !current?.captureId || uploads.current.has(slot)) return;
    const controller = new AbortController();
    uploads.current.set(slot, controller);
    const timeout = setTimeout(() => controller.abort(), 60_000);
    const updateState = (state: LocalPhoto["state"]) => {
      const updated = { ...photo, state };
      localPhotos.current.set(slot, updated);
      if (aliveRef.current) setPhotos((previous) => ({ ...previous, [slot]: updated }));
    };
    updateState("uploading");
    try {
      const form = new FormData();
      form.append("captureId", current.captureId);
      form.append("photo", photo.blob, `photo-${slot + 1}.jpg`);
      await roomRequest<Snapshot>(`${path}/photos/${slot}`, membership, { method: "POST", body: form, signal: controller.signal });
      updateState("uploaded");
    } catch { updateState("error"); }
    finally { clearTimeout(timeout); uploads.current.delete(slot); }
  }, [membership, path]);

  const captureId = room?.captureId;
  const captureSchedule = room?.captureAt?.join(",");
  const roomStatus = room?.status;
  useEffect(() => {
    if (roomStatus !== "capturing" || !captureId || !captureSchedule) return;
    const schedule = captureSchedule.split(",").map(Date.parse);
    let cancelled = false;
    const tick = () => {
      if (cancelled || failedCapture.current) return;
      const slot = schedule.findIndex((_, index) => !claimedSlots.current.has(index));
      if (slot === -1) { setCountdown(null); return; }
      const remaining = schedule[slot] - (Date.now() + clockOffset.current);
      if (remaining > 0) { setCountdown({ slot, seconds: Math.ceil(remaining / 1000) }); return; }
      claimedSlots.current.add(slot);
      // Browser timers can be delayed while camera frames are being delivered or
      // when two windows are sharing the machine. The server owns the capture
      // window, so tolerate normal scheduling jitter and let the upload endpoint
      // enforce the real deadline.
      if (remaining < -10_000 || !videoRef.current || !streamRef.current?.active || document.visibilityState === "hidden") {
        void abortCapture("We missed a shared pose. Keep both pages visible with cameras on, and start a fresh room to try again.");
        return;
      }
      setCountdown({ slot, seconds: 0 });
      void capture(videoRef.current).then((blob) => {
        if (cancelled || !aliveRef.current) return;
        const photo: LocalPhoto = { blob, url: URL.createObjectURL(blob), state: "uploading" };
        localPhotos.current.set(slot, photo);
        setPhotos((previous) => ({ ...previous, [slot]: photo }));
        void uploadPhoto(slot, photo);
        if (slot === 3) { stopCamera(streamRef.current); streamRef.current = null; setCountdown(null); }
      }).catch((error) => { void abortCapture(error instanceof Error ? error.message : "The camera stopped during capture. Please create a new room."); });
    };
    const interval = setInterval(tick, 60);
    tick();
    return () => { cancelled = true; clearInterval(interval); };
  }, [captureId, captureSchedule, roomStatus, abortCapture, uploadPhoto]);

  useEffect(() => {
    if (roomStatus === "failed" || roomStatus === "complete" || fatal) stopCamera(streamRef.current);
  }, [roomStatus, fatal]);

  async function mutate(endpoint: string, body?: object, method = "POST") {
    if (!membership || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try { await roomRequest<Snapshot>(`${path}${endpoint}`, membership, { method, body: body ? JSON.stringify(body) : undefined }); }
    catch (error) { if (aliveRef.current) setError(error instanceof Error ? error.message : "That didn’t work. Please try again."); }
    finally { busyRef.current = false; if (aliveRef.current) setBusy(false); }
  }

  async function copyInvite() {
    try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); }
    catch { setError("Select the invite link below and copy it to share your room."); }
  }

  const me = room?.participants.find((participant) => participant.id === membership?.id);
  const isHost = membership?.role === "host";
  const inLobby = room?.status === "lobby";
  const allReady = room?.participants.length === 2 && room.participants.every((participant) => participant.ready && participant.presence === "online");
  const localCount = Object.keys(photos).length;
  const errors = Object.entries(photos).filter(([, photo]) => photo.state === "error");
  const complete = room?.status === "complete";
  const failed = room?.status === "failed" || captureFailed;

  return <main className={styles.page}><BoothHeader />
    {!loaded ? <section className={styles.setupCard}><p role="status">Opening your private room…</p></section> : !membership ? <section className={styles.setupCard}>
      <div className={styles.intro}><p className={styles.eyebrow}><i /> You’re invited</p><h1>Someone saved<br />a place for you.</h1><p>Two cameras, four shared poses, one keepsake. Join your person’s private photo box.</p></div>
      <form onSubmit={join}><label className={styles.inputLabel} htmlFor="guest-name">What should we call you?</label><input className={styles.textInput} id="guest-name" maxLength={40} autoComplete="given-name" placeholder="Your name (optional)" value={name} onChange={(event) => setName(event.target.value)} disabled={busy} /><p className={styles.notice}>Your preview stays on your device. Your four photos will be uploaded to make a strip both of you can download. Keep this page open until your strip is ready.</p><button className={styles.primaryButton} disabled={busy}>{busy ? "Joining…" : "Join this moment →"}</button></form>
      {error && <p className={styles.error} role="alert">{error}</p>}<p className={styles.setupFooter}><Link href="/together">Create your own room</Link></p>
    </section> : fatal ? <section className={styles.setupCard}><h1>This room has closed.</h1><p className={styles.error} role="alert">{error}</p><Link href="/together" className={styles.primaryButton}>Create a new room →</Link></section> : <section className={styles.layout} aria-labelledby="shared-title">
      <div className={styles.intro}><p className={styles.eyebrow}><i /> Your shared photo box</p><h1 id="shared-title">{complete ? <>A little closer.<br />A moment to keep.</> : <>Two places.<br />One little moment.</>}</h1><p>{complete ? "Your four poses, side by side. A keepsake for both of you." : "Open your cameras, choose a frame, and get ready together. Keep both pages visible while the countdown runs."}</p><span className={styles.connectionBadge} role="status">{connected ? "● Room connected" : "○ Reconnecting to your room…"}</span></div>
      <div className={styles.cameraArea}>
        {complete && room?.result ? <div className={styles.result}><h2>Your moment, beautifully framed.</h2><Image className={styles.resultImage} src={room.result.downloadUrl} alt="Your shared photo strip with four side-by-side portraits" width={1200} height={1950} unoptimized /><div className={styles.resultActions}><a href={room.result.downloadUrl} className={styles.primaryButton} download="e-moment-together.png" target="_blank" rel="noopener noreferrer">Download your strip ↓</a><Link href="/together" className={styles.secondaryButton}>Make another moment</Link></div><p className={styles.notice}>Save your strip now. The private download and this guest room expire.</p></div> : failed ? <div className={styles.setupCard}><h2>Let’s try a fresh moment.</h2><p className={styles.error} role="alert">{error || "This sequence couldn’t finish. Create a new room and invite your person to try again."}</p><Link href="/together" className={styles.primaryButton}>Create a fresh room →</Link></div> : <>
          <div className={styles.cameraFrame}>
            <video ref={videoRef} className={camera === "ready" && localCount < 4 ? styles.video : styles.hiddenVideo} autoPlay muted playsInline />
            {localCount === 4 ? <div className={styles.permission}><span aria-hidden="true">✦</span><strong>Four little moments, captured.</strong><p>{errors.length ? "Some photos need another upload. They’re still here on this page." : "Putting your photos together. Stay here while your person’s photos arrive."}</p>{!errors.length && <span className={styles.spinner} aria-hidden="true" />}</div> : camera !== "ready" ? <div className={styles.permission}><span aria-hidden="true">◉</span><strong>{camera === "requesting" ? "Opening your camera…" : "A place for your smile"}</strong><p>{cameraError || "Only you can see your camera preview. Your person sees your ready status."}</p><button className={styles.primaryButton} onClick={enableCamera} disabled={camera === "requesting" || !inLobby || !connected}>{camera === "error" ? "Try camera again" : "Enable camera"}</button></div> : countdown ? <div className={styles.countdown} aria-live="polite"><strong>{countdown.seconds || "✦"}</strong><span>Pose {countdown.slot + 1} of 4</span></div> : <span className={styles.readyBadge}>● Your camera is ready</span>}
          </div>
          {inLobby && <div className={styles.actionRow}><button className={styles.primaryButton} onClick={() => void mutate("", { ready: !me?.ready }, "PATCH")} disabled={camera !== "ready" || !connected || busy}>{me?.ready ? "I need a moment" : "I’m ready ✓"}</button>{isHost && <button className={styles.secondaryButton} onClick={() => void mutate("/start")} disabled={!allReady || !connected || busy}>Start our four photos →</button>}</div>}
          <p className={styles.status} role="status">{inLobby ? me?.ready ? isHost ? "You’re ready. Start when both cameras are ready." : "You’re ready. Your host will start the shared countdown." : "Enable your camera and confirm when you’re ready." : localCount === 4 ? `${Object.values(photos).filter((photo) => photo.state === "uploaded").length} of 4 photos uploaded from your camera.` : "The same countdown is running on both screens. Strike a pose!"}</p>
          {errors.length > 0 && <div className={styles.error} role="alert"><p>Your photos are safe on this page. Check your connection and try the upload again.</p><button className={styles.secondaryButton} onClick={() => errors.forEach(([slot, photo]) => void uploadPhoto(Number(slot), photo))}>Retry {errors.length} photo {errors.length === 1 ? "upload" : "uploads"} ↻</button></div>}
          {error && <p className={styles.error} role="alert">{error}</p>}
        </>}
      </div>
      <aside className={styles.panel}>
        <div><p className={styles.panelLabel}>In this moment</p>{room?.participants.map((participant) => <div className={styles.participant} key={participant.id}><span className={styles.participantAvatar} aria-hidden="true">{participant.displayName.slice(0, 1).toUpperCase()}</span><div className={styles.participantInfo}><strong>{participant.displayName}{participant.id === membership.id ? " (you)" : ""}</strong><small>{participant.role === "host" ? "Your host" : "Your person"}</small></div><span className={styles.participantState}>{participant.presence !== "online" ? "Away" : complete ? "Done ✓" : inLobby ? participant.ready ? "Ready ✓" : "Getting ready" : `${participant.uploadedSlots.length}/4 sent`}</span></div>)}{room?.participants.length === 1 && <div className={styles.participant}><span className={styles.participantAvatar} aria-hidden="true">♡</span><div className={styles.participantInfo}><strong>A place for your person</strong><small>Waiting for them to join</small></div></div>}</div>
        {isHost && inLobby && <div><label className={styles.panelLabel} htmlFor="invite-link">Your private invite</label><div className={styles.inviteRow}><input id="invite-link" className={styles.inviteInput} readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} /><button className={styles.secondaryButton} onClick={copyInvite}>{copied ? "Copied ✓" : "Copy link"}</button></div><p className={styles.notice}>Send this link to your person. This room has just two places.</p></div>}
        <div><p className={styles.panelLabel}>{isHost ? "Choose your frame" : "Your host’s frame choice"}</p><div className={styles.frameChoices}>{frames.map((frame) => <button key={frame.id} className={room?.frameId === frame.id ? styles.frameSelected : ""} disabled={!isHost || !inLobby || !connected || busy} aria-pressed={room?.frameId === frame.id} onClick={() => void mutate("", { frameId: frame.id }, "PATCH")}><i className={styles[`swatch${frame.id}`]} /><span><strong>{frame.name}</strong><small>{frame.note}</small></span></button>)}</div></div>
        <div><p className={styles.panelLabel}>Your four poses</p><div className={styles.shots}>{Array.from({ length: 4 }, (_, index) => <span key={index} className={photos[index] ? styles.shotFilled : ""}>{photos[index] ? <Image src={photos[index].url} alt={`Your captured pose ${index + 1}`} width={120} height={90} unoptimized /> : index + 1}</span>)}</div><p className={styles.notice}>A shared strip pairs your photos side by side. No live video or audio is sent.</p></div>
      </aside>
    </section>}
  </main>;
}
