export interface UserProfile {
	id: number;
	email: string;
	fullName: string;
	role: string;
	createdAt: string;
}

export interface ProfileFormData {
	fullName: string;
	newPassword: string;
	confirmPassword: string;
}
