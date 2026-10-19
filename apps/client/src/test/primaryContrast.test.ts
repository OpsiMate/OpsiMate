import { parse } from 'postcss';
import { describe, expect, test } from 'vitest';
import stylesheet from '@/index.css?raw';

type Color = number[];

// Test the palette from the stylesheet rather than duplicating its chosen colours.
const palette = (selector: string) => {
	const tokens: Record<string, Color> = {};
	parse(stylesheet).walkRules(selector, (rule) => {
		rule.walkDecls(/^--(?:primary|primary-foreground|background|card|popover|muted|ring)$/, (declaration) => {
			const [hue, saturation, lightness] = declaration.value.split(/\s+/).map(parseFloat);
			const s = saturation / 100;
			const l = lightness / 100;
			// HSL to sRGB (channels in [0, 1]).
			const channel = (n: number) => {
				const k = (n + hue / 30) % 12;
				return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
			};
			tokens[declaration.prop.slice(2)] = [channel(0), channel(8), channel(4)];
		});
	});
	return tokens;
};

const over = (foreground: Color, background: Color, alpha: number): Color =>
	foreground.map((channel, index) => channel * alpha + background[index] * (1 - alpha));

// WCAG relative luminance, calculated after compositing translucent backgrounds.
const luminance = (color: Color) =>
	color.reduce((sum, channel, index) => {
		const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
		return sum + linear * [0.2126, 0.7152, 0.0722][index];
	}, 0);

const contrast = (foreground: Color, background: Color) => {
	const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
	return (values[0] + 0.05) / (values[1] + 0.05);
};

describe.each([':root', '.dark'])('%s primary contrast', (selector) => {
	const colors = palette(selector);
	const primary = colors.primary;
	const page = colors.background;
	const muted = colors.muted;
	const banner = over(primary, page, 0.1);
	const search = over(primary, page, 0.05);
	const textSurfaces: [string, Color][] = [
		['page links and toolbar text', page],
		['cards', colors.card],
		['popovers', colors.popover],
		['selected menu items', muted],
		['playground banner and profile initials', banner],
		['selected person-picker initials', over(primary, muted, 0.1)],
		['hovered active-row owner initials', over(primary, over(primary, page, 0.15), 0.1)],
		['own-comment initials', over(primary, search, 0.2)],
		['other-comment initials', over(primary, over(muted, page, 0.3), 0.2)],
	];

	test.each(textSurfaces)('keeps primary text readable on %s', (_name, background) => {
		expect(contrast(primary, background)).toBeGreaterThanOrEqual(4.5);
	});

	test('keeps the reduced-opacity NotFound hover link readable', () => {
		expect(contrast(over(primary, page, 0.8), page)).toBeGreaterThanOrEqual(4.5);
	});

	test('keeps text on filled buttons, active tabs and checked controls readable', () => {
		expect(contrast(colors['primary-foreground'], primary)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(colors['primary-foreground'], over(primary, page, 0.9))).toBeGreaterThanOrEqual(4.5);
	});

	test('keeps active toolbar borders and icons distinguishable', () => {
		expect(contrast(primary, page)).toBeGreaterThanOrEqual(3);
		expect(contrast(primary, muted)).toBeGreaterThanOrEqual(3);
		expect(contrast(over(primary, search, 0.6), search)).toBeGreaterThanOrEqual(3);
	});

	test('keeps the focus ring distinguishable on the page and popover', () => {
		expect(contrast(colors.ring, page)).toBeGreaterThanOrEqual(3);
		expect(contrast(colors.ring, colors.popover)).toBeGreaterThanOrEqual(3);
	});
});
