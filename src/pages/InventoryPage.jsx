import React, { useEffect, useState } from "react";
import Barcode from "react-barcode";
import PrintSticker from "../components/PrintSticker";

const emptyItem = {
	name: "",
	description: "",
	sku: "",
	barcode: "",
	price: "",
	cost: "",
	quantity: "",
	unit: "",
	categoryId: "",
	supplierId: "",
	brandId: "",
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
	const [showPrintModal, setShowPrintModal] = useState(false);
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

	// brand state for dropdown + create modal
	const [brands, setBrands] = useState([]);
	const [brandsLoading, setBrandsLoading] = useState(false);
	const [showCreateBrandModal, setShowCreateBrandModal] = useState(false);
	const [newBrandForm, setNewBrandForm] = useState({ name: '', description: '', website: '', isActive: true });

	// category state for dropdown + create modal
	const [categoryList, setCategoryList] = useState([]);
	const [categoriesLoading, setCategoriesLoading] = useState(false);
	const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
	const [newCategoryForm, setNewCategoryForm] = useState({ name: '', description: '', isActive: true });

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

		// also load brands for the brand dropdown
		loadBrands();
		// also load categories
		loadCategories();
		return () => (mounted = false);
	}, []);

	const loadCategories = async () => {
		const envBase = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
		const baseUrlRaw = import.meta.env.VITE_API_URL || '';
		const baseWithoutProducts = baseUrlRaw.replace(/\/products\/?$/, '').replace(/\/+$/, '');
		const candidates = envBase ? [envBase + '/api/categories', envBase + '/categories'] : [baseWithoutProducts + '/categories', baseWithoutProducts + '/api/categories'];
		setCategoriesLoading(true);
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
		if (!res) { setCategoriesLoading(false); return; }
		if (!res.ok) { setCategoriesLoading(false); return; }
		try {
			const json = await res.json();
			const items = Array.isArray(json) ? json : (json.data || json);
			setCategoryList(items || []);
		} catch (e) {
			console.error('Failed to parse categories', e);
		} finally { setCategoriesLoading(false); }
	};

	const loadBrands = async () => {
		// derive brand endpoints from env
		const envBase = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
		const baseUrlRaw = import.meta.env.VITE_API_URL || '';
		const baseWithoutProducts = baseUrlRaw.replace(/\/products\/?$/, '').replace(/\/+$/, '');
		const candidates = envBase ? [envBase + '/api/brands', envBase + '/brands'] : [baseWithoutProducts + '/brands', baseWithoutProducts + '/api/brands'];
		setBrandsLoading(true);
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
		if (!res) { setBrandsLoading(false); return; }
		if (!res.ok) { setBrandsLoading(false); return; }
		try {
			const json = await res.json();
			const items = Array.isArray(json) ? json : (json.data || json);
			setBrands(items || []);
		} catch (e) {
			console.error('Failed to parse brands', e);
		} finally { setBrandsLoading(false); }
	};

	// create a brand via API and add to brands list
	const createBrandSubmit = async (e) => {
		e && e.preventDefault();
		if (!newBrandForm || !newBrandForm.name || !newBrandForm.name.trim()) {
			alert('Brand name is required');
			return;
		}
		setBrandsLoading(true);
		try {
			const envBase = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
			const baseUrlRaw = import.meta.env.VITE_API_URL || '';
			const baseWithoutProducts = baseUrlRaw.replace(/\/products\/?$/, '').replace(/\/+$/, '');
			const candidates = envBase ? [envBase + '/api/brands', envBase + '/brands'] : [baseWithoutProducts + '/brands', baseWithoutProducts + '/api/brands'];
			let res;
			for (const u of candidates) {
				try {
					res = await fetch(u, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
						body: JSON.stringify(newBrandForm),
					});
					if (res.status === 404) continue;
					break;
				} catch (err) {
					// try next
				}
			}
			if (!res) { throw new Error('No brand endpoint available'); }
			if (!res.ok) {
				const txt = await res.text().catch(() => '');
				throw new Error(txt || `HTTP ${res.status}`);
			}
			const created = await res.json();
			const added = Array.isArray(created) ? created[0] : (created.data || created || null);
			if (added) {
				setBrands((prev) => (prev ? [...prev, added] : [added]));
				// select newly created brand in the main form
				setForm((f) => ({ ...f, brandId: added.id || added.ID || added.id }));
			}
			setShowCreateBrandModal(false);
			setNewBrandForm({ name: '', description: '', website: '', isActive: true });
		} catch (err) {
			console.error('Create brand failed', err);
			alert('Failed to create brand: ' + (err.message || err));
		} finally {
			setBrandsLoading(false);
		}
	};

	// create a category via API and add to categoryList
	const createCategorySubmit = async (e) => {
		e && e.preventDefault();
		if (!newCategoryForm || !newCategoryForm.name || !newCategoryForm.name.trim()) {
			alert('Category name is required');
			return;
		}
		setCategoriesLoading(true);
		try {
			const envBase = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
			const baseUrlRaw = import.meta.env.VITE_API_URL || '';
			const baseWithoutProducts = baseUrlRaw.replace(/\/products\/?$/, '').replace(/\/+$/, '');
			const candidates = envBase ? [envBase + '/api/categories', envBase + '/categories'] : [baseWithoutProducts + '/categories', baseWithoutProducts + '/api/categories'];
			let res;
			for (const u of candidates) {
				try {
					res = await fetch(u, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
						body: JSON.stringify(newCategoryForm),
					});
					if (res.status === 404) continue;
					break;
				} catch (err) {
					// try next
				}
			}
			if (!res) { throw new Error('No category endpoint available'); }
			if (!res.ok) {
				const txt = await res.text().catch(() => '');
				throw new Error(txt || `HTTP ${res.status}`);
			}
			const created = await res.json();
			const added = Array.isArray(created) ? created[0] : (created.data || created || null);
			if (added) {
				setCategoryList((prev) => (prev ? [...prev, added] : [added]));
				// select newly created category in the main form
				setForm((f) => ({ ...f, categoryId: added.id || added.ID || added.id }));
			}
			setShowCreateCategoryModal(false);
			setNewCategoryForm({ name: '', description: '', isActive: true });
		} catch (err) {
			console.error('Create category failed', err);
			alert('Failed to create category: ' + (err.message || err));
		} finally {
			setCategoriesLoading(false);
		}
	};

	const handleChange = (e) => {
		const { name, value, type, checked } = e.target;
		setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
		// if brand selection chooses to create new
		if (name === 'brandId' && value === '__new__') {
			setShowCreateBrandModal(true);
			setForm((f) => ({ ...f, brandId: '' }));
		}
		// if category selection chooses to create new
		if (name === 'categoryId' && value === '__new__') {
			setShowCreateCategoryModal(true);
			setForm((f) => ({ ...f, categoryId: '' }));
		}
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
		const existing = new Set(items.map((i) => String(i.barcode || "")));
		let attempts = 0;
		while (existing.has(String(code)) && attempts < 50) {
			code = make();
			attempts += 1;
		}
		// update preview and form so the UI reflects the generated code immediately
		try {
			setPreviewBarcode(code);
			setForm((f) => ({ ...f, barcode: code }));
		} catch (e) {
			// ignore if states not ready
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
			// include brand name in search (lookup from it.brand or brands list)
			let brandName = "";
			if (it.brand && (it.brand.name || it.brand.title)) brandName = (it.brand.name || it.brand.title);
			else {
				const id = it.brand && (it.brand.id || it.brand.ID) || it.brandId || it.brand_id;
				if (id) {
					const found = brands.find((b) => String(b.id || b.ID) === String(id));
					if (found) brandName = found.name || found.title || "";
				}
			}

			const matched = (
				(it.name || "").toString().toLowerCase().includes(q) ||
				(it.sku || "").toString().toLowerCase().includes(q) ||
				(it.barcode || "").toString().toLowerCase().includes(q) ||
				(it.categoryId || "").toString().toLowerCase().includes(q) ||
				(it.supplierId || "").toString().toLowerCase().includes(q) ||
				(brandName || "").toString().toLowerCase().includes(q)
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
	// use loaded categoryList for category filter options (falls back to ids when missing)
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

	// low stock detection (qty < 3)
	const [lowItems, setLowItems] = useState([]);
	useEffect(() => {
		const low = items.filter((i) => {
			const q = Number(i?.quantity);
			return !Number.isNaN(q) && q < 3;
		});
		if (low.length) {
			setLowItems(low);
			// show a browser alert once per detection
			try {
				const names = low.map((it) => `${it.name || it.sku || it.id} (${it.quantity})`).join(', ');
				alert(`Low stock alert: ${low.length} item(s) low on quantity: ${names}`);
			} catch (e) {
				// ignore alert errors in non-browser environments
			}
		} else {
			setLowItems([]);
		}
	}, [items]);

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
				const barcode = (form.barcode && String(form.barcode).trim()) ? form.barcode : generateBarcode();
				if (form.barcode && String(form.barcode).trim()) setPreviewBarcode(form.barcode);
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
				barcode: it.barcode || "",
				price: (it.price ?? 0).toString(),
				cost: (it.cost ?? 0).toString(),
				quantity: (it.quantity ?? 0).toString(),
				unit: it.unit || "",
				// support category as an object or id field (category, categoryId, category_id)
				categoryId: (it.category && (it.category.id || it.category.ID)) ? String(it.category.id || it.category.ID) : (it.categoryId || it.category_id || ""),
				supplierId: it.supplierId || "",
				brandId: it.brand && it.brand.id ? it.brand.id : (it.brandId || it.brand_id || ""),
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
		setShowPrintModal(true);
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
			<div className="max-w-7xl mx-auto w-full">
				<h2 className="text-3xl font-extrabold text-gray-900 mb-6">Inventory Management</h2>
			</div>
				{lowItems.length > 0 && (
					<div className="max-w-7xl mx-auto w-full mb-4">
						<div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-800">
							<strong>Low stock alert:</strong> {lowItems.length} item(s) low on quantity — {lowItems.map((it) => (it.name || it.sku || it.id) + ` (${it.quantity})`).join(', ')}
						</div>
					</div>
				)}
			<div className="max-w-7xl mx-auto w-full mb-6">
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
					<div className="flex items-center gap-4">
					<h3 className="text-xl font-semibold text-gray-700">Products</h3>
						<input
							type="search"
							placeholder="Search name, sku, barcode, category, supplier"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="w-80 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
						/>
				</div>
					<button type="button" onClick={openAddModal} className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow">
						<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
						<span>Add Product</span>
						</button>
						</div>
					</div>

			{showModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 overflow-y-auto py-12">
					<div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[85vh] overflow-auto ring-1 ring-black/5">
						<h3 className="text-xl font-semibold text-green-700 mb-4">{editingId ? "Edit Product" : "Add Product"}</h3>
						<div className="space-y-4">
							{/* each row: label left, input right */}
							<div className="grid grid-cols-3 items-center gap-4">
								<label className="text-sm font-medium text-gray-700">Name</label>
								<div className="col-span-2">
									<input name="name" value={form.name} onChange={handleChange} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
								</div>
							</div>
							<div className="grid grid-cols-3 items-center gap-4">
								<label className="text-sm font-medium text-gray-700">SKU</label>
								<div className="col-span-2">
									<input name="sku" value={form.sku} onChange={handleChange} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
								</div>
							</div>
							{/* Barcode input: allow generate or scan/paste a barcode */}
							<div className="grid grid-cols-3 items-center gap-4">
								<label className="text-sm font-medium text-gray-700">Barcode</label>
								<div className="col-span-2 flex items-center gap-2">
									<input name="barcode" value={form.barcode || ""} onChange={handleChange} className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
									<button type="button" onClick={() => { const code = generateBarcode(); setPreviewBarcode(code); }} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm">Generate</button>
									<button type="button" onClick={() => { const scanned = window.prompt('Scan or enter barcode:'); if (scanned) { setForm((f) => ({ ...f, barcode: scanned })); setPreviewBarcode(scanned); } }} className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-md text-sm">Scan</button>
								</div>
							</div>
							<div className="grid grid-cols-3 items-center gap-4">
								<label className="text-sm font-medium text-gray-700">Unit</label>
								<div className="col-span-2">
									<input name="unit" value={form.unit} onChange={handleChange} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
								</div>
							</div>
							<div className="grid grid-cols-3 items-center gap-4">
								<label className="text-sm font-medium text-gray-700">Category</label>
								<div className="col-span-2">
									<select name="categoryId" value={form.categoryId} onChange={handleChange} className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500">
										<option value="">No category</option>
										{categoryList.map((c) => (
											<option key={c.id || c.ID} value={c.id || c.ID}>{c.name}</option>
										))}
										<option value="__new__">+ Create new category...</option>
									</select>
								</div>
							</div>
							<div className="grid grid-cols-3 items-center gap-4">
								<label className="text-sm font-medium text-gray-700">Supplier ID</label>
								<div className="col-span-2">
									<input name="supplierId" value={form.supplierId} onChange={handleChange} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
								</div>
							</div>
							<div className="grid grid-cols-3 items-center gap-4">
								<label className="text-sm font-medium text-gray-700">Brand</label>
								<div className="col-span-2">
									<select name="brandId" value={form.brandId} onChange={handleChange} className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500">
										<option value="">No brand</option>
										{brands.map((b) => (
											<option key={b.id || b.ID} value={b.id || b.ID}>{b.name}</option>
										))}
										<option value="__new__">+ Create new brand...</option>
									</select>
								</div>
							</div>
							<div className="grid grid-cols-3 items-center gap-4">
								<label className="text-sm font-medium text-gray-700">Quantity</label>
								<div className="col-span-2">
									<input name="quantity" type="number" value={form.quantity} onChange={handleChange} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
								</div>
							</div>
							<div className="grid grid-cols-3 items-center gap-4">
								<label className="text-sm font-medium text-gray-700">Price</label>
								<div className="col-span-2">
									<input name="price" type="number" step="0.01" value={form.price} onChange={handleChange} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
								</div>
							</div>
							<div className="grid grid-cols-3 items-center gap-4">
								<label className="text-sm font-medium text-gray-700">Cost</label>
								<div className="col-span-2">
									<input name="cost" type="number" step="0.01" value={form.cost} onChange={handleChange} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
								</div>
							</div>
							<div className="grid grid-cols-3 items-center gap-4">
								<label className="text-sm font-medium text-gray-700">Reorder Level</label>
								<div className="col-span-2">
									<input name="reorderLevel" type="number" value={form.reorderLevel} onChange={handleChange} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
								</div>
							</div>
							<div className="grid grid-cols-3 items-center gap-4">
								<label className="text-sm font-medium text-gray-700">Tax Rate (%)</label>
								<div className="col-span-2">
									<input name="taxRate" type="number" step="0.01" value={form.taxRate} onChange={handleChange} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
								</div>
							</div>
							<div className="grid grid-cols-3 items-start gap-4">
								<label className="text-sm font-medium text-gray-700 pt-2">Description</label>
								<div className="col-span-2">
									<textarea name="description" value={form.description} onChange={handleChange} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white shadow-sm h-28 focus:outline-none focus:ring-2 focus:ring-green-500" />
								</div>
							</div>
							<div className="grid grid-cols-3 items-center gap-4">
								<label className="text-sm font-medium text-gray-700">Active</label>
								<div className="col-span-2 flex items-center gap-4">
									<input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} className="mr-2 h-4 w-4 text-green-600 rounded border-gray-200" />
									<div className="flex-1">
										<label className="block text-sm font-medium text-gray-700 mb-1">Item Image</label>
										<input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white shadow-sm" />
										{form.imageUrl && (
											<div className="mt-2">
												<p className="text-sm text-gray-600">Current Image:</p>
												<img src={form.imageUrl} alt="current item" className="max-w-xs max-h-32 object-cover border rounded cursor-pointer" onClick={() => openImagePreview(form.imageUrl, form.name)} />
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
							</div>
						</div>
						<div className="mt-4 flex justify-end gap-3">
							<button type="button"
								onClick={async () => {
									const ok = await saveItem();
									if (ok) setShowModal(false);
								}}
								disabled={isSaving}
								className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow disabled:opacity-60"
							>
								{isSaving ? "Saving..." : editingId ? "Update" : "Add"}
							</button>
							<button type="button"
								onClick={() => {
									cancelEdit();
									setShowModal(false);
								}}
								className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
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



					{/* barcode preview */}




					{/* Print sticker preview modal handled by component (moved outside Add/Edit modal) */}
				</div>
			)}

									{/* Image preview modal (click thumbnail to open) */}
			{showImagePreview && (
				<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={closeImagePreview}>
					<div className="p-4 max-w-[95vw] max-h-[90vh] bg-transparent" onClick={(e) => e.stopPropagation()}>
						<img src={imagePreviewUrl} alt={imagePreviewTitle} className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl" />
						{imagePreviewTitle && <p className="text-white text-center mt-3 text-sm">{imagePreviewTitle}</p>}
						<div className="mt-3 flex justify-center">
							<button onClick={closeImagePreview} className="bg-gray-800 text-white px-4 py-2 rounded-md">Close</button>
						</div>
					</div>
				</div>
			)}

			{/* Global print sticker modal (renders independently) */}
			<PrintSticker item={printItem} show={showPrintModal} onClose={() => { setShowPrintModal(false); setPrintItem(null); }} />

			{/* Create Brand modal (can be opened from Brand select) */}
			{showCreateBrandModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-60 overflow-y-auto py-12">
					<div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[80vh] overflow-auto ring-1 ring-black/5">
						<h3 className="text-lg font-semibold mb-3">Create Brand</h3>
						<form onSubmit={createBrandSubmit}>
							<div className="grid grid-cols-1 gap-3">
								<label className="block text-sm font-medium text-gray-700">Name</label>
								<input value={newBrandForm.name} onChange={(e) => setNewBrandForm((s) => ({ ...s, name: e.target.value }))} className="border p-2 rounded w-full" />
								<label className="block text-sm font-medium text-gray-700">Description</label>
								<textarea value={newBrandForm.description} onChange={(e) => setNewBrandForm((s) => ({ ...s, description: e.target.value }))} className="border p-2 rounded w-full h-24" />
								<label className="block text-sm font-medium text-gray-700">Website</label>
								<input value={newBrandForm.website} onChange={(e) => setNewBrandForm((s) => ({ ...s, website: e.target.value }))} className="border p-2 rounded w-full" />
								<label className="flex items-center gap-2">
									<input type="checkbox" checked={newBrandForm.isActive} onChange={(e) => setNewBrandForm((s) => ({ ...s, isActive: e.target.checked }))} />
									<span className="text-sm">Active</span>
								</label>
							</div>
							<div className="mt-4 flex justify-end gap-2">
								<button type="submit" className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md" disabled={brandsLoading}>{brandsLoading ? 'Saving...' : 'Create'}</button>
								<button type="button" onClick={() => { setShowCreateBrandModal(false); setNewBrandForm({ name: '', description: '', website: '', isActive: true }); }} className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md">Cancel</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Create Category modal (can be opened from Category select) */}
			{showCreateCategoryModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-60 overflow-y-auto py-12">
					<div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[80vh] overflow-auto ring-1 ring-black/5">
						<h3 className="text-lg font-semibold mb-3">Create Category</h3>
						<form onSubmit={createCategorySubmit}>
							<div className="grid grid-cols-1 gap-3">
								<label className="block text-sm font-medium text-gray-700">Name</label>
								<input value={newCategoryForm.name} onChange={(e) => setNewCategoryForm((s) => ({ ...s, name: e.target.value }))} className="border p-2 rounded w-full" />
								<label className="block text-sm font-medium text-gray-700">Description</label>
								<textarea value={newCategoryForm.description} onChange={(e) => setNewCategoryForm((s) => ({ ...s, description: e.target.value }))} className="border p-2 rounded w-full h-24" />
								<label className="flex items-center gap-2">
									<input type="checkbox" checked={newCategoryForm.isActive} onChange={(e) => setNewCategoryForm((s) => ({ ...s, isActive: e.target.checked }))} />
									<span className="text-sm">Active</span>
								</label>
							</div>
							<div className="mt-4 flex justify-end gap-2">
								<button type="submit" className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md" disabled={categoriesLoading}>{categoriesLoading ? 'Saving...' : 'Create'}</button>
								<button type="button" onClick={() => { setShowCreateCategoryModal(false); setNewCategoryForm({ name: '', description: '', isActive: true }); }} className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md">Cancel</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Independent Adjust stock modal — render outside Add/Edit modal so it can open anytime */}
			{adjustModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 overflow-y-auto py-12">
					<div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 max-h-[70vh] overflow-auto ring-1 ring-black/5">
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

			<div className="max-w-7xl mx-auto w-full bg-white rounded-xl shadow-lg p-6">
				<h3 className="text-xl font-semibold text-gray-800 mb-4">Products</h3>
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
					<div className="flex items-center gap-2">
						<select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm">
							<option value="">All categories</option>
							{categoryList.map((c) => (
								<option key={c.id || c.ID} value={c.id || c.ID}>{c.name}</option>
							))}
						</select>
						<select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm">
							<option value="">All suppliers</option>
							{suppliers.map((s) => (
								<option key={s} value={s}>{s}</option>
							))}
						</select>
						<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm">
							<option value="">All status</option>
							<option value="active">Active</option>
							<option value="inactive">Inactive</option>
						</select>
						<button onClick={() => { setCategoryFilter(""); setSupplierFilter(""); setStatusFilter(""); setSearch(""); }} className="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-md text-sm">Reset</button>
					</div>
					<div className="flex items-center gap-2">
						<label className="text-sm text-gray-600">Page size:</label>
						<select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm">
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
						<div className="overflow-hidden border border-gray-100 rounded-lg">
							<table className="min-w-full divide-y divide-gray-200">
								<thead className="bg-gray-50">
									<tr>
										<th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Image</th>
										<th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Name</th>
										<th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-700">SKU</th>
										<th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Qty</th>
										<th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Price</th>
										<th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Cost</th>
										<th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Category</th>
										<th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Brand</th>
										<th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
										<th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Actions</th>
									</tr>
								</thead>
								<tbody className="bg-white divide-y divide-gray-100">
									{pagedItems.map((it) => (
										<tr key={it.id} className="hover:bg-gray-50">
											<td className="px-4 py-3">
												{(it.imageUrl || it.image_url) ? (
													<img
														src={it.imageUrl || it.image_url}
														alt={it.name || 'item'}
														width="48"
														height="48"
														className="object-cover rounded-md cursor-pointer shadow-sm"
														onClick={() => openImagePreview(it.imageUrl || it.image_url, it.name)}
													/>
												) : (
													<div className="text-sm text-gray-400">No image</div>
												)}
											</td>
											<td className="px-4 py-3 text-sm text-gray-800">{it.name}</td>
											<td className="px-4 py-3 text-sm text-gray-600">{it.sku}</td>
											<td className={"px-4 py-3 text-sm " + (Number(it.quantity) < 3 ? 'text-red-600 font-bold' : 'text-gray-800')}>{it.quantity}</td>
											<td className="px-4 py-3 text-sm text-gray-800">{it.price}</td>
											<td className="px-4 py-3 text-sm text-gray-800">{it.cost}</td>
											<td className="px-4 py-3 text-sm text-gray-700">{(() => {
												const cid = it.categoryId || it.category_id || it.CategoryId || it.Category;
												if (!cid) return 'No category';
												const c = categoryList.find((x) => String(x.id || x.ID) === String(cid));
												return c ? c.name : cid;
											})()}</td>
											<td className="px-4 py-3 text-sm text-gray-700">{(() => {
												const id = (it.brand && (it.brand.id || it.brand.ID)) || it.brandId || it.brand_id;
												if (!id) return 'No brand';
												const found = brands.find((b) => String(b.id || b.ID) === String(id));
												return found ? found.name : id;
											})()}</td>
											<td className="px-4 py-3 text-sm text-gray-700">{it.isActive ? "Active" : "Inactive"}</td>
											<td className="px-4 py-3 text-center space-x-2">
												<button type="button" onClick={() => editItem(it.id)} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm">Edit</button>
												<button type="button" onClick={() => deleteItem(it.id)} className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm">Delete</button>
												<button type="button" onClick={() => openAdjustModal(it)} className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm">Adjust</button>
												<button type="button" onClick={() => handlePrint(it)} className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-md text-sm">Print</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
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
