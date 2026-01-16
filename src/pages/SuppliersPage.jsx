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

const SuppliersPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(emptySupplier);
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('suppliers');
      if (raw) setSuppliers(JSON.parse(raw));
    } catch (e) {
      setSuppliers([]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('suppliers', JSON.stringify(suppliers));
    } catch (e) {}
  }, [suppliers]);

  const openAdd = () => {
    setForm(emptySupplier);
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (id) => {
    const s = suppliers.find((x) => x.id === id);
    if (!s) return;
    setForm({ ...s });
    setEditingId(id);
    setShowModal(true);
  };

  const save = () => {
    if (!form.name.trim()) { alert('Name required'); return; }
    if (editingId) {
      setSuppliers((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...form } : p)));
    } else {
      const id = Date.now();
      setSuppliers((prev) => [...prev, { ...form, id }]);
    }
    setShowModal(false);
    setForm(emptySupplier);
    setEditingId(null);
  };

  const remove = (id) => {
    if (!confirm('Delete supplier?')) return;
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Suppliers</h2>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-semibold">Manage Suppliers</h3>
        <button onClick={openAdd} className="bg-green-600 text-white px-4 py-2 rounded">Add Supplier</button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        {suppliers.length === 0 ? (
          <p className="text-gray-500">No suppliers yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-indigo-50 text-left">
                  <th className="p-2 border">Name</th>
                  <th className="p-2 border">Contact</th>
                  <th className="p-2 border">Email</th>
                  <th className="p-2 border">Phone</th>
                  <th className="p-2 border">Address</th>
                  <th className="p-2 border text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="p-2 border">{s.name}</td>
                    <td className="p-2 border">{s.contact}</td>
                    <td className="p-2 border">{s.email}</td>
                    <td className="p-2 border">{s.phone}</td>
                    <td className="p-2 border">{s.address}</td>
                    <td className="p-2 border text-center">
                      <button onClick={() => openEdit(s.id)} className="bg-blue-500 text-white px-2 py-1 rounded mr-2">Edit</button>
                      <button onClick={() => remove(s.id)} className="bg-red-500 text-white px-2 py-1 rounded">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-xl p-6">
            <h3 className="text-xl font-semibold mb-4">{editingId ? 'Edit Supplier' : 'Add Supplier'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <input name="name" value={form.name} onChange={handleChange} placeholder="Name" className="border p-2 rounded" />
              <input name="contact" value={form.contact} onChange={handleChange} placeholder="Primary contact" className="border p-2 rounded" />
              <input name="email" value={form.email} onChange={handleChange} placeholder="Email" className="border p-2 rounded" />
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="Phone" className="border p-2 rounded" />
              <textarea name="address" value={form.address} onChange={handleChange} placeholder="Address" className="border p-2 rounded col-span-2" />
              <label className="flex items-center col-span-2">
                <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} className="mr-2" /> Active
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={save} className="bg-green-600 text-white px-4 py-2 rounded mr-2">{editingId ? 'Update' : 'Add'}</button>
              <button onClick={() => { setShowModal(false); setForm(emptySupplier); }} className="bg-gray-300 text-gray-800 px-4 py-2 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersPage;
