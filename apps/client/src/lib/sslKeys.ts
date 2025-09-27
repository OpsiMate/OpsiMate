import { secretsApi } from './api';
import { SecretMetadata,SecretType } from '@OpsiMate/shared';
import { API_BASE_URL } from './api';
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


export const updateSecretOnServer = async (secretId: number, updateData: {
    displayName?: string;
    secretType?: SecretType;  // Changed from string literal to SecretType enum
    file?: File;
}) => {
    try {
        const formData = new FormData();
        
        if (updateData.displayName) {
            formData.append('displayName', updateData.displayName);
        }
        
        if (updateData.secretType) {
            formData.append('secretType', updateData.secretType);
        }
        
        if (updateData.file) {
            formData.append('secret_file', updateData.file);
        }

        // Get JWT token from localStorage (same as your other API calls)
        const token = localStorage.getItem('jwt');
        const response = await fetch(`${API_BASE_URL}/secrets/${secretId}`, {
            method: 'PATCH',
            headers: {
                // Add Authorization header if token exists
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            credentials: 'include', // Include cookies (consistent with your other API calls)
            body: formData,
        });

        if (!response.ok) {
            // Handle 401 unauthorized (same as your main API)
            if (response.status === 401) {
                window.location.href = "/login?expired=true";
                localStorage.removeItem('jwt');
                return;
            }

            const errorText = await response.text();
            console.error(`API Error (${response.status}):`, errorText);
            
            try {
                const errorJson = JSON.parse(errorText);
                throw new Error(errorJson.error || 'Failed to update secret');
            } catch {
                throw new Error(`HTTP ${response.status}: ${errorText || 'Unknown error'}`);
            }
        }

        return await response.json();
    } catch (error) {
        console.error('API Error updating secret:', error);
        throw error;
    }
};
