import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { UptimeKumaSetupModal } from '@/components/Integrations/UptimeKumaSetupModal/UptimeKumaSetupModal';

vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

afterEach(() => {
	cleanup();
});

describe('UptimeKumaSetupModal', () => {
	test('tells Uptime Kuma 3.0 users about the built-in OpsiMate notification type', () => {
		render(<UptimeKumaSetupModal open={true} onOpenChange={() => undefined} />);

		expect(screen.getByText(/Uptime Kuma 3\.0 and later:/)).toBeInTheDocument();
		expect(screen.getByText(/built-in/)).toBeInTheDocument();
		expect(screen.getByText(/The webhook steps are for Uptime Kuma 2\.x\./)).toBeInTheDocument();
	});

	test('keeps the webhook steps for Uptime Kuma 2.x', () => {
		render(<UptimeKumaSetupModal open={true} onOpenChange={() => undefined} />);

		expect(screen.getByText(/Notification Type/)).toBeInTheDocument();
		expect(screen.getByText('"Webhook"', { exact: false })).toBeInTheDocument();
	});
});
