import { ErrorAlert } from '@/components/ErrorAlert';
import { Card, CardContent } from '@/components/ui/card';
import { User } from '@OpsiMate/shared';
import { AccountSection } from '../AccountSection';
import { EditProfileForm } from '../EditProfileForm';
import { ProfileHeader } from '../ProfileHeader';
import { ProfileInformation } from '../ProfileInformation';
import { ThemePreferences } from '../ThemePreferences';
import { ProfileFormData } from '../../Profile.types';

interface ProfileContentProps {
	profile: User;
	isEditing: boolean;
	saving: boolean;
	formData: ProfileFormData;
	errors: Record<string, string>;
	generalError: string | null;
	onFormDataChange: (formData: ProfileFormData) => void;
	onSave: () => void;
	onCancel: () => void;
	onEdit: () => void;
	onLogout: () => void;
}

export const ProfileContent = ({
	profile,
	isEditing,
	saving,
	formData,
	errors,
	generalError,
	onFormDataChange,
	onSave,
	onCancel,
	onEdit,
	onLogout,
}: ProfileContentProps) => {
	return (
		<div className="flex-1 overflow-auto p-6">
			<div className="max-w-6xl mx-auto">
				<Card>
					<ProfileHeader fullName={profile.fullName} email={profile.email} />
					<CardContent className="space-y-6">
						{generalError && <ErrorAlert message={generalError} />}

						<ProfileInformation email={profile.email} role={profile.role} createdAt={profile.createdAt} />

						<ThemePreferences />

						<EditProfileForm
							isEditing={isEditing}
							saving={saving}
							formData={formData}
							errors={errors}
							onFormDataChange={onFormDataChange}
							onSave={onSave}
							onCancel={onCancel}
							onEdit={onEdit}
						/>

						<AccountSection onLogout={onLogout} />
					</CardContent>
				</Card>
			</div>
		</div>
	);
};
