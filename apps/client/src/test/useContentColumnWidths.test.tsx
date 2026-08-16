import { renderHook } from '@testing-library/react';
import { Alert } from '@OpsiMate/shared';
import { describe, expect, test } from 'vitest';
import { useContentColumnWidths } from '@/components/Alerts/AlertsTable/hooks/useContentColumnWidths';

// The manual-width contract: a manually-resized content column leaves the automatic
// sizing game entirely — it must NOT appear in the automatic width map (its pixels come
// from the manual layer), while the remaining content columns keep getting sized.

const mkAlert = (id: string, alertName: string): Alert =>
	({
		id,
		alertName,
		type: 'Grafana',
		status: 'firing',
		tags: { env: 'prod' },
		startsAt: '2026-01-01T00:00:00Z',
		updatedAt: '2026-01-02T00:00:00Z',
		alertUrl: '',
		isSilenced: false,
	}) as unknown as Alert;

const baseOptions = {
	alerts: [mkAlert('a', 'Alert A'), mkAlert('b', 'A much longer alert name to size against')],
	orderedColumns: ['alertName', 'tagKey:env', 'status', 'owner', 'actions'],
	columnLabels: { alertName: 'Alert Name', 'tagKey:env': 'Env' },
	containerWidth: 1200,
	hasSelectColumn: false,
	actionsColumnWidthPx: 44,
};

describe('useContentColumnWidths with manual widths', () => {
	test('without manual widths, both content columns get automatic widths', () => {
		const { result } = renderHook(() => useContentColumnWidths(baseOptions));
		expect(result.current.alertName).toBeGreaterThan(0);
		expect(result.current['tagKey:env']).toBeGreaterThan(0);
	});

	test('a manually-sized content column drops out of the automatic map', () => {
		const { result } = renderHook(() =>
			useContentColumnWidths({ ...baseOptions, manualWidths: { alertName: 320 } })
		);
		expect(result.current.alertName).toBeUndefined();
		// The other content column is still auto-sized.
		expect(result.current['tagKey:env']).toBeGreaterThan(0);
	});

	test('all content columns manual leaves nothing to auto-size', () => {
		const { result } = renderHook(() =>
			useContentColumnWidths({ ...baseOptions, manualWidths: { alertName: 320, 'tagKey:env': 200 } })
		);
		expect(result.current).toEqual({});
	});
});
