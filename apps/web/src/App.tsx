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
import { Home as HomeIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const branchColors = [
  'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700',
  'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200 border-sky-300 dark:border-sky-700',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700',
  'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-700',
];

function getBranchColor(branch: string): string {
  const hash = branch.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return branchColors[hash % branchColors.length];
}

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-background text-foreground p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <HomeIcon className="h-6 w-6 text-primary" aria-hidden />
              <span>home-core web</span>
              {typeof window !== 'undefined' && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname) && (
                <Badge variant="secondary" className={`ml-1 text-sm ${import.meta.env.VITE_GIT_BRANCH ? getBranchColor(import.meta.env.VITE_GIT_BRANCH) : branchColors[0]}`}>
                  Local{import.meta.env.VITE_GIT_BRANCH ? `:${import.meta.env.VITE_GIT_BRANCH}` : ''}
                </Badge>
              )}
            </h1>
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
