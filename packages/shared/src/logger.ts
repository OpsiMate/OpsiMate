type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogOptions {
	extraArgs?: Record<string, unknown>;
}

const getTimestamp = (): string => new Date().toISOString();

export class Logger {
	constructor(private context: string) {}

	private readonly sensitiveKeyPattern = /(password|pass|token|secret|key)$/i;

	private sanitize(data: unknown): unknown {
		if (data instanceof Error) {
			const serialized: Record<string, unknown> = {
				name: data.name,
				message: data.message,
				stack: data.stack,
				cause: data.cause,
			};

			return serialized;
		}
		if (Array.isArray(data)) {
			return data.map((item) => this.sanitize(item));
		}
		if (data && typeof data === 'object') {
			return Object.fromEntries(
				Object.entries(data as Record<string, unknown>).map(([k, v]) => {
					if (this.sensitiveKeyPattern.test(k)) {
						return [k, '[REDACTED]'];
					}
					return [k, this.sanitize(v)];
				})
			);
		}
		return data;
	}

	private formatMessage(level: LogLevel, message: string): string {
		const parts = [`[${getTimestamp()}]`, `[${level.toUpperCase()}]`, `[${this.context}]`, message];
		return parts.join(' ');
	}

	private log(level: LogLevel, message: string, options?: LogOptions): void {
		const formatted = this.formatMessage(level, message);

		switch (level) {
			case 'info':
				// eslint-disable-next-line no-console
				console.log(formatted);
				break;
			case 'warn':
				// eslint-disable-next-line no-console
				console.warn(formatted);
				break;
			case 'error':
				// eslint-disable-next-line no-console
				console.error(formatted);
				break;
			case 'debug':
				// eslint-disable-next-line no-console
				console.debug(formatted);
				break;
		}

		if (options?.extraArgs) {
			const safeArgs = this.sanitize(options.extraArgs);
			// eslint-disable-next-line no-console
			console.dir({ extraArgs: safeArgs }, { depth: null, colors: true });
		}
	}

	info = (msg: string, options?: LogOptions) => this.log('info', msg, options);
	warn = (msg: string, options?: LogOptions) => this.log('warn', msg, options);
	error = (msg: string, error?: unknown, options?: LogOptions) =>
		this.log('error', msg, {
			...options,
			extraArgs: { ...options?.extraArgs, err: error },
		});
	debug = (msg: string, options?: LogOptions) => this.log('debug', msg, options);
}
