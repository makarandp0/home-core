import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HamburgerMenu } from './components/HamburgerMenu';
import { HomePage } from './pages/HomePage';
import { VersionPage } from './pages/VersionPage';

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">home-core web</h1>
          <HamburgerMenu />
        </div>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/version" element={<VersionPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
