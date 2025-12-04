import React, { useState } from "react";

const InventoryPage = () => {
  const [items, setItems] = useState([
    { id: 1, name: "T-Shirt", quantity: 25, category: "Men", price: 1200 },
    { id: 2, name: "Dress", quantity: 10, category: "Women", price: 2500 },
  ]);

  const [newItem, setNewItem] = useState({
    name: "",
    quantity: "",
    category: "",
    price: "",
  });

  const handleChange = (e) => {
    setNewItem({ ...newItem, [e.target.name]: e.target.value });
  };

  const addItem = () => {
    if (!newItem.name || !newItem.quantity || !newItem.category || !newItem.price) {
      alert("Please fill all fields");
      return;
    }
    setItems([...items, { id: Date.now(), ...newItem }]);
    setNewItem({ name: "", quantity: "", category: "", price: "" });
  };

  const deleteItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const editItem = (id) => {
    const item = items.find((i) => i.id === id);
    setNewItem(item);
    setItems(items.filter((i) => i.id !== id));
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Inventory Management</h2>

      {/* Add Item Form */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-xl font-semibold text-green-700 mb-4">Add / Edit Item</h3>
        <div className="grid grid-cols-4 gap-4">
          <input
            type="text"
            name="name"
            placeholder="Item Name"
            value={newItem.name}
            onChange={handleChange}
            className="border rounded-lg p-2"
          />
          <input
            type="number"
            name="quantity"
            placeholder="Quantity"
            value={newItem.quantity}
            onChange={handleChange}
            className="border rounded-lg p-2"
          />
          <input
            type="text"
            name="category"
            placeholder="Category"
            value={newItem.category}
            onChange={handleChange}
            className="border rounded-lg p-2"
          />
          <input
            type="number"
            name="price"
            placeholder="Price (LKR)"
            value={newItem.price}
            onChange={handleChange}
            className="border rounded-lg p-2"
          />
        </div>
        <button
          onClick={addItem}
          className="mt-4 bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700"
        >
          Save Item
        </button>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">Stock Items</h3>
        {items.length === 0 ? (
          <p className="text-gray-500">No items available.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-green-100 text-left">
                <th className="p-3 border">Item Name</th>
                <th className="p-3 border">Category</th>
                <th className="p-3 border">Quantity</th>
                <th className="p-3 border">Price (LKR)</th>
                <th className="p-3 border text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-3 border">{item.name}</td>
                  <td className="p-3 border">{item.category}</td>
                  <td className="p-3 border">{item.quantity}</td>
                  <td className="p-3 border">{item.price}</td>
                  <td className="p-3 border text-center">
                    <button
                      onClick={() => editItem(item.id)}
                      className="bg-blue-500 text-white px-3 py-1 rounded mr-2 hover:bg-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default InventoryPage;
