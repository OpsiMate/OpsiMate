// Drops blank rows on the way to the API: the editor keeps an empty row visible so the
// control looks like a field, but an empty substring would match every alert name.
// Returns null when nothing is left, matching the "no name criterion" shape the server
// expects (mirrors cleanMatcherGroups).
export const cleanNameMatchers = (values: string[]): string[] | null => {
	const cleaned = values.map((v) => v.trim()).filter((v) => v.length > 0);
	return cleaned.length > 0 ? cleaned : null;
};
