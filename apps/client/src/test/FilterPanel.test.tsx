import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { FilterPanel, FilterPanelConfig } from '@/components/shared/FilterPanel';

// The sidebar's option rows use +/− controls (no checkboxes): row click or "+" includes,
// "−" filters the value OUT (stored under a "!<field>" key), and the two states are
// mutually exclusive per value.

const config: FilterPanelConfig = {
	fields: ['severity'],
	fieldLabels: { severity: 'Severity' },
};

const facets = {
	severity: [
		{ value: 'Critical', count: 3 },
		{ value: 'Info', count: 5 },
	],
};

describe('FilterPanel +/− controls', () => {
	test('the + button includes a value', () => {
		const onFilterChange = vi.fn();
		render(<FilterPanel config={config} facets={facets} filters={{}} onFilterChange={onFilterChange} />);

		fireEvent.click(screen.getByRole('button', { name: 'Filter Critical' }));
		expect(onFilterChange).toHaveBeenCalledWith({ severity: ['Critical'] });
	});

	test('clicking the row body also includes (the old checkbox gesture)', () => {
		const onFilterChange = vi.fn();
		render(<FilterPanel config={config} facets={facets} filters={{}} onFilterChange={onFilterChange} />);

		fireEvent.click(screen.getByTitle('Info'));
		expect(onFilterChange).toHaveBeenCalledWith({ severity: ['Info'] });
	});

	test('the − button excludes a value under the !field key', () => {
		const onFilterChange = vi.fn();
		render(<FilterPanel config={config} facets={facets} filters={{}} onFilterChange={onFilterChange} />);

		fireEvent.click(screen.getByRole('button', { name: 'Filter out Critical' }));
		expect(onFilterChange).toHaveBeenCalledWith({ '!severity': ['Critical'] });
	});

	test('excluding an included value drops the include (mutually exclusive)', () => {
		const onFilterChange = vi.fn();
		render(
			<FilterPanel
				config={config}
				facets={facets}
				filters={{ severity: ['Critical'] }}
				onFilterChange={onFilterChange}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: 'Filter out Critical' }));
		expect(onFilterChange).toHaveBeenCalledWith({ severity: [], '!severity': ['Critical'] });
	});

	test('including an excluded value drops the exclusion', () => {
		const onFilterChange = vi.fn();
		render(
			<FilterPanel
				config={config}
				facets={facets}
				filters={{ '!severity': ['Critical'] }}
				onFilterChange={onFilterChange}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: 'Filter Critical' }));
		expect(onFilterChange).toHaveBeenCalledWith({ severity: ['Critical'], '!severity': [] });
	});

	test('an excluded value shows a red ≠ chip that removes the exclusion on click', () => {
		const onFilterChange = vi.fn();
		render(
			<FilterPanel
				config={config}
				facets={facets}
				filters={{ '!severity': ['Critical'] }}
				onFilterChange={onFilterChange}
			/>
		);

		const chip = screen.getByRole('button', { name: 'Remove Severity ≠ Critical' });
		fireEvent.click(chip);
		expect(onFilterChange).toHaveBeenCalledWith({ '!severity': [] });
	});

	test('an excluded value that no longer appears in any facet still renders as an option', () => {
		const onFilterChange = vi.fn();
		render(
			<FilterPanel
				config={config}
				facets={{ severity: [{ value: 'Info', count: 5 }] }}
				filters={{ '!severity': ['Critical'] }}
				onFilterChange={onFilterChange}
			/>
		);

		expect(screen.getByTitle('Critical')).toBeInTheDocument();
	});
});
