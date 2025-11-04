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

export const formatDate = (dateString: string): string => {
	return new Date(dateString).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
};
