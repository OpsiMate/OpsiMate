import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { KpiCard } from '@/components/Analytics/KpiCard';

describe('KpiCard delta chip', () => {
	test('does not show the chip when previous value is undefined', () => {
		render(<KpiCard label="Alerts" value="10" rawValue={10} />);

		expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
	});

	test('does not show the chip when the current value is null', () => {
		render(<KpiCard label="Alerts" value="10" rawValue={null} rawPrevious={8} />);

		expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
	});

	test('hides the chip when the change is tiny', () => {
		render(<KpiCard label="Alerts" value="10" rawValue={10.04} rawPrevious={10} />);

		expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
	});

	test('shows an increase in green when upIsGood is true', () => {
		render(<KpiCard label="Resolved" value="12" rawValue={12} rawPrevious={10} upIsGood />);

		const chip = screen.getByText('20%');
		expect(chip).toHaveClass('text-green-600');
	});

	test('shows an increase in red when upIsGood is false', () => {
		render(<KpiCard label="Alerts" value="12" rawValue={12} rawPrevious={10} />);

		const chip = screen.getByText('20%');
		expect(chip).toHaveClass('text-red-600');
	});

	test('shows the TrendingDown icon for a decrease', () => {
		render(<KpiCard label="Resolved" value="8" rawValue={8} rawPrevious={10} upIsGood />);

		const icon = document.querySelector('.lucide-trending-down');
		expect(icon).toBeInTheDocument();

		const chip = screen.getByText('20%');
		expect(chip).toHaveClass('text-red-600');
	});

	test('renders a delta of 0.126 as 13%', () => {
		render(<KpiCard label="Resolved" value="112.6" rawValue={112.6} rawPrevious={100} upIsGood />);

		expect(screen.getByText('13%')).toBeInTheDocument();
	});

	test('renders the hint only when provided', () => {
		const { rerender } = render(<KpiCard label="Alerts" value="10" hint="Compared with last week" />);

		expect(screen.getByText('Compared with last week')).toBeInTheDocument();

		rerender(<KpiCard label="Alerts" value="10" />);

		expect(screen.queryByText('Compared with last week')).not.toBeInTheDocument();
	});
});
