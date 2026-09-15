import { AlertRootCauseSection } from '@/components/Alerts/AlertDetails/AlertRootCauseSection';
import { AlertRootCause } from '@OpsiMate/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AllTheProviders } from './TestProviders';

// The rating hooks are mocked at the module boundary: this test is about the
// thumbs-down → "what went wrong?" flow, not about fetching.
const { mutate, rootCauseState } = vi.hoisted(() => ({
	mutate: vi.fn(),
	rootCauseState: { current: null as AlertRootCause | null },
}));
vi.mock('@/hooks/queries/rootCause', () => ({
	useAlertRootCause: () => ({ data: rootCauseState.current, isLoading: false }),
	useRateRootCause: () => ({ mutate, isPending: false }),
}));

const analysis = (overrides: Partial<AlertRootCause> = {}): AlertRootCause => ({
	alertId: 'alert-1',
	source: 'api',
	content: 'Pool exhausted after deploy 2481.',
	rating: null,
	ratedBy: null,
	ratedAt: null,
	ratingComment: null,
	createdAt: '2026-09-15T10:00:00.000Z',
	updatedAt: '2026-09-15T10:00:00.000Z',
	...overrides,
});

const renderSection = () =>
	render(
		<AllTheProviders>
			<AlertRootCauseSection alertId="alert-1" />
		</AllTheProviders>
	);

beforeEach(() => {
	mutate.mockReset();
	rootCauseState.current = analysis();
});

describe('AlertRootCauseSection feedback', () => {
	test('thumbs-up rates immediately, with no dialog', () => {
		renderSection();
		fireEvent.click(screen.getByRole('button', { name: /rate root cause helpful/i }));
		expect(mutate).toHaveBeenCalledWith({ alertId: 'alert-1', rating: 'up' });
		expect(screen.queryByText('What went wrong?')).toBeNull();
	});

	test('thumbs-down opens "what went wrong?" and sends the trimmed comment with the verdict', () => {
		renderSection();
		fireEvent.click(screen.getByRole('button', { name: /rate root cause unhelpful/i }));
		expect(mutate).not.toHaveBeenCalled();
		expect(screen.getByText('What went wrong?')).toBeInTheDocument();

		fireEvent.change(screen.getByLabelText('Feedback'), { target: { value: '  it was DNS, not the pool  ' } });
		fireEvent.click(screen.getByRole('button', { name: /send feedback/i }));
		expect(mutate).toHaveBeenCalledTimes(1);
		expect(mutate.mock.calls[0][0]).toEqual({
			alertId: 'alert-1',
			rating: 'down',
			comment: 'it was DNS, not the pool',
		});
	});

	test('Skip sends the bare thumbs-down — the verdict is never gated on typing', () => {
		renderSection();
		fireEvent.click(screen.getByRole('button', { name: /rate root cause unhelpful/i }));
		fireEvent.change(screen.getByLabelText('Feedback'), { target: { value: 'typed then skipped' } });
		fireEvent.click(screen.getByRole('button', { name: /skip/i }));
		expect(mutate).toHaveBeenCalledTimes(1);
		expect(mutate.mock.calls[0][0]).toEqual({ alertId: 'alert-1', rating: 'down', comment: undefined });
	});

	test('a stored thumbs-down comment is shown under the analysis', () => {
		rootCauseState.current = analysis({
			rating: 'down',
			ratedBy: 'Dana',
			ratedAt: '2026-09-15T10:05:00.000Z',
			ratingComment: 'Blamed the pool; it was DNS.',
		});
		renderSection();
		expect(screen.getByText('Blamed the pool; it was DNS.')).toBeInTheDocument();
	});

	test('re-clicking the active verdict is a no-op', () => {
		rootCauseState.current = analysis({ rating: 'down', ratedBy: 'Dana', ratedAt: '2026-09-15T10:05:00.000Z' });
		renderSection();
		fireEvent.click(screen.getByRole('button', { name: /rate root cause unhelpful/i }));
		expect(mutate).not.toHaveBeenCalled();
		expect(screen.queryByText('What went wrong?')).toBeNull();
	});
});
