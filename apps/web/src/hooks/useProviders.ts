// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { ProvidersResponseSchema, type ProviderInfo } from '@home/types';
import { api, getErrorMessage } from '@/lib/api';

export function useProviders() {
  const [providers, setProviders] = React.useState<ProviderInfo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedProvider, setSelectedProvider] = React.useState<string>('');

  React.useEffect(() => {
    async function fetchProviders() {
      const result = await api.get('/api/providers', ProvidersResponseSchema);
      if (result.ok) {
        setProviders(result.data.providers);
        if (result.data.providers.length > 0) {
          setSelectedProvider(result.data.providers[0].id);
        }
      } else {
        console.error('Failed to fetch providers:', getErrorMessage(result.error));
      }
      setLoading(false);
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
