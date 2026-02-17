class DuplicateProviderError extends Error {
	constructor(
		public providerName: string,
		public providerType: string
	) {
		super(`Provider with name "${providerName}" and type "${providerType}" already exists`);
		this.name = 'DuplicateProviderError';
	}
}

export { DuplicateProviderError };