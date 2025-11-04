import { useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ProfileContent, ProfileLoadingState, ProfileErrorState } from '@/components/Profile/components';
import { useProfileData, useProfileEdit } from '@/components/Profile/hooks';

const Profile: React.FC = () => {
	const { profile, loading, setProfile } = useProfileData();

	const { isEditing, saving, formData, errors, generalError, setFormData, handleEdit, handleCancel, handleSave } =
		useProfileEdit({ profile, setProfile });

	const handleLogout = useCallback(() => {
		localStorage.removeItem('jwt');
		window.location.href = '/login';
	}, []);

	if (loading) {
		return <ProfileLoadingState />;
	}

	if (!profile) {
		return <ProfileErrorState />;
	}

	return (
		<DashboardLayout>
			<div className="flex flex-col h-full">
				<div className="flex-shrink-0 bg-background border-b border-border px-6 py-4">
					<h1 className="text-2xl font-bold">Profile</h1>
				</div>
				<ProfileContent
					profile={profile}
					isEditing={isEditing}
					saving={saving}
					formData={formData}
					errors={errors}
					generalError={generalError}
					onFormDataChange={setFormData}
					onSave={handleSave}
					onCancel={handleCancel}
					onEdit={handleEdit}
					onLogout={handleLogout}
				/>
			</div>
		</DashboardLayout>
	);
};

export default Profile;
