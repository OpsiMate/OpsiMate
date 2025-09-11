import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { ServiceCustomField } from '@OpsiMate/shared';

export const customFieldsKeys = {
  all: ['custom-fields'] as const,
  lists: () => [...customFieldsKeys.all, 'list'] as const,
  list: (filters: string) => [...customFieldsKeys.lists(), { filters }] as const,
  details: () => [...customFieldsKeys.all, 'detail'] as const,
  detail: (id: number) => [...customFieldsKeys.details(), id] as const,
};

// Get all custom fields
export const useCustomFields = () => {
  return useQuery({
    queryKey: customFieldsKeys.lists(),
    queryFn: async () => {
      const response = await apiRequest<{
        customFields: ServiceCustomField[];
      }>('/custom-fields', 'GET');
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch custom fields');
      }
      return response.data.customFields;
    },
  });
};

// Get single custom field
export const useCustomField = (id: number) => {
  return useQuery({
    queryKey: customFieldsKeys.detail(id),
    queryFn: async () => {
      const response = await apiRequest<{
        customField: ServiceCustomField;
      }>(`/custom-fields/${id}`, 'GET');
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch custom field');
      }
      return response.data.customField;
    },
    enabled: !!id,
  });
};

// Create custom field
export const useCreateCustomField = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest<{
        id: number;
      }>('/custom-fields', 'POST', { name });
      if (!response.success) {
        throw new Error(response.error || 'Failed to create custom field');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldsKeys.lists() });
    },
  });
};

// Update custom field
export const useUpdateCustomField = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const response = await apiRequest('/custom-fields/' + id, 'PUT', { name });
      if (!response.success) {
        throw new Error(response.error || 'Failed to update custom field');
      }
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: customFieldsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: customFieldsKeys.detail(variables.id) });
    },
  });
};

// Delete custom field
export const useDeleteCustomField = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/custom-fields/${id}`, 'DELETE');
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete custom field');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldsKeys.lists() });
    },
  });
};
