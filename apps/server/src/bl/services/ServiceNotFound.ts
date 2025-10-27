class ServiceNotFound extends Error {
	constructor(
		public serviceId: number,
		message: string = 'Service not found'
	) {
		super(message);
		this.name = 'ServiceNotFound';
		Object.setPrototypeOf(this, new.target.prototype);
	}
}

export { ServiceNotFound };
