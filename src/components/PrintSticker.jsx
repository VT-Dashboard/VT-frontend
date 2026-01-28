import React, { useEffect, useMemo, useRef, useState } from "react";
import Barcode from "react-barcode";
import qz from "qz-tray";
import html2canvas from "html2canvas";



/**
 * PrintSticker (QZ Tray silent print)
 * - Custom label size (mm), margins, orientation, scale
 * - Rasterizes the preview area to PNG and prints via QZ
 * - No browser print dialog
 */

const STORAGE_KEY = "printStickerSettings_v2";

const mmToIn = (mm) => mm / 25.4;

const paperPresets = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  Letter: { w: 215.9, h: 279.4 },
};

async function setupQZSecurity() {
  /**
   * ✅ REQUIRED in production for trusted silent printing:
   * - Provide your certificate (public) and sign requests with your private key.
   *
   * Options:
   * 1) Host certificate + sign on server
   * 2) Use qz-tray demo signing ONLY for development
   *
   * Below is a safe placeholder pattern:
   */
  qz.security.setCertificatePromise((resolve, reject) => {
    // TODO: replace with your hosted certificate fetch
    // Example:
    // fetch("/qz/cert.pem").then(r => r.text()).then(resolve).catch(reject);

    // Dev-only fallback (not recommended for production):
    resolve(null); // allows QZ to use "Allow unsigned" only if QZ is configured that way
  });

  qz.security.setSignaturePromise((toSign) => (resolve, reject) => {
    // TODO: replace with server-side signing
    // Example:
    // fetch("/qz/sign", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ toSign }) })
    //   .then(r => r.text())
    //   .then(resolve)
    //   .catch(reject);

    // Dev-only fallback:
    resolve(null);
  });
}



