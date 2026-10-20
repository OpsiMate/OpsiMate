// What a support thread needs to know about the browser when "it looks wrong on my
// machine": the things the UI's styling depends on and that differ between machines.
// Tailwind v4 draws colors with oklch() and opacity with color-mix() (Chrome/Edge 111+,
// Firefox 128+, Safari 16.4+), applies hover styles only when the pointer can hover, and
// Windows Contrast themes override colors outright. Each is checked here and turned into
// a plain-language finding, so the first reply is a diagnosis instead of a question.

export interface DiagnosticsEnvironment {
	userAgent: string;
	language: string;
	platform: string;
	maxTouchPoints: number;
	devicePixelRatio: number;
	screen: { width: number; height: number };
	viewport: { width: number; height: number };
	timeZone: string;
	supports: (property: string, value: string) => boolean;
	matches: (mediaQuery: string) => boolean;
}

export interface BrowserDiagnostics {
	// Capabilities the UI relies on.
	checks: {
		oklch: boolean;
		colorMix: boolean;
		hoverCapable: boolean;
		finePointer: boolean;
		forcedColors: boolean;
		darkScheme: boolean;
		reducedMotion: boolean;
		moreContrast: boolean;
	};
	// Plain-language explanations of what will look wrong, if anything.
	findings: string[];
	environment: Omit<DiagnosticsEnvironment, 'supports' | 'matches'>;
}

export const MINIMUM_BROWSERS = 'Chrome/Edge 111+, Firefox 128+, Safari 16.4+';

// Reads the real browser. Guarded so a missing API (an old browser, jsdom) reads as
// "unsupported" rather than throwing — this must never be the thing that breaks.
export const readBrowserEnvironment = (): DiagnosticsEnvironment => ({
	userAgent: navigator.userAgent,
	language: navigator.language,
	platform: navigator.platform,
	maxTouchPoints: navigator.maxTouchPoints ?? 0,
	devicePixelRatio: window.devicePixelRatio,
	screen: { width: window.screen?.width ?? 0, height: window.screen?.height ?? 0 },
	viewport: { width: window.innerWidth, height: window.innerHeight },
	timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
	supports: (property, value) => {
		try {
			return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports(property, value);
		} catch {
			return false;
		}
	},
	matches: (mediaQuery) => {
		try {
			return typeof window.matchMedia === 'function' && window.matchMedia(mediaQuery).matches;
		} catch {
			return false;
		}
	},
});

// A probe that throws (an API the browser lacks) reads as "unsupported": the diagnostics
// must never be the thing that fails.
const probe = (check: () => boolean): boolean => {
	try {
		return check();
	} catch {
		return false;
	}
};

export const collectBrowserDiagnostics = (
	env: DiagnosticsEnvironment = readBrowserEnvironment()
): BrowserDiagnostics => {
	const checks = {
		oklch: probe(() => env.supports('color', 'oklch(0.5 0.1 200)')),
		colorMix: probe(() => env.supports('color', 'color-mix(in oklab, red, blue)')),
		hoverCapable: probe(() => env.matches('(hover: hover)')),
		finePointer: probe(() => env.matches('(pointer: fine)')),
		forcedColors: probe(() => env.matches('(forced-colors: active)')),
		darkScheme: probe(() => env.matches('(prefers-color-scheme: dark)')),
		reducedMotion: probe(() => env.matches('(prefers-reduced-motion: reduce)')),
		moreContrast: probe(() => env.matches('(prefers-contrast: more)')),
	};
	const findings: string[] = [];
	if (!checks.oklch || !checks.colorMix) {
		findings.push(
			`Browser too old for OpsiMate's styles (no ${[!checks.oklch && 'oklch()', !checks.colorMix && 'color-mix()']
				.filter(Boolean)
				.join(
					' / '
				)}): status, severity and fix icons lose their color and hover tints disappear. Needs ${MINIMUM_BROWSERS}.`
		);
	}
	if (checks.forcedColors) {
		findings.push(
			'A Windows Contrast (High Contrast) theme is active: the OS replaces page colors, so colored icons and hover backgrounds show in system colors.'
		);
	}
	if (!checks.hoverCapable) {
		findings.push(
			'The pointer reports it cannot hover (touch device, or a remote/virtual session): hover styles never apply, so buttons only change on click.'
		);
	}
	const { supports: _supports, matches: _matches, ...environment } = env;
	return { checks, findings, environment };
};

export interface DiagnosticsVersions {
	// null when the server has not answered: better "unknown" than the client's build
	// wearing the server's label.
	server: string | null;
	commit: string | null;
	client: string;
}

const yesNo = (value: boolean): string => (value ? 'yes' : 'no');

// The text a user pastes into a support request.
export const formatBrowserDiagnostics = (
	diagnostics: BrowserDiagnostics,
	versions: DiagnosticsVersions,
	origin: string
): string => {
	const { checks, environment, findings } = diagnostics;
	return [
		'OpsiMate browser diagnostics',
		`server ${versions.server === null ? 'unknown (not loaded)' : versions.server}${versions.server !== null && versions.commit ? ` (${versions.commit.slice(0, 7)})` : ''}, client ${versions.client}, ${origin}`,
		`browser: ${environment.userAgent}`,
		`platform: ${environment.platform || 'unknown'}, language ${environment.language}, time zone ${environment.timeZone}`,
		`screen ${environment.screen.width}x${environment.screen.height} @${environment.devicePixelRatio}x, viewport ${environment.viewport.width}x${environment.viewport.height}, touch points ${environment.maxTouchPoints}`,
		`css oklch: ${yesNo(checks.oklch)}, color-mix: ${yesNo(checks.colorMix)}`,
		`hover capable: ${yesNo(checks.hoverCapable)}, fine pointer: ${yesNo(checks.finePointer)}`,
		`forced colors: ${yesNo(checks.forcedColors)}, prefers dark: ${yesNo(checks.darkScheme)}, reduced motion: ${yesNo(checks.reducedMotion)}, more contrast: ${yesNo(checks.moreContrast)}`,
		findings.length > 0
			? `findings:\n${findings.map((f) => `- ${f}`).join('\n')}`
			: 'findings: none — no known rendering issue detected',
	].join('\n');
};
