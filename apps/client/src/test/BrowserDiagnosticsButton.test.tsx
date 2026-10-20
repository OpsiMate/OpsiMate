import { BrowserDiagnosticsButton } from '@/components/BrowserDiagnosticsButton';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { AllTheProviders } from './TestProviders';

vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

// One click must put the whole diagnostics block on the clipboard.
describe('BrowserDiagnosticsButton', () => {
	test('copies the diagnostics text, with versions and capability lines', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
		render(
			<AllTheProviders>
				<TooltipProvider>
					<BrowserDiagnosticsButton />
				</TooltipProvider>
			</AllTheProviders>
		);
		fireEvent.click(screen.getByRole('button', { name: 'Copy browser diagnostics' }));
		await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
		const text = writeText.mock.calls[0][0] as string;
		expect(text.startsWith('OpsiMate browser diagnostics')).toBe(true);
		expect(text).toMatch(/^server .*, client .*, http:\/\/localhost/m);
		expect(text).toContain('css oklch:');
		expect(text).toContain('hover capable:');
		expect(text).toMatch(/findings:/);
	});
});
