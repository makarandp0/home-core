import type { ProviderDefinition } from './types.js';
import { anthropicProvider } from './anthropic.js';
import { openaiProvider } from './openai.js';
import { geminiProvider } from './gemini.js';

// Central provider registry - add new providers here
const providers: readonly ProviderDefinition[] = [
  anthropicProvider,
  openaiProvider,
  geminiProvider,
];

// Build registry as a simple Record<string, ProviderDefinition>
export const providerRegistry: Record<string, ProviderDefinition> = Object.fromEntries(
  providers.map((p) => [p.id, p])
);

export const providerList: readonly ProviderDefinition[] = providers;

// Helper to get provider by id
export function getProviderById(id: string): ProviderDefinition | undefined {
  return providerRegistry[id];
}

// Helper to check if provider is configured (has API key in env)
export function isProviderConfigured(provider: ProviderDefinition): boolean {
  return !!process.env[provider.envVar];
}

// Get all provider IDs
export function getProviderIds(): string[] {
  return providers.map((p) => p.id);
}
