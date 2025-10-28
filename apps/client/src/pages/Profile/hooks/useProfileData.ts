import { useFormErrors } from '@/hooks/useFormErrors';
import { apiRequest } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { Logger, User as UserType } from '@OpsiMate/shared';
import { useEffect, useState } from 'react';
import { UserProfile } from '../Profile.types';

const logger = new Logger('useProfileData');

interface UseProfileDataReturn {
	profile: UserProfile | null;
	loading: boolean;
	handleApiResponse: ReturnType<typeof useFormErrors>['handleApiResponse'];
}

export const useProfileData = (): UseProfileDataReturn => {
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [loading, setLoading] = useState(false);
	const { handleApiResponse } = useFormErrors();

	useEffect(() => {
		const fetchProfile = async () => {
			setLoading(true);
			try {
				const currentUser = getCurrentUser();
				if (currentUser) {
					// Fetch the full user profile from the server
					const response = await apiRequest<UserType>('/users/profile', 'GET');
					if (response.success && response.data) {
						setProfile({
							id: response.data.id,
							email: response.data.email,
							fullName: response.data.fullName,
							role: response.data.role,
							createdAt: response.data.createdAt,
						});
					} else {
						// Fallback to JWT data if server request fails
						logger.warn('Failed to fetch user profile from server, using JWT data as fallback');
						setProfile({
							id: currentUser.id,
							email: currentUser.email,
							fullName: currentUser.email.split('@')[0], // Use email prefix as fallback
							role: currentUser.role,
							createdAt: new Date().toISOString(),
						});
					}
				}
			} catch (error) {
				handleApiResponse({
					success: false,
					error: 'Failed to load profile',
				});
			} finally {
				setLoading(false);
			}
		};

		fetchProfile();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // Only run once on mount

	return {
		profile,
		loading,
		handleApiResponse,
	};
};
