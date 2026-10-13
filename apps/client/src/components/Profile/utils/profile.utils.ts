export const getInitials = (name: string): string => {
	const trimmed = name.trim();
	if (!trimmed) return '?';
	return trimmed
		.split(' ')
		.map((word) => word.charAt(0))
		.join('')
		.toUpperCase()
		.slice(0, 2);
};
