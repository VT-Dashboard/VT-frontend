import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';


const Sidebar = ({ isSidebarOpen, toggleSidebar }) => {
  const location = useLocation();

  const navItems = [
    { to: "/", icon: "📊", label: "Dashboard" },
    { to: "/pos", icon: "🛒", label: "Point of Sale" },
    { to: "/inventory", icon: "📦", label: "Inventory" },
    { to: "/categories", icon: "🗂️", label: "Categories" },
    { to: "/brand", icon: "🏢", label: "Brand" },
    { to: "/suppliers", icon: "🏷️", label: "Suppliers" },
    { to: "/reports", icon: "📈", label: "Reports" },
    { to: "/settings", icon: "⚙️", label: "Settings" },
  ];

  const NavLink = ({ to, icon, label }) => {
    const isActive = location.pathname === to;
    const baseClass = "flex items-center p-3 my-1 rounded-lg transition duration-200 text-gray-200 hover:bg-indigo-700";
    const activeClass = "bg-indigo-800 text-white font-semibold shadow-inner";

    return (
      <Link to={to} onClick={toggleSidebar} className={`${baseClass} ${isActive ? activeClass : ''}`}>
        <span className="text-xl mr-3">{icon}</span>
        <span className="font-medium">{label}</span>
      </Link>
    );
  };

  return (
    <aside
      className={`fixed top-0 left-0 h-full w-64 bg-gray-900 z-40 transform lg:translate-x-0 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <div className="p-6">
        <h1 className="text-3xl font-extrabold text-indigo-400 tracking-wider mb-8">
          A-POS
        </h1>
        <nav className="space-y-2">
          {navItems.map((item) => (
            <NavLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="mt-10 pt-4 border-t border-gray-700 text-xs text-gray-500">
            <p>Apparel POS System v1.0</p>
        </div>
      </div>
    </aside>
  );
};
export default Sidebar;