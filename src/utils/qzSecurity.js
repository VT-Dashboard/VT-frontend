import qz from "qz-tray";

const CERT_URL = import.meta.env.VITE_QZ_CERT_URL || "/qz/cert.pem";
const SIGN_URL = import.meta.env.VITE_QZ_SIGN_URL || "/qz/sign";
const USE_DEMO_SIGNING = import.meta.env.VITE_QZ_USE_DEMO_SIGNING === "true";

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
    const certUrl = USE_DEMO_SIGNING ? DEMO_CERT_URL : CERT_URL;
    fetchText(certUrl).then(resolve).catch(reject);
  });

  qz.security.setSignaturePromise((toSign) => (resolve, reject) => {
    if (USE_DEMO_SIGNING) {
      fetchText(`${DEMO_SIGN_URL}${encodeURIComponent(toSign)}`)
        .then(resolve)
        .catch(reject);
      return;
    }
    fetchText(SIGN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toSign }),
    })
      .then(resolve)
      .catch(reject);
  });
}
