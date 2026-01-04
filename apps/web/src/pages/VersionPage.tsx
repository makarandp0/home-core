import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { HealthSchema, type DocProcessorStatus } from '@ohs/types';
import { FRONTEND_VERSION } from '../version';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface PrInfo {
  number: number;
  title: string;
  url: string;
}

const GITHUB_REPO = 'makarandp0/ohs';

function CommitDisplay({ commit }: { commit: string }) {
  const [prInfo, setPrInfo] = React.useState<PrInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const isValidCommit = commit && commit !== 'unknown' && commit !== 'dev' && commit.length >= 7;
  const shortCommit = commit?.slice(0, 7) || 'unknown';

  React.useEffect(() => {
    async function fetchPrInfo() {
      if (!isValidCommit) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/commits/${commit}/pulls`,
          {
            headers: {
              Accept: 'application/vnd.github+json',
            },
          }
        );

        if (response.ok) {
          const prs = await response.json();
          if (prs.length > 0) {
            setPrInfo({
              number: prs[0].number,
              title: prs[0].title,
              url: prs[0].html_url,
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch PR info:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPrInfo();
  }, [commit, isValidCommit]);

  if (!isValidCommit) {
    return <span className="font-mono text-xs text-muted-foreground">{shortCommit}</span>;
  }

  if (loading) {
    return <span className="font-mono text-xs text-muted-foreground">{shortCommit}</span>;
  }

  if (prInfo) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground" title={prInfo.title}>
          {prInfo.title.length > 30 ? `${prInfo.title.slice(0, 30)}...` : prInfo.title}
        </span>
        <a
          href={prInfo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
        >
          #{prInfo.number}
        </a>
      </div>
    );
  }

  return (
    <a
      href={`https://github.com/${GITHUB_REPO}/commit/${commit}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
    >
      {shortCommit}
    </a>
  );
}

function CommitLink({ commit, label }: { commit: string; label: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-md border border-border/50">
      <span className="font-medium text-sm">{label}</span>
      <CommitDisplay commit={commit} />
    </div>
  );
}

export function VersionPage() {
  const [backendVersion, setBackendVersion] = React.useState<string | null>(null);
  const [docProcessor, setDocProcessor] = React.useState<DocProcessorStatus | null>(null);
  const [databaseConnected, setDatabaseConnected] = React.useState<boolean | null>(null);
  const [documentStorage, setDocumentStorage] = React.useState<{
    path: string | null;
    accessible: boolean;
    error?: string;
  } | null>(null);
  const [authEnabled, setAuthEnabled] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Generate the network URL for QR code (for mobile access)
  const getNetworkUrl = () => {
    const { protocol, hostname, port } = window.location;
    return `${protocol}//${hostname}${port ? ':' + port : ''}/`;
  };

  const fetchHealth = React.useCallback(async () => {
    const result = await api.get('/api/health', HealthSchema);
    if (result.ok) {
      setBackendVersion(result.data.version ?? null);
      setDocProcessor(result.data.docProcessor ?? null);
      setDatabaseConnected(result.data.database?.connected ?? null);
      setDocumentStorage(result.data.documentStorage ?? null);
      setAuthEnabled(result.data.auth?.enabled ?? null);
    } else {
      setBackendVersion(null);
      setDocProcessor(null);
      setDatabaseConnected(null);
      setDocumentStorage(null);
      setAuthEnabled(null);
    }
  }, []);

  React.useEffect(() => {
    const run = async () => {
      await fetchHealth();
      setLoading(false);
    };
    run();
  }, [fetchHealth]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Version Information</h1>

      <Card className="p-4">
        <div className="space-y-2">
          <CommitLink label="Frontend (Web)" commit={FRONTEND_VERSION} />
          {loading ? (
            <>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-md border border-border/50">
                <span className="font-medium text-sm">Backend (API)</span>
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-md border border-border/50">
                <span className="font-medium text-sm">Doc Processor</span>
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-md border border-border/50">
                <span className="font-medium text-sm">Database</span>
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-md border border-border/50">
                <span className="font-medium text-sm">Document Storage</span>
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-md border border-border/50">
                <span className="font-medium text-sm">Authentication</span>
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            </>
          ) : (
            <>
              <CommitLink label="Backend (API)" commit={backendVersion || 'unknown'} />
              <div className="p-3 bg-secondary/50 rounded-md border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Doc Processor</span>
                  {docProcessor?.available ? (
                    <CommitDisplay commit={docProcessor.version || 'unknown'} />
                  ) : (
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      Unavailable
                    </span>
                  )}
                </div>
                {docProcessor?.url && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {docProcessor.url}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-md border border-border/50">
                <span className="font-medium text-sm">Database</span>
                <span className={cn(
                  "text-sm font-medium",
                  databaseConnected ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}>
                  {databaseConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <div className="p-3 bg-secondary/50 rounded-md border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Document Storage</span>
                  <span className={cn(
                    "text-sm font-medium",
                    documentStorage?.accessible
                      ? "text-green-600 dark:text-green-400"
                      : documentStorage?.path
                        ? "text-red-600 dark:text-red-400"
                        : "text-yellow-600 dark:text-yellow-400"
                  )}>
                    {documentStorage?.accessible
                      ? 'Accessible'
                      : documentStorage?.path
                        ? 'Error'
                        : 'Not Configured'}
                  </span>
                </div>
                {documentStorage?.path && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {documentStorage.path}
                  </p>
                )}
                {documentStorage?.error && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-mono">
                    {documentStorage.error}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-md border border-border/50">
                <span className="font-medium text-sm">Authentication</span>
                <span className={cn(
                  "text-sm font-medium",
                  authEnabled ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                )}>
                  {authEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </>
          )}
        </div>

        <p className="mt-4 text-sm text-muted-foreground text-center">
          Click on a PR link to view it on GitHub
        </p>
      </Card>

      {/* QR Code for Mobile Access */}
      <Card className="p-4 mt-4">
        <h2 className="text-lg font-medium mb-3">Mobile Access</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="bg-white p-3 rounded-lg">
            <QRCodeSVG
              value={getNetworkUrl()}
              size={120}
              aria-label="QR code for mobile access to this application"
            />
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm text-muted-foreground break-all font-mono">
              {getNetworkUrl()}
            </p>
            <p className="text-xs text-muted-foreground">
              Scan to open on your mobile device. Make sure both devices are on the same network.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
