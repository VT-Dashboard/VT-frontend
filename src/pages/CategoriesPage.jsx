import React, { useEffect, useState } from 'react';

const empty = { name: '', description: '', isActive: true };

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
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

  const buildCategoryUrls = (id) => {
    const base = apiRoot;
    const withoutProducts = base.replace(/\/products\/?$/, '');
    const candidates = [];
    const add = (u) => { if (!candidates.includes(u)) candidates.push(u); };
    if (id) {
      add(`${base}/categories/${id}`);
      add(`${withoutProducts}/categories/${id}`);
      add(`${base}/api/categories/${id}`);
      add(`${withoutProducts}/api/categories/${id}`);
    } else {
      add(`${base}/categories`);
      add(`${withoutProducts}/categories`);
      add(`${base}/api/categories`);
      add(`${withoutProducts}/api/categories`);
    }
    return candidates;
  };

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    if (!apiRoot) return;
    setLoading(true);
    try {
      const urls = buildCategoryUrls();
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
      const items = Array.isArray(json) ? json : (json.data || json);
      setCategories(items || []);
    } catch (err) {
      console.error('Failed to load categories', err);
    } finally { setLoading(false); }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const startCreate = () => { setForm(empty); setEditingId(null); };
  const startEdit = (c) => {
    setEditingId(c.id);
    setForm({ name: c.name || '', description: c.description || '', isActive: typeof c.isActive === 'boolean' ? c.isActive : (c.is_active !== undefined ? !!c.is_active : true) });
  };

  const openCreateModal = () => { startCreate(); setShowModal(true); };
  const openEditModal = (c) => { startEdit(c); setShowModal(true); };

  const saveCategory = async () => {
    if (!form.name || !apiRoot) { alert('Name required and API base must be set'); return; }
    setIsSaving(true);
    try {
      const payload = { ...form };
      const method = editingId ? 'PUT' : 'POST';
      const candidates = buildCategoryUrls(editingId);
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
      await loadCategories();
      setForm(empty);
      setEditingId(null);
      setShowModal(false);
    } catch (err) {
      console.error('Save category failed', err);
      alert('Save failed');
    } finally { setIsSaving(false); }
  };

  const deleteCategory = async (id) => {
    if (!confirm('Delete this category?')) return;
    if (!apiRoot) { alert('API base not set'); return; }
    try {
      const candidates = buildCategoryUrls(id);
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
      await loadCategories();
    } catch (err) {
      console.error('Delete failed', err);
      alert('Delete failed');
    }
  };

  const filtered = categories.filter((c) => {
    const name = (c.name || '').toLowerCase();
    const description = (c.description || '').toLowerCase();
    const matchesQuery = !query || name.includes(query.toLowerCase()) || description.includes(query.toLowerCase());
    const active = (c.isActive || c.is_active) ? 'active' : 'inactive';
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
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">Categories</h2>
            <p className="mt-1 text-sm text-slate-500">Keep the catalog clean, searchable, and fast for checkout.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={openCreateModal} className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700">
              + Create Category
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="text-xs uppercase tracking-wide text-slate-400">Total Categories</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{categories.length}</div>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="text-xs uppercase tracking-wide text-slate-400">Active</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-600">
              {categories.filter((c) => c.isActive || c.is_active).length}
            </div>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="text-xs uppercase tracking-wide text-slate-400">Inactive</div>
            <div className="mt-2 text-2xl font-semibold text-amber-600">
              {categories.filter((c) => !(c.isActive || c.is_active)).length}
            </div>
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl border border-white/40 bg-white/90 p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-slate-900">{editingId ? 'Edit Category' : 'Create Category'}</h4>
                  <p className="text-sm text-slate-500">Set details that appear at checkout and on receipts.</p>
                </div>
                <button onClick={() => setShowModal(false)} className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500 hover:text-slate-700">X</button>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category Name</label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Beverages"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-emerald-200 focus:border-emerald-400 focus:ring-4"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
                  <div className="flex h-[46px] items-center justify-between rounded-xl border border-slate-200 bg-white px-4">
                    <span className="text-sm text-slate-600">Active on POS</span>
                    <input type="checkbox" name="isActive" checked={!!form.isActive} onChange={handleChange} className="h-4 w-4 accent-emerald-600" />
                  </div>
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
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                <button onClick={() => { setForm(empty); setEditingId(null); setShowModal(false); }} className="rounded-full border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={saveCategory} disabled={isSaving} className="rounded-full bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700">
                  {isSaving ? 'Saving...' : (editingId ? 'Update Category' : 'Create Category')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/50 bg-white/90 p-5 shadow-xl shadow-emerald-100/50 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Category List</h3>
              <p className="text-sm text-slate-500">Search quickly and edit without slowing the line.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-sm">
                <span className="text-slate-400">Search</span>
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  placeholder="Name or description"
                  className="w-48 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
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
              Loading categories...
            </div>
          ) : (
            <div className="mt-6">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((c) => {
                      const active = (c.isActive || c.is_active);
                      return (
                        <tr key={c.id} className="border-t border-slate-100 text-sm text-slate-700 hover:bg-emerald-50/40">
                          <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                          <td className="px-4 py-3 text-slate-500">{c.description || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => openEditModal(c)} className="rounded-full border border-slate-200 px-4 py-1 text-xs font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-700">
                              Edit
                            </button>
                            <button onClick={() => deleteCategory(c.id)} className="ml-2 rounded-full border border-rose-200 px-4 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!paginated.length && (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">
                          No categories found. Try adjusting filters or create a new category.
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
