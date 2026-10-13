export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
	if (count === 1) {
		return singular;
	}
	return plural;
}
