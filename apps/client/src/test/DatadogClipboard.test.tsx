import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DatadogSetupModal } from '@/components/Integrations/DatadogSetupModal/DatadogSetupModal';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }));
const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const writeText = vi.fn();
beforeEach(() => {
	vi.useFakeTimers();
	toast.mockReset();
	writeText.mockReset().mockResolvedValue(undefined);
	Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
	if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
	else Reflect.deleteProperty(navigator, 'clipboard');
});

describe('Datadog clipboard behaviour', () => {
	test('preserves each toast and resets both indicators at the first copy deadline', async () => {
		render(<DatadogSetupModal open onOpenChange={vi.fn()} />);
		const [webhook, payload] = screen.getAllByRole('button', { name: 'Copy' });
		await act(async () => {
			fireEvent.click(webhook);
		});
		expect(writeText.mock.calls[0][0]).toContain('/alerts/custom/datadog?api_token={your_api_token}');
		expect(toast).toHaveBeenLastCalledWith({
			title: 'Copied!',
			description: 'Webhook URL copied to clipboard',
			duration: 2000,
		});
		act(() => vi.advanceTimersByTime(1000));
		await act(async () => {
			fireEvent.click(payload);
		});
		expect(writeText.mock.calls[1][0]).toContain('"alert_id": "$ALERT_ID"');
		expect(toast).toHaveBeenLastCalledWith({
			title: 'Copied!',
			description: 'Payload template copied to clipboard',
			duration: 2000,
		});
		expect(screen.getAllByRole('button', { name: 'Copied' })).toHaveLength(2);
		act(() => vi.advanceTimersByTime(1000));
		expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(2);
	});
	test('keeps the manual-copy error message after rejection', async () => {
		writeText.mockRejectedValue(new Error('Denied'));
		render(<DatadogSetupModal open onOpenChange={vi.fn()} />);
		await act(async () => {
			fireEvent.click(screen.getAllByRole('button', { name: 'Copy' })[0]);
		});
		expect(toast).toHaveBeenCalledWith({
			title: 'Failed to copy',
			description: 'Please copy the value manually',
			variant: 'destructive',
			duration: 3000,
		});
		expect(screen.queryByRole('button', { name: 'Copied' })).not.toBeInTheDocument();
	});
});
