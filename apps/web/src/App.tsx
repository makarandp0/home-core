import React from 'react';
import { Button } from '@home/ui';
import { UserSchema, apiResponse, type User } from '@home/types';

export function App() {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/user');
        const json = await res.json();
        const parsed = apiResponse(UserSchema).parse(json);
        if (parsed.ok && parsed.data) {
          setUser(parsed.data);
        } else {
          setError(parsed.error ?? 'Unknown error');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="mb-4 text-2xl font-semibold">home-core web</h1>
      <div className="mb-6 rounded-md border bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-lg font-medium">User (validated via Zod)</h2>
        {loading && <p className="text-sm text-gray-600">Loading…</p>}
        {!loading && error && (
          <p className="text-sm text-red-600">Error: {error}</p>
        )}
        {!loading && !error && user && (
          <div className="space-y-1">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Name:</span> {user.name}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Email:</span> {user.email}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-semibold">ID:</span> {user.id}
            </p>
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
      </div>
    </div>
  );
}
