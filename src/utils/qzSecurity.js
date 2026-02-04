import qz from "qz-tray";

const CERT_URL = import.meta.env.VITE_QZ_CERT_URL || "/qz/cert.pem";
const SIGN_URL = import.meta.env.VITE_QZ_SIGN_URL || "/qz/sign";
const USE_DEMO_SIGNING = import.meta.env.VITE_QZ_USE_DEMO_SIGNING === "true";
// When true, skip fetching certificate/signature entirely and resolve null.
// This mirrors the insecure fallback used by PrintSticker and is intended
// for simple local or kiosk setups only. DO NOT enable in untrusted production.
const ALLOW_UNSIGNED = import.meta.env.VITE_QZ_ALLOW_UNSIGNED === "true";

const DEMO_CERT_URL = "https://demo.qz.io/certs/demo.cert";
const DEMO_SIGN_URL = "https://demo.qz.io/sign?request=";

async function fetchText(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`QZ signing failed (${response.status})`);
  }
  return response.text();
}

export async function setupQZSecurity() {
  /**
   * REQUIRED in production for trusted silent printing:
   * - Provide your certificate (public) and sign requests with your private key.
   *
   * Options:
   * 1) Host certificate + sign on server
   * 2) Use qz-tray demo signing ONLY for development
   */
  qz.security.setCertificatePromise((resolve, reject) => {
    // If explicitly allowed, skip cert fetching and use null (insecure)
    if (ALLOW_UNSIGNED) {
      console.warn('QZ security: VITE_QZ_ALLOW_UNSIGNED=true — skipping certificate fetch (insecure).');
      resolve(null);
      return;
    }

    const certUrl = USE_DEMO_SIGNING ? DEMO_CERT_URL : CERT_URL;
    // If running on localhost during development, allow insecure local fallback
    const hostname = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
    if (!USE_DEMO_SIGNING && /^(localhost|127\.0\.0\.1|::1)$/.test(hostname)) {
      console.warn('QZ security: localhost detected — using insecure local certificate fallback (null).');
      resolve(null);
      return;
    }
    fetchText(certUrl).then(resolve).catch((err) => {
      // If cert fetch fails but we're on localhost, fall back to null to match PrintSticker behavior
      if (/^(localhost|127\.0\.0\.1|::1)$/.test(hostname)) {
        console.warn('QZ cert fetch failed, falling back to null certificate for localhost:', err?.message || err);
        resolve(null);
        return;
      }
      reject(err);
    });
  });

  qz.security.setSignaturePromise((toSign) => async (resolve, reject) => {
    // If unsigned is explicitly allowed, resolve null (insecure fallback)
    if (ALLOW_UNSIGNED) {
      console.warn('QZ security: VITE_QZ_ALLOW_UNSIGNED=true — skipping signature (insecure).');
      resolve(null);
      return;
    }
    // If running on localhost during development, resolve null (insecure fallback)
    const hostname = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
    if (!USE_DEMO_SIGNING && /^(localhost|127\.0\.0\.1|::1)$/.test(hostname)) {
      console.warn('QZ security: localhost detected — using insecure local signature fallback (null).');
      resolve(null);
      return;
    }

    if (USE_DEMO_SIGNING) {
      try {
        const demoResp = await fetchText(`${DEMO_SIGN_URL}${encodeURIComponent(toSign)}`);
        resolve(demoResp);
      } catch (err) {
        reject(err);
      }
      return;
    }

    // Try the configured signing endpoint first. If it fails (404 or network),
    // fall back to the QZ demo signing service to allow local development/testing.
    try {
      const resp = await fetchText(SIGN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toSign }),
      });
      resolve(resp);
      return;
    } catch (err) {
      console.warn("QZ signing via", SIGN_URL, "failed:", err?.message || err);
    }

    // Fallback to demo signing as a last resort (development only).
    try {
      const demoResp = await fetchText(`${DEMO_SIGN_URL}${encodeURIComponent(toSign)}`);
      console.warn("Falling back to QZ demo signing (insecure - development only)");
      resolve(demoResp);
    } catch (demoErr) {
      reject(demoErr);
    }
  });
}
