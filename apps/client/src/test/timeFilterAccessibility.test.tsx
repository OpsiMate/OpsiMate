import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { CustomTimeFilterTab } from '@/components/Alerts/AlertsTable/TimeFilter/CustomTimeFilterTab/CustomTimeFilterTab';

const renderFilter = () => (
	<CustomTimeFilterTab value={{ from: null, to: null, preset: 'custom' }} onApply={vi.fn()} onClear={vi.fn()} />
);

describe('custom time filter accessibility', () => {
	test('associates date and time labels with their controls', async () => {
		const user = userEvent.setup();
		render(renderFilter());
		for (const endpoint of ['From', 'To']) {
			const date = screen.getByLabelText(endpoint);
			expect(date).toHaveAttribute('type', 'button');
			const time = screen.getByLabelText(`${endpoint} time`);
			expect(time).toHaveAttribute('type', 'time');
			await user.click(screen.getByText(`${endpoint} time`));
			expect(time).toHaveFocus();
		}
		await user.click(screen.getByText('From', { selector: 'label' }));
		expect(screen.getByLabelText('From')).toHaveAttribute('aria-expanded', 'true');
	});

	test('keeps label associations unique when more than one filter is mounted', () => {
		render(
			<>
				<section aria-label="First filter">{renderFilter()}</section>
				<section aria-label="Second filter">{renderFilter()}</section>
			</>
		);
		const first = within(screen.getByRole('region', { name: 'First filter' }));
		const second = within(screen.getByRole('region', { name: 'Second filter' }));
		for (const label of ['From', 'From time', 'To', 'To time']) {
			expect(first.getByLabelText(label).id).not.toBe(second.getByLabelText(label).id);
		}
	});
});
