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

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Categories</h2>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold">Manage Categories</h3>
          <p className="text-sm text-gray-600">Create and update product categories.</p>
        </div>
        <div>
          <button onClick={openCreateModal} className="bg-green-600 text-white px-4 py-2 rounded shadow">Create Category</button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-lg w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold">{editingId ? 'Edit Category' : 'Create Category'}</h4>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input name="name" value={form.name} onChange={handleChange} placeholder="Name" className="border p-2 rounded" />
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isActive" checked={!!form.isActive} onChange={handleChange} /> Active
              </label>
              <textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" className="border p-2 rounded col-span-2" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setForm(empty); setEditingId(null); setShowModal(false); }} className="bg-gray-200 px-4 py-2 rounded">Cancel</button>
              <button onClick={saveCategory} disabled={isSaving} className="bg-green-600 text-white px-4 py-2 rounded">{isSaving ? 'Saving...' : (editingId ? 'Update' : 'Create')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded shadow p-4">
        <h3 className="font-semibold mb-3">Category List</h3>
        {loading ? <p>Loading...</p> : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-green-100 text-left">
                    <th className="p-2 border">Name</th>
                    <th className="p-2 border">Description</th>
                    <th className="p-2 border">Status</th>
                    <th className="p-2 border text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const total = categories.length;
                    const totalPages = Math.max(1, Math.ceil(total / pageSize));
                    const currentPage = Math.min(Math.max(1, page), totalPages);
                    const start = (currentPage - 1) * pageSize;
                    const paginated = categories.slice(start, start + pageSize);
                    return paginated.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="p-2 border">{c.name}</td>
                        <td className="p-2 border">{c.description}</td>
                        <td className="p-2 border">{(c.isActive || c.is_active) ? 'Active' : 'Inactive'}</td>
                        <td className="p-2 border text-center">
                          <button onClick={() => openEditModal(c)} className="bg-blue-500 text-white px-2 py-1 rounded mr-2">Edit</button>
                          <button onClick={() => deleteCategory(c.id)} className="bg-red-500 text-white px-2 py-1 rounded">Delete</button>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span>Total: {categories.length}</span>
                <label className="flex items-center gap-2">Per page:
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="border rounded px-2 py-1 ml-2">
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 bg-gray-100 rounded">Prev</button>
                <div className="text-sm">Page {Math.min(Math.max(1, page), Math.max(1, Math.ceil(categories.length / pageSize)))} of {Math.max(1, Math.ceil(categories.length / pageSize))}</div>
                <button onClick={() => setPage((p) => Math.min(Math.max(1, p + 1), Math.max(1, Math.ceil(categories.length / pageSize))))} className="px-3 py-1 bg-gray-100 rounded">Next</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
