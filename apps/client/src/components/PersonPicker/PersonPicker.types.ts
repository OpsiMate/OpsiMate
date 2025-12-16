export interface PersonPickerUser {
	id: number;
	email: string;
	fullName: string;
}

export interface PersonPickerProps {
	selectedUserId: number | null | undefined;
	users: PersonPickerUser[];
	onSelect: (userId: number | null) => void;
	disabled?: boolean;
	className?: string;
	placeholder?: string;
}
