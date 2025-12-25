import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from '../hooks';

export function SettingsPage() {
  const settings = useSettings();

  const providerLabel = settings.selectedMeta?.label?.split(' ')[0] ?? 'Provider';
  const keyPlaceholder = settings.selectedMeta?.placeholder ?? '';

  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label>Provider</Label>
            {settings.providersLoading ? (
              <div className="text-sm text-muted-foreground">Loading providers...</div>
            ) : (
              <div className="flex flex-wrap gap-4">
                {settings.providers.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="provider"
                      value={p.id}
                      checked={settings.selectedProvider === p.id}
                      onChange={() => settings.setSelectedProvider(p.id)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-sm">{p.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Custom Prompt */}
          <div className="space-y-2">
            <Label>Custom Prompt</Label>
            <Textarea
              value={settings.prompt}
              onChange={(e) => settings.setPrompt(e.target.value)}
              placeholder="Custom instructions for parsing. Leave empty for default."
              rows={3}
            />
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label>{providerLabel} API Key</Label>
            <Input
              type="password"
              value={settings.apiKey}
              onChange={(e) => settings.setApiKey(e.target.value)}
              placeholder={keyPlaceholder}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use server-configured key.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
