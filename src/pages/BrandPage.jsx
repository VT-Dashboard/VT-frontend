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

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Brands</h2>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold">Manage Brands</h3>
          <p className="text-sm text-gray-600">Create and update brand information shown in product listings.</p>
        </div>
        <div>
          <button onClick={openCreateModal} className="bg-green-600 text-white px-4 py-2 rounded shadow">Create Brand</button>
        </div>
      </div>

      {/* Modal for create / edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-lg w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold">{editingId ? 'Edit Brand' : 'Create Brand'}</h4>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input name="name" value={form.name} onChange={handleChange} placeholder="Name" className="border p-2 rounded" />
              <input name="website" value={form.website} onChange={handleChange} placeholder="Website" className="border p-2 rounded" />
              <textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" className="border p-2 rounded col-span-2" />
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isActive" checked={!!form.isActive} onChange={handleChange} /> Active
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo (local preview)</label>
                <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files && e.target.files[0])} className="border p-2 rounded w-full" />
                {logoFile && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-600">New logo preview:</p>
                    <img src={URL.createObjectURL(logoFile)} alt="logo preview" className="max-w-xs max-h-32 object-contain border rounded" />
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setForm(empty); setEditingId(null); setLogoFile(null); setShowModal(false); }} className="bg-gray-200 px-4 py-2 rounded">Cancel</button>
              <button onClick={saveBrand} disabled={isSaving} className="bg-green-600 text-white px-4 py-2 rounded">{isSaving ? 'Saving...' : (editingId ? 'Update' : 'Create')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded shadow p-4">
        <h3 className="font-semibold mb-3">Brand List</h3>
        {loading ? <p>Loading...</p> : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-green-100 text-left">
                    <th className="p-2 border">Logo</th>
                    <th className="p-2 border">Name</th>
                    <th className="p-2 border">Website</th>
                    <th className="p-2 border">Description</th>
                    <th className="p-2 border">Status</th>
                    <th className="p-2 border text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const total = brands.length;
                    const totalPages = Math.max(1, Math.ceil(total / pageSize));
                    const currentPage = Math.min(Math.max(1, page), totalPages);
                    const start = (currentPage - 1) * pageSize;
                    const paginated = brands.slice(start, start + pageSize);
                    return paginated.map((b) => {
                      const logoUrl = b.image_url || b.logo_url || b.logo || b.logoUrl || b.imageUrl || null;
                      return (
                        <tr key={b.id} className="hover:bg-gray-50">
                          <td className="p-2 border">{logoUrl ? <img src={logoUrl} alt="logo" width="50" height="50" className="object-contain rounded" /> : '—'}</td>
                          <td className="p-2 border">{b.name}</td>
                          <td className="p-2 border">{b.website}</td>
                          <td className="p-2 border">{b.description}</td>
                          <td className="p-2 border">{(b.isActive || b.is_active) ? 'Active' : 'Inactive'}</td>
                          <td className="p-2 border text-center">
                            <button onClick={() => openEditModal(b)} className="bg-blue-500 text-white px-2 py-1 rounded mr-2">Edit</button>
                            <button onClick={() => deleteBrand(b.id)} className="bg-red-500 text-white px-2 py-1 rounded">Delete</button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span>Total: {brands.length}</span>
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
                <div className="text-sm">
                  Page {Math.min(Math.max(1, page), Math.max(1, Math.ceil(brands.length / pageSize)))} of {Math.max(1, Math.ceil(brands.length / pageSize))}
                </div>
                <button onClick={() => setPage((p) => Math.min(Math.max(1, p + 1), Math.max(1, Math.ceil(brands.length / pageSize))))} className="px-3 py-1 bg-gray-100 rounded">Next</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
