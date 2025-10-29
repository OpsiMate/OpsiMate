// using User type from shared package instead of local UserProfile
export interface ProfileFormData {
	fullName: string;
	newPassword: string;
	confirmPassword: string;
}
