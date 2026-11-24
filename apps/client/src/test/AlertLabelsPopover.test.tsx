import { Alert } from '@OpsiMate/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { AlertLabelsPopover } from '@/components/Alerts/AlertDetails/AlertLabelsPopover';
import {
	LABELS_CHIPS_TEST_ID,
	POPOVER_ARIA_LABEL,
} from '@/components/Alerts/AlertDetails/AlertLabelsPopover/AlertLabelsPopover.constants';
import { TooltipProvider } from '@/components/ui/tooltip';
import { render } from './test-utils';

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

// The popover's trigger doubles as a tooltip trigger, which needs the app's provider.
const renderPopover = (alert: Alert) =>
	render(
		<TooltipProvider>
			<AlertLabelsPopover alert={alert} />
		</TooltipProvider>
	);

const openPopover = () => fireEvent.click(screen.getByRole('button', { name: /labels/i }));

describe('AlertLabelsPopover', () => {
	test('labels are hidden until the tag icon is clicked; the icon carries the count', () => {
		renderPopover(mkAlert({ env: 'prod', team: 'core' }));

		expect(screen.getByRole('button', { name: /2 labels/i })).toHaveTextContent('2');
		expect(screen.queryByText('env')).not.toBeInTheDocument();

		openPopover();

		expect(screen.getByRole('dialog', { name: POPOVER_ARIA_LABEL })).toBeInTheDocument();
		expect(screen.getByText('env')).toBeInTheDocument();
		expect(screen.getByText('team')).toBeInTheDocument();
	});

	test('the id is the first chip, dashed, and its value is selectable', () => {
		renderPopover(mkAlert({ env: 'prod', team: 'core' }));
		openPopover();

		const value = screen.getByText('grafana-8f3a1c-disk-full-node-7');
		expect(value).toHaveClass('select-all');
		const chips = screen.getByTestId(LABELS_CHIPS_TEST_ID).children;
		expect(chips[0]).toContainElement(value);
		expect(chips[0]).toHaveClass('border-dashed');
		expect(chips).toHaveLength(3);
	});

	test('an alert with no tags still offers its id behind a zero-count icon', () => {
		renderPopover(mkAlert({}));

		expect(screen.getByRole('button', { name: /0 labels/i })).toBeInTheDocument();
		openPopover();
		expect(screen.getByText('grafana-8f3a1c-disk-full-node-7')).toBeInTheDocument();
	});
});
