import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiResponse, ProvidersResponseSchema, type ProviderInfo } from '@home/types';

interface SettingsContextValue {
  // Provider
  providers: ProviderInfo[];
  providersLoading: boolean;
  selectedProvider: string;
  setSelectedProvider: (provider: string) => void;
  selectedMeta: ProviderInfo | undefined;
  // Settings
  apiKey: string;
  setApiKey: (key: string) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

function getStoredValue(key: string, defaultValue: string): string {
  if (typeof window === 'undefined') return defaultValue;
  try {
    return localStorage.getItem(key) ?? defaultValue;
  } catch (_e) {
    return defaultValue;
  }
}

function storeValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (_e) {
    // localStorage might be disabled
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [selectedProvider, setSelectedProviderState] = useState<string>(() =>
    getStoredValue('settings.selectedProvider', '')
  );
  const [apiKey, setApiKeyState] = useState<string>(() =>
    getStoredValue('settings.apiKey', '')
  );
  const [prompt, setPromptState] = useState<string>(() =>
    getStoredValue('settings.prompt', '')
  );

  // Fetch providers on mount
  useEffect(() => {
    async function fetchProviders() {
      try {
        const res = await fetch('/api/providers');
        const json = await res.json();
        const parsed = apiResponse(ProvidersResponseSchema).parse(json);
        if (parsed.ok && parsed.data) {
          setProviders(parsed.data.providers);
          // Auto-select first provider if none stored
          if (!selectedProvider && parsed.data.providers.length > 0) {
            const firstProvider = parsed.data.providers[0].id;
            setSelectedProviderState(firstProvider);
            storeValue('settings.selectedProvider', firstProvider);
          }
        }
      } catch (err) {
        console.error('Failed to fetch providers:', err);
      } finally {
        setProvidersLoading(false);
      }
    }
    fetchProviders();
  }, []);

  const selectedMeta = providers.find((p) => p.id === selectedProvider);

  const setSelectedProvider = (provider: string) => {
    setSelectedProviderState(provider);
    storeValue('settings.selectedProvider', provider);
  };

  const setApiKey = (key: string) => {
    setApiKeyState(key);
    storeValue('settings.apiKey', key);
  };

  const setPrompt = (newPrompt: string) => {
    setPromptState(newPrompt);
    storeValue('settings.prompt', newPrompt);
  };

  return (
    <SettingsContext.Provider
      value={{
        providers,
        providersLoading,
        selectedProvider,
        setSelectedProvider,
        selectedMeta,
        apiKey,
        setApiKey,
        prompt,
        setPrompt,
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
