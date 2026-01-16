import React, { useState } from 'react';

const mockProducts = [
  { id: 1, name: 'Espresso', price: 2.5, sku: 'ESP-01' },
  { id: 2, name: 'Cappuccino', price: 3.0, sku: 'CAP-02' },
  { id: 3, name: 'Latte', price: 3.5, sku: 'LAT-03' },
  { id: 4, name: 'Blueberry Muffin', price: 2.75, sku: 'MUF-04' },
  { id: 5, name: 'Bagel', price: 1.8, sku: 'BAG-05' },
  { id: 6, name: 'Scone', price: 2.2, sku: 'SCO-06' },
  { id: 7, name: 'Bottled Water', price: 1.0, sku: 'WTR-07' },
  { id: 8, name: 'Sandwich', price: 5.5, sku: 'SND-08' },
];

const POSPage = () => {
  const [products] = useState(mockProducts);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [keypadValue, setKeypadValue] = useState('');

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) || p.sku.toLowerCase().includes(query.toLowerCase())
  );

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

  function removeFromCart(id) {
    setCart(prev => prev.filter(i => i.id !== id));
  }

  const subtotal = cart.reduce((s, it) => s + it.price * it.qty, 0);
  const tax = +(subtotal * 0.07).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);

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

  function handleCheckout() {
    setShowCheckout(true);
  }

  function confirmPayment() {
    // In a real app, this would call backend/payment API
    alert(`Payment received. Total: $${total.toFixed(2)}`);
    setCart([]);
    setShowCheckout(false);
  }

  return (
    <div className="p-6 h-screen flex flex-col">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Point of Sale</h1>
          <p className="text-sm text-gray-500">Quick sales — fast checkout</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-3 py-1 bg-indigo-600 text-white rounded">New Order</button>
          <div className="text-sm text-gray-600">Items: {cart.reduce((c, i) => c + i.qty, 0)}</div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-4">
        <main className="col-span-8 bg-white rounded shadow p-4 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search products or SKU"
              className="flex-1 border rounded px-3 py-2"
            />
            <div className="w-40 text-right text-sm text-gray-600">Found: {filtered.length}</div>
          </div>

          <div className="grid grid-cols-3 gap-3 overflow-auto">
            {filtered.map(p => (
              <div key={p.id} className="border rounded p-3 flex flex-col justify-between">
                <div>
                  <div className="h-28 bg-gray-100 rounded mb-2 flex items-center justify-center text-gray-400">Image</div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.sku}</div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-lg font-semibold">${p.price.toFixed(2)}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => addToCart(p)} className="px-2 py-1 bg-green-600 text-white rounded">Add</button>
                    <button onClick={() => applyKeypadQty(p)} className="px-2 py-1 bg-blue-600 text-white rounded">Qty</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>

        <aside className="col-span-4 bg-gray-50 rounded shadow p-4 flex flex-col">
          <h2 className="font-semibold text-lg mb-2">Cart</h2>
          <div className="flex-1 overflow-auto">
            {cart.length === 0 ? (
              <div className="text-sm text-gray-500">Cart is empty</div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="border-b py-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-gray-500">${item.price.toFixed(2)} • {item.sku}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => changeQty(item.id, item.qty - 1)} className="px-2 bg-gray-200 rounded">-</button>
                    <div className="w-8 text-center">{item.qty}</div>
                    <button onClick={() => changeQty(item.id, item.qty + 1)} className="px-2 bg-gray-200 rounded">+</button>
                    <button onClick={() => removeFromCart(item.id)} className="ml-2 text-red-500">✕</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm text-gray-600"><span>Tax</span><span>${tax.toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold text-lg mt-2"><span>Total</span><span>${total.toFixed(2)}</span></div>

            <div className="mt-3 flex gap-2">
              <button onClick={handleCheckout} disabled={cart.length===0} className="flex-1 py-2 bg-indigo-600 text-white rounded disabled:opacity-50">Checkout</button>
              <button onClick={() => { setCart([]); }} className="px-3 py-2 bg-red-100 text-red-600 rounded">Clear</button>
            </div>
          </div>
        </aside>
      </div>

      <footer className="mt-4">
        <div className="bg-white rounded shadow p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">Keypad:</div>
            <div className="grid grid-cols-5 gap-2">
              {['1','2','3','4','5','6','7','8','9','0','C','←'].map(k => (
                <button key={k} onClick={() => handleKeypadPress(k)} className="px-3 py-2 bg-gray-100 rounded">{k}</button>
              ))}
            </div>
            <div className="ml-4 text-sm">Value: <span className="font-medium">{keypadValue || '1'}</span></div>
          </div>
          <div className="text-sm text-gray-500">Tip: use "Qty" on a product to apply the keypad value</div>
        </div>
      </footer>

      {showCheckout && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded p-6 w-96">
            <h3 className="text-lg font-semibold mb-2">Checkout</h3>
            <div className="text-sm text-gray-600 mb-4">
              <div className="flex justify-between"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>${tax.toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold mt-2"><span>Total</span><span>${total.toFixed(2)}</span></div>
            </div>
            <div className="flex gap-2">
              <button onClick={confirmPayment} className="flex-1 py-2 bg-green-600 text-white rounded">Confirm Payment</button>
              <button onClick={() => setShowCheckout(false)} className="flex-1 py-2 bg-gray-100 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSPage;