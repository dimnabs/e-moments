"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MemoryPage } from "@/components/memory-pages/memory-page";
import styles from "@/components/memory-pages/memory-pages.module.css";

export default function AccountPage() {
  const router = useRouter();
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/auth/${signup ? "signup" : "signin"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password"), name: data.get("name") }) });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "Please try again."); }
      router.push("/gallery");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t connect. Please try again."); setBusy(false); }
  }
  return <MemoryPage><div className={styles.layout}>
    <section className={styles.intro}><p className="eyebrow">A home for your moments</p><h1>Little memories.<br />Always yours.</h1><p>Sign in before a session to keep your completed photo strips in a private gallery. Revisit, download, or delete them whenever you choose.</p><p className={styles.note}>Just passing through? You can still <a href="/create">make a moment as a guest</a>. Guest media expires after 24 hours.</p></section>
    <section className={styles.panel} aria-label={signup ? "Create an account" : "Sign in"}>
      <h2 style={{ fontSize: "2.1rem" }}>{signup ? "Make yourself at home." : "Welcome back."}</h2>
      <form className={styles.form} onSubmit={submit}>
        {signup && <label>Your name (optional)<input name="name" autoComplete="name" maxLength={80} /></label>}
        <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label>Password<input name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 12 : undefined} maxLength={200} /></label>
        {signup && <><p className={styles.note}>Use at least 12 characters for your password.</p><label className={styles.consent}><input type="checkbox" required /> <span>I agree to the <a href="/terms">Terms</a> and have read the <a href="/privacy">Privacy Policy</a>.</span></label></>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button className={styles.primary} disabled={busy}>{busy ? "One moment…" : signup ? "Create account" : "Sign in"}</button>
      </form>
      <button className={styles.switch} disabled={busy} onClick={() => { setSignup(!signup); setError(""); }}>{signup ? "Already have an account? Sign in" : "New here? Create an account"}</button>
    </section>
  </div></MemoryPage>;
}
