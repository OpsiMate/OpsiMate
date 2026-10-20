import {
	buildAboutList,
	buildChecklist,
	collectBrowserDiagnostics,
	describeBrowser,
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

	test('a Windows Contrast theme and a non-hovering mouse each get their own finding', () => {
		const result = collectBrowserDiagnostics(env({ matches: (query) => query === '(forced-colors: active)' }));
		expect(result.checks.forcedColors).toBe(true);
		expect(result.checks.hoverCapable).toBe(false);
		expect(result.findings.map((f) => f.split(':')[0])).toEqual([
			'A Windows Contrast (High Contrast) theme is active',
			'The pointer reports it cannot hover (a remote/virtual session, most likely)',
		]);
	});

	test('no hover on a touch screen is how touch works, not a finding', () => {
		const result = collectBrowserDiagnostics(env({ matches: () => false, maxTouchPoints: 10 }));
		expect(result.checks.hoverCapable).toBe(false);
		expect(result.findings).toEqual([]);
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

describe('describeBrowser', () => {
	test('names the browser and OS the way a person would', () => {
		expect(
			describeBrowser(
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/110.0.5481.178 Safari/537.36 Edg/110.0.1587.63'
			)
		).toBe('Microsoft Edge 110 on Windows');
		expect(
			describeBrowser(
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36'
			)
		).toBe('Chrome 140 on macOS');
		expect(describeBrowser('Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0')).toBe(
			'Firefox 128 on Linux'
		);
		expect(
			describeBrowser(
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15'
			)
		).toBe('Safari 17 on macOS');
		expect(describeBrowser('something else')).toBe('Unknown browser on an unknown OS');
	});

	test('recognises the mobile builds that hide behind Chrome/Safari tokens', () => {
		expect(
			describeBrowser(
				'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 CriOS/140.0.7339.0 Mobile/15E148 Safari/604.1'
			)
		).toBe('Chrome 140 on iOS');
		expect(
			describeBrowser(
				'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 FxiOS/128.0 Mobile/15E148 Safari/605.1.15'
			)
		).toBe('Firefox 128 on iOS');
		expect(
			describeBrowser(
				'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36 EdgA/140.0.0.0'
			)
		).toBe('Microsoft Edge 140 on Android');
		expect(
			describeBrowser(
				'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36 SamsungBrowser/27.0'
			)
		).toBe('Samsung Internet 27 on Android');
	});
});

describe('buildChecklist and buildAboutList', () => {
	test('a healthy browser is all green or grey; an old one marks the color checks red with the fix', () => {
		const healthy = buildChecklist(collectBrowserDiagnostics(env()));
		expect(healthy.map((item) => item.status)).not.toContain('problem');
		const old = buildChecklist(collectBrowserDiagnostics(env({ supports: () => false })));
		const byId = Object.fromEntries(old.map((item) => [item.id, item]));
		expect(byId.oklch.status).toBe('problem');
		expect(byId.oklch.detail).toContain(MINIMUM_BROWSERS);
		expect(byId.colorMix.status).toBe('problem');
		expect(byId.hover.status).toBe('ok');
	});

	test('a Contrast theme is a problem; no hover is a problem without a touch screen, info with one', () => {
		const items = buildChecklist(
			collectBrowserDiagnostics(env({ matches: (q) => q === '(forced-colors: active)' }))
		);
		const byId = Object.fromEntries(items.map((item) => [item.id, item]));
		expect(byId.forcedColors.status).toBe('problem');
		expect(byId.hover.status).toBe('problem');
		expect(byId.pointer.status).toBe('info');

		const touch = buildChecklist(collectBrowserDiagnostics(env({ matches: () => false, maxTouchPoints: 10 })));
		expect(touch.find((item) => item.id === 'hover')?.status).toBe('info');
	});

	test('the about list is plain words: browser name, versions, screen and zoom', () => {
		const about = buildAboutList(collectBrowserDiagnostics(env()), versions, 'https://opsimate.example.com');
		const byLabel = Object.fromEntries(about.map((item) => [item.label, item.value]));
		expect(byLabel.Browser).toBe('Chrome 140 on Windows');
		expect(byLabel.OpsiMate).toBe('server 0.0.120, client 0.0.120');
		expect(byLabel.Screen).toBe('1920 × 1080, window 1600 × 900, zoom 125%');
		expect(byLabel.Touch).toBe('no');
	});
});
