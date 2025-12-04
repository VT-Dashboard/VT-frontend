import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';

const POSPage = () => (
  <div className="p-8">
    <h2 className="text-3xl font-bold text-gray-800 mb-6">Point of Sale</h2>
    <p className="text-gray-600">This is where sales transactions will be processed.</p>
    <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
      <h3 className="text-xl font-semibold text-blue-800">Sales Area</h3>
      <p className="text-blue-700">Ready to start scanning products!</p>
    </div>
  </div>
);
export default POSPage;