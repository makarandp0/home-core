import * as React from 'react';
import { apiResponse, ProvidersResponseSchema, type ProviderInfo } from '@home/types';

export function useProviders() {
  const [providers, setProviders] = React.useState<ProviderInfo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedProvider, setSelectedProvider] = React.useState<string>('');

  React.useEffect(() => {
    async function fetchProviders() {
      try {
        const res = await fetch('/api/providers');
        const json = await res.json();
        const parsed = apiResponse(ProvidersResponseSchema).parse(json);
        if (parsed.ok && parsed.data) {
          setProviders(parsed.data.providers);
          if (parsed.data.providers.length > 0) {
            setSelectedProvider(parsed.data.providers[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch providers:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProviders();
  }, []);

  const selectedMeta = React.useMemo(
    () => providers.find((p) => p.id === selectedProvider),
    [providers, selectedProvider]
  );

  return {
    providers,
    loading,
    selectedProvider,
    setSelectedProvider,
    selectedMeta,
  };
}
