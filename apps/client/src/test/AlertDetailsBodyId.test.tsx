import { Alert } from '@OpsiMate/shared';
import { screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { AlertDetailsBody } from '@/components/Alerts/AlertDetails/AlertDetailsBody';
import { render } from './test-utils';

// Each section fetches or needs providers; this test is only about where the id sits.
vi.mock('@/components/Alerts/AlertDetails/AlertInfoSection', () => ({
	AlertInfoSection: () => <h3>alert name</h3>,
}));
vi.mock('@/components/Alerts/AlertDetails/AlertRootCauseSection', () => ({ AlertRootCauseSection: () => null }));
vi.mock('@/components/Alerts/AlertDetails/AlertLastCommentSection', () => ({ AlertLastCommentSection: () => null }));
vi.mock('@/components/Alerts/AlertDetails/AlertActionsSection', () => ({
	AlertActionsSection: () => <div>actions-section</div>,
}));

const alert = {
	id: 'grafana-8f3a1c-disk-full-node-7',
	alertName: 'Disk full on node 7',
	type: 'Grafana',
	status: 'firing',
	severity: 'critical',
	tags: {},
	startsAt: new Date(0).toISOString(),
	updatedAt: new Date(0).toISOString(),
	createdAt: new Date(0).toISOString(),
	isSilenced: false,
} as unknown as Alert;

describe('AlertDetailsBody — alert id', () => {
	test('the id sits last, after the actions, small and selectable', () => {
		render(<AlertDetailsBody alert={alert} historyData={null} />);
		const id = screen.getByText('grafana-8f3a1c-disk-full-node-7');
		expect(id).toHaveClass('select-all');
		const line = id.closest('p');
		expect(line).toHaveClass('text-[11px]', 'text-muted-foreground/70');
		// Last element of the body, after the actions section.
		expect(line?.parentElement?.lastElementChild).toBe(line);
		expect(
			screen.getByText('actions-section').compareDocumentPosition(id) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
	});
});
