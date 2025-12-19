export interface PersonPickerUser {
	id: string;
	email: string;
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
