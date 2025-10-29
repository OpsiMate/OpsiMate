import { ErrorAlert } from '@/components/ErrorAlert';
import { Card, CardContent } from '@/components/ui/card';
import { useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { AccountSection, EditProfileForm, ProfileHeader, ProfileInformation, ThemePreferences } from '@/components/Profile/components';
import { useProfileData, useProfileEdit } from '@/components/Profile/hooks';

const Profile: React.FC = () => {
	const { profile, loading, handleApiResponse } = useProfileData();

	const {
		isEditing,
		saving,
		formData,
		errors,
		generalError,
		setFormData,
		handleEdit,
		handleCancel,
		handleSave,
	} = useProfileEdit({
		profile,
	});

	const handleLogout = useCallback(() => {
		localStorage.removeItem('jwt');
		window.location.href = '/login';
	}, []);

	if (loading) {
		return (
			<DashboardLayout>
				<div className="flex items-center justify-center h-full">
					<div className="text-lg">Loading profile...</div>
				</div>
			</DashboardLayout>
		);
	}

	if (!profile) {
		return (
			<DashboardLayout>
				<div className="flex items-center justify-center h-full">
					<div className="text-lg text-red-500">Failed to load profile</div>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout>
			<div className="flex flex-col h-full">
				{/* Header */}
				<div className="flex-shrink-0 bg-background border-b border-border px-6 py-4">
					<h1 className="text-2xl font-bold">Profile</h1>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-auto p-6">
					<div className="max-w-6xl mx-auto">
						<Card>
							<ProfileHeader fullName={profile.fullName} email={profile.email} />
							<CardContent className="space-y-6">
								{generalError && <ErrorAlert message={generalError} />}

								<ProfileInformation
									email={profile.email}
									role={profile.role}
									createdAt={profile.createdAt}
								/>

								<ThemePreferences />

								<EditProfileForm
									isEditing={isEditing}
									saving={saving}
									formData={formData}
									errors={errors}
									onFormDataChange={setFormData}
									onSave={handleSave}
									onCancel={handleCancel}
									onEdit={handleEdit}
								/>

								<AccountSection onLogout={handleLogout} />
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</DashboardLayout>
	);
};

export default Profile;

