import React, { useState, useEffect, useRef } from 'react';
import qz from 'qz-tray';
import html2canvas from 'html2canvas';
import Receipt from '../components/Receipt';
import { setupQZSecurity } from '../utils/qzSecurity';

const RECEIPT_PRINTER_KEY = 'receiptPrinterName';
const RECEIPT_CANVAS_SCALE = 2;
const RECEIPT_MAX_PAGE_HEIGHT_MM = 200;

const POSPage = () => {
  // products list will be loaded from API on mount
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [keypadValue, setKeypadValue] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const barcodeRef = useRef(null);
  const receiptRef = useRef(null);
  const [qzConnected, setQzConnected] = useState(false);
  const [qzError, setQzError] = useState('');
  const [printers, setPrinters] = useState([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState(
    () => localStorage.getItem(RECEIPT_PRINTER_KEY) || ''
  );

  // states for adding custom (manual) items not present in product catalog
  const [customName, setCustomName] = useState('Item');
  const [customPrice, setCustomPrice] = useState('0.00');
  const [customQty, setCustomQty] = useState(1);
  const [customSku, setCustomSku] = useState('');

  // small inline SVG placeholder used as fallback when images fail to load
  const fallbackImage = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='100%' height='100%' fill='%23F3F4F6'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%239CA3AF' font-size='14'>No image</text></svg>";
  const envBase = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/g, '').replace(/\\/g, '/');
  const baseUrlRaw = import.meta.env.VITE_API_URL || '';
  const baseWithoutProducts = baseUrlRaw.replace(/\/products\/?$/i, '').replace(/\/+$/g, '');
  // API base to use for POSTing orders. Prefer explicit VITE_API_BASE or VITE_API_URL.
  const apiBase = (import.meta.env.VITE_API_BASE || baseUrlRaw || '').replace(/\/products\/?$/i, '').replace(/\/+$/g, '');

  function productCandidateRoots() {
    // mirrors InventoryPage logic: prefer VITE_API_URL when set (it may already include /products)
    const candidates = [];
    if (baseUrlRaw) candidates.push(baseUrlRaw.replace(/\/+$/, ''));
    if (envBase) {
      candidates.push(envBase + '/products');
      candidates.push(envBase + '/api/products');
    } else if (baseWithoutProducts) {
      candidates.push(baseWithoutProducts + '/products');
      candidates.push(baseWithoutProducts + '/api/products');
    }
    // common local fallbacks
    candidates.push('/products');
    candidates.push('/api/products');
    return Array.from(new Set(candidates.filter(Boolean)));
  }

  useEffect(() => {
    // focus barcode input for scanners
    if (barcodeRef.current) barcodeRef.current.focus();
    // load products (first page, large limit)
    let mounted = true;
    async function loadProducts() {
      for (const root of productCandidateRoots()) {
        const base = root.replace(/\/+$/g, '');
        try {
          const url = base + '?limit=1000';
          const resp = await fetch(url, { credentials: 'same-origin' });
          if (!mounted) return;
          if (!resp.ok) continue;
          const json = await tryParseJSONResponse(resp);
          if (!json) {
            console.debug('products load returned non-JSON (likely HTML) for base', base);
            continue;
          }
          const list = Array.isArray(json) ? json : (json.data || []);
          setProducts(list || []);
          return;
        } catch (e) {
          console.debug('products load failed for base', base, e);
        }
      }
      setProducts([]);
    }
    loadProducts();
    return () => { mounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mmToIn = (mm) => mm / 25.4;

  const buildReceiptConfig = (printerName, widthMm, heightMm) => {
    return qz.configs.create(printerName, {
      copies: 1,
      orientation: 'portrait',
      units: 'in',
      size: { width: mmToIn(widthMm), height: mmToIn(heightMm) },
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      rasterize: true,
    });
  };

  const ensureReceiptPrinter = async () => {
    await setupQZSecurity();
    if (!qz.websocket.isActive()) await qz.websocket.connect();

    let printerName = selectedPrinter || localStorage.getItem(RECEIPT_PRINTER_KEY);
    if (printerName) return printerName;

    const list = await qz.printers.find();
    const arr = Array.isArray(list) ? list : [list];
    if (!arr.length) throw new Error('No printers found in QZ Tray');
    printerName = arr[0];
    localStorage.setItem(RECEIPT_PRINTER_KEY, printerName);
    setSelectedPrinter(printerName);
    return printerName;
  };

  const printReceiptSilent = async () => {
    const el = receiptRef.current;
    if (!el) throw new Error('Receipt element is not ready');
    const printerName = await ensureReceiptPrinter();
    const canvas = await html2canvas(el, {
      backgroundColor: '#ffffff',
      scale: RECEIPT_CANVAS_SCALE,
      useCORS: true,
      onclone: (doc) => {
        doc.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => node.remove());
        const cloned = doc.getElementById('receipt-print');
        if (cloned) {
          cloned.style.color = '#111';
          cloned.style.background = '#fff';
          cloned.style.fontFamily = 'monospace';
        }
      },
    });
    const pxToMm = (px) => (px * 25.4) / (96 * RECEIPT_CANVAS_SCALE);
    const widthMm = Math.max(60, Math.ceil(pxToMm(canvas.width)));
    const heightMm = Math.max(40, Math.ceil(pxToMm(canvas.height)));

    const maxSlicePx = Math.floor((RECEIPT_MAX_PAGE_HEIGHT_MM * (96 * RECEIPT_CANVAS_SCALE)) / 25.4);
    if (heightMm <= RECEIPT_MAX_PAGE_HEIGHT_MM || maxSlicePx <= 0) {
      const cfg = buildReceiptConfig(printerName, widthMm, heightMm);
      const base64 = canvas.toDataURL('image/png').split(',')[1];
      await qz.print(cfg, [{ type: 'image', format: 'base64', data: base64 }]);
      return;
    }

    for (let y = 0; y < canvas.height; y += maxSlicePx) {
      const sliceHeightPx = Math.min(maxSlicePx, canvas.height - y);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeightPx;
      const ctx = sliceCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, -y);

      const sliceHeightMm = Math.ceil(pxToMm(sliceHeightPx));
      const cfg = buildReceiptConfig(printerName, widthMm, sliceHeightMm);
      const base64 = sliceCanvas.toDataURL('image/png').split(',')[1];
      await qz.print(cfg, [{ type: 'image', format: 'base64', data: base64 }]);
    }
  };

  const syncQzState = () => {
    try {
      const active = !!(qz?.websocket?.isActive?.() || false);
      setQzConnected(active);
    } catch {
      setQzConnected(false);
    }
  };

  const connectQz = async () => {
    setQzError('');
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
    setQzError('');
    try {
      if (qz.websocket.isActive()) await qz.websocket.disconnect();
      setQzConnected(false);
    } catch (err) {
      setQzError(err?.message ? err.message : String(err));
    }
  };

  const refreshPrinters = async (autoPick = false) => {
    setLoadingPrinters(true);
    setQzError('');
    try {
      if (!qz.websocket.isActive()) throw new Error('QZ Tray is not connected');
      const list = await qz.printers.find();
      const arr = Array.isArray(list) ? list : [list];
      setPrinters(arr);
      if (autoPick && !selectedPrinter && arr.length) {
        setSelectedPrinter(arr[0]);
        localStorage.setItem(RECEIPT_PRINTER_KEY, arr[0]);
      }
    } catch (err) {
      setQzError(err?.message ? err.message : String(err));
    } finally {
      setLoadingPrinters(false);
    }
  };

  // Helper: attempt to parse response as JSON but safely handle HTML/text
  async function tryParseJSONResponse(resp) {
    try {
      const ct = (resp.headers && resp.headers.get && resp.headers.get('content-type')) || '';
      if (ct.includes('application/json')) {
        return await resp.json();
      }
      const txt = await resp.text();
      const trimmed = txt.trim();
      if (!trimmed) return null;
      if (trimmed[0] === '<') return null; // HTML fallback (likely index.html)
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        return null;
      }
    } catch (e) {
      return null;
    }
  }

  // show all products in POS grid (search box removed for scanner-first UX)
  const filtered = products;

  function addToCart(product, qty = 1) {
    setCart(prev => {
      const found = prev.find(i => i.id === product.id);
      if (found) return prev.map(i => (i.id === product.id ? { ...i, qty: i.qty + qty } : i));
      return [{ ...product, qty }, ...prev];
    });
  }

  function changeQty(id, newQty) {
    setCart(prev => prev.map(i => (i.id === id ? { ...i, qty: Math.max(1, newQty) } : i)));
  }

  function changePrice(id, newPrice) {
    const parsed = parseFloat(newPrice);
    setCart(prev => prev.map(i => (i.id === id ? { ...i, price: isNaN(parsed) ? i.price : parsed } : i)));
  }

  function removeFromCart(id) {
    setCart(prev => prev.filter(i => i.id !== id));
  }

  const subtotal = cart.reduce((s, it) => s + it.price * it.qty, 0);
  const total = +subtotal.toFixed(2); // no taxes by default

  function handleKeypadPress(char) {
    if (char === 'C') return setKeypadValue('');
    if (char === '←') return setKeypadValue(v => v.slice(0, -1));
    setKeypadValue(v => (v + char).replace(/^0+(?!$)/, ''));
  }

  function applyKeypadQty(product) {
    const num = parseInt(keypadValue || '1', 10);
    addToCart(product, Math.max(1, isNaN(num) ? 1 : num));
    setKeypadValue('');
  }

  function handleBarcodeScan(value) {
    if (!value || !value.trim()) return;
    const code = value.trim();
    // try find by sku or barcode or id
    const found = products.find(p => String(p.sku || p.barcode || p.id) === String(code));
    if (found) {
      addToCart(found, 1);
      setMessage(null);
      setBarcodeInput('');
      return;
    }

    // Not found locally - attempt network lookup using product controller
    (async () => {
      let lastErr = null;
      for (const root of productCandidateRoots()) {
        const base = root.replace(/\/+$/g, '');
        try {
          // endpoints to try (in order). `base` may already be the products root.
          const endpoints = [
            `${base}/${encodeURIComponent(code)}`,
            `${base}/barcode/${encodeURIComponent(code)}`,
            `${base}?barcode=${encodeURIComponent(code)}`,
            `${base}?sku=${encodeURIComponent(code)}`,
          ];

          for (const url of endpoints) {
            try {
              const resp = await fetch(url, { credentials: 'same-origin' });
              if (!resp.ok) continue;
              const parsed = await tryParseJSONResponse(resp);
              if (!parsed) {
                // non-JSON (likely HTML) — skip
                continue;
              }

              // If API returned array/list or {data: [...]}
              if (Array.isArray(parsed)) {
                if (parsed.length) {
                  addToCart(parsed[0], 1);
                  setMessage(null);
                  setBarcodeInput('');
                  return;
                }
                continue;
              }

              // If API returned paginated object
              if (parsed.data && Array.isArray(parsed.data)) {
                if (parsed.data.length) {
                  addToCart(parsed.data[0], 1);
                  setMessage(null);
                  setBarcodeInput('');
                  return;
                }
                continue;
              }

              // Otherwise assume it's a single product object
              if (parsed && typeof parsed === 'object') {
                // guard: some HTML servers return serialized HTML as string — skip empty objects
                if (Object.keys(parsed).length) {
                  addToCart(parsed, 1);
                  setMessage(null);
                  setBarcodeInput('');
                  return;
                }
              }
            } catch (e) {
              console.debug('endpoint fetch failed', url, e);
              lastErr = e.message || String(e);
              continue;
            }
          }

          // if none of the endpoints matched for this base
          lastErr = `no match (base=${base})`;
        } catch (err) {
          lastErr = err.message;
          console.debug('barcode lookup failed for base', base, err);
        }
      }
      setMessage({ type: 'error', text: `Product not found: ${code} (${lastErr || 'no response'})` });
      setBarcodeInput('');
      setTimeout(() => setMessage(null), 5000);
    })();
  }

  function handleCheckout() {
    setShowCheckout(true);
    syncQzState();
  }

  // Try to decrement stock for catalog items by calling product adjust endpoints.
  async function adjustStockForItems(items) {
    const catalog = items.filter(i => i.productId && (i.decrementQuantity && i.decrementQuantity > 0));
    if (!catalog.length) return;

    // for each item try candidate product endpoints until one succeeds
    for (const it of catalog) {
      const delta = -(Math.abs(it.decrementQuantity));
      let adjusted = false;
      for (const root of productCandidateRoots()) {
        const base = root.replace(/\/+$/g, '');
        const endpoints = [
          `${base}/adjust-stock`,
          `${base}/adjustStock`,
          `${base}/adjust`,
          `${base}/stock/adjust`,
        ];
        for (const url of endpoints) {
          try {
            const resp = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ id: it.productId, delta })
            });
            if (!resp.ok) continue;
            adjusted = true;
            break;
          } catch (e) {
            console.debug('adjustStock attempt failed', url, e.message || e);
            continue;
          }
        }
        if (adjusted) break;
      }
      if (!adjusted) console.debug('adjustStock: no endpoint succeeded for', it.productId, 'delta', delta);
    }
  }

  async function confirmPayment() {
    if (!cart.length) return;
    setIsSubmitting(true);
    try {
      const items = cart.map(it => ({
        // send real product id when available; for manual items send null
        productId: it.productId || (String(it.id || '').startsWith('manual-') ? null : it.id),
        productName: it.name || it.productName || null,
        quantity: it.qty || it.quantity || 1,
        unitPrice: Number(it.price || it.unitPrice || 0),
        totalPrice: Number(((it.qty || it.quantity || 1) * Number(it.price || it.unitPrice || 0)).toFixed(2)),
        // only request inventory change for items that exist in catalog (non-null productId)
        decrementQuantity: (it.productId || (!String(it.id || '').startsWith('manual-') && it.id)) ? (it.qty || it.quantity || 1) : 0
      }));

      const payload = {
        items,
        totalAmount: Number(total.toFixed(2)),
        isPaid: true,
        notes: null,
        // signal to backend that it should decrement stock for catalog items
        updateInventory: true
      };

      // POST to the fixed backend URL per request
      const ordersUrl = 'http://localhost:5000/api/orders';
      const resp = await fetch(ordersUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(errText || `Request failed (${resp.status})`);
      }

      const data = await resp.json();
      const receiptItems = cart.map(it => ({
        name: it.name || it.productName || 'Item',
        qty: it.qty || it.quantity || 1,
        price: Number(it.price || it.unitPrice || 0),
      }));
      setReceiptData({
        items: receiptItems,
        subtotal,
        total,
        orderNumber: data.orderNumber || data.id || '',
        paidAt: new Date(),
      });
      await new Promise(requestAnimationFrame);
      await new Promise(resolve => setTimeout(resolve, 0));
      try {
        await printReceiptSilent();
        setReceiptData(null);
      } catch (printErr) {
        setMessage({ type: 'error', text: `Print failed: ${printErr.message}` });
        setQzError(printErr.message || String(printErr));
      }
      // attempt to decrement stock for catalog items (best-effort)
      try {
        await adjustStockForItems(items);
      } catch (e) {
        console.debug('inventory update failed', e.message || e);
      }
      setMessage({ type: 'success', text: `Order saved (${data.orderNumber || data.id || 'OK'})` });
      setCart([]);
      setShowCheckout(false);
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setMessage({ type: 'error', text: `Failed to save order: ${err.message}` });
      setTimeout(() => setMessage(null), 6000);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-6 h-screen flex flex-col bg-gray-50 text-gray-800">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-extrabold leading-tight">Point of Sale</h1>
          <p className="text-sm text-gray-500 mt-1">Quick sales — fast checkout</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-3 py-1 bg-white border border-gray-200 text-sm text-gray-700 rounded-md shadow-sm">New Order</button>
          <div className="text-sm text-gray-600">Items: <span className="font-medium text-gray-800">{cart.reduce((c, i) => c + i.qty, 0)}</span></div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-6">
        <main className="col-span-7 bg-white rounded-lg shadow-md p-6 flex flex-col">
          {/* Search removed — scanner-first POS. */}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Scan or enter barcode / SKU</label>
            <div className="flex items-center gap-2">
              <input
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleBarcodeScan(barcodeInput); }}
                ref={barcodeRef}
                onFocus={e => e.target.select()}
                inputMode="numeric"
                placeholder="Scan barcode or type SKU then press Enter"
                className="flex-1 text-lg border border-gray-200 rounded-md px-4 py-3 shadow-sm"
              />
              <button onClick={() => handleBarcodeScan(barcodeInput)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm shadow">Add</button>
              <button onClick={() => setBarcodeInput('')} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md">Clear</button>
            </div>
            <div className="text-xs text-gray-500 mt-2">Ready for scan — scanner will input code and press Enter automatically.</div>
          </div>
          {message && (
            <div className={`mb-3 text-sm px-3 py-2 rounded ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>{message.text}</div>
          )}

          <div className="space-y-6">
            <div className="p-4 border border-dashed border-gray-200 rounded bg-gray-50">
              <div className="text-sm text-gray-600">Products list hidden for POS. Use scanning or add manual items below.</div>
            </div>

            <div className="p-4 border rounded bg-white shadow-sm">
              <h3 className="text-lg font-semibold mb-2">Add manual item</h3>
              <p className="text-sm text-gray-500 mb-3">Quickly add an item that isn't in the product catalog. It will be added to this sale only.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="text-sm text-gray-700">Name</label>
                  <input value={customName} onChange={e => setCustomName(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="e.g. Cut piece" />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Price (Rs)</label>
                  <input value={customPrice} onChange={e => setCustomPrice(e.target.value)} type="number" step="0.01" min="0" className="mt-1 w-full border rounded px-3 py-2 text-base focus:outline:none focus:ring-2 focus:ring-indigo-200" />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Qty</label>
                  <input value={customQty} onChange={e => setCustomQty(Math.max(1, parseInt(e.target.value || '1', 10)))} type="number" min="1" className="mt-1 w-full border rounded px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="text-sm text-gray-700">SKU / Note (optional)</label>
                  <input value={customSku} onChange={e => setCustomSku(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Optional — SKU or short note" />
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:col-span-1">
                  <button onClick={() => {
                    const priceNum = parseFloat(customPrice || '0');
                    if (!customName.trim()) {
                      setMessage({ type: 'error', text: 'Please enter a name' });
                      setTimeout(() => setMessage(null), 3000);
                      return;
                    }
                    const id = `manual-${Date.now()}-${Math.floor(Math.random()*1000)}`;
                    addToCart({ id, name: customName.trim(), price: isNaN(priceNum) ? 0 : priceNum, sku: customSku || '', image: null }, Number(customQty || 1));
                    setCustomName('Item'); setCustomPrice('0.00'); setCustomQty(1); setCustomSku('');
                  }} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md text-base shadow hover:bg-green-700">+ Add Item</button>
                  <button onClick={() => { setCustomName('Item'); setCustomPrice('0.00'); setCustomQty(1); setCustomSku(''); }} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-base hover:shadow-sm">Clear</button>
                </div>
              </div>
            </div>
          </div>
        </main>

        <aside className="col-span-5 bg-white rounded-lg shadow-md p-6 flex flex-col">
          <h2 className="font-semibold text-lg mb-4">Cart</h2>
          <div className="flex-1 overflow-auto divide-y divide-gray-100">
            {cart.length === 0 ? (
              <div className="text-sm text-gray-500">Cart is empty</div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-2">
                    <div className="flex-1 flex items-center gap-3">
                      { (item.image || item.image_url || item.photo || item.thumbnail) ? (
                        <img
                          src={item.image || item.image_url || item.photo || item.thumbnail}
                          alt={item.name || item.sku || 'product'}
                          className="w-12 h-12 object-cover rounded"
                          onError={(e) => { e.target.onerror = null; e.target.src = fallbackImage; }}
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400">Img</div>
                      ) }
                      <div>
                        <div className="font-medium text-gray-900">{item.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                            <span>Rs</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.price}
                              onChange={e => changePrice(item.id, e.target.value)}
                              className="w-28 text-sm text-right border rounded px-1 py-0.5"
                            />
                            <span>• {item.sku}</span>
                          </div>
                      </div>
                    </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => changeQty(item.id, item.qty - 1)} className="px-3 py-1 bg-gray-100 rounded-md">-</button>
                    <div className="w-8 text-center font-medium">{item.qty}</div>
                    <button onClick={() => changeQty(item.id, item.qty + 1)} className="px-3 py-1 bg-gray-100 rounded-md">+</button>
                    <button onClick={() => removeFromCart(item.id)} className="ml-3 text-red-500">✕</button>
                  </div>
                </div>
              ))
            )}
          </div>

            <div className="mt-6">
            <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span className="font-medium text-gray-800">Rs {subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold text-lg mt-3"><span>Total</span><span className="text-indigo-600">Rs {total.toFixed(2)}</span></div>

            <div className="mt-4 flex gap-2">
              <button onClick={handleCheckout} disabled={cart.length===0} className="flex-1 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50">Checkout</button>
              <button onClick={() => { setCart([]); }} className="px-3 py-2 bg-red-50 text-red-600 rounded-md">Clear</button>
            </div>
          </div>
        </aside>
      </div>

      {/* Keypad UI removed — kept keypad logic and state intact for future use */}

      {showCheckout && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded p-6 w-96">
            <h3 className="text-lg font-semibold mb-2">Checkout</h3>
            <div className="text-sm text-gray-600 mb-4">
              <div className="flex justify-between"><span>Subtotal</span><span>Rs {subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold mt-2"><span>Total</span><span>Rs {total.toFixed(2)}</span></div>
            </div>
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className={`text-xs font-medium ${qzConnected ? 'text-green-700' : 'text-red-700'}`}>
                  {qzConnected ? 'QZ Tray connected' : 'QZ Tray disconnected'}
                </div>
                <div className="flex items-center gap-2">
                  {!qzConnected ? (
                    <button onClick={connectQz} className="px-2 py-1 text-xs bg-indigo-600 text-white rounded">Connect</button>
                  ) : (
                    <button onClick={disconnectQz} className="px-2 py-1 text-xs bg-gray-100 rounded">Disconnect</button>
                  )}
                  <button onClick={() => refreshPrinters(false)} disabled={!qzConnected || loadingPrinters} className="px-2 py-1 text-xs bg-gray-100 rounded disabled:opacity-50">
                    {loadingPrinters ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
              </div>
              <select
                value={selectedPrinter}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedPrinter(value);
                  if (value) localStorage.setItem(RECEIPT_PRINTER_KEY, value);
                }}
                disabled={!qzConnected}
                className="w-full border rounded px-2 py-1 text-sm"
              >
                <option value="">Select printer...</option>
                {printers.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              {qzError && <div className="text-xs text-red-600">QZ: {qzError}</div>}
            </div>
            <div className="flex gap-2">
              <button onClick={confirmPayment} disabled={isSubmitting} className="flex-1 py-2 bg-green-600 text-white rounded disabled:opacity-50">{isSubmitting ? 'Processing...' : 'Confirm Payment'}</button>
              <button onClick={() => setShowCheckout(false)} disabled={isSubmitting} className="flex-1 py-2 bg-gray-100 rounded disabled:opacity-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {receiptData && (
        <div
          id="receipt-print"
          ref={receiptRef}
          style={{ position: 'fixed', left: '-10000px', top: 0, width: '80mm', padding: '8px', background: '#fff' }}
          aria-hidden="true"
        >
          <Receipt
            items={receiptData.items}
            subtotal={receiptData.subtotal}
            total={receiptData.total}
            orderNumber={receiptData.orderNumber}
            paidAt={receiptData.paidAt}
          />
        </div>
      )}
    </div>
  );
};

export default POSPage;
