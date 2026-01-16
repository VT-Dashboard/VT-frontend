import React, { useEffect, useState } from "react";
import Barcode from "react-barcode";

const emptyItem = {
	name: "",
	description: "",
	sku: "",
	price: "",
	cost: "",
	quantity: "",
	unit: "",
	categoryId: "",
	supplierId: "",
	reorderLevel: "",
	taxRate: "",
	isActive: true,
	imageUrl: "",
};

const InventoryPage = () => {
	const [items, setItems] = useState([]);

	// Normalize item shape from API (support image_url / imageUrl, image_public_id / imagePublicId)
	const normalizeItem = (it) => {
		if (!it || typeof it !== 'object') return it;
		const copy = { ...it };
		if (!copy.imageUrl && copy.image_url) copy.imageUrl = copy.image_url;
		if (!copy.image_url && copy.imageUrl) copy.image_url = copy.imageUrl;
		if (!copy.imagePublicId && copy.image_public_id) copy.imagePublicId = copy.image_public_id;
		if (!copy.image_public_id && copy.imagePublicId) copy.image_public_id = copy.imagePublicId;
		// normalize boolean-ish isActive / is_active
		if (copy.isActive === undefined && typeof copy.is_active !== 'undefined') copy.isActive = !!copy.is_active;
		if (typeof copy.isActive === 'undefined') copy.isActive = true;
		return copy;
	};

	const [form, setForm] = useState(emptyItem);
	const [editingId, setEditingId] = useState(null);
	const [showModal, setShowModal] = useState(false);
	const [search, setSearch] = useState("");
	const [previewBarcode, setPreviewBarcode] = useState("");
	const [printItem, setPrintItem] = useState(null);
	const [adjustModal, setAdjustModal] = useState(false);
	const [adjustDelta, setAdjustDelta] = useState(0);
	const [adjustItem, setAdjustItem] = useState(null);
	const [adjustError, setAdjustError] = useState("");

	const [imageFile, setImageFile] = useState(null);
	const [imagePreviewUrl, setImagePreviewUrl] = useState("");
	const [imagePreviewTitle, setImagePreviewTitle] = useState("");
	const [showImagePreview, setShowImagePreview] = useState(false);

	// UI state: pagination and filters
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [categoryFilter, setCategoryFilter] = useState("");
	const [supplierFilter, setSupplierFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState("");

	useEffect(() => {
		if (adjustModal) console.debug('Adjust modal opened for', adjustItem && (adjustItem.id || adjustItem.barcode));
		else console.debug('Adjust modal closed');
	}, [adjustModal, adjustItem]);

	// Load products from backend on mount
	useEffect(() => {
		const baseUrlRaw = import.meta.env.VITE_API_URL;
		if (!baseUrlRaw) {
			console.warn('VITE_API_URL not set — Inventory will not load from API');
			return;
		}

		const apiRoot = baseUrlRaw.replace(/\/+$/, "");
		let mounted = true;
		const load = async () => {
			try {
				const res = await fetch(apiRoot, { cache: 'no-store', headers: { Accept: 'application/json' } });
				if (res.status === 304) {
					console.info('Products not modified (304)');
					return;
				}
				if (!res.ok) {
					const text = await res.text();
					console.error('Failed to fetch products', res.status, text);
					return;
				}
				let data = [];
				try {
					data = await res.json();
				} catch (err) {
					console.warn('Failed to parse JSON response (maybe empty body)', err);
					data = [];
				}

				// Accept common API response shapes: array, { products: [] }, { data: [] }, { rows: [] }, etc.
				let products = [];
				if (Array.isArray(data)) {
					products = data;
				} else if (data && typeof data === 'object') {
					if (Array.isArray(data.products)) products = data.products;
					else if (Array.isArray(data.data)) products = data.data;
					else if (Array.isArray(data.rows)) products = data.rows;
					else if (Array.isArray(data.items)) products = data.items;
					else {
						// fallback: find the first array value on the object
						const firstArr = Object.values(data).find((v) => Array.isArray(v));
						if (Array.isArray(firstArr)) products = firstArr;
					}
				}

				if (mounted) {
					setItems(products.map((p) => normalizeItem(p)));
					console.debug('Loaded products:', products.length);
				}
			} catch (err) {
				console.error('Error loading products', err);
			}
		};
		load();
		return () => (mounted = false);
	}, []);

	const handleChange = (e) => {
		const { name, value, type, checked } = e.target;
		setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
	};

	const generateBarcode = () => {
		// generate a 12-digit numeric barcode and ensure it's unique within current items
		const make = () => {
			const ts = Date.now().toString();
			const tail = ts.slice(-8);
			const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
			return (tail + rand).slice(0, 12);
		};
		let code = make();
		const existing = new Set(items.map((i) => i.barcode));
		let attempts = 0;
		while (existing.has(code) && attempts < 10) {
			code = make();
			attempts += 1;
		}
		return code;
	};

	const isGuid = (s) => {
		if (!s || typeof s !== "string") return false;
		return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
	};

	// filtered list by search (name, sku, barcode, categoryId, supplierId) + filters
	const filtered = items.filter((it) => {
		// search
		if (search && search.trim()) {
			const q = search.toLowerCase();
			const matched = (
				(it.name || "").toString().toLowerCase().includes(q) ||
				(it.sku || "").toString().toLowerCase().includes(q) ||
				(it.barcode || "").toString().toLowerCase().includes(q) ||
				(it.categoryId || "").toString().toLowerCase().includes(q) ||
				(it.supplierId || "").toString().toLowerCase().includes(q)
			);
			if (!matched) return false;
		}

		// category filter
		if (categoryFilter && (it.categoryId || "") !== categoryFilter) return false;
		// supplier filter
		if (supplierFilter && (it.supplierId || "") !== supplierFilter) return false;
		// status filter
		if (statusFilter === "active" && !it.isActive) return false;
		if (statusFilter === "inactive" && it.isActive) return false;

		return true;
	});

	// derived lists for filter dropdowns
	const categories = Array.from(new Set(items.map((i) => i.categoryId).filter(Boolean)));
	const suppliers = Array.from(new Set(items.map((i) => i.supplierId).filter(Boolean)));

	// pagination
	const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
	useEffect(() => {
		if (page > totalPages) setPage(totalPages);
	}, [page, totalPages]);

	useEffect(() => {
		// reset to first page when filters/search/pageSize change
		setPage(1);
	}, [search, categoryFilter, supplierFilter, statusFilter, pageSize]);

	const startIndex = (page - 1) * pageSize;
	const endIndex = Math.min(startIndex + pageSize, filtered.length);
	const pagedItems = filtered.slice(startIndex, endIndex);

	const [isSaving, setIsSaving] = useState(false);

	const saveItem = async () => {
		if (!form.name.trim()) {
			alert("Name is required");
			return false;
		}

		setIsSaving(true);
		const baseUrlRaw = import.meta.env.VITE_API_URL || "";
		const apiRoot = baseUrlRaw.replace(/\/+$/, "");

		try {
			if (!baseUrlRaw) {
				alert('VITE_API_URL is not configured. Set VITE_API_URL to your API base (e.g. http://localhost:5000/api/products)');
				return false;
			}

			const formData = new FormData();

			const appendPayloadToForm = (fd, payload) => {
				for (const [k, v] of Object.entries(payload)) {
					if (v === undefined || v === null || v === "") continue;
					if (k === "isActive") {
						fd.append("isActive", payload.isActive === false ? "0" : "1");
						continue;
					}
					fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
				}
			};

			if (editingId) {
				// sanitize payload: convert empty guid fields to null, numbers to numbers
				const payload = { ...form };
				if (!payload.categoryId || payload.categoryId.toString().trim() === "") payload.categoryId = null;
				if (!payload.supplierId || payload.supplierId.toString().trim() === "") payload.supplierId = null;
				payload.price = payload.price === "" ? null : Number(payload.price || 0);
				payload.cost = payload.cost === "" ? null : Number(payload.cost || 0);
				payload.quantity = payload.quantity === "" ? null : Number(payload.quantity || 0);
				payload.reorderLevel = payload.reorderLevel === "" ? null : Number(payload.reorderLevel || 0);
				payload.taxRate = payload.taxRate === "" ? null : Number(payload.taxRate || 0);
				// backend SQL fallback expects 'is_active' field name
				payload.is_active = payload.isActive === false ? 0 : 1;

				appendPayloadToForm(formData, payload);
				if (imageFile) formData.append('image', imageFile);

				const url = isGuid(editingId) ? `${apiRoot}/${editingId}` : `${apiRoot}?barcode=${encodeURIComponent(editingId)}`;
				const res = await fetch(url, { method: 'PUT', body: formData });
				if (!res.ok) {
					const text = await res.text();
					console.error('Update failed:', res.status, text);
					alert(`Update failed: ${res.status}`);
					return false;
				}
				const updatedRaw = await res.json();
				const updated = normalizeItem(updatedRaw);
				setItems((prev) => prev.map((it) => {
					const matches = (updated && (it.id === updated.id || it.barcode === updated.barcode)) || it.id === editingId || it.barcode === editingId;
					return matches ? { ...it, ...updated } : it;
				}));
			} else {
				// create
				const barcode = generateBarcode();
				const payload = {
					...form,
					price: form.price === "" ? null : Number(form.price || 0),
					cost: form.cost === "" ? null : Number(form.cost || 0),
					quantity: form.quantity === "" ? null : Number(form.quantity || 0),
					reorderLevel: form.reorderLevel === "" ? null : Number(form.reorderLevel || 0),
					taxRate: form.taxRate === "" ? null : Number(form.taxRate || 0),
					barcode,
					categoryId: form.categoryId && form.categoryId.toString().trim() !== "" ? form.categoryId : null,
					supplierId: form.supplierId && form.supplierId.toString().trim() !== "" ? form.supplierId : null,
				};
				// support SQL fallback expecting is_active
				payload.is_active = payload.isActive === false ? 0 : 1;

				appendPayloadToForm(formData, payload);
				if (imageFile) formData.append('image', imageFile);

				const res = await fetch(apiRoot, { method: 'POST', body: formData });
				if (!res.ok) {
					const text = await res.text();
					console.error('Create failed:', res.status, text);
					alert(`Create failed: ${res.status}`);
					return false;
				}
				const createdRaw = await res.json();
				const created = normalizeItem(createdRaw);
				setItems((prev) => [...prev, created]);
			}
			setForm(emptyItem);
			setEditingId(null);
			setPreviewBarcode("");
			setImageFile(null);
			return true;
		} catch (err) {
			console.error("saveItem error", err);
			alert("Network error while saving item. Saved locally.");
			// fallback: save locally
			if (!editingId) {
				const barcode = generateBarcode();
				const newItem = { id: Date.now(), ...form, price: Number(form.price), cost: Number(form.cost), quantity: Number(form.quantity), reorderLevel: Number(form.reorderLevel), taxRate: Number(form.taxRate), barcode };
				setItems((prev) => [...prev, newItem]);
			} else {
				setItems((prev) => prev.map((it) => (it.id === editingId ? { ...it, ...form, price: Number(form.price), cost: Number(form.cost), quantity: Number(form.quantity), reorderLevel: Number(form.reorderLevel), taxRate: Number(form.taxRate) } : it)));
			}
			return false;
		} finally {
			setIsSaving(false);
		}
	};

	const editItem = (id) => {
		const it = items.find((x) => x.id === id);
		if (!it) return;
		setForm({
			name: it.name || "",
			description: it.description || "",
			sku: it.sku || "",
			price: (it.price ?? 0).toString(),
			cost: (it.cost ?? 0).toString(),
			quantity: (it.quantity ?? 0).toString(),
			unit: it.unit || "",
			categoryId: it.categoryId || "",
			supplierId: it.supplierId || "",
			reorderLevel: (it.reorderLevel ?? 0).toString(),
			taxRate: (it.taxRate ?? 0).toString(),
			isActive: !!it.isActive,
			imageUrl: it.imageUrl || it.image_url || "",
		});
		setEditingId(id);
		setShowModal(true);
		setPreviewBarcode(it.barcode || "");
		setImageFile(null); // reset file input
	};

	const deleteItem = async (id) => {
		if (!confirm("Delete this item?")) return;
		const baseUrlRaw = import.meta.env.VITE_API_URL || '';
		if (!baseUrlRaw) {
			alert('VITE_API_URL not set — cannot delete from server');
			return;
		}
		const apiRoot = baseUrlRaw.replace(/\/+$/, "");
		const url = isGuid(id) ? `${apiRoot}/${id}` : `${apiRoot}?barcode=${encodeURIComponent(id)}`;
		try {
			console.debug('DELETE request', url, 'id=', id);
			const res = await fetch(url, { method: 'DELETE' });
			const bodyText = await res.text().catch(() => "");
			let body;
			try { body = bodyText ? JSON.parse(bodyText) : null; } catch(e) { body = bodyText; }
			if (!res.ok) {
				console.error('Delete failed', res.status, body);
				alert(`Delete failed: ${res.status} - ${JSON.stringify(body)}`);
				return;
			}
			console.debug('Delete response', res.status, body);
			setItems((prev) => prev.filter((x) => x.id !== id && x.barcode !== id));
			if (editingId === id) {
				setEditingId(null);
				setForm(emptyItem);
			}
		} catch (err) {
			console.error(err);
			alert('Failed to delete item on server');
		}
	};

	const cancelEdit = () => {
		setEditingId(null);
		setForm(emptyItem);
		setImageFile(null);
	};



	const handlePrint = (item) => {
		setPrintItem(item);
		setTimeout(() => {
			window.print();
			setPrintItem(null);
		}, 300);
	};

	const openAddModal = () => {
		setForm(emptyItem);
		setEditingId(null);
		const code = generateBarcode();
		setPreviewBarcode(code);
		setShowModal(true);
		setImageFile(null);
	};


	const openAdjustModal = (item) => {
		setAdjustItem(item);
		setAdjustDelta(0);
		setAdjustModal(true);
	};

	const openImagePreview = (url, title) => {
		if (!url) return;
		setImagePreviewUrl(url);
		setImagePreviewTitle(title || "");
		setShowImagePreview(true);
	};

	const closeImagePreview = () => {
		setShowImagePreview(false);
		setImagePreviewUrl("");
		setImagePreviewTitle("");
	};

	useEffect(() => {
		if (!showImagePreview) return;
		const onKey = (e) => { if (e.key === 'Escape') closeImagePreview(); };
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [showImagePreview]);

	return (
		<div className="p-8 bg-gray-50 min-h-screen">
			<h2 className="text-3xl font-bold text-gray-800 mb-6">Inventory Management</h2>
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-4">
					<h3 className="text-xl font-semibold text-gray-700">Products</h3>
					<input
						type="search"
						placeholder="Search name, sku, barcode, category, supplier"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="border rounded p-2 w-80"
					/>
				</div>
				<button type="button" onClick={openAddModal} className="bg-green-600 text-white px-4 py-2 rounded">
					Add Product
				</button>

			</div>

			{showModal && (
				<div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
					<div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
						<h3 className="text-xl font-semibold text-green-700 mb-4">{editingId ? "Edit Product" : "Add Product"}</h3>
						<div className="grid grid-cols-2 gap-4">
							<input name="name" value={form.name} onChange={handleChange} placeholder="Name" className="border p-2 rounded" />
							<input name="sku" value={form.sku} onChange={handleChange} placeholder="SKU" className="border p-2 rounded" />
							<input name="unit" value={form.unit} onChange={handleChange} placeholder="Unit (e.g. pcs)" className="border p-2 rounded" />
							<input name="categoryId" value={form.categoryId} onChange={handleChange} placeholder="Category ID" className="border p-2 rounded" />
							<input name="supplierId" value={form.supplierId} onChange={handleChange} placeholder="Supplier ID" className="border p-2 rounded" />
							<input name="quantity" type="number" value={form.quantity} onChange={handleChange} placeholder="Quantity" className="border p-2 rounded" />
							<input name="price" type="number" step="0.01" value={form.price} onChange={handleChange} placeholder="Price" className="border p-2 rounded" />
							<input name="cost" type="number" step="0.01" value={form.cost} onChange={handleChange} placeholder="Cost" className="border p-2 rounded" />
							<input name="reorderLevel" type="number" value={form.reorderLevel} onChange={handleChange} placeholder="Reorder Level" className="border p-2 rounded" />
							<input name="taxRate" type="number" step="0.01" value={form.taxRate} onChange={handleChange} placeholder="Tax Rate (%)" className="border p-2 rounded" />
							<textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" className="border p-2 rounded col-span-2" />
							<label className="flex items-center col-span-2">
								<input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} className="mr-2" />
								Active
							</label>
							<div className="col-span-2">
								<label className="block text-sm font-medium text-gray-700 mb-1">Item Image</label>
								<input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} className="border p-2 rounded w-full" />
								{form.imageUrl && (
									<div className="mt-2">
										<p className="text-sm text-gray-600">Current Image:</p>
										<img src={form.imageUrl} alt="current item" className="max-w-xs max-h-32 object-cover border rounded cursor-pointer" onClick={() => openImagePreview(form.imageUrl, form.name)} />
									</div>
								)}

							{/* Global image preview modal (renders regardless of add/edit modal) */}
							{showImagePreview && (
								<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={closeImagePreview}>
									<div className="relative bg-white rounded p-4 max-w-3xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
										<button onClick={closeImagePreview} className="absolute top-2 right-2 bg-gray-200 hover:bg-gray-300 rounded-full p-2">✕</button>
										{imagePreviewTitle && <h4 className="text-lg font-semibold mb-2">{imagePreviewTitle}</h4>}
										<img src={imagePreviewUrl} alt={imagePreviewTitle || 'Preview'} className="w-full h-auto max-h-[80vh] object-contain" />
									</div>
								</div>
							)}
								{imageFile && (
									<div className="mt-2">
										<p className="text-sm text-gray-600">New Image Preview:</p>
										<img src={URL.createObjectURL(imageFile)} alt="preview" className="max-w-xs max-h-32 object-cover border rounded" />
									</div>
								)}
							</div>
						</div>
						<div className="mt-4 flex justify-end">
							<button type="button"
								onClick={async () => {
									const ok = await saveItem();
									if (ok) setShowModal(false);
								}}
								disabled={isSaving}
								className="bg-green-600 text-white px-4 py-2 rounded mr-2 disabled:opacity-60"
							>
								{isSaving ? "Saving..." : editingId ? "Update" : "Add"}
							</button>
							<button type="button"
								onClick={() => {
									cancelEdit();
									setShowModal(false);
								}}
								className="bg-gray-300 text-gray-800 px-4 py-2 rounded"
							>
								Cancel
							</button>
						</div>
					</div>
					{/* barcode preview */}
					{previewBarcode && (
						<div className="mt-4">
							<p className="text-sm text-gray-600 mb-2">Barcode preview:</p>
							<div>
								<Barcode value={previewBarcode} format="CODE128" height={50} displayValue={true} />
							</div>
						</div>
					)}

					{/* Image preview modal (click thumbnail to open) */}

					{/* barcode preview */}




					{/* printable area - visible only while printing */}
					{printItem && (
						<>
							<style>{`@media print{body *{visibility:hidden;} #print-area, #print-area *{visibility:visible;} #print-area{position:relative;left:0;top:0;margin:0;padding:20px}}`}</style>
							<div id="print-area" style={{ padding: 20, background: '#fff' }}>
								<div style={{ textAlign: 'center' }}>
									<h2 style={{ marginBottom: 8 }}>{printItem.name}</h2>
									<div style={{ display: 'inline-block' }}>
										<Barcode value={printItem.barcode} format="CODE128" height={80} displayValue={true} />
									</div>
									<p style={{ marginTop: 8 }}>{printItem.sku || ''}</p>
								</div>
							</div>
						</>
					)}
				</div>
			)}

			{/* Independent Adjust stock modal — render outside Add/Edit modal so it can open anytime */}
			{adjustModal && (
				<div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
					<div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6">
						<h3 className="text-lg font-semibold mb-3">Adjust Stock</h3>
						{adjustItem && <p className="text-sm text-gray-700 mb-2">Product: {adjustItem.name} ({adjustItem.sku || adjustItem.barcode})</p>}
						<input
							type="number"
							value={adjustDelta}
							onChange={(e) => setAdjustDelta(Number(e.target.value))}
							className="border p-2 rounded w-full mb-3"
							placeholder="Delta (use negative for decrease)"
						/>
						{adjustError && <p className="text-red-500 text-sm mb-2">{adjustError}</p>}
						<div className="flex justify-end gap-2">
							<button type="button"
								onClick={async () => {
									setAdjustError("");
									if (!adjustItem) return;
									const baseUrlRaw = import.meta.env.VITE_API_URL || "";
									if (!baseUrlRaw) { setAdjustError('VITE_API_URL not configured'); return; }
									const apiRoot = baseUrlRaw.replace(/\/+$/, "");
									const payload = { delta: Number(adjustDelta) };
									if (isGuid(adjustItem.id)) payload.id = adjustItem.id; else payload.barcode = adjustItem.barcode;
									try {
										const res = await fetch(`${apiRoot}/adjust-stock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
										const json = await res.json().catch(() => null);
										if (!res.ok) { setAdjustError(json && json.error ? json.error : `Server ${res.status}`); return; }
										// update local list with returned product
										if (json) {
											setItems((prev) => prev.map((it) => (it.id === json.id || it.barcode === json.barcode ? { ...it, ...json } : it)));
										}
										setAdjustModal(false);
									} catch (err) {
										console.error('Adjust stock failed', err);
										setAdjustError('Network error');
									}
								}}
								className="bg-green-600 text-white px-3 py-1 rounded"
							>
								Apply
							</button>
							<button type="button" onClick={() => setAdjustModal(false)} className="bg-gray-300 px-3 py-1 rounded">Cancel</button>
						</div>
					</div>
				</div>
			)}

			<div className="bg-white rounded-lg shadow-md p-6">
				<h3 className="text-xl font-semibold text-gray-700 mb-4">Products</h3>
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
					<div className="flex items-center gap-2">
						<select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="border p-2 rounded">
							<option value="">All categories</option>
							{categories.map((c) => (
								<option key={c} value={c}>{c}</option>
							))}
						</select>
						<select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="border p-2 rounded">
							<option value="">All suppliers</option>
							{suppliers.map((s) => (
								<option key={s} value={s}>{s}</option>
							))}
						</select>
						<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border p-2 rounded">
							<option value="">All status</option>
							<option value="active">Active</option>
							<option value="inactive">Inactive</option>
						</select>
						<button onClick={() => { setCategoryFilter(""); setSupplierFilter(""); setStatusFilter(""); setSearch(""); }} className="bg-gray-200 px-3 py-1 rounded">Reset</button>
					</div>
					<div className="flex items-center gap-2">
						<label className="text-sm text-gray-600">Page size:</label>
						<select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="border p-2 rounded">
							<option value={5}>5</option>
							<option value={10}>10</option>
							<option value={25}>25</option>
							<option value={50}>50</option>
						</select>
					</div>
				</div>
				{items.length === 0 ? (
					<p className="text-gray-500">No products yet.</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full border-collapse">
							<thead>
								<tr className="bg-green-100 text-left">
									<th className="p-2 border">Image</th>
									<th className="p-2 border">Name</th>
									<th className="p-2 border">SKU</th>
									<th className="p-2 border">Qty</th>
									<th className="p-2 border">Price</th>
									<th className="p-2 border">Cost</th>
									<th className="p-2 border">Barcode</th>
									<th className="p-2 border">Status</th>
									<th className="p-2 border text-center">Actions</th>
								</tr>
							</thead>
							<tbody>
								{pagedItems.map((it) => (
									<tr key={it.id} className="hover:bg-gray-50">
										<td className="p-2 border">{(it.imageUrl || it.image_url) ? (
											<img
												src={it.imageUrl || it.image_url}
												alt={it.name || 'item'}
												width="50"
												height="50"
												className="object-cover rounded cursor-pointer"
												onClick={() => openImagePreview(it.imageUrl || it.image_url, it.name)}
											/>
										) : 'No image'}</td>
										<td className="p-2 border">{it.name}</td>
										<td className="p-2 border">{it.sku}</td>
										<td className="p-2 border">{it.quantity}</td>
										<td className="p-2 border">{it.price}</td>
										<td className="p-2 border">{it.cost}</td>
										<td className="p-2 border">
											<div className="flex flex-col items-start">
												<Barcode value={it.barcode} format="CODE128" height={40} displayValue={false} />
												<span className="text-xs text-gray-600 mt-1">{it.barcode}</span>
											</div>
										</td>
										<td className="p-2 border">{it.isActive ? "Active" : "Inactive"}</td>
										<td className="p-2 border text-center">
											<button type="button" onClick={() => editItem(it.id)} className="bg-blue-500 text-white px-2 py-1 rounded mr-2">Edit</button>
											<button type="button" onClick={() => deleteItem(it.id)} className="bg-red-500 text-white px-2 py-1 rounded mr-2">Delete</button>
											<button type="button" onClick={() => openAdjustModal(it)} className="bg-yellow-500 text-white px-2 py-1 rounded mr-2">Adjust</button>

											<button type="button" onClick={() => handlePrint(it)} className="bg-purple-600 text-white px-2 py-1 rounded">Print Sticker</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
						{/* pagination controls */}
						<div className="mt-3 flex items-center justify-between">
							<div className="text-sm text-gray-600">Showing {filtered.length === 0 ? 0 : startIndex + 1}–{endIndex} of {filtered.length}</div>
							<div className="flex items-center gap-2">
								<button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50">Prev</button>
								<span className="text-sm">Page {page} / {totalPages}</span>
								<button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50">Next</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default InventoryPage;
