import { describe, expect, test, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { JsonTemplateEditor } from '@/components/shared/JsonTemplateEditor';
import {
	addChild,
	MAX_FORM_NODES,
	removeNode,
	templateToTree,
	treeToTemplate,
	updateNode,
} from '@/components/shared/JsonTemplateEditor/jsonTemplateTree';
import { parseJsonTemplate, RawPlaceholder, serializeJsonTemplate } from '@OpsiMate/shared';
import { render, screen, within } from './test-utils';

// The JSON body template as a form: rows for keys, types and values that write the text
// back after every edit, placeholders kept — bare ones as "variable (raw)". The text
// stays the editor when the template is not JSON or too large to be a form.

const TEMPLATE = `{
  "text": "Alert {{name}} is {{status}}",
  "count": {{label.count}},
  "labels": { "env": "{{label.env}}" },
  "tags": ["a", 2, true, null]
}`;

describe('parse / serialize', () => {
	test('round-trips every value kind with placeholders kept, bare ones written bare', () => {
		const value = parseJsonTemplate(TEMPLATE) as Record<string, unknown>;
		expect(value.text).toBe('Alert {{name}} is {{status}}');
		expect(value.count).toBeInstanceOf(RawPlaceholder);
		expect((value.count as RawPlaceholder).key).toBe('label.count');
		expect(value.tags).toEqual(['a', 2, true, null]);
		const text = serializeJsonTemplate(value);
		expect(text).toContain('"count": {{label.count}}');
		expect(text).toContain('"text": "Alert {{name}} is {{status}}"');
		expect(parseJsonTemplate(text)).toEqual(value);
	});
});

describe('template tree', () => {
	test('text → tree → text is stable, and edits write back as JSON', () => {
		const outcome = templateToTree(TEMPLATE);
		if (!outcome.ok) throw new Error('expected a tree');
		expect(JSON.parse(treeToTemplate(outcome.root).replace(/\{\{label\.count\}\}/, '0'))).toEqual(
			JSON.parse(TEMPLATE.replace(/\{\{label\.count\}\}/, '0'))
		);
		const count = outcome.root.children.find((c) => c.key === 'count')!;
		expect(count.type).toBe('variable');
		expect(count.value).toBe('label.count');

		let root = updateNode(outcome.root, count.id, { type: 'number', value: '7' });
		expect(treeToTemplate(root)).toContain('"count": 7');
		root = addChild(root, root.id);
		expect(treeToTemplate(root)).toContain('"field": ""');
		root = removeNode(root, root.children.find((c) => c.key === 'tags')!.id);
		expect(treeToTemplate(root)).not.toContain('tags');
	});

	test('the form steps aside for invalid JSON, a bare value, or a template that is too large', () => {
		expect(templateToTree('{"a":')).toEqual({ ok: false, reason: 'invalid' });
		expect(templateToTree('"just text"')).toEqual({ ok: false, reason: 'scalar' });
		const big = JSON.stringify(
			Object.fromEntries(Array.from({ length: MAX_FORM_NODES + 1 }, (_, i) => [`k${i}`, i]))
		);
		expect(templateToTree(big)).toEqual({ ok: false, reason: 'too-large' });
		expect(templateToTree('').ok).toBe(true);
	});
});

const renderEditor = (value: string, onChange = vi.fn()) => {
	const ref = createRef<HTMLTextAreaElement>();
	const utils = render(
		<JsonTemplateEditor
			value={value}
			onChange={onChange}
			variables={['name', 'label.count']}
			problem={null}
			textareaId="body"
			textareaRef={ref}
		/>
	);
	return { ...utils, onChange };
};

describe('JsonTemplateEditor', () => {
	test('shows a row per field with its type, and writes an edited value back as template text', async () => {
		const user = userEvent.setup();
		const { onChange } = renderEditor('{"text": "{{name}} fired", "count": {{label.count}}}');
		const rows = within(screen.getByRole('list', { name: 'Body fields' })).getAllByRole('listitem');
		expect(rows).toHaveLength(2);
		expect(screen.getAllByLabelText('Field name').map((el) => (el as HTMLInputElement).value)).toEqual([
			'text',
			'count',
		]);
		expect(screen.getByLabelText('Variable name')).toHaveValue('label.count');

		await user.type(screen.getByLabelText('Field value'), '!');
		const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as string;
		expect(last).toContain('"text": "{{name}} fired!"');
		expect(last).toContain('"count": {{label.count}}');
	});

	test('adds and removes fields', async () => {
		const user = userEvent.setup();
		const { onChange } = renderEditor('{"a": "1"}');
		await user.click(screen.getByRole('button', { name: /Add field/ }));
		expect(onChange.mock.calls[onChange.mock.calls.length - 1][0]).toContain('"field": ""');
		await user.click(screen.getAllByRole('button', { name: 'Remove field' })[0]);
		expect(onChange.mock.calls[onChange.mock.calls.length - 1][0]).not.toContain('"a"');
	});

	test('a template that is not JSON stays in text mode, with the form view disabled and the reason', () => {
		renderEditor('{"a": ');
		expect(screen.getByRole('button', { name: 'Form' })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Text' })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByText(/needs valid JSON/)).toBeInTheDocument();
		expect(screen.getByRole('textbox')).toHaveValue('{"a": ');
	});

	test('a very long template is edited as text, and says why', () => {
		const big = JSON.stringify(
			Object.fromEntries(Array.from({ length: MAX_FORM_NODES + 1 }, (_, i) => [`k${i}`, i]))
		);
		renderEditor(big);
		expect(screen.getByRole('button', { name: 'Form' })).toBeDisabled();
		expect(screen.getByText(/too large for the form view/)).toBeInTheDocument();
	});

	test('switching to text shows the same template; switching back keeps the rows', async () => {
		const user = userEvent.setup();
		renderEditor('{"a": "1"}');
		await user.click(screen.getByRole('button', { name: 'Text' }));
		expect(screen.getByRole('textbox')).toHaveValue('{"a": "1"}');
		await user.click(screen.getByRole('button', { name: 'Form' }));
		expect(screen.getByLabelText('Field name')).toHaveValue('a');
	});
});
