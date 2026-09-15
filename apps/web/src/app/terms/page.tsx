import { MemoryPage } from "@/components/memory-pages/memory-page";
import styles from "@/components/memory-pages/memory-pages.module.css";

export default function TermsPage() {
  return <MemoryPage><article className={styles.legal}>
    <p className="eyebrow">A little shared understanding</p><h1>Terms of use</h1><p>Last updated: September 15, 2026. These terms apply to the current E-moment prototype.</p>
    <h2>Make moments with permission</h2><p>Use E-moment only for photos you have permission to capture and upload. Everyone pictured should understand and agree to taking part. Do not use the service for illegal content, harassment, impersonation, or sharing another person’s private images without consent.</p>
    <h2>Your photos remain yours</h2><p>You retain your rights to the photos you create. You allow E-moment to process and store them only to compose your strips, provide private galleries and downloads, and operate the service. You are responsible for the copies and links you choose to share.</p>
    <h2>Your account and private links</h2><p>Keep your password and room invite links private. A room invite allows another person to participate and see the shared result. Sign out when using a shared device.</p>
    <h2>Retention and deletion</h2><p>Guest media expires after 24 hours. Signed-in sessions remain until deleted. Deleting a session permanently removes its photos and output from E-moment storage; it cannot recall downloaded copies. Read our <a href="/privacy">Privacy Policy</a> for details.</p>
    <h2>A prototype in progress</h2><p>The service may change or be unavailable while development continues. Download a copy of any moment you want to keep. Production policies and operator contact details will be added before external testing.</p>
  </article></MemoryPage>;
}
