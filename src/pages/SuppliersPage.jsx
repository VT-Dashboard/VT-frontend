import React, { useEffect, useState } from 'react';

const emptySupplier = {
  id: null,
  name: '',
  contact: '',
  email: '',
  phone: '',
  address: '',
  isActive: true,
};

// detect API base similar to BrandPage
const envBase = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
const envUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const apiRoot = envBase ? `${envBase}/api` : envUrl;

const buildSupplierUrls = (id) => {
  const base = apiRoot;
  const withoutProducts = base.replace(/\/products\/?$/, '');
  const candidates = [];
  const add = (u) => { if (u && !candidates.includes(u)) candidates.push(u); };
  if (id) {
    add(`${base}/suppliers/${id}`);
    add(`${withoutProducts}/suppliers/${id}`);
    add(`${base}/api/suppliers/${id}`);
    add(`${withoutProducts}/api/suppliers/${id}`);
  } else {
    add(`${base}/suppliers`);
    add(`${withoutProducts}/suppliers`);
    add(`${base}/api/suppliers`);
    add(`${withoutProducts}/api/suppliers`);
  }
  return candidates;
};

const SuppliersPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(emptySupplier);
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [search, setSearch] = useState('');

  const loadSuppliers = async (q = '', p = page, limit = pageSize) => {
    if (!apiRoot) return;
    try {
      setLoading(true);
      setError(null);
      const urls = buildSupplierUrls();
      let res;
      let used;
      for (const u of urls) {
        try {
          const params = new URLSearchParams();
          params.set('page', String(Number(p) || 1));
          params.set('limit', String(Number(limit) || 10));
          if (q) params.set('q', q);
          const url = `${u}?${params.toString()}`;
          res = await fetch(url);
          used = url;
          if (res.status === 404) continue;
          break;
        } catch (e) {
          // try next
        }
      }
      if (!res) throw new Error('No endpoint responded');
      if (!res.ok) throw new Error(`Request to ${used} failed: ${await res.text()}`);
      const body = await res.json();
      // backend may return { meta: { total }, data: [...] }
      const list = Array.isArray(body) ? body : (body.data || body.rows || []);
      const meta = body.meta || {};
      const totalCount = meta.total ?? (body.count ?? (body.total ?? (Array.isArray(body) ? body.length : 0)));
      setSuppliers(list || []);
      setTotal(Number(totalCount) || 0);
    } catch (e) {
      setError(e.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // reload when page, pageSize, or active search changes
    loadSuppliers(search, page, pageSize);
  }, [page, pageSize, search]);

  const openAdd = () => {
    setForm(emptySupplier);
    setEditingId(null);
    setShowModal(true);
  };

  const onSearch = (e) => {
    e?.preventDefault?.();
    setPage(1);
    setSearch(searchTerm.trim());
  };

  const openEdit = async (id) => {
    const existing = suppliers.find((x) => x.id === id);
    if (existing) {
      setForm({
        id: existing.id,
        name: existing.name || '',
        contact: existing.contactPerson || existing.contact || '',
        email: existing.email || '',
        phone: existing.phone || '',
        address: existing.address || '',
        isActive: typeof existing.isActive === 'boolean' ? existing.isActive : !!existing.is_active,
      });
      setEditingId(id);
      setShowModal(true);
      return;
    }
    try {
      setLoading(true);
      const candidates = buildSupplierUrls(id);
      let res;
      let used;
      for (const u of candidates) {
        try {
          res = await fetch(u);
          used = u;
          if (res.status === 404) continue;
          break;
        } catch (e) {
          // try next
        }
      }
      if (!res) throw new Error('No endpoint responded');
      if (!res.ok) throw new Error(`Request to ${used} failed: ${await res.text()}`);
      const inst = await res.json();
      setForm({
        id: inst.id,
        name: inst.name || '',
        contact: inst.contactPerson || inst.contact || '',
        email: inst.email || '',
        phone: inst.phone || '',
        address: inst.address || '',
        isActive: typeof inst.isActive === 'boolean' ? inst.isActive : !!inst.is_active,
      });
      setEditingId(id);
      setShowModal(true);
    } catch (e) {
      setError(e.message || 'Failed to load supplier');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!form.name || !form.name.trim()) { alert('Name required'); return; }
    const payload = {
      name: form.name,
      contactPerson: form.contact,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      isActive: !!form.isActive,
    };
    try {
      setLoading(true);
      setError(null);
      const method = editingId ? 'PUT' : 'POST';
      const candidates = buildSupplierUrls(editingId);
      let res;
      let used;
      for (const u of candidates) {
        try {
          res = await fetch(u, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          used = u;
          if (res.status === 404) continue;
          break;
        } catch (e) {
          // try next
        }
      }
      if (!res) throw new Error('No endpoint responded');
      if (!res.ok) throw new Error(`Request to ${used} failed: ${await res.text()}`);
      const saved = await res.json();
      if (editingId) setSuppliers((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
      else setSuppliers((prev) => [...prev, saved]);
      setShowModal(false);
      setForm(emptySupplier);
      setEditingId(null);
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete supplier?')) return;
    try {
      setLoading(true);
      const candidates = buildSupplierUrls(id);
      let res;
      let used;
      for (const u of candidates) {
        try {
          res = await fetch(u, { method: 'DELETE' });
          used = u;
          if (res.status === 404) continue;
          break;
        } catch (e) {
          // try next
        }
      }
      if (!res) throw new Error('No endpoint responded');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request to ${used} failed`);
      }
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e.message || 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const activeCount = suppliers.filter((s) => s.isActive || s.is_active).length;
  const inactiveCount = suppliers.length - activeCount;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-emerald-50/60">
      <div className="px-6 py-8 lg:px-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600">POS Control</div>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">Suppliers</h2>
            <p className="mt-1 text-sm text-slate-500">Keep vendors reliable and stock flowing without delays.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={openAdd} className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700">
              + Add Supplier
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="text-xs uppercase tracking-wide text-slate-400">Total Suppliers</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{total || suppliers.length}</div>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="text-xs uppercase tracking-wide text-slate-400">Active</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-600">{activeCount}</div>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="text-xs uppercase tracking-wide text-slate-400">Inactive</div>
            <div className="mt-2 text-2xl font-semibold text-amber-600">{inactiveCount}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/50 bg-white/90 p-5 shadow-xl shadow-emerald-100/50 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Supplier Directory</h3>
              <p className="text-sm text-slate-500">Search, verify contacts, and update on the fly.</p>
            </div>
            <form onSubmit={onSearch} className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-sm">
                <span className="text-slate-400">Search</span>
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Name, contact, email"
                  className="w-52 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
              <button type="submit" className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-200">Search</button>
              <button type="button" onClick={() => { setSearchTerm(''); setSearch(''); setPage(1); }} className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Clear</button>
            </form>
          </div>

          {loading && (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Loading suppliers...
            </div>
          )}
          {error && !loading && (
            <div className="mt-6 rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
              {error}
            </div>
          )}
          {!loading && suppliers.length === 0 && !error && (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No suppliers yet.
            </div>
          )}

          {!loading && suppliers.length > 0 && (
            <div className="mt-6">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Address</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((s) => {
                      const active = (s.isActive || s.is_active);
                      return (
                        <tr key={s.id} className="border-t border-slate-100 text-sm text-slate-700 hover:bg-emerald-50/40">
                          <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                          <td className="px-4 py-3 text-slate-500">{s.contactPerson || s.contact || '-'}</td>
                          <td className="px-4 py-3 text-slate-500">{s.email || '-'}</td>
                          <td className="px-4 py-3 text-slate-500">{s.phone || '-'}</td>
                          <td className="px-4 py-3 text-slate-500">{s.address || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => openEdit(s.id)} className="rounded-full border border-slate-200 px-4 py-1 text-xs font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-700">
                              Edit
                            </button>
                            <button onClick={() => remove(s.id)} className="ml-2 rounded-full border border-rose-200 px-4 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {!loading && total > 0 && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <span>Total: {total}</span>
                    <label className="flex items-center gap-2">
                      Per page:
                      <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm">
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-full border border-slate-200 px-4 py-1 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Prev</button>
                    <div className="text-sm text-slate-500">Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</div>
                    <button onClick={() => setPage((p) => Math.min(Math.max(1, Math.ceil(total / pageSize)), p + 1))} disabled={page >= Math.ceil(total / pageSize)} className="rounded-full border border-slate-200 px-4 py-1 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Next</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-white/40 bg-white/90 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{editingId ? 'Edit Supplier' : 'Add Supplier'}</h3>
                <p className="text-sm text-slate-500">Make sure contact details are accurate for replenishment.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500 hover:text-slate-700">X</button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Supplier Name</label>
                <input name="name" value={form.name} onChange={handleChange} placeholder="Name" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-400 focus:ring-4" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primary Contact</label>
                <input name="contact" value={form.contact} onChange={handleChange} placeholder="Primary contact" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-400 focus:ring-4" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</label>
                <input name="email" value={form.email} onChange={handleChange} placeholder="Email" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-400 focus:ring-4" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</label>
                <input name="phone" value={form.phone} onChange={handleChange} placeholder="Phone" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-400 focus:ring-4" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</label>
                <textarea name="address" value={form.address} onChange={handleChange} placeholder="Address" className="min-h-[110px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-400 focus:ring-4" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
                <div className="flex h-[46px] items-center justify-between rounded-xl border border-slate-200 bg-white px-4">
                  <span className="text-sm text-slate-600">Active on POS</span>
                  <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} className="h-4 w-4 accent-emerald-600" />
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button onClick={save} className="rounded-full bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200">{editingId ? 'Update Supplier' : 'Add Supplier'}</button>
              <button onClick={() => { setShowModal(false); setForm(emptySupplier); }} className="rounded-full border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersPage;
