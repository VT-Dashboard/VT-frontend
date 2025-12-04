import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';

const SettingsPage = () => (
  <div className="p-8">
    <h2 className="text-3xl font-bold text-gray-800 mb-6">Settings</h2>
    <p className="text-gray-600">Manage system configurations and user accounts.</p>
    <div className="mt-8 p-6 bg-purple-50 rounded-lg border border-purple-200">
      <h3 className="text-xl font-semibold text-purple-800">System Configuration</h3>
      <p className="text-purple-700">Adjust application settings.</p>
    </div>
  </div>
);
export default SettingsPage;