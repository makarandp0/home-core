import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  ProvidersResponseSchema,
  SettingsResponseSchema,
  ProviderConfigSchema,
  DeleteResponseSchema,
  type ProviderInfo,
  type ProviderConfig,
  type ProviderConfigCreate,
  type ProviderConfigUpdate,
} from '@ohs/types';
import { api, getErrorMessage } from '@/lib/api';

interface SettingsContextValue {
  // Available provider types (for dropdown when adding)
  providerTypes: ProviderInfo[];
  providerTypesLoading: boolean;

  // Configured providers
  providers: ProviderConfig[];
  activeProviderId: string | null;
  activeProvider: ProviderConfig | null; // Derived from providers

  // Loading state
  loading: boolean;
  error: string | null;

  // Actions
  addProvider: (data: ProviderConfigCreate) => Promise<ProviderConfig | null>;
  updateProvider: (id: string, data: ProviderConfigUpdate) => Promise<ProviderConfig | null>;
  deleteProvider: (id: string) => Promise<boolean>;
  activateProvider: (id: string) => Promise<ProviderConfig | null>;
  refresh: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // Provider types (openai, anthropic, gemini)
  const [providerTypes, setProviderTypes] = useState<ProviderInfo[]>([]);
  const [providerTypesLoading, setProviderTypesLoading] = useState(true);

  // Settings state
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derive activeProvider from providers
  const activeProvider = providers.find((p) => p.id === activeProviderId) ?? null;

  // Fetch provider types on mount
  useEffect(() => {
    async function fetchProviderTypes() {
      const result = await api.get('/api/providers', ProvidersResponseSchema);
      if (result.ok) {
        setProviderTypes(result.data.providers);
      } else {
        console.error('Failed to fetch provider types:', getErrorMessage(result.error));
      }
      setProviderTypesLoading(false);
    }
    fetchProviderTypes();
  }, []);

  // Fetch settings with retry for when backend isn't ready yet
  const fetchSettings = useCallback(async (retryCount = 0) => {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    if (retryCount === 0) {
      setLoading(true);
      setError(null);
    }

    const result = await api.get('/api/settings', SettingsResponseSchema);
    if (result.ok) {
      setProviders(result.data.providers);
      setActiveProviderId(result.data.activeProviderId);
      setLoading(false);
    } else {
      console.error('[useSettings] Fetch failed:', getErrorMessage(result.error));
      // Retry if backend might not be ready yet
      if (retryCount < maxRetries) {
        console.log(`[useSettings] Retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        setTimeout(() => fetchSettings(retryCount + 1), retryDelay);
        return;
      }
      setError(getErrorMessage(result.error));
      setLoading(false);
    }
  }, []);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Add a new provider
  const addProvider = useCallback(
    async (data: ProviderConfigCreate): Promise<ProviderConfig | null> => {
      const result = await api.post('/api/settings/providers', ProviderConfigSchema, data);
      if (result.ok) {
        setProviders((prev) => [...prev, result.data]);
        return result.data;
      }
      setError(getErrorMessage(result.error));
      return null;
    },
    [],
  );

  // Update a provider
  const updateProvider = useCallback(
    async (id: string, data: ProviderConfigUpdate): Promise<ProviderConfig | null> => {
      const result = await api.put(`/api/settings/providers/${id}`, ProviderConfigSchema, data);
      if (result.ok) {
        setProviders((prev) => prev.map((p) => (p.id === id ? result.data : p)));
        return result.data;
      }
      setError(getErrorMessage(result.error));
      return null;
    },
    [],
  );

  // Delete a provider
  const deleteProvider = useCallback(async (id: string): Promise<boolean> => {
    const result = await api.delete(`/api/settings/providers/${id}`, DeleteResponseSchema);
    if (result.ok) {
      setProviders((prev) => prev.filter((p) => p.id !== id));
      setActiveProviderId((prev) => (prev === id ? null : prev));
      return true;
    }
    setError(getErrorMessage(result.error));
    return false;
  }, []);

  // Activate a provider
  const activateProvider = useCallback(async (id: string): Promise<ProviderConfig | null> => {
    const result = await api.post(`/api/settings/providers/${id}/activate`, ProviderConfigSchema);
    if (result.ok) {
      // Update providers list to reflect new active state
      setProviders((prev) =>
        prev.map((p) => ({
          ...p,
          isActive: p.id === id,
        })),
      );
      setActiveProviderId(id);
      return result.data;
    }
    setError(getErrorMessage(result.error));
    return null;
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        providerTypes,
        providerTypesLoading,
        providers,
        activeProviderId,
        activeProvider,
        loading,
        error,
        addProvider,
        updateProvider,
        deleteProvider,
        activateProvider,
        refresh: fetchSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}
