"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MemoryPage } from "@/components/memory-pages/memory-page";
import styles from "@/components/memory-pages/memory-pages.module.css";

type SavedSession = { id: string; frameId: string; completedAt: string; previewUrl?: string };

export default function GalleryPage() {
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      try {
        const response = await fetch("/api/gallery", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) { setSignedOut(true); return; }
        if (!response.ok) throw new Error("Your gallery couldn’t load. Please try again.");
        const data = await response.json();
        setSessions(data.sessions);
        const previews = await Promise.all((data.sessions as SavedSession[]).map(async (session) => {
          const preview = await fetch(`/api/gallery/${session.id}/download`, { cache: "no-store", signal: controller.signal });
          return { ...session, previewUrl: preview.ok ? (await preview.json()).downloadUrl : undefined };
        }));
        if (!controller.signal.aborted) setSessions(previews);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Your gallery couldn’t load."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [reload]);

  async function remove(id: string) {
    setBusy(id); setError("");
    try {
      const response = await fetch(`/api/gallery/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("We couldn’t delete this moment. Please try again.");
      setSessions((current) => current.filter((session) => session.id !== id)); setConfirmId(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Deletion failed."); }
    finally { setBusy(null); }
  }
  async function download(id: string) {
    setBusy(id); setError("");
    try {
      const response = await fetch(`/api/gallery/${id}/download`, { cache: "no-store" });
      if (!response.ok) throw new Error("We couldn’t prepare your download. Please try again.");
      const data = await response.json();
      const anchor = document.createElement("a"); anchor.href = data.downloadUrl; anchor.download = "e-moment-photo-strip.png"; anchor.rel = "noreferrer"; anchor.click();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Download failed."); }
    finally { setBusy(null); }
  }
  async function signout() {
    setBusy("signout"); setError("");
    try { const response = await fetch("/api/auth/signout", { method: "POST" }); if (!response.ok) throw new Error(); setSessions([]); setSignedOut(true); }
    catch { setError("We couldn’t sign you out. Please try again."); }
    finally { setBusy(null); }
  }
  return <MemoryPage>
    <section className={styles.intro}><p className="eyebrow">Your private gallery</p><h1>A few good moments.</h1><p>For the memories you want to come back to. Your saved sessions stay here until you choose to delete them.</p></section>
    {error && <div role="alert" className={styles.error}>{error} <button className={styles.secondary} onClick={() => setReload((value) => value + 1)}>Reload gallery</button></div>}
    {loading ? <p role="status">Opening your memories…</p> : signedOut ? <section className={styles.empty}><h2>A little place of your own.</h2><p className={styles.note}>Sign in to see your saved moments, or create an account before your next session.</p><div className={styles.actions} style={{ justifyContent: "center" }}><Link className={styles.primary} href="/account">Sign in or create an account</Link></div></section> : <>
      <div className={styles.toolbar}><p className={styles.note}>{sessions.length} saved {sessions.length === 1 ? "moment" : "moments"}</p><div className={styles.actions}><Link href="/create" className={styles.primary}>Create a moment ↗</Link><button className={styles.secondary} disabled={busy !== null} onClick={signout}>Sign out</button></div></div>
      {sessions.length === 0 ? <section className={styles.empty}><h2>Your first keeper is waiting.</h2><p className={styles.note}>Complete a session while signed in and your photo strip will appear here.</p></section> : <div className={styles.grid}>{sessions.map((session) => <article key={session.id} className={styles.card}>
        <div className={styles.preview}>{session.previewUrl ? <Image src={session.previewUrl} alt={`Your ${session.frameId} photo strip`} width={500} height={750} unoptimized /> : <p className={styles.note}>Your moment is saved.</p>}</div>
        <div className={styles.details}><h2>{session.frameId} moment</h2><p className={styles.note}><time dateTime={session.completedAt}>{new Date(session.completedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</time></p>
          {confirmId === session.id ? <div><p className={styles.note}>Permanently delete this session, all original photos, and its strip? This cannot be undone. Downloaded copies are not affected.</p><div className={styles.actions}><button className={styles.danger} disabled={busy !== null} onClick={() => remove(session.id)}>{busy === session.id ? "Deleting…" : "Delete permanently"}</button><button className={styles.secondary} disabled={busy !== null} onClick={() => setConfirmId(null)}>Keep it</button></div></div> : <div className={styles.actions}><button className={styles.secondary} disabled={busy !== null} onClick={() => download(session.id)}>Download</button><button className={styles.danger} disabled={busy !== null} onClick={() => setConfirmId(session.id)}>Delete</button></div>}
        </div>
      </article>)}</div>}
    </>}
  </MemoryPage>;
}
