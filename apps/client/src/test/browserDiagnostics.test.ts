import {
	collectBrowserDiagnostics,
	DiagnosticsEnvironment,
	formatBrowserDiagnostics,
	MINIMUM_BROWSERS,
} from '@/lib/browserDiagnostics';
import { describe, expect, test } from 'vitest';

// The diagnostics exist to turn "it looks wrong on my Windows machine" into a cause.
// Each known cause must surface as a finding, and a healthy browser must report none.

const env = (overrides: Partial<DiagnosticsEnvironment> = {}): DiagnosticsEnvironment => ({
	userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0',
	language: 'en-US',
	platform: 'Win32',
	maxTouchPoints: 0,
	devicePixelRatio: 1.25,
	screen: { width: 1920, height: 1080 },
	viewport: { width: 1600, height: 900 },
	timeZone: 'Asia/Jerusalem',
	supports: () => true,
	matches: (query) => query === '(hover: hover)' || query === '(pointer: fine)',
	...overrides,
});

const versions = { server: '0.0.120', commit: 'abc1234def', client: '0.0.120' };

describe('collectBrowserDiagnostics', () => {
	test('a modern desktop browser has no findings', () => {
		const result = collectBrowserDiagnostics(env());
		expect(result.checks).toMatchObject({ oklch: true, colorMix: true, hoverCapable: true, forcedColors: false });
		expect(result.findings).toEqual([]);
	});

	test('an old browser (no oklch / color-mix) is named as the cause of colorless icons', () => {
		const result = collectBrowserDiagnostics(env({ supports: () => false }));
		expect(result.findings).toHaveLength(1);
		expect(result.findings[0]).toContain('too old');
		expect(result.findings[0]).toContain('oklch() / color-mix()');
		expect(result.findings[0]).toContain(MINIMUM_BROWSERS);
	});

	test('a Windows Contrast theme and a non-hovering pointer each get their own finding', () => {
		const result = collectBrowserDiagnostics(
			env({ matches: (query) => query === '(forced-colors: active)', maxTouchPoints: 10 })
		);
		expect(result.checks.forcedColors).toBe(true);
		expect(result.checks.hoverCapable).toBe(false);
		expect(result.findings.map((f) => f.split(':')[0])).toEqual([
			'A Windows Contrast (High Contrast) theme is active',
			'The pointer reports it cannot hover (touch device, or a remote/virtual session)',
		]);
	});

	test('a missing API counts as unsupported rather than throwing', () => {
		const result = collectBrowserDiagnostics(
			env({
				supports: () => {
					throw new Error('no CSS.supports');
				},
			})
		);
		expect(result.checks.oklch).toBe(false);
	});
});

describe('formatBrowserDiagnostics', () => {
	test('is a plain-text block with versions, browser, capabilities and findings', () => {
		const text = formatBrowserDiagnostics(
			collectBrowserDiagnostics(env({ supports: () => false })),
			versions,
			'https://opsimate.example.com'
		);
		expect(text).toContain('server 0.0.120 (abc1234), client 0.0.120, https://opsimate.example.com');
		expect(text).toContain('browser: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0');
		expect(text).toContain('css oklch: no, color-mix: no');
		expect(text).toContain('hover capable: yes, fine pointer: yes');
		expect(text).toContain('findings:\n- Browser too old');
	});

	test('an unanswered server version is "unknown", never the client build in disguise', () => {
		const text = formatBrowserDiagnostics(
			collectBrowserDiagnostics(env()),
			{ server: null, commit: 'abc1234def', client: '0.0.120' },
			'http://localhost:8080'
		);
		expect(text).toContain('server unknown (not loaded), client 0.0.120');
		expect(text).not.toContain('abc1234');
	});

	test('says so when nothing is wrong', () => {
		const text = formatBrowserDiagnostics(
			collectBrowserDiagnostics(env()),
			{ ...versions, commit: null },
			'http://localhost:8080'
		);
		expect(text).toContain('server 0.0.120, client 0.0.120, http://localhost:8080');
		expect(text).toContain('findings: none');
	});
});
