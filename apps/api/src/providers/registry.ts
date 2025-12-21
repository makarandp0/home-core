import type { ProviderDefinition } from './types.js';
import { anthropicProvider } from './anthropic.js';
import { openaiProvider } from './openai.js';
import { geminiProvider } from './gemini.js';

// Central provider registry - add new providers here
const providers = [anthropicProvider, openaiProvider, geminiProvider] as const;

export type ProviderId = (typeof providers)[number]['id'];

export const providerRegistry: Record<ProviderId, ProviderDefinition> = Object.fromEntries(
  providers.map((p) => [p.id, p])
) as Record<ProviderId, ProviderDefinition>;

export const providerList: readonly ProviderDefinition[] = providers;

// Helper to get provider by id
export function getProviderById(id: string): ProviderDefinition | undefined {
  return providerRegistry[id as ProviderId];
}

// Helper to check if provider is configured (has API key in env)
export function isProviderConfigured(provider: ProviderDefinition): boolean {
  return !!process.env[provider.envVar];
}

// Get all provider IDs
export function getProviderIds(): ProviderId[] {
  return providers.map((p) => p.id) as ProviderId[];
}
