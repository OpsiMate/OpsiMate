import { useFormErrors } from '@/hooks/useFormErrors';
import { apiRequest } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { Logger, User } from '@OpsiMate/shared';
import { useEffect, useState } from 'react';

const logger = new Logger('useProfileData');

interface UseProfileDataReturn {
	profile: User | null;
	loading: boolean;
	handleApiResponse: ReturnType<typeof useFormErrors>['handleApiResponse'];
	setProfile: React.Dispatch<React.SetStateAction<User | null>>;
}

export const useProfileData = (): UseProfileDataReturn => {
	const [profile, setProfile] = useState<User | null>(null);
	const [loading, setLoading] = useState(false);
	const { handleApiResponse } = useFormErrors();

	useEffect(() => {
		const fetchProfile = async () => {
			setLoading(true);
			try {
				const currentUser = getCurrentUser();
				if (currentUser) {
					const response = await apiRequest<User>('/users/profile', 'GET');
					if (response.success && response.data) {
						setProfile({
							id: response.data.id,
							email: response.data.email,
							fullName: response.data.fullName,
							role: response.data.role,
							createdAt: response.data.createdAt,
						});
					} else {
						logger.warn('Failed to fetch user profile from server, using JWT data as fallback');
						setProfile({
							id: String(currentUser.id),
							email: currentUser.email,
							fullName: currentUser.email.split('@')[0],
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
	}, []);

	return {
		profile,
		loading,
		handleApiResponse,
		setProfile,
	};
};
