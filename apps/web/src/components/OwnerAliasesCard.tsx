// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { useOwnerAliases } from '@/hooks';
import { cn } from '@/lib/utils';
import type { OwnerAlias } from '@home/types';
import { Pencil, Trash2, Plus, ArrowRight } from 'lucide-react';

type ModalMode = 'add' | 'edit' | null;

export function OwnerAliasesCard() {
  const {
    aliases,
    loading,
    error,
    addAlias,
    updateAlias,
    deleteAlias,
  } = useOwnerAliases();

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingAlias, setEditingAlias] = useState<OwnerAlias | null>(null);

  // Form state
  const [formAliasName, setFormAliasName] = useState('');
  const [formCanonicalName, setFormCanonicalName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ id: string; countdown: number } | null>(null);

  const openAddModal = () => {
    setModalMode('add');
    setEditingAlias(null);
    setFormAliasName('');
    setFormCanonicalName('');
    setFormError(null);
  };

  const openEditModal = (alias: OwnerAlias) => {
    setModalMode('edit');
    setEditingAlias(alias);
    setFormAliasName(alias.aliasName);
    setFormCanonicalName(alias.canonicalName);
    setFormError(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingAlias(null);
    setFormError(null);
  };

  // Countdown timer for delete confirmation
  useEffect(() => {
    if (!confirmState || confirmState.countdown <= 0) return;
    const timer = setInterval(() => {
      setConfirmState((s) => (s && s.countdown > 1 ? { ...s, countdown: s.countdown - 1 } : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [confirmState]);

  const handleSave = async () => {
    setFormError(null);

    if (!formAliasName.trim()) {
      setFormError('Alias name is required');
      return;
    }
    if (!formCanonicalName.trim()) {
      setFormError('Canonical name is required');
      return;
    }

    setFormSaving(true);

    if (modalMode === 'add') {
      const result = await addAlias({
        aliasName: formAliasName.trim(),
        canonicalName: formCanonicalName.trim(),
      });
      if (result) {
        closeModal();
      } else {
        setFormError('Failed to add alias. The alias name may already exist.');
      }
    } else if (modalMode === 'edit' && editingAlias) {
      const result = await updateAlias(editingAlias.id, {
        aliasName: formAliasName.trim(),
        canonicalName: formCanonicalName.trim(),
      });
      if (result) {
        closeModal();
      } else {
        setFormError('Failed to update alias');
      }
    }

    setFormSaving(false);
  };

  const handleDelete = async (alias: OwnerAlias) => {
    if (!confirmState || confirmState.id !== alias.id) {
      setConfirmState({ id: alias.id, countdown: 3 });
      return;
    }
    setDeletingId(alias.id);
    await deleteAlias(alias.id);
    setDeletingId(null);
    setConfirmState(null);
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Owner Name Patterns</CardTitle>
          <Button size="sm" onClick={openAddModal}>
            <Plus className="mr-1 h-4 w-4" />
            Add Pattern
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Define regex patterns to suggest canonical names when editing documents.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-muted-foreground">Loading patterns...</div>
        ) : aliases.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-muted-foreground">
            No patterns configured. Add a pattern to help normalize owner names.
          </div>
        ) : (
          <div className="space-y-2">
            {aliases.map((alias) => (
              <div
                key={alias.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded truncate">{alias.aliasName}</code>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span className="text-primary truncate">{alias.canonicalName}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(alias)}
                    aria-label={`Edit alias ${alias.aliasName}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(alias)}
                    disabled={deletingId === alias.id}
                    aria-label={`Delete alias ${alias.aliasName}`}
                    className={cn(
                      confirmState?.id === alias.id
                        ? 'text-destructive hover:text-destructive font-medium'
                        : 'text-destructive hover:text-destructive'
                    )}
                  >
                    {deletingId === alias.id ? (
                      'Deleting...'
                    ) : confirmState?.id === alias.id ? (
                      `Confirm? (${confirmState.countdown})`
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
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

      {/* Add/Edit Dialog */}
      <Dialog open={modalMode !== null} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalMode === 'add' ? 'Add Name Pattern' : 'Edit Name Pattern'}</DialogTitle>
            <DialogDescription>
              Define a regex pattern to match owner names and replace with a canonical name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="aliasName">Pattern to Match (regex)</Label>
              <Input
                id="aliasName"
                value={formAliasName}
                onChange={(e) => setFormAliasName(e.target.value)}
                placeholder="e.g., .*Makarand.*"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Regular expression pattern (case-insensitive). Examples:
              </p>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                <li><code className="bg-muted px-1 rounded">.*Makarand.*</code> - matches any name containing "Makarand"</li>
                <li><code className="bg-muted px-1 rounded">^John Smith$</code> - matches exactly "John Smith"</li>
                <li><code className="bg-muted px-1 rounded">John.*Smith</code> - matches "John Smith", "John Q Smith", etc.</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Label htmlFor="canonicalName">Canonical Name (to replace with)</Label>
              <Input
                id="canonicalName"
                value={formCanonicalName}
                onChange={(e) => setFormCanonicalName(e.target.value)}
                placeholder="e.g., Makarand Patwardhan"
              />
              <p className="text-xs text-muted-foreground">
                The preferred name that will be used instead.
              </p>
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
            <Button onClick={handleSave} disabled={formSaving}>
              {formSaving ? 'Saving...' : modalMode === 'add' ? 'Add Pattern' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
