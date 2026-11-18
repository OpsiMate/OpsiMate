export interface PersonPickerUser {
	id: string;
	// Shown where the account has no email.
	username: string;
	// null for an account without a contact address.
	email: string | null;
	fullName: string;
}

export interface PersonPickerProps {
	selectedUserId: string | null | undefined;
	users: PersonPickerUser[];
	onSelect: (userId: string | null) => void;
	disabled?: boolean;
	className?: string;
	placeholder?: string;
}
