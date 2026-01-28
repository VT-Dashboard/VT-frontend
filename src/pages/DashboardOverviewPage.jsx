import React, { useEffect, useState } from 'react';

/**
 * DashboardOverviewPage
 * - Removes hardcoded sample values
 * - Fetches overview data from provided `controllers.getDashboardOverview()` or
 *   falls back to `GET /api/dashboard/overview`.
 * - Accepts an optional `controllers` prop to integrate with your backend controllers.
 */
const DashboardOverviewPage = ({ controllers }) => {
  const [data, setData] = useState({ summary: null, top: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let result = null;

        if (controllers && typeof controllers.getDashboard === 'function') {
          result = await controllers.getDashboard();
        } else {
          // Build API endpoint from Vite env vars. Prefer VITE_API_BASE; fall back to VITE_API_URL's origin; finally use relative path.
          const { VITE_API_BASE, VITE_API_URL } = import.meta.env;
          let apiBase = VITE_API_BASE;
          if (!apiBase && VITE_API_URL) {
            try {
              apiBase = new URL(VITE_API_URL).origin;
            } catch {
              apiBase = '';
            }
          }
          const endpoint = apiBase ? `${apiBase.replace(/\/$/, '')}/api/dashboard` : '/api/dashboard';

          const res = await fetch(endpoint);
          // Read as text first so we can surface helpful debug information when JSON parsing fails
          const contentType = res.headers.get('content-type') || '';
          const bodyText = await res.text();
          if (!res.ok) {
            const msg = bodyText || res.statusText || res.status;
            throw new Error(`Request failed (${endpoint}): ${msg}`);
          }

          if (contentType.includes('application/json')) {
            try {
              result = JSON.parse(bodyText);
            } catch (e) {
              throw new Error('Invalid JSON response: ' + (bodyText ? bodyText.slice(0, 500) : '')); 
            }
          } else {
            // Usually indicates the dev server returned HTML (index.html) or an error page
            throw new Error(`Expected JSON but received text/HTML from ${endpoint}: ` + (bodyText ? bodyText.slice(0, 500) : ''));
          }
        }

        // Accept either { summary, top } or legacy shapes
        let summary = null;
        let top = [];

        if (result) {
          // If the response is the express res.json return wrapper, it may already be the data
          if (result.summary || result.top) {
            summary = result.summary || null;
            top = result.top || [];
          } else if (result.totalSales || result.ordersCount) {
            // direct summary object
            summary = result;
          } else if (result.metrics || result.recentSales) {
            // legacy UI data
            summary = {
              totalSales: result.metrics?.dailySales ?? null,
              ordersCount: null,
              paidCount: null,
              avgOrder: null
            };
            top = result.recentSales || [];
          }
        }

        if (mounted) setData({ summary, top });
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load dashboard');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [controllers]);
  // Helpers to produce ISO start/end for a given Date
  const startOfDayISO = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.toISOString();
  };
  const endOfDayISO = (d) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x.toISOString();
  };

  const formatCurrency = (v) => {
    if (v == null) return '-';
    try {
      // Format using Sri Lankan Rupee
      return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(v);
    } catch {
      return String(v);
    }
  };

  const [last7, setLast7] = useState({ labels: [], values: [], loading: true });

  useEffect(() => {
    let mounted = true;
    const load7 = async () => {
      setLast7({ labels: [], values: [], loading: true });
      try {
        // build endpoint base same as earlier
        const { VITE_API_BASE, VITE_API_URL } = import.meta.env;
        let apiBase = VITE_API_BASE;
        if (!apiBase && VITE_API_URL) {
          try {
            apiBase = new URL(VITE_API_URL).origin;
          } catch {
            apiBase = '';
          }
        }
        const summaryEndpointBase = apiBase ? `${apiBase.replace(/\/$/, '')}/api/dashboard/summary` : '/api/dashboard/summary';

        const days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          days.push(new Date(d));
        }

        const requests = days.map((day) => {
          const start = startOfDayISO(day);
          const end = endOfDayISO(day);
          // If controllers prop provides getSummary, prefer it
          if (controllers && typeof controllers.getSummary === 'function') {
            return controllers.getSummary({ query: { start, end } }).then((r) => r).catch(() => null);
          }
          const url = `${summaryEndpointBase}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
          return fetch(url).then(async (res) => {
            if (!res.ok) return null;
            try {
              return await res.json();
            } catch {
              return null;
            }
          }).catch(() => null);
        });

        const results = await Promise.all(requests);
        const labels = days.map((d) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));
        const values = results.map((r) => (r && (r.totalSales != null ? Number(r.totalSales) : (r.totalSales === 0 ? 0 : null))) );
        // normalize nulls to 0
        const cleaned = values.map((v) => (v == null ? 0 : v));
        if (mounted) setLast7({ labels, values: cleaned, loading: false });
      } catch (e) {
        if (mounted) setLast7((s) => ({ ...s, loading: false }));
      }
    };

    load7();
    return () => { mounted = false; };
  }, [controllers]);

  // Filter controls: last7 (default), lastWeek, lastMonth, exact date
  const [filterType, setFilterType] = useState('last7');
  const [selectedDate, setSelectedDate] = useState('');
  const [filterTotal, setFilterTotal] = useState(null);
  const [filterLoading, setFilterLoading] = useState(false);

  const fetchSummaryRange = async (startISO, endISO) => {
    setFilterLoading(true);
    try {
      if (controllers && typeof controllers.getSummary === 'function') {
        const r = await controllers.getSummary({ query: { start: startISO, end: endISO } });
        setFilterTotal(r?.totalSales ?? 0);
        return;
      }

      const { VITE_API_BASE, VITE_API_URL } = import.meta.env;
      let apiBase = VITE_API_BASE;
      if (!apiBase && VITE_API_URL) {
        try { apiBase = new URL(VITE_API_URL).origin; } catch { apiBase = ''; }
      }
      const urlBase = apiBase ? `${apiBase.replace(/\/$/, '')}/api/dashboard/summary` : '/api/dashboard/summary';
      const url = `${urlBase}?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`;
      const res = await fetch(url);
      if (!res.ok) { setFilterTotal(null); setFilterLoading(false); return; }
      const j = await res.json();
      setFilterTotal(j?.totalSales ?? 0);
    } catch (e) {
      setFilterTotal(null);
    } finally { setFilterLoading(false); }
  };

  useEffect(() => {
    // Run when filterType or selectedDate changes
    const run = async () => {
      if (filterType === 'last7') {
        // sum client-side values (already loaded)
        if (!last7.loading) {
          setFilterTotal(last7.values.reduce((a, b) => a + b, 0));
        }
        return;
      }

      const today = new Date();
      if (filterType === 'lastWeek') {
        // previous 7 days excluding today
        const end = new Date(); end.setDate(today.getDate() - 1);
        const start = new Date(); start.setDate(today.getDate() - 7);
        await fetchSummaryRange(startOfDayISO(start), endOfDayISO(end));
        return;
      }

      if (filterType === 'lastMonth') {
        const end = new Date();
        const start = new Date(); start.setDate(today.getDate() - 30);
        await fetchSummaryRange(startOfDayISO(start), endOfDayISO(end));
        return;
      }

      if (filterType === 'date') {
        if (!selectedDate) { setFilterTotal(null); return; }
        const d = new Date(selectedDate);
        await fetchSummaryRange(startOfDayISO(d), endOfDayISO(d));
        return;
      }
    };
    run();
  }, [filterType, selectedDate, last7.loading]);

  if (loading) return <div className="p-8">Loading dashboard…</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

  const { summary, top } = data;

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Dashboard Overview</h2>
      <p className="text-gray-600">Overview of real-time metrics and top-selling items.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
          <h3 className="text-xl font-semibold text-indigo-700 mb-2">Total Sales</h3>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(summary?.totalSales)}</p>
          <p className="text-sm text-gray-500 mt-1">Orders: {summary?.ordersCount ?? '-'}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
          <h3 className="text-xl font-semibold text-yellow-700 mb-2">Paid Orders</h3>
          <p className="text-3xl font-bold text-gray-900">{summary?.paidCount ?? '-'}</p>
          <p className="text-sm text-gray-500 mt-1">Average Order: {formatCurrency(summary?.avgOrder)}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
          <h3 className="text-xl font-semibold text-green-700 mb-2">Avg. Order Value</h3>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(summary?.avgOrder)}</p>
          <p className="text-sm text-gray-500 mt-1">Period: {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setFilterType('last7')} className={`px-3 py-1 rounded ${filterType === 'last7' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Last 7 days</button>
          <button onClick={() => setFilterType('lastWeek')} className={`px-3 py-1 rounded ${filterType === 'lastWeek' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Last week</button>
          <button onClick={() => setFilterType('lastMonth')} className={`px-3 py-1 rounded ${filterType === 'lastMonth' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Last month</button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Exact date:</label>
          <input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setFilterType('date'); }} className="border rounded p-1 text-sm" />
        </div>

        <div className="ml-auto bg-white p-3 rounded shadow border">
          <div className="text-sm text-gray-500">Selected range total</div>
          <div className="text-xl font-semibold text-gray-900">{filterLoading ? 'Loading…' : formatCurrency(filterTotal)}</div>
        </div>
      </div>

      <div className="mt-8 p-6 bg-white rounded-lg shadow-md border border-gray-100">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Last 7 Days Sales</h3>
        {last7.loading ? (
          <p className="text-gray-600">Loading chart…</p>
        ) : (
          <div className="w-full overflow-x-auto">
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
              <svg viewBox="0 0 900 260" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '260px' }}>
                {/* axis labels & grid */}
                <g transform="translate(60,20)">
                  {/* y grid and labels */}
                  {(() => {
                    const max = Math.max(...last7.values, 1);
                    const ticks = 4;
                    const rows = [];
                    for (let i = 0; i <= ticks; i++) {
                      const y = (i / ticks) * 180;
                      const val = Math.round(max - (i / ticks) * max);
                      rows.push(
                        <g key={i}>
                          <line x1={0} x2={760} y1={y} y2={y} stroke="#e6e6e6" strokeWidth="1" />
                          <text x={-10} y={y + 4} fontSize="12" fill="#6b7280" textAnchor="end">{formatCurrency(val)}</text>
                        </g>
                      );
                    }
                    return rows;
                  })()}

                  {/* bars */}
                  {(() => {
                    const max = Math.max(...last7.values, 1);
                    const barAreaWidth = 760;
                    const barWidth = barAreaWidth / last7.values.length - 18;
                    return last7.values.map((v, i) => {
                      const x = i * (barWidth + 18) + 10;
                      const h = (v / max) * 160;
                      const y = 180 - h;
                      return (
                        <g key={i}>
                          <rect x={x} y={y} width={barWidth} height={h} rx={6} ry={6} fill="#4f46e5" />
                          <text x={x + barWidth / 2} y={y - 8} fontSize="12" fill="#111827" textAnchor="middle">{formatCurrency(v)}</text>
                          <text x={x + barWidth / 2} y={205} fontSize="12" fill="#6b7280" textAnchor="middle">{last7.labels[i]}</text>
                        </g>
                      );
                    });
                  })()}
                </g>
              </svg>

              <div className="mt-3 text-sm text-gray-600">Total (7 days): <span className="font-semibold text-gray-800">{formatCurrency(last7.values.reduce((a,b)=>a+b,0))}</span></div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 p-6 bg-white rounded-lg shadow-md border border-gray-100">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Top Selling Items</h3>
        {(!top || top.length === 0) ? (
          <p className="text-gray-600">No top items available for the selected period.</p>
        ) : (
          <ul className="text-gray-600 space-y-2">
            {top.map((t, idx) => (
              <li key={t.productId || idx} className="flex justify-between">
                <span>{t.productName || t.product_name || `Product ${t.productId || idx}`}</span>
                <span className="text-sm text-gray-500">{t.quantitySold ?? t.quantity ?? 0} sold — {formatCurrency(t.salesAmount ?? t.sales_amount ?? 0)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DashboardOverviewPage;