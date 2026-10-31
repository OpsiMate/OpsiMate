import { describe, expect, it } from 'vitest';
import type { AlertNameStats } from '@OpsiMate/shared';
import { ByNameTab } from '@/components/Analytics/ByNameTab';
import { fireEvent, render, screen } from './test-utils';

const makeRow = (name: string, episodes: number): AlertNameStats => ({
	name,
	episodes,
	firingNow: 0,
	mttrMs: 60_000,
	mtbfMs: null,
	refireRate: null,
	worstSeverity: null,
	lastSeen: new Date(0).toISOString(),
});

const rows: AlertNameStats[] = [makeRow('Disk full', 5), makeRow('High CPU', 3)];

const filterBox = () => screen.getByRole('textbox', { name: /filter by alert name/i });

describe('ByNameTab empty states', () => {
	it('says there were no alerts when the window has none', () => {
		render(<ByNameTab rows={[]} />);

		expect(screen.getByText('No alerts in this window')).toBeInTheDocument();
	});

	it('says the filter matched nothing, not that the alerts are gone', () => {
		render(<ByNameTab rows={rows} />);

		fireEvent.change(filterBox(), { target: { value: '  memory ' } });

		expect(screen.getByText('No alerts match "memory"')).toBeInTheDocument();
		expect(screen.queryByText('No alerts in this window')).not.toBeInTheDocument();
		expect(screen.getByText('0 of 2')).toBeInTheDocument();
	});

	it('shows only the matching row and counts it', () => {
		render(<ByNameTab rows={rows} />);

		fireEvent.change(filterBox(), { target: { value: 'disk' } });

		expect(screen.getByText('Disk full')).toBeInTheDocument();
		expect(screen.queryByText('High CPU')).not.toBeInTheDocument();
		expect(screen.getByText('1 of 2')).toBeInTheDocument();
	});
});
