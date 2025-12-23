import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';
import { User, Logger } from '@OpsiMate/shared';

const logger = new Logger('useProfileAvatar');

// Allowed content types
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png'];

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Validates the avatar file before upload
 */
export function validateAvatarFile(file: File): { valid: boolean; error?: string } {
	if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
		return {
			valid: false,
			error: 'Invalid file type. Only JPEG and PNG images are allowed.',
		};
	}

	if (file.size > MAX_FILE_SIZE) {
		return {
			valid: false,
			error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
		};
	}

	return { valid: true };
}

/**
 * Hook to upload a user avatar
 * This handles the entire flow: get presigned URL, upload to S3, confirm upload
 */
export const useUploadAvatar = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (file: File): Promise<User> => {
			// Validate file
			const validation = validateAvatarFile(file);
			if (!validation.valid) {
				throw new Error(validation.error);
			}

			// Step 1: Get presigned upload URL
			const uploadUrlResponse = await usersApi.getAvatarUploadUrl(file.type);
			if (!uploadUrlResponse.success || !uploadUrlResponse.data) {
				throw new Error(uploadUrlResponse.error || 'Failed to get upload URL');
			}

			const { uploadUrl, key } = uploadUrlResponse.data;

			// Step 2: Upload file directly to S3 using presigned URL
			try {
				const uploadResponse = await fetch(uploadUrl, {
					method: 'PUT',
					body: file,
					headers: {
						'Content-Type': file.type,
					},
				});

				if (!uploadResponse.ok) {
					throw new Error(`Upload failed with status: ${uploadResponse.status}`);
				}
			} catch (error) {
				logger.error('Error uploading file to S3:', error);
				throw new Error('Failed to upload file. Please try again.');
			}

			// Step 3: Confirm upload with the server
			const confirmResponse = await usersApi.confirmAvatarUpload(key);
			if (!confirmResponse.success || !confirmResponse.data) {
				throw new Error(confirmResponse.error || 'Failed to confirm upload');
			}

			return confirmResponse.data as User;
		},
		onSuccess: (updatedUser) => {
			// Invalidate user-related queries
			queryClient.invalidateQueries({ queryKey: queryKeys.users });
			queryClient.invalidateQueries({ queryKey: ['profile'] });

			// Update cached profile data
			queryClient.setQueryData(['profile'], updatedUser);
		},
		onError: (error) => {
			logger.error('Avatar upload failed:', error);
		},
	});
};

/**
 * Hook to delete a user avatar
 */
export const useDeleteAvatar = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (): Promise<User> => {
			const response = await usersApi.deleteAvatar();
			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to delete avatar');
			}
			return response.data as User;
		},
		onSuccess: (updatedUser) => {
			// Invalidate user-related queries
			queryClient.invalidateQueries({ queryKey: queryKeys.users });
			queryClient.invalidateQueries({ queryKey: ['profile'] });

			// Update cached profile data
			queryClient.setQueryData(['profile'], updatedUser);
		},
		onError: (error) => {
			logger.error('Avatar deletion failed:', error);
		},
	});
};
