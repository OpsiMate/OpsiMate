import { describe, expect, test } from 'vitest';
import type { HttpActionConfig, JiraActionConfig, SlackActionConfig, TeamsActionConfig } from '@OpsiMate/shared';
import { buildAlertContext, previewAction } from '../src/bl/actions/actionExecutor';

// What the "Preview" button shows: previewAction renders the exact message, title, summary
// and body an action would send for an alert. Pure, so contexts are built with
// buildAlertContext as actionTemplating.test.ts builds them.

const alert = {
	id: 'a-1',
	alertName: 'CPU high',
	status: 'firing',
	type: 'grafana',
	severity: 'critical',
	summary: 'CPU above 90%',
	startsAt: '2026-01-01T00:00:00Z',
	updatedAt: '2026-01-02T00:00:00Z',
	createdAt: '2026-01-01T00:00:00Z',
	alertUrl: 'https://grafana/alert/a-1',
	runbookUrl: 'https://runbooks/cpu',
	tags: { service: 'api', env: 'prod' },
};

const ctx = buildAlertContext(alert);

const slack = (config: Partial<SlackActionConfig>) =>
	previewAction({ name: 's', type: 'slack', config: { webhookUrl: 'https://hooks/s', ...config } }, ctx);

describe('previewAction', () => {
	test('slack with an empty messageTemplate falls back to the bell and the alert name', () => {
		const preview = slack({ messageTemplate: '' });
		expect(preview).toMatchObject({ type: 'slack', message: ':bell: OpsiMate — CPU high' });
	});

	test('slack passes the channel through, and null when it is absent', () => {
		expect(slack({ channel: '#ops' })).toMatchObject({ channel: '#ops' });
		expect(slack({})).toMatchObject({ channel: null });
	});

	test('teams falls back to "OpsiMate alert" for an empty title and the alert name for an empty message', () => {
		const config: TeamsActionConfig = { webhookUrl: 'https://hooks/t', titleTemplate: '', messageTemplate: '' };
		const preview = previewAction({ name: 't', type: 'teams', config }, ctx);
		expect(preview).toMatchObject({ type: 'teams', title: 'OpsiMate alert', message: 'CPU high' });
	});

	test('jira falls back to "[OpsiMate] <name>" for an empty summary, with an empty description', () => {
		const config: JiraActionConfig = {
			baseUrl: 'https://jira',
			email: 'ops@example.com',
			apiToken: 'token',
			projectKey: 'OPS',
			issueType: 'Task',
			summaryTemplate: '',
			descriptionTemplate: '',
		};
		const preview = previewAction({ name: 'j', type: 'jira', config }, ctx);
		expect(preview).toMatchObject({ type: 'jira', summary: '[OpsiMate] CPU high', description: '' });
	});

	test('http templates both the url and the body', () => {
		const config: HttpActionConfig = {
			url: 'https://hooks/{{label.service}}/{{severity}}',
			method: 'POST',
			bodyTemplate: 'alert={{name}}',
		};
		const preview = previewAction({ name: 'h', type: 'http', config }, ctx);
		expect(preview).toMatchObject({
			type: 'http',
			method: 'POST',
			url: 'https://hooks/api/critical',
			body: 'alert=CPU high',
		});
	});

	test('an unknown placeholder stays literal and inner whitespace still resolves', () => {
		expect(slack({ messageTemplate: '{{nope}} / {{ name }}' })).toMatchObject({ message: '{{nope}} / CPU high' });
	});

	test('the alert.name, tag.env and label.env aliases all resolve', () => {
		const preview = slack({ messageTemplate: '{{alert.name}} {{tag.env}} {{label.env}}' });
		expect(preview).toMatchObject({ message: 'CPU high prod prod' });
	});
});
