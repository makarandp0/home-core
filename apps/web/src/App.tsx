import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ThemeProvider } from './hooks/useTheme';
import { AuthProvider } from './hooks/useAuth';
import { SettingsProvider } from './hooks';
import { ThemeToggle } from './components/ThemeToggle';
import { HamburgerMenu } from './components/HamburgerMenu';
import { ProtectedRoute } from './components/ProtectedRoute';
import { UserMenu } from './components/UserMenu';
import { HomePage } from './pages/HomePage';
import { LandingPage } from './pages/LandingPage';
import { VersionPage } from './pages/VersionPage';
import { UploadPage } from './pages/UploadPage';
import { SettingsPage } from './pages/SettingsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { DocumentDetailPage } from './pages/DocumentDetailPage';
import { LoginPage } from './pages/LoginPage';
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

function isLocalDevelopment(hostname: string): boolean {
  // Standard localhost variants
  if (['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    return true;
  }
  // Private IPv4 ranges (RFC 1918)
  const privateIpPatterns = [
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,      // 10.0.0.0 - 10.255.255.255
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/, // 172.16.0.0 - 172.31.255.255
    /^192\.168\.\d{1,3}\.\d{1,3}$/,          // 192.168.0.0 - 192.168.255.255
  ];
  return privateIpPatterns.some(pattern => pattern.test(hostname));
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <SettingsProvider>
                    <div className="min-h-screen bg-background text-foreground p-6">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <h1 className="text-2xl font-semibold flex items-center gap-2">
                          <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <HomeIcon className="h-6 w-6 text-primary" aria-hidden />
                            <span>openHomeStorage</span>
                          </Link>
                          {typeof window !== 'undefined' && isLocalDevelopment(window.location.hostname) && (
                            <Badge variant="secondary" className={`ml-1 text-sm ${import.meta.env.VITE_GIT_BRANCH ? getBranchColor(import.meta.env.VITE_GIT_BRANCH) : branchColors[0]}`}>
                              Local{import.meta.env.VITE_GIT_BRANCH ? `:${import.meta.env.VITE_GIT_BRANCH}` : ''}
                            </Badge>
                          )}
                        </h1>
                        <div className="flex items-center gap-2">
                          <UserMenu />
                          <ThemeToggle />
                          <HamburgerMenu />
                        </div>
                      </div>
                      <Routes>
                        <Route path="/dashboard" element={<HomePage />} />
                        <Route path="/version" element={<VersionPage />} />
                        <Route path="/upload" element={<UploadPage />} />
                        <Route path="/documents" element={<DocumentsPage />} />
                        <Route path="/documents/:id" element={<DocumentDetailPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                      </Routes>
                    </div>
                  </SettingsProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
