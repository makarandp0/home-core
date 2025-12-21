import React from 'react';
import { HealthSchema } from '@home/types';
import { FRONTEND_VERSION } from '../version';

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
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
      <span className="font-medium text-gray-700 dark:text-gray-200 text-sm">{label}</span>
      {isValidCommit ? (
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="font-mono text-xs text-gray-400 dark:text-gray-600">{shortCommit}</span>
          ) : prInfo ? (
            <>
              <span className="font-mono text-xs text-gray-500 dark:text-gray-400" title={prInfo.title}>
                {prInfo.title.length > 30 ? `${prInfo.title.slice(0, 30)}...` : prInfo.title}
              </span>
              <a
                href={prInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
              >
                #{prInfo.number}
              </a>
            </>
          ) : (
            <a
              href={`https://github.com/${GITHUB_REPO}/commit/${commit}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
            >
              {shortCommit}
            </a>
          )}
        </div>
      ) : (
        <span className="font-mono text-xs text-gray-400 dark:text-gray-600">{shortCommit}</span>
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
  const [configuredProviders, setConfiguredProviders] = React.useState<ConfiguredProviders | null>(
    null
  );
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/health');
        const json = await res.json();
        const parsed = HealthSchema.parse(json);
        setBackendVersion(parsed.version ?? null);
        setDocProcessorVersion(parsed.docProcessorVersion ?? null);
        setConfiguredProviders(parsed.configuredProviders ?? null);
      } catch {
        setBackendVersion(null);
        setDocProcessorVersion(null);
        setConfiguredProviders(null);
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-3xl font-semibold dark:text-gray-100">Version Information</h1>

        <div className="space-y-2">
          <CommitLink label="Frontend (Web)" commit={FRONTEND_VERSION} />
          {loading ? (
            <>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <span className="font-medium text-gray-700 dark:text-gray-200 text-sm">Backend (API)</span>
                <span className="text-sm text-gray-400 dark:text-gray-600">Loading...</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <span className="font-medium text-gray-700 dark:text-gray-200 text-sm">Doc Processor</span>
                <span className="text-sm text-gray-400 dark:text-gray-600">Loading...</span>
              </div>
            </>
          ) : (
            <>
              <CommitLink label="Backend (API)" commit={backendVersion || 'unknown'} />
              <CommitLink label="Doc Processor" commit={docProcessorVersion || 'unavailable'} />
            </>
          )}
        </div>

        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400 text-center">
          Click on a PR link to view it on GitHub
        </p>

        {!loading && missingProviders.length > 0 && (
          <div className="mt-6 rounded-md bg-yellow-50 p-4 dark:bg-yellow-900/20">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Vision API Configuration
            </h3>
            <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
              The following providers are not configured on the server:{' '}
              <strong>{missingProviders.join(', ')}</strong>
            </p>
            <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
              Users will need to provide their own API keys in the Vision page, or set the
              environment variables on the server.
            </p>
          </div>
        )}

        {!loading && configuredList.length > 0 && (
          <div className="mt-6 rounded-md bg-green-50 p-4 dark:bg-green-900/20">
            <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
              Configured Providers
            </h3>
            <ul className="mt-2 space-y-1">
              {configuredList.map((provider) => (
                <li key={provider.name} className="text-sm text-green-700 dark:text-green-300">
                  {provider.name}:{' '}
                  <code className="rounded bg-green-100 px-1 py-0.5 font-mono text-xs dark:bg-green-800">
                    {provider.key}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
