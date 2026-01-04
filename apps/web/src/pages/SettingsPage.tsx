import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettings } from '../hooks';
import { cn } from '@/lib/utils';
import type { ProviderConfig, ProviderId } from '@ohs/types';
import { ProviderIdSchema } from '@ohs/types';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { OwnerAliasesCard } from '@/components/OwnerAliasesCard';

type ModalMode = 'add' | 'edit' | null;

function isProviderId(value: string): value is ProviderId {
  return ProviderIdSchema.safeParse(value).success;
}

export function SettingsPage() {
  const {
    providerTypes,
    providerTypesLoading,
    providers,
    loading,
    error,
    addProvider,
    updateProvider,
    deleteProvider,
    activateProvider,
  } = useSettings();

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formProviderType, setFormProviderType] = useState<ProviderId | ''>('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  // Delete confirmation state (inline countdown pattern)
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ id: string; countdown: number } | null>(null);

  const openAddModal = () => {
    setModalMode('add');
    setEditingProvider(null);
    setFormName('');
    setFormProviderType('');
    setFormApiKey('');
    setFormError(null);
  };

  const openEditModal = (provider: ProviderConfig) => {
    setModalMode('edit');
    setEditingProvider(provider);
    setFormName(provider.name);
    setFormProviderType(provider.providerType);
    setFormApiKey('');
    setFormError(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingProvider(null);
    setFormError(null);
  };

  // Countdown timer for delete confirmation
  useEffect(() => {
    if (!confirmState || confirmState.countdown <= 0) return;

    const timer = setInterval(() => {
      setConfirmState((s) => (s && s.countdown > 1 ? { ...s, countdown: s.countdown - 1 } : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [confirmState?.id, confirmState && confirmState.countdown > 0]);

  const handleSaveProvider = async () => {
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Name is required');
      return;
    }

    if (modalMode === 'add') {
      if (!formProviderType || !isProviderId(formProviderType)) {
        setFormError('Provider type is required');
        return;
      }
      if (!formApiKey.trim()) {
        setFormError('API key is required');
        return;
      }

      setFormSaving(true);
      const result = await addProvider({
        name: formName.trim(),
        providerType: formProviderType,
        apiKey: formApiKey.trim(),
      });
      setFormSaving(false);

      if (result) {
        closeModal();
      } else {
        setFormError('Failed to add provider');
      }
    } else if (modalMode === 'edit' && editingProvider) {
      setFormSaving(true);
      const updateData: { name?: string; apiKey?: string } = {};
      if (formName.trim() !== editingProvider.name) {
        updateData.name = formName.trim();
      }
      if (formApiKey.trim()) {
        updateData.apiKey = formApiKey.trim();
      }

      if (Object.keys(updateData).length === 0) {
        closeModal();
        return;
      }

      const result = await updateProvider(editingProvider.id, updateData);
      setFormSaving(false);

      if (result) {
        closeModal();
      } else {
        setFormError('Failed to update provider');
      }
    }
  };

  const handleActivate = async (id: string) => {
    const result = await activateProvider(id);
    if (!result) {
      setFormError('Failed to activate provider');
    }
  };

  const handleDelete = async (provider: ProviderConfig) => {
    // First click: start countdown
    if (!confirmState || confirmState.id !== provider.id) {
      setConfirmState({ id: provider.id, countdown: 3 });
      return;
    }

    // Second click during countdown: perform delete
    setDeletingId(provider.id);
    await deleteProvider(provider.id);
    setDeletingId(null);
    setConfirmState(null);
    // Error is already set by deleteProvider in useSettings
  };

  const getProviderTypeLabel = (typeId: ProviderId) => {
    const type = providerTypes.find((t) => t.id === typeId);
    return type?.label ?? typeId;
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Provider Configurations Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Provider Configurations</CardTitle>
            <Button size="sm" onClick={openAddModal}>
              <Plus className="mr-1 h-4 w-4" />
              Add Provider
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading settings...</div>
          ) : providers.length === 0 ? (
            <div className="rounded-md border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/50">
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                No providers configured
              </p>
              <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                Add a provider to start processing documents.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className={cn(
                    'rounded-lg border p-4',
                    provider.isActive
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'bg-card',
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{provider.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {getProviderTypeLabel(provider.providerType)}
                        </Badge>
                        {provider.isActive && (
                          <Badge className="bg-primary text-primary-foreground text-xs">
                            Active
                          </Badge>
                        )}
                      </div>
                      <code className="text-xs text-muted-foreground mt-1 block">
                        {provider.apiKeyRedacted}
                      </code>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!provider.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActivate(provider.id)}
                        >
                          Make Active
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(provider)}
                        aria-label={`Edit ${provider.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(provider)}
                        disabled={
                          deletingId === provider.id ||
                          (provider.isActive && providers.length > 1)
                        }
                        aria-label={`Delete ${provider.name}`}
                        title={
                          provider.isActive && providers.length > 1
                            ? 'Activate another provider first'
                            : undefined
                        }
                        className={cn(
                          confirmState?.id === provider.id
                            ? 'text-destructive hover:text-destructive font-medium'
                            : 'text-destructive hover:text-destructive',
                        )}
                      >
                        {deletingId === provider.id ? (
                          'Deleting...'
                        ) : confirmState?.id === provider.id ? (
                          `Confirm? (${confirmState.countdown})`
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Owner Name Aliases */}
      <OwnerAliasesCard />

      {/* Add/Edit Provider Dialog */}
      <Dialog open={modalMode !== null} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalMode === 'add' ? 'Add Provider' : 'Edit Provider'}</DialogTitle>
            <DialogDescription>
              {modalMode === 'add'
                ? 'Configure a new AI provider for document processing.'
                : 'Update the provider configuration.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., OpenAI_work, claude_personal"
              />
              <p className="text-xs text-muted-foreground">
                A friendly name to identify this configuration.
              </p>
            </div>

            {modalMode === 'add' && (
              <div className="space-y-2">
                <Label id="provider-type-label">Provider Type</Label>
                {providerTypesLoading ? (
                  <div className="text-sm text-muted-foreground">Loading...</div>
                ) : (
                  <Select
                    value={formProviderType}
                    onValueChange={(value) => {
                      if (isProviderId(value)) {
                        setFormProviderType(value);
                      }
                    }}
                  >
                    <SelectTrigger aria-labelledby="provider-type-label">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providerTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {modalMode === 'edit' && editingProvider && (
              <div className="space-y-2">
                <Label>Provider Type</Label>
                <div className="rounded-md border bg-muted px-3 py-2 text-sm">
                  {getProviderTypeLabel(editingProvider.providerType)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Provider type cannot be changed. Delete and recreate to use a different provider.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                placeholder={
                  modalMode === 'edit'
                    ? 'Enter new key to update (leave empty to keep current)'
                    : 'Enter your API key'
                }
              />
              {modalMode === 'edit' && editingProvider && (
                <p className="text-xs text-muted-foreground">
                  Current key:{' '}
                  <code className="rounded bg-secondary px-1">
                    {editingProvider.apiKeyRedacted}
                  </code>
                </p>
              )}
            </div>

            {formError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {formError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSaveProvider} disabled={formSaving}>
              {formSaving ? 'Saving...' : modalMode === 'add' ? 'Add Provider' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
