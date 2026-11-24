import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Alert, IncidentSummary } from '@OpsiMate/shared';
import { IncidentCreateTarget, IncidentDialog } from '@/components/Alerts/IncidentDialog';

const alert = (id: string, incidentId: number | null = null): Alert => ({ id, alertName: id, incidentId }) as Alert;
const incident = (id: number, alertIds: string[]): IncidentSummary =>
	({ id, name: `Incident #${id}`, alertIds, alertCount: alertIds.length }) as IncidentSummary;

// A drop that would dissolve an incident opens the dialog on the drop's own destination,
// so that confirming does what the drop meant (and the warning is shown first).
describe('IncidentDialog preset', () => {
	const m1 = alert('m1', 7);
	const incidents = [incident(7, ['m1']), incident(8, ['x'])];
	const target = (preset: IncidentCreateTarget['preset']): IncidentCreateTarget => ({
		alerts: [m1],
		incidents,
		incidentsState: 'ready',
		preset,
	});
	const open = (preset: IncidentCreateTarget['preset']) => {
		const onSubmit = vi.fn();
		const view = render(<IncidentDialog target={target(preset)} onOpenChange={() => {}} onSubmit={onSubmit} />);
		return { onSubmit, unmount: view.unmount };
	};

	test('"existing" starts on that incident and submits an add to it', () => {
		const { onSubmit } = open({ destination: 'existing', incidentId: 8 });
		expect(screen.getByRole('radio', { name: 'Existing' })).toHaveAttribute('aria-checked', 'true');
		expect(screen.getByRole('alert')).toHaveTextContent('dissolves incident "Incident #7"');
		fireEvent.click(screen.getByRole('button', { name: 'Add to incident' }));
		expect(onSubmit).toHaveBeenCalledWith({ kind: 'add', incidentId: 8 });
	});

	test('"remove" starts on Remove', () => {
		const { onSubmit } = open({ destination: 'remove' });
		expect(screen.getByRole('radio', { name: 'Remove' })).toHaveAttribute('aria-checked', 'true');
		fireEvent.click(screen.getByRole('button', { name: 'Remove from incident' }));
		expect(onSubmit).toHaveBeenCalledWith({ kind: 'remove' });
	});

	test('no preset, or one naming an incident that cannot take the alerts, starts on New', () => {
		const first = open(undefined);
		expect(screen.getByRole('radio', { name: 'New' })).toHaveAttribute('aria-checked', 'true');
		first.unmount();
		// Incident 7 already holds every selected alert, so it is not offered.
		open({ destination: 'existing', incidentId: 7 });
		expect(screen.getByRole('radio', { name: 'New' })).toHaveAttribute('aria-checked', 'true');
	});
});
