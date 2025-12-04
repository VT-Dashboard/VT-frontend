import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';

const DashboardOverviewPage = () => (
  <div className="p-8">
    <h2 className="text-3xl font-bold text-gray-800 mb-6">Dashboard Overview</h2>
    <p className="text-gray-600">A quick glance at key metrics: recent sales, low stock alerts, daily revenue, etc.</p>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
        <h3 className="text-xl font-semibold text-indigo-700 mb-2">Daily Sales</h3>
        <p className="text-3xl font-bold text-gray-900">$1,250.00</p>
        <p className="text-sm text-gray-500 mt-1">+8% vs last day</p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
        <h3 className="text-xl font-semibold text-yellow-700 mb-2">Low Stock Alerts</h3>
        <p className="text-3xl font-bold text-gray-900">14 SKUs</p>
        <p className="text-sm text-gray-500 mt-1">Immediate reorder required</p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
        <h3 className="text-xl font-semibold text-green-700 mb-2">Total Inventory Value</h3>
        <p className="text-3xl font-bold text-gray-900">$55,890.00</p>
        <p className="text-sm text-gray-500 mt-1">Current market value</p>
      </div>
    </div>
    <div className="mt-8 p-6 bg-white rounded-lg shadow-md border border-gray-100">
      <h3 className="text-xl font-semibold text-gray-800 mb-2">Recent Sales Activity</h3>
      <ul className="text-gray-600 space-y-2">
        <li>Sale #9001: $45.98 (Card) - 2 mins ago</li>
        <li>Sale #9000: $19.99 (Cash) - 15 mins ago</li>
        <li>Sale #8999: $120.50 (Card) - 1 hour ago</li>
      </ul>
    </div>
  </div>
);
export default DashboardOverviewPage;