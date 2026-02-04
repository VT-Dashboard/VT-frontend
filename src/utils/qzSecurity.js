import qz from "qz-tray";

// Simplified QZ security: do not fetch certificates or signatures from any backend.
// This mirrors the behavior used by `PrintSticker` and is suitable when you
// intentionally do not use server-side signing. THIS IS INSECURE: only enable
// for trusted local/kiosk setups where silent printing without signatures is acceptable.
export async function setupQZSecurity() {
  qz.security.setCertificatePromise((resolve) => {
    console.warn('QZ security: certificates disabled — using unsigned mode (insecure).');
    resolve(null);
  });

  qz.security.setSignaturePromise((toSign) => (resolve) => {
    console.warn('QZ security: signatures disabled — using unsigned mode (insecure).');
    resolve(null);
  });
}