const PrintSticker = ({ item, show, onClose }) => {
  const printAreaRef = useRef(null);

  const [qzConnected, setQzConnected] = useState(false);
  const [qzError, setQzError] = useState("");
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState("");

  const [name, setName] = useState("");
  const [showName, setShowName] = useState(true);
  const [nameFontSize, setNameFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState("Arial, sans-serif");

  const [barcodeHeight, setBarcodeHeight] = useState(80);
  const [displayValue, setDisplayValue] = useState(true);
  const [barWidth, setBarWidth] = useState(2); // thickness of bars
  const [fitBarcode, setFitBarcode] = useState(true); // force barcode to fit container width
  const [showPrice, setShowPrice] = useState(true);
  const [priceFontSize, setPriceFontSize] = useState(14);

  const [copies, setCopies] = useState(1);
  const [orientation, setOrientation] = useState("portrait");

  const [paperSize, setPaperSize] = useState("Custom");
  const [paperWidthMm, setPaperWidthMm] = useState(60);  // label-like default
  const [paperHeightMm, setPaperHeightMm] = useState(40); // label-like default

  const [margins, setMargins] = useState({ top: 2, right: 2, bottom: 2, left: 2 });
  const [scalePercent, setScalePercent] = useState(100);

  const [saveSettings, setSaveSettings] = useState(true);

  const [contentScale, setContentScale] = useState(100);


  // Load item defaults when item changes
  useEffect(() => {
    if (!item) return;
    setName(item.name || "");
    setShowName(true);
    setNameFontSize(18);
    setBarcodeHeight(80);
    setDisplayValue(true);
    setShowPrice(true);
    setPriceFontSize(14);
  }, [item]);

  // Load saved settings on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);

      if (s.fontFamily) setFontFamily(s.fontFamily);
      if (s.copies) setCopies(Number(s.copies) || 1);

      if (s.paperSize) setPaperSize(s.paperSize);
      if (s.paperWidthMm) setPaperWidthMm(Number(s.paperWidthMm) || 0);
      if (s.paperHeightMm) setPaperHeightMm(Number(s.paperHeightMm) || 0);

      if (s.orientation) setOrientation(s.orientation);
      if (s.margins) setMargins(s.margins);
      if (s.scalePercent) setScalePercent(Number(s.scalePercent) || 100);
    } catch {
      // ignore
    }
  }, []);

  // When modal opens, just check current QZ state (no auto connect)
  useEffect(() => {
    if (!show) return;
    try {
      const active = !!(qz?.websocket?.isActive?.() || false);
      setQzConnected(active);
    } catch {
      setQzConnected(false);
    }
    setQzError("");
  }, [show]);

  const effectivePaper = useMemo(() => {
    if (paperSize !== "Custom" && paperPresets[paperSize]) {
      return paperPresets[paperSize];
    }
    return { w: Number(paperWidthMm) || 0, h: Number(paperHeightMm) || 0 };
  }, [paperSize, paperWidthMm, paperHeightMm]);

  const saveToStorage = () => {
    if (!saveSettings) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const s = {
      fontFamily,
      copies,
      paperSize,
      paperWidthMm: effectivePaper.w,
      paperHeightMm: effectivePaper.h,
      orientation,
      margins,
      scalePercent,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  };

  const connectQz = async () => {
    setQzError("");
    try {
      await setupQZSecurity();
      if (!qz.websocket.isActive()) await qz.websocket.connect();
      setQzConnected(true);
      await refreshPrinters(true);
    } catch (err) {
      setQzConnected(false);
      setQzError(err?.message ? err.message : String(err));
    }
  };

  const disconnectQz = async () => {
    setQzError("");
    try {
      if (qz.websocket.isActive()) await qz.websocket.disconnect();
      setQzConnected(false);
    } catch (err) {
      setQzError(err?.message ? err.message : String(err));
    }
  };

  const refreshPrinters = async (autoPick = false) => {
    setLoadingPrinters(true);
    setQzError("");
    try {
      if (!qz.websocket.isActive()) throw new Error("QZ Tray is not connected");
      const list = await qz.printers.find();
      const arr = Array.isArray(list) ? list : [list];
      setPrinters(arr);

      if (autoPick) {
        if (!selectedPrinter && arr.length) setSelectedPrinter(arr[0]);
      }
    } catch (err) {
      setQzError(err?.message ? err.message : String(err));
    } finally {
      setLoadingPrinters(false);
    }
  };

  const buildQzConfig = (printerName) => {
    const wMm = effectivePaper.w;
    const hMm = effectivePaper.h;

    if (!printerName) throw new Error("No printer selected");
    if (!wMm || !hMm) throw new Error("Paper width/height must be greater than 0");

    // QZ expects inches for "size" commonly. We'll convert mm -> inches.
    const sizeIn = { width: mmToIn(wMm), height: mmToIn(hMm) };

    // Margins: QZ uses inches in some settings; we’ll pass inches.
    const marginsIn = {
      top: mmToIn(margins.top || 0),
      right: mmToIn(margins.right || 0),
      bottom: mmToIn(margins.bottom || 0),
      left: mmToIn(margins.left || 0),
    };

    // Most useful options for silent label printing:
    return qz.configs.create(printerName, {
      copies: Number(copies) || 1,
      orientation, // "portrait" | "landscape"
      units: "in",
      size: sizeIn,
      margins: marginsIn,
      rasterize: true,
      // density is optional; if your prints look blurry, raise it:
      // density: 300,
    });
  };

  const captureStickerAsBase64 = async () => {
    const el = printAreaRef.current;
    if (!el) throw new Error("Print area not found");

    // Apply scale on capture (only for rendering)
    const prevTransform = el.style.transform;
    const prevOrigin = el.style.transformOrigin;

    try {
      el.style.transform = `scale(${scalePercent / 100})`;
      el.style.transformOrigin = "top left";

      // Higher scale = sharper print. 2 is often good; can be 3 for small labels.
      const canvas = await html2canvas(el, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });

      const dataUrl = canvas.toDataURL("image/png");
      return dataUrl.split(",")[1];
    } finally {
      el.style.transform = prevTransform || "";
      el.style.transformOrigin = prevOrigin || "";
    }
  };

  const handlePrint = async () => {
    setQzError("");

    try {
      if (!selectedPrinter) {
        throw new Error("Select a printer (QZ Tray) to print without browser dialog.");
      }
      if (!qz.websocket.isActive()) {
        throw new Error("QZ Tray is not connected. Click 'Connect QZ' first.");
      }

      const cfg = buildQzConfig(selectedPrinter);
      const base64 = await captureStickerAsBase64();

      const payload = [
        {
          type: "image",
          format: "base64",
          data: base64,
        },
      ];

      await qz.print(cfg, payload);

      // Save settings after a successful print
      saveToStorage();
    } catch (err) {
      setQzError(err?.message ? err.message : String(err));
    }
  };

  if (!show || !item) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-60 overflow-auto py-8">
      <div className="w-full max-w-5xl mx-4 md:mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-auto max-h-[85vh]" style={{ minHeight: '56vh' }}>
          <div className="md:flex h-full">
            {/* Left: Preview */}
            <div className="md:w-1/2 bg-neutral-50 p-6 flex flex-col overflow-auto">
              <div className="sticky top-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">Print Label</h3>
                    <p className="text-sm text-slate-500 mt-1">Preview your label and adjust settings before printing.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${qzConnected ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>{qzConnected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-slate-700">Label preview</div>
                      <div className="text-xs text-slate-400">Live</div>
                    </div>

                    <div className="flex items-center justify-center">
                      <div className="bg-white rounded-md shadow-md p-4" style={{ width: '100%', maxWidth: 360 }}>
                        <div
                          ref={printAreaRef}
                          id="print-sticker-area"
                          style={{
                            background: 'white',
                            fontFamily,
                            width: paperSize === 'Custom' ? `${effectivePaper.w}mm` : undefined,
                            height: paperSize === 'Custom' ? `${effectivePaper.h}mm` : undefined,
                            padding: `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`,
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                            borderRadius: 8,
                            border: '1px solid rgba(15,23,42,0.04)'
                          }}
                        >
                          <div style={{ textAlign: 'center' }}>
                            {showName && (
                              <div style={{ fontSize: `${nameFontSize}px`, fontWeight: 700, marginBottom: 6, wordBreak: 'break-word' }}>
                                {name}
                              </div>
                            )}

                            <div style={{ display: 'inline-block', width: '100%', boxSizing: 'border-box' }}>
                              <div style={{ width: '100%', textAlign: 'center' }}>
                                <Barcode
                                  value={item.barcode || ''}
                                  format="CODE128"
                                  height={barcodeHeight}
                                  displayValue={displayValue}
                                  {...(fitBarcode ? { style: { maxWidth: '100%', height: 'auto' } } : { width: Number(barWidth) })}
                                />
                              </div>
                            </div>

                            {item.price != null && showPrice && (
                              <div style={{ marginTop: 6, fontSize: `${priceFontSize}px`, fontWeight: 700 }}>
                                Rs {Number(item.price).toFixed(2)}
                              </div>
                            )}

                            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600 }}>
                              {item.sku || ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-500">Tip: Adjust size, margins and scale to perfectly fit label stock.</div>
                </div>
              </div>
            </div>

            {/* Right: Controls */}
            <div className="md:w-1/2 p-6 flex flex-col">
              <div className="flex-1 overflow-auto">
                <div className="flex flex-col gap-4">
                {/* Printer connection */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M6 9V3h12v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <rect x="3" y="9" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    <div>
                      <div className="text-sm font-medium text-slate-800">Printer</div>
                      <div className="text-xs text-slate-500">Connect QZ Tray to print silently</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!qzConnected ? (
                      <button onClick={connectQz} className="inline-flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700 transition">Connect</button>
                    ) : (
                      <button onClick={disconnectQz} className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-2 rounded-lg text-sm hover:bg-slate-200 transition">Disconnect</button>
                    )}
                    <button onClick={() => refreshPrinters(false)} disabled={loadingPrinters || !qzConnected} className="inline-flex items-center gap-2 bg-white border border-slate-100 text-slate-700 px-3 py-2 rounded-lg text-sm disabled:opacity-50">{loadingPrinters ? 'Refreshing...' : 'Refresh'}</button>
                  </div>
                </div>

                {qzError && <div className="text-sm text-red-600">QZ: {qzError}</div>}

                {/* Content Section */}
                <div className="bg-white border border-slate-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold">Content</div>
                    <div className="text-xs text-slate-400">Show / hide fields</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div className="flex items-center justify-between">
                      <div className="text-sm">Name</div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
                        <span className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${showName ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                          <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${showName ? 'translate-x-5' : ''}`} />
                        </span>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm">Name size</div>
                      <input type="number" min={8} value={nameFontSize} onChange={(e) => setNameFontSize(Number(e.target.value || 1))} className="border rounded px-2 py-1 w-20 text-sm" />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm">Barcode text</div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only" checked={displayValue} onChange={(e) => setDisplayValue(e.target.checked)} />
                        <span className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${displayValue ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                          <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${displayValue ? 'translate-x-5' : ''}`} />
                        </span>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm">Barcode height</div>
                      <input type="number" min={10} value={barcodeHeight} onChange={(e) => setBarcodeHeight(Number(e.target.value || 10))} className="border rounded px-2 py-1 w-20 text-sm" />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm">Fit barcode</div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only" checked={fitBarcode} onChange={(e) => setFitBarcode(e.target.checked)} />
                        <span className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${fitBarcode ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                          <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${fitBarcode ? 'translate-x-5' : ''}`} />
                        </span>
                      </label>
                    </div>

                    {!fitBarcode && (
                      <>
                        <div className="text-sm">Bar thickness</div>
                        <input type="number" min={0.2} step={0.1} value={barWidth} onChange={(e) => setBarWidth(Number(e.target.value || 1))} className="border rounded px-2 py-1 w-20 text-sm" />
                      </>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="text-sm">Show price (Rs)</div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />
                        <span className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${showPrice ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                          <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${showPrice ? 'translate-x-5' : ''}`} />
                        </span>
                      </label>
                    </div>

                    {showPrice && (
                      <>
                        <div className="text-sm">Price size</div>
                        <input type="number" min={8} value={priceFontSize} onChange={(e) => setPriceFontSize(Number(e.target.value || 12))} className="border rounded px-2 py-1 w-20 text-sm" />
                      </>
                    )}
                  </div>
                </div>

                {/* Label Size Section */}
                <div className="bg-white border border-slate-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold">Label Size</div>
                    <div className="text-xs text-slate-400">mm</div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <select value={paperSize} onChange={(e) => { const v = e.target.value; setPaperSize(v); if (v !== 'Custom' && paperPresets[v]) { setPaperWidthMm(paperPresets[v].w); setPaperHeightMm(paperPresets[v].h); } }} className="rounded-full border px-3 py-1 text-sm">
                      <option value="Custom">Custom</option>
                      <option value="A4">A4</option>
                      <option value="A5">A5</option>
                      <option value="Letter">Letter</option>
                    </select>

                    <div className="flex items-center gap-2">
                      <div className="text-sm">W</div>
                      <input type="number" min={1} value={paperWidthMm} onChange={(e) => setPaperWidthMm(Number(e.target.value || 0))} className="border rounded px-2 py-1 w-20 text-sm" />
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-sm">H</div>
                      <input type="number" min={1} value={paperHeightMm} onChange={(e) => setPaperHeightMm(Number(e.target.value || 0))} className="border rounded px-2 py-1 w-20 text-sm" />
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-sm">Margins</div>
                      <input type="number" min={0} value={margins.top} onChange={(e) => setMargins({ ...margins, top: Number(e.target.value || 0) })} className="border rounded px-2 py-1 w-16 text-sm" title="Top" />
                      <input type="number" min={0} value={margins.right} onChange={(e) => setMargins({ ...margins, right: Number(e.target.value || 0) })} className="border rounded px-2 py-1 w-16 text-sm" title="Right" />
                      <input type="number" min={0} value={margins.bottom} onChange={(e) => setMargins({ ...margins, bottom: Number(e.target.value || 0) })} className="border rounded px-2 py-1 w-16 text-sm" title="Bottom" />
                      <input type="number" min={0} value={margins.left} onChange={(e) => setMargins({ ...margins, left: Number(e.target.value || 0) })} className="border rounded px-2 py-1 w-16 text-sm" title="Left" />
                    </div>
                  </div>
                </div>

                {/* Print Quality & Printer Options */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="bg-white border border-slate-100 rounded-lg p-4">
                    <div className="text-sm font-semibold mb-2">Print Quality</div>
                    <div className="text-xs text-slate-400 mb-2">Scale and rendering</div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm">Content scale</div>
                        <div className="text-sm w-12">{contentScale}%</div>
                      </div>
                      <input type="range" min={50} max={200} value={contentScale} onChange={(e) => setContentScale(Number(e.target.value))} className="w-full" />

                      <div className="flex items-center justify-between">
                        <div className="text-sm">Print scale</div>
                        <div className="text-sm w-12">{scalePercent}%</div>
                      </div>
                      <input type="range" min={50} max={200} value={scalePercent} onChange={(e) => setScalePercent(Number(e.target.value))} className="w-full" />
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-lg p-4">
                    <div className="text-sm font-semibold mb-2">Printer Options</div>
                    <div className="text-xs text-slate-400 mb-2">Copies & orientation</div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="text-sm">Copies</div>
                        <input type="number" min={1} value={copies} onChange={(e) => setCopies(Number(e.target.value || 1))} className="border rounded px-2 py-1 w-20 text-sm" />
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-sm">Orientation</div>
                        <select value={orientation} onChange={(e) => setOrientation(e.target.value)} className="border rounded px-2 py-1 text-sm">
                          <option value="portrait">Portrait</option>
                          <option value="landscape">Landscape</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-3">
                      <select value={selectedPrinter} onChange={(e) => setSelectedPrinter(e.target.value)} disabled={!qzConnected} className="w-full rounded-full border px-3 py-2 text-sm">
                        <option value="">Select printer…</option>
                        {printers.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                </div>
              </div>

              <div className="sticky bottom-0 bg-white z-10 border-t border-slate-100 p-4 flex items-center justify-between">
                <div className="text-xs text-slate-400">When ready, print directly to your connected printer.</div>
                <div className="flex items-center gap-2">
                  <button onClick={onClose} className="bg-white border border-slate-100 text-slate-700 px-4 py-2 rounded-lg">Close</button>
                  <button onClick={handlePrint} disabled={!qzConnected || !selectedPrinter} className="bg-indigo-600 text-white px-4 py-2 rounded-lg disabled:opacity-50">Print Label</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintSticker;
