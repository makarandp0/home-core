import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  apiResponse,
  ProvidersResponseSchema,
  SettingsResponseSchema,
  ProviderConfigSchema,
  type ProviderInfo,
  type ProviderConfig,
  type ProviderConfigCreate,
  type ProviderConfigUpdate,
} from '@home/types';

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
      try {
        const res = await fetch('/api/providers');
        const json = await res.json();
        const parsed = apiResponse(ProvidersResponseSchema).parse(json);
        if (parsed.ok && parsed.data) {
          setProviderTypes(parsed.data.providers);
        }
      } catch (err) {
        console.error('Failed to fetch provider types:', err);
      } finally {
        setProviderTypesLoading(false);
      }
    }
    fetchProviderTypes();
  }, []);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings');
      const json = await res.json();
      const parsed = apiResponse(SettingsResponseSchema).parse(json);
      if (parsed.ok && parsed.data) {
        setProviders(parsed.data.providers);
        setActiveProviderId(parsed.data.activeProviderId);
      } else {
        setError(parsed.error?.toString() ?? 'Failed to load settings');
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
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
      try {
        const res = await fetch('/api/settings/providers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setError(json.error?.toString() ?? `Failed to add provider (${res.status})`);
          return null;
        }
        const json = await res.json();
        const parsed = apiResponse(ProviderConfigSchema).parse(json);
        if (parsed.ok && parsed.data) {
          setProviders((prev) => [...prev, parsed.data!]);
          return parsed.data;
        }
        setError(parsed.error?.toString() ?? 'Failed to add provider');
        return null;
      } catch (err) {
        console.error('Failed to add provider:', err);
        setError(err instanceof Error ? err.message : 'Failed to add provider');
        return null;
      }
    },
    [],
  );

  // Update a provider
  const updateProvider = useCallback(
    async (id: string, data: ProviderConfigUpdate): Promise<ProviderConfig | null> => {
      try {
        const res = await fetch(`/api/settings/providers/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setError(json.error?.toString() ?? `Failed to update provider (${res.status})`);
          return null;
        }
        const json = await res.json();
        const parsed = apiResponse(ProviderConfigSchema).parse(json);
        if (parsed.ok && parsed.data) {
          setProviders((prev) => prev.map((p) => (p.id === id ? parsed.data! : p)));
          return parsed.data;
        }
        setError(parsed.error?.toString() ?? 'Failed to update provider');
        return null;
      } catch (err) {
        console.error('Failed to update provider:', err);
        setError(err instanceof Error ? err.message : 'Failed to update provider');
        return null;
      }
    },
    [],
  );

  // Delete a provider
  const deleteProvider = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/settings/providers/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error?.toString() ?? `Failed to delete provider (${res.status})`);
        return false;
      }
      const json = await res.json();
      if (json.ok) {
        setProviders((prev) => prev.filter((p) => p.id !== id));
        setActiveProviderId((prev) => (prev === id ? null : prev));
        return true;
      }
      setError(json.error?.toString() ?? 'Failed to delete provider');
      return false;
    } catch (err) {
      console.error('Failed to delete provider:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete provider');
      return false;
    }
  }, []);

  // Activate a provider
  const activateProvider = useCallback(async (id: string): Promise<ProviderConfig | null> => {
    try {
      const res = await fetch(`/api/settings/providers/${id}/activate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error?.toString() ?? `Failed to activate provider (${res.status})`);
        return null;
      }
      const json = await res.json();
      const parsed = apiResponse(ProviderConfigSchema).parse(json);
      if (parsed.ok && parsed.data) {
        // Update providers list to reflect new active state
        setProviders((prev) =>
          prev.map((p) => ({
            ...p,
            isActive: p.id === id,
          })),
        );
        setActiveProviderId(id);
        return parsed.data;
      }
      setError(parsed.error?.toString() ?? 'Failed to activate provider');
      return null;
    } catch (err) {
      console.error('Failed to activate provider:', err);
      setError(err instanceof Error ? err.message : 'Failed to activate provider');
      return null;
    }
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
