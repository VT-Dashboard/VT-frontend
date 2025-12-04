import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';

const ReportsPage = () => (
  <div className="p-8">
    <h2 className="text-3xl font-bold text-gray-800 mb-6">Sales Reports</h2>
    <p className="text-gray-600">Generate reports on sales performance and inventory turnover.</p>
    <div className="mt-8 p-6 bg-yellow-50 rounded-lg border border-yellow-200">
      <h3 className="text-xl font-semibold text-yellow-800">Analytics Dashboard</h3>
      <p className="text-yellow-700">Visualize your business performance.</p>
    </div>
  </div>
);
export default ReportsPage;