import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { useColumnManagement } from '@/components/Alerts/hooks/useColumnManagement';
import { DEFAULT_COLUMN_ORDER, DEFAULT_VISIBLE_COLUMNS } from '@/components/Alerts/AlertsTable/AlertsTable.constants';
import { TagKeyInfo } from '@/types';

const tagKeys: TagKeyInfo[] = [
	{ key: 'host', label: 'Host' },
	{ key: 'env', label: 'Env' },
];

afterEach(() => {
	localStorage.clear();
});

// Dashboards save whatever order the table is rendering (the "effective" order), so the
// arrangement on screen must survive a save -> load round trip unchanged. This pins the
// bug where TV mode persisted column_order: [] — the render silently fell back to the
// defaults while every save kept writing the empty array, so the visible arrangement was
// never the persisted one.
describe('effectiveColumnOrder round trip', () => {
	test('empty stored order falls back to defaults, and that fallback round-trips', () => {
		const first = renderHook(() => useColumnManagement({ tagKeys, visibleColumns: [], columnOrder: [] })).result
			.current;
		expect(first.columnOrder).toEqual(DEFAULT_COLUMN_ORDER);

		// Save persists first.columnOrder / first.visibleColumns; a later load feeds them back.
		const reloaded = renderHook(() =>
			useColumnManagement({ tagKeys, visibleColumns: first.visibleColumns, columnOrder: first.columnOrder })
		).result.current;
		expect(reloaded.columnOrder).toEqual(first.columnOrder);
		expect(reloaded.visibleColumns).toEqual(first.visibleColumns);
	});

	test('visible tag columns missing from the stored order append and then round-trip stably', () => {
		const visibleColumns = [...DEFAULT_VISIBLE_COLUMNS, 'tagKey:host', 'tagKey:env'];
		const first = renderHook(() =>
			useColumnManagement({ tagKeys, visibleColumns, columnOrder: [...DEFAULT_COLUMN_ORDER] })
		).result.current;
		expect(first.columnOrder).toEqual([...DEFAULT_COLUMN_ORDER, 'tagKey:host', 'tagKey:env']);

		const reloaded = renderHook(() =>
			useColumnManagement({ tagKeys, visibleColumns: first.visibleColumns, columnOrder: first.columnOrder })
		).result.current;
		expect(reloaded.columnOrder).toEqual(first.columnOrder);
	});

	test('a user-arranged order that interleaves tag columns is preserved verbatim', () => {
		const columnOrder = [
			'type',
			'severity',
			'tagKey:host',
			'alertName',
			'status',
			'summary',
			'lastComment',
			'owner',
			'startsAt',
			'updatedAt',
			'tagKey:env',
		];
		const { result } = renderHook(() =>
			useColumnManagement({ tagKeys, visibleColumns: ['type', 'alertName', 'tagKey:host'], columnOrder })
		);
		expect(result.current.columnOrder).toEqual(columnOrder);
	});

	test('severity injects after type for pre-severity orders, and the injection round-trips', () => {
		const legacyOrder = ['type', 'status', 'alertName', 'summary', 'owner', 'startsAt'];
		const first = renderHook(() =>
			useColumnManagement({ tagKeys, visibleColumns: ['type', 'status'], columnOrder: legacyOrder })
		).result.current;
		expect(first.columnOrder).toEqual(['type', 'severity', 'status', 'alertName', 'summary', 'owner', 'startsAt']);

		const reloaded = renderHook(() =>
			useColumnManagement({ tagKeys, visibleColumns: first.visibleColumns, columnOrder: first.columnOrder })
		).result.current;
		expect(reloaded.columnOrder).toEqual(first.columnOrder);
	});

	test('explicitly hidden severity stays out of the order', () => {
		localStorage.setItem('opsimate-severity-column-hidden', 'true');
		const legacyOrder = ['type', 'status', 'alertName'];
		const { result } = renderHook(() =>
			useColumnManagement({ tagKeys, visibleColumns: ['type'], columnOrder: legacyOrder })
		);
		expect(result.current.columnOrder).toEqual(legacyOrder);
	});
});
