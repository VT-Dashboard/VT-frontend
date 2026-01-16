import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

import DashboardLayout from './layouts/DashboardLayout'
import DashboardOverviewPage from './pages/DashboardOverviewPage'
import POSPage from './pages/POSPage'
import InventoryPage from './pages/InventoryPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import SuppliersPage from './pages/SuppliersPage'

const App = () => (
  <>
    
    <Router>
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<DashboardOverviewPage />} />
          <Route path="/pos" element={<POSPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<DashboardOverviewPage />} />
        </Routes>
      </DashboardLayout>
    </Router>
  </>
);

export default App;
