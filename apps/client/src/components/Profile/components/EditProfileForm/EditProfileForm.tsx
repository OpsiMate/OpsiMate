import { ErrorAlert } from '@/components/ErrorAlert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Save, User, X } from 'lucide-react';
import { ProfileFormData } from '../../Profile.types';

interface EditProfileFormProps {
	isEditing: boolean;
	saving: boolean;
	formData: ProfileFormData;
	errors: Record<string, string>;
	onFormDataChange: (formData: ProfileFormData) => void;
	onSave: () => void;
	onCancel: () => void;
	onEdit: () => void;
}

export const EditProfileForm = ({
	isEditing,
	saving,
	formData,
	errors,
	onFormDataChange,
	onSave,
	onCancel,
	onEdit,
}: EditProfileFormProps) => {
	if (!isEditing) {
		return (
			<div className="flex gap-3 pt-4 border-t">
				<Button onClick={onEdit} className="flex items-center gap-2">
					<User className="h-4 w-4" />
					Edit Profile
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-4 border-t pt-6">
			<div className="flex items-center gap-3">
				<Lock className="h-5 w-5 text-gray-500" />
				<h3 className="font-semibold">Edit Profile</h3>
			</div>

			<div className="space-y-4">
				<div className="max-w-md">
					<label htmlFor="fullName" className="text-sm font-semibold text-muted-foreground">
						Full Name
					</label>
					<Input
						id="fullName"
						type="text"
						value={formData.fullName}
						onChange={(e) => onFormDataChange({ ...formData, fullName: e.target.value })}
						className="mt-1"
						disabled={saving}
					/>
					{errors.fullName && <ErrorAlert message={errors.fullName} className="mt-2" />}
				</div>

				<div className="space-y-3">
					<h4 className="text-sm font-semibold text-muted-foreground">Change Password (Optional)</h4>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
						<div>
							<label className="text-sm font-semibold text-muted-foreground">New Password</label>
							<Input
								type="password"
								value={formData.newPassword}
								onChange={(e) => onFormDataChange({ ...formData, newPassword: e.target.value })}
								className="mt-1"
								disabled={saving}
								placeholder="Enter new password"
							/>
						</div>

						<div>
							<label className="text-sm font-semibold text-muted-foreground">Confirm Password</label>
							<Input
								type="password"
								value={formData.confirmPassword}
								onChange={(e) => onFormDataChange({ ...formData, confirmPassword: e.target.value })}
								className="mt-1"
								disabled={saving}
								placeholder="Confirm password"
							/>
						</div>
					</div>
				</div>
			</div>

			<div className="flex gap-3 pt-4">
				<Button onClick={onSave} disabled={saving} className="flex items-center gap-2">
					<Save className="h-4 w-4" />
					{saving ? 'Saving...' : 'Save Changes'}
				</Button>
				<Button variant="outline" onClick={onCancel} disabled={saving} className="flex items-center gap-2">
					<X className="h-4 w-4" />
					Cancel
				</Button>
			</div>
		</div>
	);
};
