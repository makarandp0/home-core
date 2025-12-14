import React from 'react';
import { HealthSchema } from '@home/types';
import { FRONTEND_VERSION } from '../version';

export function VersionPage() {
  const [backendVersion, setBackendVersion] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/health');
        const json = await res.json();
        const parsed = HealthSchema.parse(json);
        setBackendVersion(parsed.version ?? null);
      } catch {
        setBackendVersion(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-3xl font-semibold">Version Information</h1>

        <div className="space-y-4">
          <div className="rounded-md border bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-medium text-gray-900">Frontend (Web)</h2>
            <p className="font-mono text-sm text-gray-700">{FRONTEND_VERSION}</p>
          </div>

          <div className="rounded-md border bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-medium text-gray-900">Backend (API)</h2>
            {loading ? (
              <p className="text-sm text-gray-600">Loading...</p>
            ) : backendVersion ? (
              <p className="font-mono text-sm text-gray-700">{backendVersion}</p>
            ) : (
              <p className="text-sm text-gray-500">Version unavailable</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
