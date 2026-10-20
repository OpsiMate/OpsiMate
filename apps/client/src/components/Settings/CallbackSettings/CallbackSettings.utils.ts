import { AlertCallbackEvent } from '@OpsiMate/shared';

export interface HeaderRow {
	key: string;
	value: string;
}

export const headersToRows = (headers?: Record<string, string> | null): HeaderRow[] =>
	headers ? Object.entries(headers).map(([key, value]) => ({ key, value })) : [];

// Blank keys are dropped; an empty set is sent as null so the server stores "no headers".
export const rowsToHeaders = (rows: HeaderRow[]): Record<string, string> | null => {
	const headers: Record<string, string> = {};
	for (const row of rows) {
		const key = row.key.trim();
		if (key) headers[key] = row.value;
	}
	return Object.keys(headers).length > 0 ? headers : null;
};

export interface CallbackFormValues {
	name: string;
	url: string;
	events: AlertCallbackEvent[];
	headerRows?: HeaderRow[];
	// The typed secret; empty means "keep or generate", which is always valid.
	secret?: string;
}

export interface CallbackFormErrors {
	name?: string;
	url?: string;
	events?: string;
	headers?: string;
	secret?: string;
}

// The server's limits (CreateAlertCallbackSchema), checked here so a mistake shows under
// its field instead of as a bare "Validation error" toast.
const NAME_MAX_LENGTH = 100;
const URL_MAX_LENGTH = 2000;
const SECRET_MIN_LENGTH = 8;
const SECRET_MAX_LENGTH = 200;
const HEADER_NAME_PATTERN = /^[A-Za-z0-9-]{1,200}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\x00-\x1f\x7f]/;

const isHttpUrl = (value: string): boolean => {
	try {
		const parsed = new URL(value);
		return parsed.protocol === 'http:' || parsed.protocol === 'https:';
	} catch {
		return false;
	}
};

const headerRowsError = (rows: HeaderRow[]): string | undefined => {
	for (const row of rows) {
		const key = row.key.trim();
		if (!key) continue;
		if (!HEADER_NAME_PATTERN.test(key))
			return `"${key}": header names may only contain letters, digits and dashes.`;
		if (CONTROL_CHARACTERS.test(row.value))
			return `"${key}": the value cannot contain line breaks or control characters.`;
	}
	return undefined;
};

const nameError = (name: string): string | undefined => {
	if (!name) return 'Give the callback a name.';
	if (name.length > NAME_MAX_LENGTH) return `Keep the name under ${NAME_MAX_LENGTH} characters.`;
	return undefined;
};

const urlError = (url: string): string | undefined => {
	if (!url) return 'Enter the URL to send to.';
	if (!isHttpUrl(url)) return 'Enter a full http(s) URL.';
	if (url.length > URL_MAX_LENGTH) return `The URL is longer than ${URL_MAX_LENGTH} characters.`;
	return undefined;
};

// Empty means "keep the saved one" (or "generate one" on create), which is always fine.
const secretError = (secret: string): string | undefined =>
	secret && (secret.length < SECRET_MIN_LENGTH || secret.length > SECRET_MAX_LENGTH)
		? `The secret needs ${SECRET_MIN_LENGTH} to ${SECRET_MAX_LENGTH} characters.`
		: undefined;

// Mirrors the server's CreateAlertCallbackSchema for the fields a person types.
export const callbackFormErrors = (values: CallbackFormValues): CallbackFormErrors => {
	const found: CallbackFormErrors = {
		name: nameError(values.name.trim()),
		url: urlError(values.url.trim()),
		events: values.events.length === 0 ? 'Pick at least one event.' : undefined,
		headers: headerRowsError(values.headerRows ?? []),
		secret: secretError(values.secret?.trim() ?? ''),
	};
	// Only the fields with a problem, so "no errors" is {}.
	const errors: CallbackFormErrors = {};
	for (const key of Object.keys(found) as (keyof CallbackFormErrors)[]) {
		if (found[key]) errors[key] = found[key];
	}
	return errors;
};
