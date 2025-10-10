class ProviderNotFound extends Error {
  constructor(
    public provider: number,
    message: string = "Provider not found",
  ) {
    super(message);
    this.name = "ProviderNotFound";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export { ProviderNotFound };
