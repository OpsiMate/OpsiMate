import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { CustomAlertsSetupModal } from '@/components/Integrations/CustomAlertsSetupModal/CustomAlertsSetupModal';

vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

afterEach(cleanup);

// The custom webhook can resolve with `"status": "resolved"`; the DELETE route stays
// but is deprecated. The setup modal is where senders learn this.
describe('CustomAlertsSetupModal — resolve by status', () => {
	test('the payload reference documents the status field', () => {
		render(<CustomAlertsSetupModal open onOpenChange={() => undefined} />);
		expect(screen.getByText('status')).toBeInTheDocument();
		expect(screen.getAllByText(/"status": "firing"/).length).toBeGreaterThan(0);
	});

	test('the Resolve tab leads with the POST and marks DELETE as deprecated', () => {
		render(<CustomAlertsSetupModal open onOpenChange={() => undefined} />);
		const tab = screen.getByRole('tab', { name: /resolve/i });
		fireEvent.mouseDown(tab);
		fireEvent.click(tab);
		expect(screen.getByText(/Resolve With the Webhook/i)).toBeInTheDocument();
		expect(screen.getAllByText(/"status": "resolved"/).length).toBeGreaterThan(0);
		expect(screen.getByText(/DELETE Endpoint \(Deprecated\)/i)).toBeInTheDocument();
		expect(screen.getByText(/will be removed in a future release/i)).toBeInTheDocument();
	});
});
