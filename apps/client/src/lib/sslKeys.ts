import { secretsApi } from './api';
import { SecretMetadata } from '@OpsiMate/shared';

// Server-based secrets functions
export async function getSecretsFromServer(): Promise<SecretMetadata[]> {
  try {
    const response = await secretsApi.getSecrets();
    if (response.success && response.data) {
      return response.data.secrets;
    }
    return [];
  } catch (error) {
    console.error('Error fetching secrets from server:', error);
    return [];
  }
}

export async function createSecretOnServer(displayName: string, file: File, secretType: 'ssh' | 'kubeconfig' = 'ssh'): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    const response = await secretsApi.createSecret(displayName, file, secretType);
    if (response.success && response.data) {
      return { success: true, id: response.data.id };
    }
    return { success: false, error: response.error || 'Failed to create secret' };
  } catch (error) {
    console.error('Error creating secret on server:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}

export async function deleteSecretOnServer(secretId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await secretsApi.deleteSecret(secretId);
    if (response.success) {
      return { success: true };
    }
    return { success: false, error: response.error || 'Failed to delete secret' };
  } catch (error) {
    console.error('Error deleting secret on server:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}


