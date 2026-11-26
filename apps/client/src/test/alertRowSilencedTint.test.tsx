import { Alert, AlertSeverity } from '@OpsiMate/shared';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { AlertRow } from '@/components/Alerts/AlertsTable/AlertRow';
import { SILENCED_ROW_CLASSES } from '@/components/Alerts/AlertsTable/AlertRow/AlertRow.constants';
import { SEVERITY_ROW_CLASSES } from '@/components/Alerts/utils/severity.utils';

interface RowAlertOverrides {
	isSilenced?: boolean;
	severity?: AlertSeverity;
}

interface RenderRowOptions {
	severityColors?: boolean;
	isSelected?: boolean;
}

const makeAlert = ({ isSilenced = false, severity = AlertSeverity.CRITICAL }: RowAlertOverrides = {}) =>
	({ id: 'a1', alertName: 'alert a1', tags: {}, isSilenced, severity }) as unknown as Alert;

const renderRow = (alert: Alert, { severityColors = false, isSelected = false }: RenderRowOptions = {}) => {
	const { container } = render(
		<table>
			<tbody>
				<AlertRow
					alert={alert}
					isSelected={isSelected}
					orderedColumns={[]}
					onSelectAlert={vi.fn()}
					severityColors={severityColors}
				/>
			</tbody>
		</table>
	);
	return container.querySelector('tr') as HTMLTableRowElement;
};

const tintClasses = SILENCED_ROW_CLASSES.split(' ');
const criticalTint = SEVERITY_ROW_CLASSES[AlertSeverity.CRITICAL].split(' ');

afterEach(cleanup);

describe('AlertRow silenced tint', () => {
	test('a silenced alert gets the silenced row tint', () => {
		const row = renderRow(makeAlert({ isSilenced: true }));
		for (const cls of tintClasses) expect(row.classList.contains(cls)).toBe(true);
	});

	test('a firing alert does not', () => {
		const row = renderRow(makeAlert({ isSilenced: false }));
		for (const cls of tintClasses) expect(row.classList.contains(cls)).toBe(false);
	});

	test('silenced wins over the severity tint when severity colours are on', () => {
		const row = renderRow(makeAlert({ isSilenced: true }), { severityColors: true });
		for (const cls of tintClasses) expect(row.classList.contains(cls)).toBe(true);
		// tailwind-merge keeps one background class: the later silenced tint replaces the severity one.
		for (const cls of criticalTint) expect(row.classList.contains(cls)).toBe(false);
	});

	test('selection still wins over the silenced tint', () => {
		const row = renderRow(makeAlert({ isSilenced: true }), { isSelected: true });
		expect(row.classList.contains('bg-muted/50')).toBe(true);
		expect(row.classList.contains('bg-violet-500/10')).toBe(false);
	});
});
