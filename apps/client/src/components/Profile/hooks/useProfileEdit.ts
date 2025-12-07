import { useFormErrors } from '@/hooks/useFormErrors';
import { apiRequest } from '@/lib/api';
import { Logger, User } from '@OpsiMate/shared';
import { useCallback, useEffect, useState } from 'react';
import { ProfileFormData } from '../Profile.types';

const logger = new Logger('useProfileEdit');

interface UseProfileEditProps {
	profile: User | null;
	setProfile: React.Dispatch<React.SetStateAction<User | null>>;
}

interface UseProfileEditReturn {
	isEditing: boolean;
	saving: boolean;
	formData: ProfileFormData;
	errors: Record<string, string>;
	generalError: string | null;
	setFormData: React.Dispatch<React.SetStateAction<ProfileFormData>>;
	handleEdit: () => void;
	handleCancel: () => void;
	handleSave: () => Promise<void>;
	clearErrors: () => void;
}

const validatePassword = (password: string): string | null => {
	if (password.length < 6) {
		return 'New password must be at least 6 characters';
	}
	if (/\s/.test(password)) {
		return 'Password must not contain spaces';
	}
	return null;
};

export const useProfileEdit = ({ profile, setProfile }: UseProfileEditProps): UseProfileEditReturn => {
	const [isEditing, setIsEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [formData, setFormData] = useState<ProfileFormData>({
		fullName: profile?.fullName || '',
		newPassword: '',
		confirmPassword: '',
	});
	const { errors, generalError, clearErrors, handleApiResponse } = useFormErrors();

	// Update formData when profile changes
	useEffect(() => {
		if (profile) {
			setFormData((prev) => ({ ...prev, fullName: profile.fullName }));
		}
	}, [profile]);

	const handleEdit = useCallback(() => {
		setIsEditing(true);
		clearErrors();
	}, [clearErrors]);

	const handleCancel = useCallback(() => {
		setIsEditing(false);
		setFormData({
			fullName: profile?.fullName || '',
			newPassword: '',
			confirmPassword: '',
		});
		clearErrors();
	}, [profile, clearErrors]);

	const handleSave = useCallback(async () => {
		setSaving(true);
		clearErrors();

		// Validate passwords if changing password
		if (formData.newPassword) {
			const passwordError = validatePassword(formData.newPassword);
			if (passwordError) {
				handleApiResponse({
					success: false,
					error: passwordError,
				});
				setSaving(false);
				return;
			}

			if (formData.newPassword !== formData.confirmPassword) {
				handleApiResponse({
					success: false,
					error: 'New passwords do not match',
				});
				setSaving(false);
				return;
			}
		}

		try {
			const updateData: { fullName: string; newPassword?: string } = {
				fullName: formData.fullName,
			};

			if (formData.newPassword) {
				updateData.newPassword = formData.newPassword;
			}

			const response = await apiRequest('/users/profile', 'PATCH', updateData);

			if (response.success) {
				// Update JWT token if password was changed
				if (response.data && typeof response.data === 'object' && 'token' in response.data) {
					localStorage.setItem('jwt', response.data.token as string);
				}

				// update local profile state to reflect changes in UI
				setProfile((prev) => (prev ? { ...prev, fullName: updateData.fullName } : prev));

				setIsEditing(false);
				setFormData((prev) => ({
					...prev,
					newPassword: '',
					confirmPassword: '',
				}));

				// Show success message (you might want to add a toast here)
				logger.info('Profile updated successfully');
			} else {
				handleApiResponse(response);
			}
		} catch (error) {
			handleApiResponse({
				success: false,
				error: 'Failed to update profile',
			});
		} finally {
			setSaving(false);
		}
	}, [formData, clearErrors, handleApiResponse, setProfile]);

	return {
		isEditing,
		saving,
		formData,
		errors,
		generalError,
		setFormData,
		handleEdit,
		handleCancel,
		handleSave,
		clearErrors,
	};
};
