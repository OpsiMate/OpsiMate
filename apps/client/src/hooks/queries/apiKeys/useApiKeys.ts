import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiKeysApi } from '@/lib/api';
import { ApiKey, ApiKeyResponse } from '@OpsiMate/shared';

// Query keys
export const apiKeyKeys = {
  all: ['apiKeys'] as const,
  lists: () => [...apiKeyKeys.all, 'list'] as const,
  list: (filters: string) => [...apiKeyKeys.lists(), { filters }] as const,
  details: () => [...apiKeyKeys.all, 'detail'] as const,
  detail: (id: number) => [...apiKeyKeys.details(), id] as const,
};

// Get all API keys
export function useApiKeys() {
  return useQuery({
    queryKey: apiKeyKeys.lists(),
    queryFn: async () => {
      const response = await apiKeysApi.getApiKeys();
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch API keys');
    },
  });
}

// Get a specific API key
export function useApiKey(apiKeyId: number) {
  return useQuery({
    queryKey: apiKeyKeys.detail(apiKeyId),
    queryFn: async () => {
      const response = await apiKeysApi.getApiKey(apiKeyId);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch API key');
    },
    enabled: !!apiKeyId,
  });
}

// Create API key mutation
export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; expiresAt?: string }) => {
      const response = await apiKeysApi.createApiKey(data);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to create API key');
    },
    onSuccess: () => {
      // Invalidate and refetch API keys list
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() });
    },
  });
}

// Update API key mutation
export function useUpdateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      apiKeyId, 
      updates 
    }: { 
      apiKeyId: number; 
      updates: { name?: string; isActive?: boolean } 
    }) => {
      const response = await apiKeysApi.updateApiKey(apiKeyId, updates);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to update API key');
    },
    onSuccess: (data, variables) => {
      // Update the specific API key in cache
      queryClient.setQueryData(apiKeyKeys.detail(variables.apiKeyId), data);
      // Invalidate and refetch API keys list
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() });
    },
  });
}

// Delete API key mutation
export function useDeleteApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (apiKeyId: number) => {
      const response = await apiKeysApi.deleteApiKey(apiKeyId);
      // For 204 No Content, response.success will be true but no data
      if (response.success) {
        return apiKeyId;
      }
      throw new Error(response.error || 'Failed to delete API key');
    },
    onSuccess: (apiKeyId) => {
      // Remove the API key from cache
      queryClient.removeQueries({ queryKey: apiKeyKeys.detail(apiKeyId) });
      // Invalidate and refetch API keys list
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() });
    },
  });
}
