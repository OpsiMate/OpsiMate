export const createServiceNameLookup = (
	services: Array<{ id: string | number; name: string }>
): Record<string | number, string> => {
	const map: Record<string | number, string> = {};
	services.forEach((s) => {
		map[s.id] = s.name;
	});
	return map;
};
