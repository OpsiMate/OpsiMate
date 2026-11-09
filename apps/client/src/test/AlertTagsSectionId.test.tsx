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

describe('alert id and labels strip', () => {
	test('the id is the first label, dashed, and its value is selectable', () => {
		render(<AlertTagsSection alert={mkAlert({ env: 'prod', team: 'core' })} />);
		const value = screen.getByText('grafana-8f3a1c-disk-full-node-7');
		expect(value).toHaveClass('select-all');
		const badges = value.closest('div.flex')?.children ?? [];
		expect(badges[0]).toContainElement(value);
		expect(badges[0]).toHaveClass('border-dashed');
		expect(badges).toHaveLength(3);
	});

	test('an alert with no tags still shows its id, with no section to open first', () => {
		render(<AlertDetailsBody alert={mkAlert({})} />);
		expect(screen.queryByRole('button', { name: /labels/i })).not.toBeInTheDocument();
		expect(screen.getByText('grafana-8f3a1c-disk-full-node-7')).toBeInTheDocument();
	});

	test('up to six labels show outright; more fold behind a "+N more" chip that expands in place', () => {
		const tags = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`k${i}`, `v${i}`]));
		render(<AlertTagsSection alert={mkAlert(tags)} />);

		expect(screen.getByText('k5')).toBeInTheDocument();
		expect(screen.queryByText('k6')).not.toBeInTheDocument();
		const more = screen.getByRole('button', { name: '+3 more' });
		expect(more).toHaveAttribute('aria-expanded', 'false');

		fireEvent.click(more);
		expect(screen.getByText('k8')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');

		fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
		expect(screen.queryByText('k6')).not.toBeInTheDocument();
	});

	test('exactly six labels never show a "+0 more" chip', () => {
		const tags = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`k${i}`, `v${i}`]));
		render(<AlertTagsSection alert={mkAlert(tags)} />);
		expect(screen.queryByRole('button', { name: /more/i })).not.toBeInTheDocument();
	});
});
