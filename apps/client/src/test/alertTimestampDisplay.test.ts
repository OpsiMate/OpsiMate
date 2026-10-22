import { describe, expect, test } from 'vitest';
import { formatAlertTimestampDisplay, formatAlertTimestampFull } from '@OpsiMate/shared';
import { formatDate, formatFullTimestamp } from '@/components/Alerts/AlertsTable/AlertsTable.utils';
import { viewerFormatting } from '@/lib/api';

// The server renders {{startsAt.display}} with the shared formatter and the viewer's zone
// and locale sent by the client; the table renders its cells with the client formatter.
// They must agree, or an action says a different time than the table the sender read.

describe('display timestamps match the alerts table', () => {
	const viewer = viewerFormatting();

	test('today → clock only, yesterday → full date, both identical to the table cell and tooltip', () => {
		const today = new Date();
		today.setHours(9, 7, 5, 0);
		const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
		for (const date of [today, yesterday]) {
			const iso = date.toISOString();
			expect(formatAlertTimestampDisplay(iso, viewer)).toBe(formatDate(iso));
			expect(formatAlertTimestampFull(iso, viewer)).toBe(formatFullTimestamp(iso));
		}
		expect(viewer.timeZone).toBeTruthy();
	});
});
