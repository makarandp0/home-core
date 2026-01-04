import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ThemeToggle } from '../components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Home as HomeIcon, Github, Loader2 } from 'lucide-react';

export function LandingPage() {
  const { user, loading, authEnabled } = useAuth();

  // If auth is disabled, redirect directly to dashboard
  if (!authEnabled && !loading) {
    return <Navigate to="/dashboard" replace />;
  }

  // If already logged in, redirect to dashboard
  if (user && !loading) {
    return <Navigate to="/dashboard" replace />;
  }

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between p-6">
        <div className="flex items-center gap-2">
          <HomeIcon className="h-6 w-6 text-primary" aria-hidden="true" />
          <span className="text-xl font-semibold">home-core</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild>
            <Link to="/login">Sign In</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-2xl mx-auto px-6 py-16 text-center">
        <HomeIcon aria-hidden="true" className="h-16 w-16 text-primary mx-auto mb-6" />
        <h1 className="text-4xl font-bold mb-4">home-core</h1>
        <p className="text-xl text-muted-foreground mb-8">
          A self-hosted document management platform with AI-powered metadata extraction.
          Upload your PDFs and images, and let AI organize them for you.
        </p>
        <Button asChild size="lg">
          <Link to="/login">Get Started</Link>
        </Button>

        {/* Self-hosting section */}
        <div className="mt-16 p-6 rounded-xl border bg-card">
          <h2 className="text-lg font-semibold mb-2">Want to self-host?</h2>
          <p className="text-muted-foreground mb-4">
            Deploy your own instance and keep full control of your data.
            Bring your own API keys for Claude, GPT, or Gemini.
          </p>
          <Button variant="outline" asChild>
            <a
              href="https://github.com/makarandp0/home-core"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="mr-2 h-4 w-4" />
              View on GitHub
            </a>
          </Button>
        </div>

        {/* Video placeholder - uncomment when video is available
        <div className="mt-12">
          <h2 className="text-lg font-semibold mb-4">See it in action</h2>
          <div className="aspect-video bg-muted rounded-xl flex items-center justify-center">
            <p className="text-muted-foreground">Demo video coming soon</p>
          </div>
        </div>
        */}
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-sm text-muted-foreground">
        <a
          href="https://github.com/makarandp0/home-core"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
        >
          GitHub
        </a>
      </footer>
    </div>
  );
}
