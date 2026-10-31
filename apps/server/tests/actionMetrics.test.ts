import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Action } from '@OpsiMate/shared';
import { ActionBL } from '../src/bl/actions/action.bl';
import type { AuditBL } from '../src/bl/audit/audit.bl';
import type { ActionRepository } from '../src/dal/actionRepository';
import { actionsRunTotal } from '../src/metrics';

// Issue #1141: runOnAlert labelled every run outcome="error" because it read
// result.success, which ActionTestResult does not have (the field is `ok`).

const slackAction: Action = {
	id: 1,
	name: 'Metrics Slack Action',
	type: 'slack',
	config: { webhookUrl: 'https://hooks.slack.com/services/T000/B000/xyz' },
	labelMatchers: [],
	createdAt: '2026-10-09T00:00:00.000Z',
	updatedAt: '2026-10-09T00:00:00.000Z',
};

// runOnAlert only touches the repository/audit dependencies outside this path, and
// skips the alert-history write when the alert has no id, so empty stubs are enough.
const actionBL = new ActionBL({} as ActionRepository, {} as AuditBL);

const runCount = async (outcome: 'success' | 'error'): Promise<number> => {
	const metric = await actionsRunTotal.get();
	return metric.values.find((v) => v.labels.type === 'slack' && v.labels.outcome === outcome)?.value ?? 0;
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe('opsimate_actions_run_total', () => {
	test('counts a successful run as success and a failed run as error', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(new Response('ok', { status: 200 }))
			.mockResolvedValueOnce(new Response('invalid_token', { status: 500 }));

		const successBefore = await runCount('success');
		const errorBefore = await runCount('error');

		const ok = await actionBL.runOnAlert(slackAction, { alertName: 'Disk full' });
		expect(ok.ok).toBe(true);
		expect(await runCount('success')).toBe(successBefore + 1);
		expect(await runCount('error')).toBe(errorBefore);

		const failed = await actionBL.runOnAlert(slackAction, { alertName: 'Disk full' });
		expect(failed.ok).toBe(false);
		expect(await runCount('success')).toBe(successBefore + 1);
		expect(await runCount('error')).toBe(errorBefore + 1);

		expect(fetchSpy).toHaveBeenCalledTimes(2);
	});
});
