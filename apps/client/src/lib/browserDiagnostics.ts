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
	// No hover on a touch screen is how touch works, not a fault; with no touch screen it
	// is a remote/virtual session misreporting the mouse — the case worth flagging.
	if (!checks.hoverCapable && env.maxTouchPoints === 0) {
		findings.push(
			'The pointer reports it cannot hover (a remote/virtual session, most likely): hover styles never apply, so buttons only change on click.'
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

// "Microsoft Edge 110 on Windows" from a user-agent string: what a person recognises.
// Order matters — Edge and Opera also say "Chrome", Chrome also says "Safari".
export const describeBrowser = (userAgent: string): string => {
	const ua = userAgent;
	const pick = (...pairs: Array<[string, RegExp]>): string | null => {
		for (const [name, pattern] of pairs) {
			const match = pattern.exec(ua);
			if (match) return `${name} ${match[1].split('.')[0]}`;
		}
		return null;
	};
	// Mobile builds carry their own tokens (EdgA/EdgiOS, CriOS, FxiOS, SamsungBrowser) and
	// otherwise look like Chrome or Safari; they go first.
	const browser =
		pick(
			['Microsoft Edge', /Edg(?:A|iOS)?\/([\d.]+)/],
			['Opera', /OPR\/([\d.]+)/],
			['Samsung Internet', /SamsungBrowser\/([\d.]+)/],
			['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
			['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
			['Safari', /Version\/([\d.]+).*Safari/]
		) ?? 'Unknown browser';
	const os = /Windows NT 10/.test(ua)
		? 'Windows'
		: /Windows/.test(ua)
			? 'Windows (older)'
			: /Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)
				? 'macOS'
				: /iPhone|iPad/.test(ua)
					? 'iOS'
					: /Android/.test(ua)
						? 'Android'
						: /Linux|X11/.test(ua)
							? 'Linux'
							: 'an unknown OS';
	return `${browser} on ${os}`;
};

export type ChecklistStatus = 'ok' | 'problem' | 'info';

export interface ChecklistItem {
	id: string;
	// What is checked, in a user's words.
	label: string;
	status: ChecklistStatus;
	// What the answer means for what they see.
	detail: string;
}

// The checks as a list a person reads top to bottom: green when the UI will look right,
// red when it will not, grey for a preference that only explains a look.
export const buildChecklist = ({ checks, environment }: BrowserDiagnostics): ChecklistItem[] => [
	{
		id: 'oklch',
		label: 'Modern colors (oklch)',
		status: checks.oklch ? 'ok' : 'problem',
		detail: checks.oklch
			? 'Icon and badge colors display as designed.'
			: `Status, severity and fix icons lose their colors. The browser is too old — needs ${MINIMUM_BROWSERS}.`,
	},
	{
		id: 'colorMix',
		label: 'Color blending (color-mix)',
		status: checks.colorMix ? 'ok' : 'problem',
		detail: checks.colorMix
			? 'Hover and selection tints display as designed.'
			: 'Hover and selection tints on buttons and rows disappear. The browser is too old.',
	},
	{
		id: 'hover',
		label: 'Mouse hover',
		// A touch screen with no hover is expected (grey); no hover and no touch is a
		// remote/virtual session misreporting the mouse (red) — the same rule as the finding.
		status: checks.hoverCapable ? 'ok' : environment.maxTouchPoints > 0 ? 'info' : 'problem',
		detail: checks.hoverCapable
			? 'Buttons and rows react when the pointer is over them.'
			: environment.maxTouchPoints > 0
				? 'Touch screen without hover: buttons change when tapped.'
				: 'The browser reports no hover (a remote/virtual session, most likely): buttons only change when clicked.',
	},
	{
		id: 'pointer',
		label: 'Precise pointer (mouse or trackpad)',
		status: checks.finePointer ? 'ok' : 'info',
		detail: checks.finePointer
			? 'A mouse or trackpad is in use.'
			: 'No precise pointer detected (touch, or a remote session).',
	},
	{
		id: 'forcedColors',
		label: 'Windows Contrast theme',
		status: checks.forcedColors ? 'problem' : 'ok',
		detail: checks.forcedColors
			? 'A High Contrast theme is on: Windows replaces page colors, so colored icons and tints show in system colors.'
			: 'Off — page colors are shown as designed.',
	},
	{
		id: 'dark',
		label: 'Dark mode preferred by the system',
		status: 'info',
		detail: checks.darkScheme ? 'Yes.' : 'No.',
	},
	{
		id: 'motion',
		label: 'Reduced motion requested',
		status: 'info',
		detail: checks.reducedMotion ? 'Yes — animations are kept to a minimum.' : 'No.',
	},
	{
		id: 'contrast',
		label: 'More contrast requested',
		status: 'info',
		detail: checks.moreContrast ? 'Yes.' : 'No.',
	},
];

export interface AboutItem {
	label: string;
	value: string;
}

// "About this browser": the facts support asks for, in plain words.
export const buildAboutList = (
	diagnostics: BrowserDiagnostics,
	versions: DiagnosticsVersions,
	origin: string
): AboutItem[] => {
	const { environment } = diagnostics;
	return [
		{ label: 'Browser', value: describeBrowser(environment.userAgent) },
		{
			label: 'OpsiMate',
			value: `server ${versions.server === null ? 'unknown (not loaded)' : versions.server}, client ${versions.client}`,
		},
		{ label: 'Address', value: origin },
		{
			label: 'Screen',
			value: `${environment.screen.width} × ${environment.screen.height}, window ${environment.viewport.width} × ${environment.viewport.height}, zoom ${Math.round(environment.devicePixelRatio * 100)}%`,
		},
		{ label: 'Touch', value: environment.maxTouchPoints > 0 ? `yes (${environment.maxTouchPoints} points)` : 'no' },
		{ label: 'Language & time zone', value: `${environment.language}, ${environment.timeZone}` },
	];
};
