class DuplicateProviderError extends Error {
	constructor(
		public name: string,
		public providerType: string
	) {
		super(`Provider with name "${name}" and type "${providerType}" already exists`);
		this.name = 'DuplicateProviderError';
	}
}

export { DuplicateProviderError };