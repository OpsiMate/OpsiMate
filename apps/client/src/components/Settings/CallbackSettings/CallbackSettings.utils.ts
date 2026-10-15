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
}

export interface CallbackFormErrors {
	name?: string;
	url?: string;
	events?: string;
}

const isHttpUrl = (value: string): boolean => {
	try {
		const parsed = new URL(value);
		return parsed.protocol === 'http:' || parsed.protocol === 'https:';
	} catch {
		return false;
	}
};

// Mirrors the server's CreateAlertCallbackSchema for the fields a person types.
export const callbackFormErrors = (values: CallbackFormValues): CallbackFormErrors => {
	const errors: CallbackFormErrors = {};
	if (!values.name.trim()) errors.name = 'Give the callback a name.';
	if (!values.url.trim()) errors.url = 'Enter the URL to send to.';
	else if (!isHttpUrl(values.url.trim())) errors.url = 'Enter a full http(s) URL.';
	if (values.events.length === 0) errors.events = 'Pick at least one event.';
	return errors;
};
