// "<name> (copy)", then "(copy 2)", … — the first suggestion that is not taken.
export const suggestCopyName = (sourceName: string, existingNames: string[]): string => {
	const base = sourceName.trim() || 'New Dashboard';
	const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()));
	let candidate = `${base} (copy)`;
	for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${base} (copy ${n})`;
	return candidate;
};

// Why the name can't be used, or null when it can. Case-insensitive like the switcher's search.
export const copyNameError = (name: string, existingNames: string[]): string | null => {
	const trimmed = name.trim();
	if (trimmed.length === 0) return 'Give the new dashboard a name.';
	const duplicate = existingNames.some((n) => n.trim().toLowerCase() === trimmed.toLowerCase());
	return duplicate ? 'A dashboard with this name already exists.' : null;
};
