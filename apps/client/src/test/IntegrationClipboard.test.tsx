import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { GCPSetupModal } from '@/components/Integrations/GCPSetupModal/GCPSetupModal';
import { UptimeKumaSetupModal } from '@/components/Integrations/UptimeKumaSetupModal/UptimeKumaSetupModal';
import { GrafanaSetupModal } from '@/components/Integrations/GrafanaSetupModal/GrafanaSetupModal';
import { CustomAlertsSetupModal } from '@/components/Integrations/CustomAlertsSetupModal/CustomAlertsSetupModal';
import { ZabbixSetupModal } from '@/components/Integrations/ZabbixSetupModal/ZabbixSetupModal';

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

const dialogs = [
	{
		name: 'GCP',
		Component: GCPSetupModal,
		content: '/alerts/custom/gcp?api_token={your_api_token}',
		success: 'Webhook URL copied to clipboard',
		failure: 'Please copy the URL manually',
	},
	{
		name: 'Uptime Kuma',
		Component: UptimeKumaSetupModal,
		content: '/alerts/custom/UptimeKuma?api_token={your_api_token}',
		success: 'Webhook URL copied to clipboard',
		failure: 'Please copy the URL manually',
	},
	{
		name: 'Grafana',
		Component: GrafanaSetupModal,
		content: '/alerts/custom/grafana?api_token={your_api_token}',
		success: 'Webhook URL copied to clipboard',
		failure: 'Please copy the value manually',
	},
	{
		name: 'Custom alerts',
		Component: CustomAlertsSetupModal,
		content: '/alerts/custom?api_token={your_api_token}',
		success: 'URL copied to clipboard',
		failure: 'Please copy manually',
	},
	{
		name: 'Zabbix',
		Component: ZabbixSetupModal,
		content: '#!/bin/bash',
		success: 'Script copied',
		failure: 'Please copy manually',
	},
];

describe('integration dialog copy success', () => {
	test.each(dialogs)(
		'$name preserves the copied content, toast and reset',
		async ({ Component, content, success }) => {
			render(<Component open onOpenChange={vi.fn()} />);
			const button = screen.getAllByRole('button', { name: 'Copy' })[0];
			await act(async () => {
				fireEvent.click(button);
			});
			expect(writeText).toHaveBeenCalledOnce();
			expect(writeText.mock.calls[0][0]).toContain(content);
			expect(toast).toHaveBeenCalledWith({ title: 'Copied!', description: success, duration: 2000 });
			expect(button).toHaveTextContent('Copied');
			act(() => vi.advanceTimersByTime(1999));
			expect(button).toHaveTextContent('Copied');
			act(() => vi.advanceTimersByTime(1));
			expect(button).toHaveTextContent(/^Copy$/);
		}
	);
});

describe('integration dialog copy failures', () => {
	test.each(dialogs)('$name preserves its manual-copy guidance', async ({ Component, failure }) => {
		writeText.mockRejectedValue(new Error('Clipboard access denied'));
		render(<Component open onOpenChange={vi.fn()} />);
		const button = screen.getAllByRole('button', { name: 'Copy' })[0];
		await act(async () => {
			fireEvent.click(button);
		});
		expect(toast).toHaveBeenCalledWith({
			title: 'Failed to copy',
			description: failure,
			variant: 'destructive',
			duration: 3000,
		});
		expect(button).toHaveTextContent(/^Copy$/);
	});
});
