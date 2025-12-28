import React from 'react';
import { HealthSchema, LoadFaceModelResponseSchema, type DocProcessorStatus } from '@home/types';
import { FRONTEND_VERSION } from '../version';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface PrInfo {
  number: number;
  title: string;
  url: string;
}

const GITHUB_REPO = 'makarandp0/home-core';

function CommitLink({ commit, label }: { commit: string; label: string }) {
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

  return (
    <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-md border border-border/50">
      <span className="font-medium text-sm">{label}</span>
      {isValidCommit ? (
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="font-mono text-xs text-muted-foreground">{shortCommit}</span>
          ) : prInfo ? (
            <>
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
            </>
          ) : (
            <a
              href={`https://github.com/${GITHUB_REPO}/commit/${commit}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
            >
              {shortCommit}
            </a>
          )}
        </div>
      ) : (
        <span className="font-mono text-xs text-muted-foreground">{shortCommit}</span>
      )}
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
  const [loading, setLoading] = React.useState(true);
  const [loadingModel, setLoadingModel] = React.useState(false);
  const [loadModelError, setLoadModelError] = React.useState<string | null>(null);

  const fetchHealth = React.useCallback(async () => {
    const result = await api.get('/api/health', HealthSchema);
    if (result.ok) {
      setBackendVersion(result.data.version ?? null);
      setDocProcessor(result.data.docProcessor ?? null);
      setDatabaseConnected(result.data.database?.connected ?? null);
      setDocumentStorage(result.data.documentStorage ?? null);
    } else {
      setBackendVersion(null);
      setDocProcessor(null);
      setDatabaseConnected(null);
      setDocumentStorage(null);
    }
  }, []);

  React.useEffect(() => {
    const run = async () => {
      await fetchHealth();
      setLoading(false);
    };
    run();
  }, [fetchHealth]);

  const handleLoadModel = async () => {
    setLoadingModel(true);
    setLoadModelError(null);
    try {
      const res = await fetch('/api/doc-processor/load-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'buffalo_l' }),
      });
      const json = await res.json();
      const parsed = LoadFaceModelResponseSchema.parse(json);
      if (!parsed.ok) {
        setLoadModelError(parsed.error ?? 'Unknown error');
      } else {
        await fetchHealth();
      }
    } catch (err) {
      setLoadModelError(err instanceof Error ? err.message : 'Failed to load model');
    } finally {
      setLoadingModel(false);
    }
  };

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
            </>
          ) : (
            <>
              <CommitLink label="Backend (API)" commit={backendVersion || 'unknown'} />
              <div className="p-3 bg-secondary/50 rounded-md border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Doc Processor</span>
                  <div className="flex items-center gap-2">
                    {docProcessor?.available ? (
                      <>
                        <span className={cn(
                          "text-xs font-medium",
                          "text-green-600 dark:text-green-400"
                        )}>
                          Available
                        </span>
                        {docProcessor.version && (
                          <a
                            href={`https://github.com/${GITHUB_REPO}/commit/${docProcessor.version}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
                          >
                            {docProcessor.version.slice(0, 7)}
                          </a>
                        )}
                      </>
                    ) : (
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">
                        Unavailable
                      </span>
                    )}
                  </div>
                </div>
                {docProcessor?.url && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {docProcessor.url}
                  </p>
                )}
                {docProcessor?.available && (
                  <div className="mt-2 pt-2 border-t border-border/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Face Model</span>
                      <div className="flex items-center gap-2">
                        {docProcessor.faceModel?.loaded ? (
                          <span className="text-xs font-medium text-green-600 dark:text-green-400">
                            {docProcessor.faceModel.model || 'Loaded'}
                          </span>
                        ) : (
                          <>
                            <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                              Not Loaded
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleLoadModel}
                              disabled={loadingModel}
                              className="h-6 px-2 text-xs"
                            >
                              {loadingModel ? 'Loading...' : 'Load'}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {loadModelError && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {loadModelError}
                      </p>
                    )}
                  </div>
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
            </>
          )}
        </div>

        <p className="mt-4 text-sm text-muted-foreground text-center">
          Click on a PR link to view it on GitHub
        </p>
      </Card>
    </div>
  );
}
