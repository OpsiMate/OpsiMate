import { Alert, AlertSeverity, AlertStatus } from '@OpsiMate/shared';
import { describe, expect, test } from 'vitest';
import {
	ALERTS_CSV_HEADER,
	alertsExportFilename,
	alertsToCsv,
	getAlertExportStatus,
} from '@/components/Alerts/utils/alertsExport.utils';

const alert = (overrides: Partial<Alert> = {}): Alert => ({
	id: 'a1',
	type: 'Grafana',
	status: AlertStatus.FIRING,
	severity: AlertSeverity.CRITICAL,
	tags: {},
	startsAt: '2026-11-19T10:00:00.000Z',
	updatedAt: '2026-11-19T11:00:00.000Z',
	alertUrl: 'https://grafana.example/a1',
	alertName: 'CPU high',
	createdAt: '2026-11-19T10:00:00.000Z',
	isSilenced: false,
	...overrides,
});

const users = [{ id: '7', fullName: 'Dana Ops' }];

// Every optional field set, to check each column's mapping.
const fullAlert = alert({
	team: 'payments',
	ownerId: '7',
	isSilenced: true,
	silencedUntil: '2026-11-20T00:00:00.000Z',
	tags: { env: 'prod', region: 'eu', severity: 'critical', fix: 'auto' },
	summary: 'CPU above 90%',
	lastComment: 'looking into it',
	runbookUrl: 'https://runbooks.example/cpu',
});

const parseRow = (line: string): string[] => line.slice(1, -1).split('","');

describe('alertsToCsv', () => {
	test('writes the header and one quoted CRLF-separated record per alert', () => {
		const csv = alertsToCsv([alert(), alert({ id: 'a2', alertName: 'Disk full' })]);
		const lines = csv.split('\r\n');
		expect(lines).toHaveLength(3);
		expect(parseRow(lines[0])).toEqual(ALERTS_CSV_HEADER);
		expect(parseRow(lines[2])[1]).toBe('Disk full');
	});

	test('maps every column from the alert', () => {
		const row = parseRow(alertsToCsv([fullAlert], users).split('\r\n')[1]);
		const byColumn = Object.fromEntries(ALERTS_CSV_HEADER.map((key, i) => [key, row[i]]));
		expect(byColumn).toEqual({
			id: 'a1',
			name: 'CPU high',
			status: 'silenced',
			severity: 'critical',
			source: 'Grafana',
			team: 'payments',
			owner: 'Dana Ops',
			started_at: '2026-11-19T10:00:00.000Z',
			updated_at: '2026-11-19T11:00:00.000Z',
			silenced_until: '2026-11-20T00:00:00.000Z',
			// The internal severity/fix mirror tags stay out, as in every tag UI.
			tags: 'env=prod; region=eu',
			summary: 'CPU above 90%',
			last_comment: 'looking into it',
			alert_url: 'https://grafana.example/a1',
			runbook_url: 'https://runbooks.example/cpu',
		});
	});

	test('leaves optional fields empty instead of writing "null"', () => {
		const row = parseRow(alertsToCsv([alert({ summary: null, team: null, ownerId: null })]).split('\r\n')[1]);
		expect(row).not.toContain('null');
		expect(row[ALERTS_CSV_HEADER.indexOf('owner')]).toBe('');
		expect(row[ALERTS_CSV_HEADER.indexOf('silenced_until')]).toBe('');
	});

	test('falls back to "User <id>" for an owner missing from the user list', () => {
		const row = parseRow(alertsToCsv([alert({ ownerId: '42' })], users).split('\r\n')[1]);
		expect(row[ALERTS_CSV_HEADER.indexOf('owner')]).toBe('User 42');
	});
});

describe('alertsToCsv escaping', () => {
	// Alert names and summaries come from external integrations, comments from users —
	// neither may turn into a live formula when the file is opened in a spreadsheet.
	test('escapes quotes, keeps multi-line text in one field and neutralizes formulas', () => {
		const csv = alertsToCsv([alert({ alertName: '=HYPERLINK("http://evil","x")', summary: 'line 1\nsaid "hi"' })]);
		expect(csv).toContain('"\'=HYPERLINK(""http://evil"",""x"")"');
		expect(csv).toContain('"line 1\r\nsaid ""hi"""');
	});

	test('an empty list still produces the header', () => {
		expect(alertsToCsv([]).split('\r\n')).toHaveLength(1);
	});
});

describe('getAlertExportStatus', () => {
	test('follows the status badge precedence: silenced > muted > firing', () => {
		expect(getAlertExportStatus(alert({ isSilenced: true, isMuted: true }))).toBe('silenced');
		expect(getAlertExportStatus(alert({ isMuted: true }))).toBe('muted');
		expect(getAlertExportStatus(alert())).toBe('firing');
	});

	test('resolved alerts read as resolved, including rows tagged in the All view', () => {
		expect(getAlertExportStatus(alert({ status: AlertStatus.RESOLVED }))).toBe('resolved');
		expect(getAlertExportStatus(alert({ isResolved: true }))).toBe('resolved');
	});
});

describe('alertsExportFilename', () => {
	test('includes a sanitized view name and the timestamp', () => {
		expect(alertsExportFilename('Prod / On-call view', '2026-11-19-10-00-00')).toBe(
			'alerts-prod-on-call-view-2026-11-19-10-00-00.csv'
		);
	});

	test('drops the name part when the view is unnamed', () => {
		expect(alertsExportFilename('', '2026-11-19-10-00-00')).toBe('alerts-2026-11-19-10-00-00.csv');
		expect(alertsExportFilename(undefined, '2026-11-19-10-00-00')).toBe('alerts-2026-11-19-10-00-00.csv');
	});
});
