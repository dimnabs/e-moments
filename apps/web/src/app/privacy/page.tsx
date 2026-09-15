import { MemoryPage } from "@/components/memory-pages/memory-page";
import styles from "@/components/memory-pages/memory-pages.module.css";

export default function PrivacyPage() {
  return <MemoryPage><article className={styles.legal}>
    <p className="eyebrow">Your photos, your choice</p><h1>Privacy policy</h1><p>Last updated: September 15, 2026. This policy describes the current E-moment prototype.</p>
    <h2>What we keep</h2><p>If you create an account, we store your email, optional name, and a protected password hash. A necessary sign-in cookie keeps you signed in. When you complete a session, we store the captured photos, composed strip, and the session details needed to provide your gallery and downloads.</p>
    <h2>Your camera and consent</h2><p>Your browser asks permission before opening the camera. The preview stays on your device; captured photos are uploaded to create the strip. Start a session only with the consent of everyone pictured. Together sessions share the final strip with the other participant. Treat private room invite links as confidential.</p>
    <h2>Private by default</h2><p>There is no public gallery. Account galleries require sign-in, and media downloads use temporary links. Anyone you send a downloaded photo or an active media link to may keep a copy.</p>
    <h2>How long photos stay</h2><p>Guest media expires 24 hours after the completed session. Expired media is removed by the retention cleanup process; physical deletion may follow expiry when that process next runs. Download your strip before it expires. Sessions saved to an account remain until you delete them.</p>
    <h2>Deleting a moment</h2><p>Use Delete in <a href="/gallery">your gallery</a> to permanently remove a saved session, its original photos, and its composed output from E-moment storage. Guest sessions provide a deletion control with the completed result. Deletion cannot remove copies someone already downloaded or saved elsewhere.</p>
    <h2>Before wider availability</h2><p>E-moment is a development prototype. Production hosting, backup policies, privacy contact details, and a security review must be finalized before external testing. These details will be reflected in this policy before that rollout.</p>
  </article></MemoryPage>;
}
