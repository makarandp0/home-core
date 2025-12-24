import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './hooks/useTheme';
import { ThemeToggle } from './components/ThemeToggle';
import { HamburgerMenu } from './components/HamburgerMenu';
import { HomePage } from './pages/HomePage';
import { VersionPage } from './pages/VersionPage';
import { VisionPage } from './pages/VisionPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { DocumentDetailPage } from './pages/DocumentDetailPage';

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-background text-foreground p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold">home-core web</h1>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <HamburgerMenu />
            </div>
          </div>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/version" element={<VersionPage />} />
            <Route path="/vision" element={<VisionPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/documents/:id" element={<DocumentDetailPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
