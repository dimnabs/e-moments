"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { roomRequest, saveMembership, type Admission } from "./room-client";
import styles from "./shared-photo-booth.module.css";

export function BoothHeader() {
  return <header className={styles.header}><Link href="/" className={styles.brand}><span className={styles.mark} aria-hidden="true"><i /><i /><i /><i /></span>E-moment</Link><span>Two places. One moment.</span></header>;
}

export function TogetherSetup() {
  const router = useRouter();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function createRoom(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      // Confirm session storage works before reserving a room membership.
      sessionStorage.setItem("e-moment-storage-check", "ok");
      sessionStorage.removeItem("e-moment-storage-check");
      const result = await roomRequest<Admission>("/api/rooms", null, { method: "POST", body: JSON.stringify({ frameId: "cherry", displayName: name.trim() || "Host" }) });
      saveMembership(result.room.token, result.participant);
      router.push(`/room/${result.room.token}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "We couldn’t create your room. Please try again.");
      busyRef.current = false; setBusy(false);
    }
  }

  return <main className={styles.page}><BoothHeader /><section className={styles.setupCard}>
    <div className={styles.intro}><p className={styles.eyebrow}><i /> Your shared moment</p><h1>Different places.<br />Same little moment.</h1><p>Invite someone you miss. You’ll take four photos at the same time, then keep one strip together.</p></div>
    <form onSubmit={createRoom}>
      <label className={styles.inputLabel} htmlFor="host-name">What should we call you?</label>
      <input className={styles.textInput} id="host-name" autoComplete="given-name" maxLength={40} placeholder="Your name (optional)" value={name} onChange={(event) => setName(event.target.value)} disabled={busy} />
      <p className={styles.notice}>Your room is private: only share its invite with your person. Both cameras stay local; your four photos are uploaded after capture to make the shared strip.</p>
      <button className={styles.primaryButton} disabled={busy}>{busy ? "Opening your room…" : "Create a private room ↗"}</button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
    <p className={styles.setupFooter}>A moment just for you? <Link className={styles.modeLink} href="/create">Open the solo photo box →</Link></p>
  </section></main>;
}
