import { describe, expect, test } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { looksLikeJson, renderJsonTemplate, validateJsonTemplate } from '@OpsiMate/shared';
import { buildAlertContext, executeAction, ExecutableAction, renderHttpBody } from '../src/bl/actions/actionExecutor';

// The JSON body template of an HTTP action: whatever an alert's fields contain — quotes,
// backslashes, line breaks — the request that goes out is valid JSON and the receiver
// reads back the exact text. Text mode stays plain substitution, byte for byte.

const ctx = buildAlertContext({
	id: 'a-1',
	alertName: 'Disk "sda" at 95%',
	status: 'firing',
	summary: 'disk "sda" at 95%\nline two \\ backslash',
	tags: { env: 'prod', count: '3', flaky: 'true', nested: '{"a":1}' },
});
const resolve = (key: string) => ctx[key];

describe('renderJsonTemplate', () => {
	test('quotes, backslashes and line breaks in values come back intact through JSON.parse', () => {
		const out = renderJsonTemplate('{"text":"{{name}}","details":"{{summary}}"}', resolve);
		expect(JSON.parse(out)).toEqual({
			text: 'Disk "sda" at 95%',
			details: 'disk "sda" at 95%\nline two \\ backslash',
		});
	});

	test('a placeholder mixed with literal text, in a key, and nested in arrays/objects', () => {
		const out = renderJsonTemplate(
			'{"msg":"Alert {{name}} is {{status}}","{{label.env}}_env":true,"list":[{"id":"{{id}}"},"{{label.env}}"]}',
			resolve
		);
		expect(JSON.parse(out)).toEqual({
			msg: 'Alert Disk "sda" at 95% is firing',
			prod_env: true,
			list: [{ id: 'a-1' }, 'prod'],
		});
	});

	test('a bare placeholder is a JSON value when the text is one, a string otherwise', () => {
		const out = renderJsonTemplate(
			'{"count":{{label.count}},"flaky":{{label.flaky}},"nested":{{label.nested}},"name":{{name}},"env":{{label.env}}}',
			resolve
		);
		expect(JSON.parse(out)).toEqual({
			count: 3,
			flaky: true,
			nested: { a: 1 },
			name: 'Disk "sda" at 95%',
			env: 'prod',
		});
	});

	test('unknown variables stay literal, inside and outside strings', () => {
		const out = renderJsonTemplate('{"a":"{{nope}}","b":{{nope}}}', resolve);
		expect(JSON.parse(out)).toEqual({ a: '{{nope}}', b: '{{nope}}' });
	});

	test('a multi-line template stays pretty-printed; a one-liner stays compact', () => {
		expect(renderJsonTemplate('{\n  "id": "{{id}}"\n}', resolve)).toBe('{\n  "id": "a-1"\n}');
		expect(renderJsonTemplate('{"id":"{{id}}"}', resolve)).toBe('{"id":"a-1"}');
	});

	test('an escaped quote before a placeholder does not confuse the scanner', () => {
		const out = renderJsonTemplate('{"q":"say \\"{{label.env}}\\""}', resolve);
		expect(JSON.parse(out)).toEqual({ q: 'say "prod"' });
	});

	test('validateJsonTemplate names the problem; looksLikeJson is a cheap hint', () => {
		expect(validateJsonTemplate('{"a":"{{id}}"}')).toBeNull();
		expect(validateJsonTemplate('{"a":{{id}}}')).toBeNull();
		expect(validateJsonTemplate('{"a":"{{id}}" "b":1}')).toMatch(/./);
		expect(validateJsonTemplate('just text {{id}}')).toMatch(/./);
		expect(looksLikeJson('  {"a":1}')).toBe(true);
		expect(looksLikeJson('[1]')).toBe(true);
		expect(looksLikeJson('text')).toBe(false);
	});
});

describe('renderHttpBody', () => {
	const cfg = (bodyTemplate: string, bodyFormat?: 'json' | 'text') => ({
		url: 'https://example.com',
		method: 'POST' as const,
		bodyTemplate,
		bodyFormat,
	});

	test('text mode and a legacy action without the field substitute as plain text', () => {
		const raw = `{"d":"disk "sda" at 95%\nline two \\ backslash"}`;
		expect(renderHttpBody(cfg('{"d":"{{summary}}"}', 'text'), ctx)).toBe(raw);
		expect(renderHttpBody(cfg('{"d":"{{summary}}"}'), ctx)).toBe(raw);
	});

	test('json mode escapes; an invalid json-mode template falls back to text rather than failing', () => {
		expect(JSON.parse(renderHttpBody(cfg('{"d":"{{summary}}"}', 'json'), ctx))).toEqual({ d: ctx.summary });
		expect(renderHttpBody(cfg('not json {{id}}', 'json'), ctx)).toBe('not json a-1');
	});
});

describe('over the wire', () => {
	test('the receiver can parse the body and gets the exact summary back', async () => {
		const received: string[] = [];
		const server = http.createServer((req, res) => {
			let body = '';
			req.on('data', (chunk: Buffer) => (body += chunk.toString()));
			req.on('end', () => {
				received.push(body);
				res.statusCode = 200;
				res.end('ok');
			});
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook?q={{name}}`;
		try {
			const action: ExecutableAction = {
				name: 'json hook',
				type: 'http',
				config: {
					url,
					method: 'POST',
					headers: { 'X-Summary': '{{summary}}' },
					bodyTemplate: '{"summary":"{{summary}}","count":{{label.count}}}',
					bodyFormat: 'json',
				},
			};
			const result = await executeAction(action, ctx);
			expect(result.ok).toBe(true);
			expect(JSON.parse(received[0])).toEqual({ summary: ctx.summary, count: 3 });
		} finally {
			server.closeAllConnections();
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	});
});
