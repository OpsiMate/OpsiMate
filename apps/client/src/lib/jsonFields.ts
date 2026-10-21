import { parseJsonTemplate, RawPlaceholder } from '@OpsiMate/shared';

// Fields of a JSON body, addressed by dotted path ("labels.site", "tags.0"): the action
// form lists a template's fields so the author can mark which ones the sender may change,
// and the Send dialog reads and writes those fields on the rendered request.

export type FieldKind = 'string' | 'number' | 'boolean' | 'null' | 'variable';

export interface TemplateField {
	path: string;
	kind: FieldKind;
	// The template's text for the field: "" for an empty "comment", "{{summary}}" for one
	// filled per alert.
	sample: string;
}

const join = (prefix: string, key: string | number): string => (prefix ? `${prefix}.${key}` : String(key));

const collect = (value: unknown, prefix: string, out: TemplateField[]): void => {
	if (value instanceof RawPlaceholder) {
		out.push({ path: prefix, kind: 'variable', sample: `{{${value.key}}}` });
	} else if (Array.isArray(value)) {
		value.forEach((item, index) => collect(item, join(prefix, index), out));
	} else if (value !== null && typeof value === 'object') {
		for (const [key, child] of Object.entries(value as Record<string, unknown>))
			collect(child, join(prefix, key), out);
	} else if (value === null) {
		out.push({ path: prefix, kind: 'null', sample: 'null' });
	} else {
		out.push({ path: prefix, kind: typeof value as FieldKind, sample: String(value) });
	}
};

// Every leaf of a JSON body template, in the template's order. Empty when the template is
// not JSON (the form says to fix it first) or has no leaves.
export const listTemplateFields = (template: string): TemplateField[] => {
	if (!template.trim()) return [];
	try {
		const out: TemplateField[] = [];
		collect(parseJsonTemplate(template), '', out);
		return out.filter((f) => f.path !== '');
	} catch {
		return [];
	}
};

const segments = (path: string): string[] => path.split('.');

export const getAtPath = (json: unknown, path: string): unknown => {
	let node: unknown = json;
	for (const seg of segments(path)) {
		if (node === null || typeof node !== 'object') return undefined;
		node = (node as Record<string, unknown>)[seg];
	}
	return node;
};

// A copy of the body with one field replaced; containers on the way are copied, missing
// ones created as objects (or lists, for a numeric segment).
export const setAtPath = (json: unknown, path: string, value: unknown): unknown => {
	const segs = segments(path);
	const set = (node: unknown, index: number): unknown => {
		const seg = segs[index];
		const last = index === segs.length - 1;
		const container: Record<string, unknown> | unknown[] = Array.isArray(node)
			? [...node]
			: node !== null && typeof node === 'object'
				? { ...(node as Record<string, unknown>) }
				: /^\d+$/.test(segs[index])
					? []
					: {};
		const current = (container as Record<string, unknown>)[seg];
		(container as Record<string, unknown>)[seg] = last ? value : set(current, index + 1);
		return container;
	};
	return set(json, 0);
};

// "labels.site" → "labels › site"; "tags.0" → "tags › 1st".
export const pathLabel = (path: string): string =>
	segments(path)
		.map((seg) => (/^\d+$/.test(seg) ? `#${Number(seg) + 1}` : seg))
		.join(' › ');

// What the sender typed, as the type the field had: numbers stay numbers (when the text
// is one), booleans booleans, everything else a string.
export const coerceFieldValue = (original: unknown, text: string): unknown => {
	if (typeof original === 'number') {
		const n = Number(text);
		return text.trim() !== '' && Number.isFinite(n) ? n : text;
	}
	if (typeof original === 'boolean') return text === 'true';
	if (original === null && text === '') return null;
	return text;
};

export const fieldValueText = (value: unknown): string => {
	if (value === undefined || value === null) return '';
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
};
