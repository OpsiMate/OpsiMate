import { RootCauseGuide } from '@/components/Settings/AiSettings/RootCauseGuide';
import { API_HOST } from '@/lib/api';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

// The guide is documentation rendered as UI: what matters is that the endpoint it
// prints is THIS deployment's, and that the contract it describes matches the server.
describe('RootCauseGuide', () => {
	test('prints the PUT endpoint for this deployment and the full callback contract', () => {
		render(<RootCauseGuide />);
		const send = screen.getByText(/curl -X PUT/).textContent ?? '';
		expect(send).toContain(`${API_HOST}/api/v1/alerts/{alertId}/root-cause?api_token={your_api_token}`);
		expect(send).toContain('"content"');
		expect(send).toContain('"feedbackUpUrl"');
		expect(send).toContain('"feedbackDownUrl"');

		const callback = screen.getByText(/POST https:\/\/analyzer\.example/).textContent ?? '';
		for (const key of ['"alertId"', '"rating"', '"ratedBy"', '"ratedAt"', '"comment"']) {
			expect(callback).toContain(key);
		}
	});

	test('explains the thumbs-down note and exposes copy buttons with names', () => {
		render(<RootCauseGuide />);
		expect(screen.getByText(/What went wrong\?/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Copy the send example' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Copy the callback example' })).toBeInTheDocument();
	});
});
