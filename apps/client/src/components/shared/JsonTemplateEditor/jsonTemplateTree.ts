import { parseJsonTemplate, RawPlaceholder, serializeJsonTemplate } from '@OpsiMate/shared';

// The form view of a JSON body template: the template's JSON value as a tree of rows a
// person edits (key, type, value), and back to template text after every edit. The text
// stays the stored thing — this is only a way of editing it.

export type NodeType = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array' | 'variable';

export interface TemplateNode {
	// Stable across edits, so React rows keep their identity (and focus) while typing.
	id: string;
	// The property name when the parent is an object; unused under arrays and at the root.
	key: string;
	type: NodeType;
	// string: the text (placeholders inside); number: the digits as typed; variable: the
	// placeholder's key without braces; boolean: 'true' | 'false'. Unused otherwise.
	value: string;
	children: TemplateNode[];
}

export const NODE_TYPES: NodeType[] = ['string', 'number', 'boolean', 'null', 'object', 'array', 'variable'];

// Past this the form is a wall of rows and the text is the better editor.
export const MAX_FORM_NODES = 150;
export const MAX_FORM_DEPTH = 6;

let nextId = 1;
const newId = (): string => `n${nextId++}`;

export const makeNode = (partial: Partial<TemplateNode> & { type: NodeType }): TemplateNode => ({
	id: newId(),
	key: '',
	value: partial.type === 'boolean' ? 'false' : '',
	children: [],
	...partial,
});

const fromValue = (key: string, value: unknown): TemplateNode => {
	if (value instanceof RawPlaceholder) return makeNode({ key, type: 'variable', value: value.key });
	if (value === null) return makeNode({ key, type: 'null' });
	if (Array.isArray(value)) {
		return makeNode({ key, type: 'array', children: value.map((item) => fromValue('', item)) });
	}
	switch (typeof value) {
		case 'string':
			return makeNode({ key, type: 'string', value });
		case 'number':
			return makeNode({ key, type: 'number', value: String(value) });
		case 'boolean':
			return makeNode({ key, type: 'boolean', value: String(value) });
		case 'object':
			return makeNode({
				key,
				type: 'object',
				children: Object.entries(value as Record<string, unknown>).map(([k, v]) => fromValue(k, v)),
			});
		default:
			return makeNode({ key, type: 'string', value: String(value) });
	}
};

const toValue = (node: TemplateNode): unknown => {
	switch (node.type) {
		case 'string':
			return node.value;
		case 'number': {
			const n = Number(node.value);
			return node.value.trim() !== '' && Number.isFinite(n) ? n : 0;
		}
		case 'boolean':
			return node.value === 'true';
		case 'null':
			return null;
		case 'variable':
			return new RawPlaceholder(node.value.trim());
		case 'array':
			return node.children.map(toValue);
		case 'object': {
			const out: Record<string, unknown> = {};
			for (const child of node.children) out[child.key] = toValue(child);
			return out;
		}
	}
};

export const countNodes = (node: TemplateNode): number => 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
export const depthOf = (node: TemplateNode): number => 1 + Math.max(0, ...node.children.map(depthOf));

export type ParseOutcome =
	| { ok: true; root: TemplateNode }
	// Why the form cannot show this template: it is not JSON, its root is not an object or
	// array, or it is too big to be a form.
	| { ok: false; reason: 'invalid' | 'scalar' | 'too-large' };

export const templateToTree = (template: string): ParseOutcome => {
	if (template.trim() === '') return { ok: true, root: makeNode({ type: 'object' }) };
	let value: unknown;
	try {
		value = parseJsonTemplate(template);
	} catch {
		return { ok: false, reason: 'invalid' };
	}
	if (value === null || typeof value !== 'object' || value instanceof RawPlaceholder) {
		return { ok: false, reason: 'scalar' };
	}
	const root = fromValue('', value);
	if (countNodes(root) > MAX_FORM_NODES || depthOf(root) > MAX_FORM_DEPTH) return { ok: false, reason: 'too-large' };
	return { ok: true, root };
};

export const treeToTemplate = (root: TemplateNode): string => serializeJsonTemplate(toValue(root));

// Immutable edits: each returns a new tree with one node changed, added or removed.
export const updateNode = (root: TemplateNode, id: string, patch: Partial<TemplateNode>): TemplateNode => {
	if (root.id === id) {
		const next = { ...root, ...patch };
		// A type change resets what no longer applies: children of a scalar, text of a container.
		if (patch.type && patch.type !== root.type) {
			next.children = patch.type === 'object' || patch.type === 'array' ? root.children : [];
			// Unless the caller set the value too, carry over what still fits the new type.
			if (patch.value === undefined) {
				if (patch.type === 'boolean') next.value = 'false';
				else if (patch.type === 'number') next.value = /^-?\d+(\.\d+)?$/.test(root.value) ? root.value : '0';
				else if (patch.type === 'variable') next.value = root.value.replace(/^\{\{\s*|\s*\}\}$/g, '');
			}
		}
		return next;
	}
	return { ...root, children: root.children.map((child) => updateNode(child, id, patch)) };
};

export const addChild = (root: TemplateNode, parentId: string): TemplateNode => {
	if (root.id === parentId) {
		const child = makeNode({ type: 'string', key: root.type === 'object' ? nextKey(root.children) : '' });
		return { ...root, children: [...root.children, child] };
	}
	return { ...root, children: root.children.map((child) => addChild(child, parentId)) };
};

export const removeNode = (root: TemplateNode, id: string): TemplateNode => ({
	...root,
	children: root.children.filter((child) => child.id !== id).map((child) => removeNode(child, id)),
});

// "field", "field2", ... so a new row never silently collides with an existing key.
const nextKey = (siblings: TemplateNode[]): string => {
	const taken = new Set(siblings.map((s) => s.key));
	if (!taken.has('field')) return 'field';
	let n = 2;
	while (taken.has(`field${n}`)) n++;
	return `field${n}`;
};

// Keys that appear twice under one object: JSON cannot hold both, so the form says so.
export const duplicateKeys = (node: TemplateNode): string[] => {
	const dupes: string[] = [];
	if (node.type === 'object') {
		const seen = new Set<string>();
		for (const child of node.children) {
			if (seen.has(child.key)) dupes.push(child.key);
			seen.add(child.key);
		}
	}
	for (const child of node.children) dupes.push(...duplicateKeys(child));
	return dupes;
};
