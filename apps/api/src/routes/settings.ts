import type { FastifyPluginAsync } from 'fastify';
import {
  ProviderConfigCreateSchema,
  ProviderConfigUpdateSchema,
  type ApiResponse,
  type SettingsResponse,
  type ProviderConfig,
} from '@home/types';
import {
  getSettingsResponse,
  createProviderConfig,
  updateProviderConfig,
  deleteProviderConfig,
  setActiveProvider,
  getActiveProvider,
} from '../services/settings-service.js';

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/settings - Get all settings (providers + active)
  app.get('/settings', async (): Promise<ApiResponse<SettingsResponse>> => {
    const settings = await getSettingsResponse();
    return { ok: true, data: settings };
  });

  // POST /api/settings/providers - Create new provider config
  app.post('/settings/providers', async (request, reply): Promise<ApiResponse<ProviderConfig>> => {
    const parseResult = ProviderConfigCreateSchema.safeParse(request.body);

    if (!parseResult.success) {
      reply.code(400);
      return {
        ok: false,
        error: `Validation error: ${parseResult.error.issues.map((e) => e.message).join(', ')}`,
      };
    }

    const provider = await createProviderConfig(parseResult.data);
    return { ok: true, data: provider };
  });

  // PUT /api/settings/providers/:id - Update provider config
  app.put<{ Params: { id: string } }>('/settings/providers/:id', async (request, reply): Promise<ApiResponse<ProviderConfig>> => {
    const { id } = request.params;
    const parseResult = ProviderConfigUpdateSchema.safeParse(request.body);

    if (!parseResult.success) {
      reply.code(400);
      return {
        ok: false,
        error: `Validation error: ${parseResult.error.issues.map((e) => e.message).join(', ')}`,
      };
    }

    const provider = await updateProviderConfig(id, parseResult.data);
    if (!provider) {
      reply.code(404);
      return { ok: false, error: 'Provider configuration not found' };
    }

    return { ok: true, data: provider };
  });

  // DELETE /api/settings/providers/:id - Delete provider config
  app.delete<{ Params: { id: string } }>('/settings/providers/:id', async (request, reply): Promise<ApiResponse<{ deleted: boolean }>> => {
    const { id } = request.params;

    // Prevent deleting the active provider if there are other providers to switch to
    const activeProvider = await getActiveProvider();
    if (activeProvider && activeProvider.id === id) {
      const settings = await getSettingsResponse();
      if (settings.providers.length > 1) {
        reply.code(400);
        return { ok: false, error: 'Cannot delete the active provider. Please activate another provider first.' };
      }
    }

    const deleted = await deleteProviderConfig(id);
    if (!deleted) {
      reply.code(404);
      return { ok: false, error: 'Provider configuration not found' };
    }

    return { ok: true, data: { deleted: true } };
  });

  // POST /api/settings/providers/:id/activate - Set provider as active
  app.post<{ Params: { id: string } }>('/settings/providers/:id/activate', async (request, reply): Promise<ApiResponse<ProviderConfig>> => {
    const { id } = request.params;

    const provider = await setActiveProvider(id);
    if (!provider) {
      reply.code(404);
      return { ok: false, error: 'Provider configuration not found' };
    }

    return { ok: true, data: provider };
  });
};
