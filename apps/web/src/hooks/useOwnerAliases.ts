// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useEffect, useCallback } from 'react';
import {
  OwnerAliasListResponseSchema,
  OwnerAliasSchema,
  OwnerAliasBatchApplyResponseSchema,
  DeleteResponseSchema,
  type OwnerAlias,
  type OwnerAliasCreate,
  type OwnerAliasUpdate,
  type OwnerAliasBatchApplyResponse,
} from '@ohs/types';
import { api, getErrorMessage } from '@/lib/api';

export function useOwnerAliases() {
  const [aliases, setAliases] = useState<OwnerAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAliases = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await api.get('/api/settings/owner-aliases', OwnerAliasListResponseSchema);
    if (result.ok) {
      setAliases(result.data.aliases);
    } else {
      setError(getErrorMessage(result.error));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAliases();
  }, [fetchAliases]);

  const addAlias = useCallback(async (data: OwnerAliasCreate): Promise<OwnerAlias | null> => {
    const result = await api.post('/api/settings/owner-aliases', OwnerAliasSchema, data);
    if (result.ok) {
      setAliases((prev) =>
        [...prev, result.data].sort((a, b) => a.aliasName.localeCompare(b.aliasName))
      );
      return result.data;
    }
    setError(getErrorMessage(result.error));
    return null;
  }, []);

  const updateAlias = useCallback(
    async (id: string, data: OwnerAliasUpdate): Promise<OwnerAlias | null> => {
      const result = await api.put(`/api/settings/owner-aliases/${id}`, OwnerAliasSchema, data);
      if (result.ok) {
        setAliases((prev) => prev.map((a) => (a.id === id ? result.data : a)));
        return result.data;
      }
      setError(getErrorMessage(result.error));
      return null;
    },
    []
  );

  const deleteAlias = useCallback(async (id: string): Promise<boolean> => {
    const result = await api.delete(`/api/settings/owner-aliases/${id}`, DeleteResponseSchema);
    if (result.ok) {
      setAliases((prev) => prev.filter((a) => a.id !== id));
      return true;
    }
    setError(getErrorMessage(result.error));
    return false;
  }, []);

  const applyRetroactively = useCallback(async (): Promise<OwnerAliasBatchApplyResponse | null> => {
    const result = await api.post(
      '/api/settings/owner-aliases/apply',
      OwnerAliasBatchApplyResponseSchema
    );
    if (result.ok) {
      return result.data;
    }
    setError(getErrorMessage(result.error));
    return null;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    aliases,
    loading,
    error,
    refresh: fetchAliases,
    addAlias,
    updateAlias,
    deleteAlias,
    applyRetroactively,
    clearError,
  };
}
