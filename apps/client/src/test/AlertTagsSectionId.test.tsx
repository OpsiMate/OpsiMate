import { Alert } from '@OpsiMate/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { AlertDetailsBody } from '@/components/Alerts/AlertDetails/AlertDetailsBody';
import { AlertTagsSection } from '@/components/Alerts/AlertDetails/AlertTagsSection';
import { render } from './test-utils';

// Sections that fetch or need providers are out of scope here.
vi.mock('@/components/Alerts/AlertDetails/AlertInfoSection', () => ({ AlertInfoSection: () => null }));
vi.mock('@/components/Alerts/AlertDetails/AlertRootCauseSection', () => ({ AlertRootCauseSection: () => null }));
vi.mock('@/components/Alerts/AlertDetails/AlertLastCommentSection', () => ({ AlertLastCommentSection: () => null }));
vi.mock('@/components/Alerts/AlertDetails/AlertActionsSection', () => ({ AlertActionsSection: () => null }));

const mkAlert = (tags: Record<string, string>) =>
	({
		id: 'grafana-8f3a1c-disk-full-node-7',
		alertName: 'Disk full on node 7',
		type: 'Grafana',
		status: 'firing',
		severity: 'critical',
		tags,
		startsAt: new Date(0).toISOString(),
		updatedAt: new Date(0).toISOString(),
		createdAt: new Date(0).toISOString(),
		isSilenced: false,
	}) as unknown as Alert;

describe('alert id in the Labels section', () => {
	test('the id is the first label, dashed, and its value is selectable', () => {
		render(<AlertTagsSection alert={mkAlert({ env: 'prod', team: 'core' })} />);
		const value = screen.getByText('grafana-8f3a1c-disk-full-node-7');
		expect(value).toHaveClass('select-all');
		const badges = value.closest('div.flex')?.children ?? [];
		expect(badges[0]).toContainElement(value);
		expect(badges[0]).toHaveClass('border-dashed');
		expect(badges).toHaveLength(3);
	});

	test('an alert with no tags still gets a Labels section holding its id', () => {
		render(<AlertDetailsBody alert={mkAlert({})} historyData={null} />);
		const labels = screen.getByRole('button', { name: /labels/i });
		fireEvent.click(labels);
		expect(screen.getByText('grafana-8f3a1c-disk-full-node-7')).toBeInTheDocument();
	});
});
