import { screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { render } from './test-utils';

// The modal overlays must not use backdrop-filter: it is recomputed for the whole viewport
// on every frame behind the modal, and without GPU compositing (VDI, hardware acceleration
// off: chrome://gpu "Compositing: Software only") that made every modal stutter. Measured
// with Chromium in software compositing: ~24 ms of draw per frame with the blur, ~6 ms
// without. A plain dim is enough to separate the modal.

const overlayOf = (role: string): Element => {
	const content = screen.getByRole(role);
	// Radix renders the overlay as the content's previous sibling inside the portal.
	const overlay = content.parentElement?.querySelector('[data-state="open"].fixed.inset-0');
	if (!overlay) throw new Error(`no overlay found for ${role}`);
	return overlay;
};

describe('modal overlays', () => {
	test('the alert dialog overlay dims without a backdrop blur', () => {
		render(
			<AlertDialog open>
				<AlertDialogContent>
					<AlertDialogTitle>Confirm</AlertDialogTitle>
				</AlertDialogContent>
			</AlertDialog>
		);
		expect(overlayOf('alertdialog').className).not.toMatch(/backdrop-blur/);
	});

	test('the dialog overlay dims without a backdrop blur', () => {
		render(
			<Dialog open>
				<DialogContent>
					<DialogTitle>Edit</DialogTitle>
				</DialogContent>
			</Dialog>
		);
		expect(overlayOf('dialog').className).not.toMatch(/backdrop-blur/);
	});
});
