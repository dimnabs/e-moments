import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./memory-pages.module.css";

export function MemoryPage({ children }: { children: ReactNode }) {
  return <div className={styles.page}>
    <header className={styles.header}><Link className="brand" href="/">E-moment</Link><nav aria-label="Primary navigation"><Link href="/gallery">My gallery</Link><Link href="/create">Create a moment ↗</Link></nav></header>
    <main className={styles.main}>{children}</main>
    <footer className={styles.footer}><span>Your moments, beautifully framed.</span><nav aria-label="Legal"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></footer>
  </div>;
}
