// JSON body templates for HTTP actions. A template like {"text": "{{summary}}"} is written
// once and filled per alert — and an alert's summary can hold quotes, backslashes or
// newlines, which plain text substitution would paste in raw and break the JSON. Here
// the template is treated as JSON, not text: placeholders are swapped for sentinels,
// the template is parsed, the values are set on the parsed structure, and the result is
// serialised again — so whatever the values contain, the output is valid JSON and the
// receiver reads back exactly the text the alert carried.
//
// A placeholder may also stand bare, outside any string ({"count": {{count}}}); it is
// quoted for parsing and, on output, inserted as a JSON value when the text is one
// (a number, true/false/null, an object or array), as a string otherwise.

export type HttpBodyFormat = 'json' | 'text';

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

interface Placeholder {
	key: string;
	// Appeared outside a JSON string literal, so the value may be a non-string JSON value.
	bare: boolean;
}

interface Tokenized {
	// The template with every placeholder replaced by a sentinel, bare ones quoted.
	text: string;
	sentinels: Map<string, Placeholder>;
	sentinelPattern: RegExp;
}

// Replaces placeholders with sentinels, tracking whether each sat inside a string literal.
// A tiny scanner, because the template is not yet valid JSON while it holds placeholders.
const tokenize = (template: string): Tokenized => {
	const nonce = Math.random().toString(36).slice(2, 10);
	const sentinels = new Map<string, Placeholder>();
	let text = '';
	let inString = false;
	let escaped = false;
	let index = 0;
	const placeholderAt = (at: number): RegExpExecArray | null => {
		PLACEHOLDER.lastIndex = at;
		const match = PLACEHOLDER.exec(template);
		return match && match.index === at ? match : null;
	};
	while (index < template.length) {
		const char = template[index];
		if (inString) {
			if (escaped) escaped = false;
			else if (char === '\\') escaped = true;
			else if (char === '"') inString = false;
			else {
				const match = placeholderAt(index);
				if (match) {
					const sentinel = `__ph_${nonce}_${sentinels.size}__`;
					sentinels.set(sentinel, { key: match[1], bare: false });
					text += sentinel;
					index += match[0].length;
					continue;
				}
			}
		} else if (char === '"') {
			inString = true;
		} else {
			const match = placeholderAt(index);
			if (match) {
				const sentinel = `__ph_${nonce}_${sentinels.size}__`;
				sentinels.set(sentinel, { key: match[1], bare: true });
				text += `"${sentinel}"`;
				index += match[0].length;
				continue;
			}
		}
		text += char;
		index += 1;
	}
	return { text, sentinels, sentinelPattern: new RegExp(`__ph_${nonce}_\\d+__`, 'g') };
};

// null when the template is valid JSON once its placeholders are read as strings;
// otherwise the parser's message, for the form to show.
export const validateJsonTemplate = (template: string): string | null => {
	try {
		JSON.parse(tokenize(template).text);
		return null;
	} catch (error) {
		return error instanceof Error ? error.message.replace(/^JSON\.parse: /, '') : 'Invalid JSON';
	}
};

export const looksLikeJson = (template: string): boolean => /^\s*[[{]/.test(template);

// A bare value is inserted as JSON when the text is JSON (42, true, null, {...}, [...]),
// as a string otherwise. Unknown placeholders stay literal, as everywhere else.
const bareValue = (value: string): unknown => {
	const trimmed = value.trim();
	if (trimmed === '') return '';
	if (/^(-?\d|true$|false$|null$|[[{])/.test(trimmed)) {
		try {
			return JSON.parse(trimmed) as unknown;
		} catch {
			return value;
		}
	}
	return value;
};

export type TemplateResolver = (key: string) => string | undefined;

const fill = (node: unknown, tokens: Tokenized, resolve: TemplateResolver): unknown => {
	if (typeof node === 'string') {
		const whole = tokens.sentinels.get(node);
		if (whole?.bare) {
			const value = resolve(whole.key);
			return value === undefined ? `{{${whole.key}}}` : bareValue(value);
		}
		return node.replace(tokens.sentinelPattern, (sentinel) => {
			const placeholder = tokens.sentinels.get(sentinel);
			if (!placeholder) return sentinel;
			return resolve(placeholder.key) ?? `{{${placeholder.key}}}`;
		});
	}
	if (Array.isArray(node)) return node.map((item) => fill(item, tokens, resolve));
	if (node !== null && typeof node === 'object') {
		const out: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
			out[fill(key, tokens, resolve) as string] = fill(value, tokens, resolve);
		}
		return out;
	}
	return node;
};

// The template filled in as JSON. Throws when the template itself is not valid JSON —
// callers decide whether that is a validation error (saving) or a reason to fall back to
// text substitution (running an action saved before validation existed).
export const renderJsonTemplate = (template: string, resolve: TemplateResolver): string => {
	const tokens = tokenize(template);
	const parsed = JSON.parse(tokens.text) as unknown;
	const filled = fill(parsed, tokens, resolve);
	// Keep the template's shape: pretty when it was written over several lines.
	return template.includes('\n') ? JSON.stringify(filled, null, 2) : JSON.stringify(filled);
};
