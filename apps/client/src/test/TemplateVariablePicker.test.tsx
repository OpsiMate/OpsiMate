import { useRef, useState } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { TemplateFieldTarget, TemplateVariablePicker } from '@/components/shared';
import { fireEvent, render, screen, waitFor } from '@/test/test-utils';

interface TemplateHarnessProps {
	variables: string[];
	caption?: string;
	initialFirst?: string;
	initialSecond?: string;
}

// Two controlled fields so the tests can tell the focused/second target apart from the first.
const TemplateHarness = ({ variables, caption, initialFirst = '', initialSecond = '' }: TemplateHarnessProps) => {
	const firstRef = useRef<HTMLInputElement>(null);
	const secondRef = useRef<HTMLInputElement>(null);
	const [first, setFirst] = useState(initialFirst);
	const [second, setSecond] = useState(initialSecond);
	const targets: TemplateFieldTarget[] = [
		{ ref: firstRef, value: first, onChange: setFirst },
		{ ref: secondRef, value: second, onChange: setSecond },
	];

	return (
		<>
			<label>
				First field
				<input ref={firstRef} value={first} onChange={(e) => setFirst(e.target.value)} />
			</label>
			<label>
				Second field
				<input ref={secondRef} value={second} onChange={(e) => setSecond(e.target.value)} />
			</label>
			<TemplateVariablePicker variables={variables} targets={targets} caption={caption} />
		</>
	);
};

describe('TemplateVariablePicker', () => {
	test('renders nothing when there are no variables', () => {
		render(<TemplateVariablePicker variables={[]} targets={[]} />);

		expect(screen.queryByText(/Available variables/)).not.toBeInTheDocument();
		expect(screen.queryAllByRole('button')).toHaveLength(0);
	});

	test('labels every variable as a {{name}} chip with an insert title', () => {
		render(<TemplateHarness variables={['name', 'label.env']} />);

		expect(screen.getByRole('button', { name: '{{name}}' })).toHaveAttribute('title', 'Insert {{name}}');
		expect(screen.getByRole('button', { name: '{{label.env}}' })).toHaveAttribute('title', 'Insert {{label.env}}');
		expect(
			screen.getByText('Available variables — click to insert into the field you are editing:')
		).toBeInTheDocument();
	});

	test('replaces the default caption with a custom one', () => {
		render(<TemplateHarness variables={['name']} caption="Pick a variable" />);

		expect(screen.getByText('Pick a variable')).toBeInTheDocument();
		expect(
			screen.queryByText('Available variables — click to insert into the field you are editing:')
		).not.toBeInTheDocument();
	});

	test('inserts at the caret of the focused field, then restores focus and caret', async () => {
		const user = userEvent.setup();
		render(<TemplateHarness variables={['name']} initialFirst="Disk  full" />);
		const first = screen.getByLabelText<HTMLInputElement>('First field');
		first.focus();
		first.setSelectionRange(4, 4);

		await user.click(screen.getByRole('button', { name: '{{name}}' }));

		expect(first).toHaveValue('Disk{{name}}  full');
		await waitFor(() => expect(first).toHaveFocus());
		await waitFor(() => expect([first.selectionStart, first.selectionEnd]).toEqual([12, 12]));
	});

	test('replaces the selected text', async () => {
		const user = userEvent.setup();
		render(<TemplateHarness variables={['name']} initialFirst="Disk  full" />);
		const first = screen.getByLabelText<HTMLInputElement>('First field');
		first.focus();
		first.setSelectionRange(6, 10);

		await user.click(screen.getByRole('button', { name: '{{name}}' }));

		expect(first).toHaveValue('Disk  {{name}}');
		await waitFor(() => expect(first).toHaveFocus());
		await waitFor(() => expect([first.selectionStart, first.selectionEnd]).toEqual([14, 14]));
	});

	test('inserts into the focused second field, not the first target', async () => {
		const user = userEvent.setup();
		render(<TemplateHarness variables={['label']} initialFirst="first" initialSecond="second" />);
		const second = screen.getByLabelText<HTMLInputElement>('Second field');
		second.focus();
		second.setSelectionRange(3, 3);

		await user.click(screen.getByRole('button', { name: '{{label}}' }));

		expect(second).toHaveValue('sec{{label}}ond');
		expect(screen.getByLabelText('First field')).toHaveValue('first');
	});

	test('appends to the first target when no field is focused', async () => {
		const user = userEvent.setup();
		render(<TemplateHarness variables={['name']} initialFirst="Disk  full" />);

		await user.click(screen.getByRole('button', { name: '{{name}}' }));

		const first = screen.getByLabelText('First field');
		expect(first).toHaveValue('Disk  full{{name}}');
		expect(first).not.toHaveValue('{{name}}Disk  full');
	});

	test('keeps the focused field active when a chip is pressed', () => {
		render(<TemplateHarness variables={['name']} />);
		const first = screen.getByLabelText('First field');
		first.focus();

		const notPrevented = fireEvent.mouseDown(screen.getByRole('button', { name: '{{name}}' }));

		expect(notPrevented).toBe(false);
		expect(first).toHaveFocus();
	});

	test('inserts into the field keyboard focus just left', async () => {
		const user = userEvent.setup();
		render(<TemplateHarness variables={['name']} initialFirst="first" initialSecond="second" />);
		const first = screen.getByLabelText<HTMLInputElement>('First field');
		const second = screen.getByLabelText<HTMLInputElement>('Second field');
		second.focus();
		second.setSelectionRange(2, 2);

		await user.tab();
		const chip = screen.getByRole('button', { name: '{{name}}' });
		expect(chip).toHaveFocus();

		await user.keyboard('{Enter}');

		expect(second).toHaveValue('se{{name}}cond');
		expect(first).toHaveValue('first');
		await waitFor(() => expect(second).toHaveFocus());
	});
});
