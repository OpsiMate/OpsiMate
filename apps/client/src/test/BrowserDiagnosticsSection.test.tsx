import { BrowserDiagnosticsSection } from '@/components/Profile/components/BrowserDiagnosticsSection';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { AllTheProviders } from './TestProviders';

// The profile page prints the diagnostics in full: a verdict a person can read, and the
// raw block support can work from.
describe('BrowserDiagnosticsSection', () => {
	test('prints the report block with versions, browser and capability lines', () => {
		render(
			<AllTheProviders>
				<BrowserDiagnosticsSection />
			</AllTheProviders>
		);
		expect(screen.getByRole('heading', { name: 'Browser check' })).toBeInTheDocument();
		// Collapsed by default; the header alone carries the verdict. Clicking opens it.
		const section = screen.getByText('Browser check').closest('details');
		expect(section).not.toBeNull();
		expect(section).not.toHaveAttribute('open');
		// The verdict sits in the header, readable without opening.
		expect(screen.getByLabelText(/^Browser check: (All good|\d+ problems? found)$/)).toBeInTheDocument();
		fireEvent.click(screen.getByText('Browser check'));
		expect(section).toHaveAttribute('open');
		// The checklist a person reads, with a status icon per row.
		const checks = screen.getByRole('list', { name: 'Browser checks' });
		expect(within(checks).getAllByRole('listitem')).toHaveLength(8);
		expect(within(checks).getByText('Modern colors (oklch)')).toBeInTheDocument();
		expect(within(checks).getAllByRole('img', { name: /OK|Problem|Info/ }).length).toBe(8);
		expect(screen.getByText('Browser')).toBeInTheDocument();
		// The raw report is still there for support, folded away.
		expect(screen.getByText('Technical details for support')).toBeInTheDocument();
		const report = screen.getByLabelText('Browser diagnostics report').textContent ?? '';
		expect(report.startsWith('OpsiMate browser diagnostics')).toBe(true);
		expect(report).toMatch(/^server .*, client .*, http:\/\/localhost/m);
		expect(report).toContain('css oklch:');
		expect(report).toContain('hover capable:');
		expect(report).toMatch(/findings:/);
	});

	test('re-collects when the window changes, so the report is never stale', () => {
		render(
			<AllTheProviders>
				<BrowserDiagnosticsSection />
			</AllTheProviders>
		);
		const report = () => screen.getByLabelText('Browser diagnostics report').textContent ?? '';
		const before = window.innerWidth;
		expect(report()).toContain(`viewport ${before}x`);
		act(() => {
			Object.defineProperty(window, 'innerWidth', { value: before + 123, configurable: true });
			window.dispatchEvent(new Event('resize'));
		});
		expect(report()).toContain(`viewport ${before + 123}x`);
	});

	test('states a verdict: either the findings or that nothing is wrong', () => {
		render(
			<AllTheProviders>
				<BrowserDiagnosticsSection />
			</AllTheProviders>
		);
		// jsdom has no CSS.supports / matchMedia, so it reads as an old, non-hovering browser —
		// the findings list shows, not the all-clear.
		const findings = screen.queryByRole('list', { name: 'Browser findings' });
		const allClear = screen.queryByText(/Everything this page depends on is supported/);
		expect(Boolean(findings) !== Boolean(allClear)).toBe(true);
	});
});
