import { describe, expect, test, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { EditableFieldsPicker, MAX_EDITABLE_FIELDS } from '@/components/Actions/EditableFieldsPicker';
import { SendFieldsForm } from '@/components/Alerts/AlertDetails/AlertActionsSection/SendFieldsForm';
import { getAtPath, listTemplateFields, pathLabel, setAtPath } from '@/lib/jsonFields';
import { render, screen, within } from './test-utils';

// The edges of "fields the sender can change": a body near the 10,000-character template
// limit with hundreds of leaves, deep nesting, lists of objects, keys that contain dots,
// slashes, spaces, quotes, emoji or nothing at all, big and odd numbers. Paths must address
// every leaf exactly, the picker must stay usable, and edits must land where they aim.

// ~230 leaves, 8 levels deep, awkward keys, every value kind.
const buildHugeTemplate = (): string => {
	const body: Record<string, unknown> = {
		'dotted.key': 'has a dot',
		'slash/key': 'has a slash',
		'tilde~key': 'has a tilde',
		'spaced key': 'has spaces',
		'quote"key': 'has a quote',
		'🇮🇱 flag key': '{{flag.il}}',
		'': 'empty key',
		bigInt: Number('12345678901234567890'),
		float: 1.5e-7,
		negative: -42,
		nothing: null,
		on: true,
		summary: '{{summary}}',
		items: Array.from({ length: 12 }, (_, i) => ({
			id: i,
			name: `item ${i}`,
			tags: ['a', 'b', { deep: { deeper: { deepest: { bottom: `leaf ${i}` } } } }],
		})),
	};
	let node: Record<string, unknown> = body;
	for (let level = 0; level < 8; level++) {
		const next: Record<string, unknown> = { level, note: `level ${level}` };
		node[`nested${level}`] = next;
		node = next;
	}
	for (let i = 0; i < 120; i++) body[`label_${i}`] = `{{label.l${i}}}`;
	return JSON.stringify(body, null, 2);
};

describe('huge templates', () => {
	test('a decimal can be typed one key at a time into a number field', async () => {
		const user = userEvent.setup();
		let body: Record<string, unknown> = { ratio: 2 };
		const onChange = vi.fn((next: unknown) => {
			body = next as Record<string, unknown>;
			rerender(
				<SendFieldsForm body={body} original={{ ratio: 2 }} fields={[{ path: '/ratio' }]} onChange={onChange} />
			);
		});
		const { rerender } = render(
			<SendFieldsForm body={body} original={{ ratio: 2 }} fields={[{ path: '/ratio' }]} onChange={onChange} />
		);
		const field = screen.getByLabelText('ratio');
		await user.clear(field);
		await user.type(field, '1.5');
		expect(field).toHaveValue('1.5');
		expect(body.ratio).toBe(1.5);
		await user.type(field, '0');
		expect(field).toHaveValue('1.50');
		expect(body.ratio).toBe(1.5);
	});

	const template = buildHugeTemplate();

	test('is a realistic worst case, and every leaf gets a pointer that reads back the same value', () => {
		expect(template.length).toBeGreaterThan(5000);
		expect(template.length).toBeLessThan(10000);
		const fields = listTemplateFields(template);
		expect(fields.length).toBeGreaterThan(200);
		const value = JSON.parse(template.replace(/\{\{[\w.]+\}\}/g, 'x')) as unknown;
		// Pointers round-trip: for each listed field, reading at its path finds a leaf.
		for (const field of fields) {
			const found = getAtPath(value, field.path);
			expect(found === null || typeof found !== 'object', field.path).toBe(true);
		}
		const byPath = Object.fromEntries(fields.map((f) => [f.path, f]));
		expect(byPath['/dotted.key'].sample).toBe('has a dot');
		expect(byPath['/slash~1key'].sample).toBe('has a slash');
		expect(byPath['/tilde~0key'].sample).toBe('has a tilde');
		expect(byPath['/'].sample).toBe('empty key');
		expect(byPath['/items/11/tags/2/deep/deeper/deepest/bottom'].sample).toBe('leaf 11');
		expect(byPath['/nested0/nested1/nested2/nested3/nested4/nested5/nested6/nested7/note'].sample).toBe('level 7');
		expect(pathLabel('/slash~1key')).toBe('slash/key');
		expect(pathLabel('/')).toBe('(empty key)');
		expect(pathLabel('/items/11/tags/2/deep')).toBe('items › #12 › tags › #3 › deep');
	});

	test('setting a deep field changes only that field', () => {
		const value = JSON.parse(template.replace(/\{\{[\w.]+\}\}/g, 'x')) as Record<string, unknown>;
		const next = setAtPath(value, '/items/11/tags/2/deep/deeper/deepest/bottom', 'changed') as typeof value;
		expect(getAtPath(next, '/items/11/tags/2/deep/deeper/deepest/bottom')).toBe('changed');
		expect(getAtPath(next, '/items/10/tags/2/deep/deeper/deepest/bottom')).toBe('leaf 10');
		expect(getAtPath(value, '/items/11/tags/2/deep/deeper/deepest/bottom')).toBe('leaf 11');
		expect(getAtPath(setAtPath(value, '/slash~1key', 'v'), '/slash~1key')).toBe('v');
		expect(getAtPath(setAtPath(value, '/', 'v'), '/')).toBe('v');
		expect(JSON.stringify(Object.keys(next))).toBe(JSON.stringify(Object.keys(value)));
	});

	test('the picker lists them all, filters, and stops at the limit', async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		const chosen = Array.from({ length: MAX_EDITABLE_FIELDS }, (_, i) => ({ path: `/label_${i}` }));
		const { rerender } = render(<EditableFieldsPicker template={template} value={[]} onChange={onChange} />);
		const list = screen.getByRole('list', { name: 'Fields the sender can change' });
		expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(200);

		await user.type(screen.getByLabelText('Filter fields'), 'deepest');
		expect(within(list).getAllByRole('listitem')).toHaveLength(12);
		await user.clear(screen.getByLabelText('Filter fields'));
		await user.type(screen.getByLabelText('Filter fields'), 'no such field');
		expect(within(list).getByText(/No field matches/)).toBeInTheDocument();
		await user.clear(screen.getByLabelText('Filter fields'));

		rerender(<EditableFieldsPicker template={template} value={chosen} onChange={onChange} />);
		expect(screen.getByText(/that is the limit/)).toBeInTheDocument();
		expect(screen.getByRole('checkbox', { name: 'Sender can change dotted.key' })).toBeDisabled();
		expect(screen.getByRole('checkbox', { name: 'Sender can change label_3' })).toBeEnabled();
	});

	test('the Send form handles odd keys, a big number and a list-of-objects field', async () => {
		const user = userEvent.setup();
		const body = JSON.parse(template.replace(/\{\{[\w.]+\}\}/g, 'x')) as Record<string, unknown>;
		const onChange = vi.fn();
		render(
			<SendFieldsForm
				body={body}
				original={body}
				fields={[
					{ path: '/slash~1key', label: 'Slash' },
					{ path: '/', label: 'Empty key' },
					{ path: '/bigInt' },
					{ path: '/items/3/name' },
					{ path: '/missing/field' },
				]}
				onChange={onChange}
			/>
		);
		expect(screen.getByLabelText(/Slash/)).toHaveValue('has a slash');
		expect(screen.getByLabelText(/Empty key/)).toHaveValue('empty key');
		expect(screen.getByLabelText('items › #4 › name')).toHaveValue('item 3');
		expect(screen.getByText(/Not in this request: missing › field/)).toBeInTheDocument();

		await user.type(screen.getByLabelText('items › #4 › name'), '!');
		const next = onChange.mock.calls[0][0] as Record<string, unknown>;
		expect(getAtPath(next, '/items/3/name')).toBe('item 3!');
		expect(getAtPath(next, '/items/2/name')).toBe('item 2');
		// A big number keeps its numeric type when edited to another number.
		await user.clear(screen.getByLabelText('bigInt'));
		await user.type(screen.getByLabelText('bigInt'), '7');
		const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Record<string, unknown>;
		expect(typeof getAtPath(last, '/bigInt')).toBe('number');
	});
});
