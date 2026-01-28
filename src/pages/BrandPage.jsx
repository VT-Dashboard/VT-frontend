import React, { useEffect, useState } from 'react';

const empty = { name: '', description: '', website: '', isActive: true };

export default function BrandPage() {
  const [brands, setBrands] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const envBase = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
  const envUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  const apiRoot = envBase ? `${envBase}/api` : envUrl;

  // Build candidate brand endpoints to handle variants of apiRoot
  const buildBrandUrls = (id) => {
    const base = apiRoot;
    const withoutProducts = base.replace(/\/products\/?$/, '');
    const candidates = [];
    const add = (u) => { if (!candidates.includes(u)) candidates.push(u); };
    if (id) {
      add(`${base}/brands/${id}`);
      add(`${withoutProducts}/brands/${id}`);
      add(`${base}/products/brands/${id}`);
      add(`${base}/api/brands/${id}`);
      add(`${withoutProducts}/api/brands/${id}`);
    } else {
      add(`${base}/brands`);
      add(`${withoutProducts}/brands`);
      add(`${base}/products/brands`);
      add(`${base}/api/brands`);
      add(`${withoutProducts}/api/brands`);
    }
    return candidates;
  };

  useEffect(() => { loadBrands(); }, []);

  const loadBrands = async () => {
    if (!apiRoot) return;
    setLoading(true);
    try {
      const urls = buildBrandUrls();
      let res;
      let used;
      for (const u of urls) {
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
      const json = await res.json();
      // support { data: [] } or array
      const items = Array.isArray(json) ? json : (json.data || json);
      setBrands(items || []);
    } catch (err) {
      console.error('Failed to load brands', err);
    } finally { setLoading(false); }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const startCreate = () => { setForm(empty); setEditingId(null); setLogoFile(null); };

  const startEdit = (b) => {
    setEditingId(b.id);
    setForm({ name: b.name || '', description: b.description || '', website: b.website || '', isActive: typeof b.isActive === 'boolean' ? b.isActive : (b.is_active !== undefined ? !!b.is_active : true) });
    setLogoFile(null);
  };

  const openCreateModal = () => { startCreate(); setShowModal(true); };
  const openEditModal = (b) => { startEdit(b); setShowModal(true); };

  const saveBrand = async () => {
    if (!form.name || !apiRoot) { alert('Name required and API base must be set'); return; }
    setIsSaving(true);
    try {
      const payload = { ...form };
      const method = editingId ? 'PUT' : 'POST';
      const candidates = buildBrandUrls(editingId);
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
      // Note: backend does not currently persist brand logos via upload.
      // We keep a local preview for unsaved file only (not persisted).
      await loadBrands();
      setForm(empty);
      setEditingId(null);
      setLogoFile(null);
      setShowModal(false);
    } catch (err) {
      console.error('Save brand failed', err);
      alert('Save failed');
    } finally { setIsSaving(false); }
  };

  const deleteBrand = async (id) => {
    if (!confirm('Delete this brand?')) return;
    if (!apiRoot) { alert('API base not set'); return; }
    try {
      const candidates = buildBrandUrls(id);
      let res;
      let used;
      for (const u of candidates) {
        try {
          res = await fetch(u, { method: 'DELETE' });
          used = u;
          if (res.status === 404) continue;
          break;
        } catch (e) {}
      }
      if (!res) throw new Error('No endpoint responded');
      if (!res.ok) throw new Error(`Request to ${used} failed: ${await res.text()}`);
      // Logo persistence is handled by backend; nothing to remove locally.
      await loadBrands();
    } catch (err) {
      console.error('Delete failed', err);
      alert('Delete failed');
    }
  };

  const filtered = brands.filter((b) => {
    const name = (b.name || '').toLowerCase();
    const website = (b.website || '').toLowerCase();
    const description = (b.description || '').toLowerCase();
    const matchesQuery = !query || name.includes(query.toLowerCase()) || website.includes(query.toLowerCase()) || description.includes(query.toLowerCase());
    const active = (b.isActive || b.is_active) ? 'active' : 'inactive';
    const matchesStatus = statusFilter === 'all' || statusFilter === active;
    return matchesQuery && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-emerald-50/60">
      <div className="px-6 py-8 lg:px-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600">POS Control</div>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">Brands</h2>
            <p className="mt-1 text-sm text-slate-500">Keep brands consistent and easy to spot at checkout.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={openCreateModal} className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700">
              + Create Brand
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="text-xs uppercase tracking-wide text-slate-400">Total Brands</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{brands.length}</div>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="text-xs uppercase tracking-wide text-slate-400">Active</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-600">
              {brands.filter((b) => b.isActive || b.is_active).length}
            </div>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="text-xs uppercase tracking-wide text-slate-400">Inactive</div>
            <div className="mt-2 text-2xl font-semibold text-amber-600">
              {brands.filter((b) => !(b.isActive || b.is_active)).length}
            </div>
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl border border-white/40 bg-white/90 p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-slate-900">{editingId ? 'Edit Brand' : 'Create Brand'}</h4>
                  <p className="text-sm text-slate-500">Brand details appear across product cards and receipts.</p>
                </div>
                <button onClick={() => setShowModal(false)} className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500 hover:text-slate-700">X</button>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Brand Name</label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Acme Foods"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-400 focus:ring-4"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Website</label>
                  <input
                    name="website"
                    value={form.website}
                    onChange={handleChange}
                    placeholder="https://"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-400 focus:ring-4"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Short customer-facing description"
                    className="min-h-[110px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-400 focus:ring-4"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
                  <div className="flex h-[46px] items-center justify-between rounded-xl border border-slate-200 bg-white px-4">
                    <span className="text-sm text-slate-600">Active on POS</span>
                    <input type="checkbox" name="isActive" checked={!!form.isActive} onChange={handleChange} className="h-4 w-4 accent-emerald-600" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Logo (local preview)</label>
                  <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files && e.target.files[0])} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  {logoFile && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">New logo preview:</div>
                      <img src={URL.createObjectURL(logoFile)} alt="logo preview" className="mt-2 max-h-28 w-full object-contain" />
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                <button onClick={() => { setForm(empty); setEditingId(null); setLogoFile(null); setShowModal(false); }} className="rounded-full border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={saveBrand} disabled={isSaving} className="rounded-full bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700">
                  {isSaving ? 'Saving...' : (editingId ? 'Update Brand' : 'Create Brand')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/50 bg-white/90 p-5 shadow-xl shadow-emerald-100/50 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Brand List</h3>
              <p className="text-sm text-slate-500">Search quickly and edit without slowing the line.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-sm">
                <span className="text-slate-400">Search</span>
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  placeholder="Name, website, description"
                  className="w-52 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Loading brands...
            </div>
          ) : (
            <div className="mt-6">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Logo</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Website</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((b) => {
                      const logoUrl = b.image_url || b.logo_url || b.logo || b.logoUrl || b.imageUrl || null;
                      const active = (b.isActive || b.is_active);
                      return (
                        <tr key={b.id} className="border-t border-slate-100 text-sm text-slate-700 hover:bg-emerald-50/40">
                          <td className="px-4 py-3">
                            {logoUrl ? (
                              <img src={logoUrl} alt="logo" width="48" height="48" className="h-12 w-12 rounded-md object-contain" />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-slate-200 text-xs text-slate-400">No Logo</div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">{b.name}</td>
                          <td className="px-4 py-3 text-slate-500">{b.website || '-'}</td>
                          <td className="px-4 py-3 text-slate-500">{b.description || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => openEditModal(b)} className="rounded-full border border-slate-200 px-4 py-1 text-xs font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-700">
                              Edit
                            </button>
                            <button onClick={() => deleteBrand(b.id)} className="ml-2 rounded-full border border-rose-200 px-4 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!paginated.length && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                          No brands found. Try adjusting filters or create a new brand.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span>Showing {paginated.length} of {filtered.length}</span>
                  <label className="flex items-center gap-2">
                    Per page:
                    <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm">
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                    </select>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-full border border-slate-200 px-4 py-1 text-sm text-slate-600 hover:bg-slate-50">Prev</button>
                  <div className="text-sm text-slate-500">Page {currentPage} of {totalPages}</div>
                  <button onClick={() => setPage((p) => Math.min(Math.max(1, p + 1), totalPages))} className="rounded-full border border-slate-200 px-4 py-1 text-sm text-slate-600 hover:bg-slate-50">Next</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
