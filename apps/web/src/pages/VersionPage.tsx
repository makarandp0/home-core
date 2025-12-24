import React from 'react';
import { HealthSchema } from '@home/types';
import { FRONTEND_VERSION } from '../version';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

interface ConfiguredProviders {
  anthropic: string | null;
  openai: string | null;
}

export function VersionPage() {
  const [backendVersion, setBackendVersion] = React.useState<string | null>(null);
  const [docProcessorVersion, setDocProcessorVersion] = React.useState<string | null>(null);
  const [docProcessorUrl, setDocProcessorUrl] = React.useState<string | null>(null);
  const [databaseConnected, setDatabaseConnected] = React.useState<boolean | null>(null);
  const [configuredProviders, setConfiguredProviders] = React.useState<ConfiguredProviders | null>(
    null
  );
  const [documentStorage, setDocumentStorage] = React.useState<{
    path: string | null;
    accessible: boolean;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/health');
        const json = await res.json();
        const parsed = HealthSchema.parse(json);
        setBackendVersion(parsed.version ?? null);
        setDocProcessorVersion(parsed.docProcessorVersion ?? null);
        setDocProcessorUrl(parsed.docProcessorUrl ?? null);
        setDatabaseConnected(parsed.database?.connected ?? null);
        setConfiguredProviders(parsed.configuredProviders ?? null);
        setDocumentStorage(parsed.documentStorage ?? null);
      } catch {
        setBackendVersion(null);
        setDocProcessorVersion(null);
        setDocProcessorUrl(null);
        setDatabaseConnected(null);
        setConfiguredProviders(null);
        setDocumentStorage(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const missingProviders = configuredProviders
    ? [
        !configuredProviders.anthropic && 'Anthropic',
        !configuredProviders.openai && 'OpenAI',
      ].filter(Boolean)
    : [];

  const configuredList: Array<{ name: string; key: string }> = [];
  if (configuredProviders?.anthropic) {
    configuredList.push({ name: 'Anthropic', key: configuredProviders.anthropic });
  }
  if (configuredProviders?.openai) {
    configuredList.push({ name: 'OpenAI', key: configuredProviders.openai });
  }

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
                  {docProcessorVersion ? (
                    <a
                      href={`https://github.com/${GITHUB_REPO}/commit/${docProcessorVersion}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
                    >
                      {docProcessorVersion.slice(0, 7)}
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      Unavailable
                    </span>
                  )}
                </div>
                {docProcessorUrl && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {docProcessorUrl}
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
            </>
          )}
        </div>

        <p className="mt-4 text-sm text-muted-foreground text-center">
          Click on a PR link to view it on GitHub
        </p>
      </Card>

      {!loading && missingProviders.length > 0 && (
        <Card className={cn(
          "mt-6 p-4 border-yellow-500/30",
          "bg-yellow-500/10"
        )}>
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="border-yellow-500/50 text-yellow-600 dark:text-yellow-400">
              Warning
            </Badge>
            <div>
              <h3 className="text-sm font-medium">
                Vision API Configuration
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                The following providers are not configured on the server:{' '}
                <strong className="text-foreground">{missingProviders.join(', ')}</strong>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Users will need to provide their own API keys in the Vision page, or set the
                environment variables on the server.
              </p>
            </div>
          </div>
        </Card>
      )}

      {!loading && configuredList.length > 0 && (
        <Card className={cn(
          "mt-6 p-4 border-green-500/30",
          "bg-green-500/10"
        )}>
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="border-green-500/50 text-green-600 dark:text-green-400">
              Active
            </Badge>
            <div>
              <h3 className="text-sm font-medium">
                Configured Providers
              </h3>
              <ul className="mt-2 space-y-1">
                {configuredList.map((provider) => (
                  <li key={provider.name} className="text-sm text-muted-foreground">
                    {provider.name}:{' '}
                    <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
                      {provider.key}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
