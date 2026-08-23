import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { FormattedText, stripHtml } from './FormattedText';

// FormattedText renders integration/webhook-provided HTML, so these tests are as much a
// security contract as a formatting one: the allow-listed subset must render, and every
// script / CSS-injection vector must be neutralized.

const html = (text: string): string => {
	const { container } = render(<FormattedText text={text} />);
	return container.innerHTML;
};

describe('FormattedText — allowed formatting', () => {
	test('renders a table with rows and cells', () => {
		const out = html('<table><thead><tr><th>Metric</th></tr></thead><tbody><tr><td>CPU</td></tr></tbody></table>');
		expect(out).toContain('<table');
		expect(out).toContain('<th>Metric</th>');
		expect(out).toContain('<td>CPU</td>');
	});

	test('keeps allow-listed inline colors (color, background-color)', () => {
		const out = html('<span style="color: red; background-color: yellow">alert</span>');
		expect(out).toContain('color: red');
		expect(out).toContain('background-color: yellow');
	});

	test('keeps presentational bgcolor/colspan on table cells', () => {
		const out = html('<table><tr><td colspan="2" bgcolor="#ffcc00">x</td></tr></table>');
		expect(out).toContain('colspan="2"');
		expect(out).toContain('bgcolor="#ffcc00"');
	});

	test('keeps bold, links (forced safe), and lists', () => {
		const out = html('<b>bold</b> <a href="https://x.example">link</a> <ul><li>item</li></ul>');
		expect(out).toContain('<b>bold</b>');
		expect(out).toContain('rel="noopener noreferrer"');
		expect(out).toContain('target="_blank"');
		expect(out).toContain('<li>item</li>');
	});
});

describe('FormattedText — security', () => {
	test('strips <script> entirely', () => {
		const out = html('<p>hi</p><script>window.__pwned = 1</script>');
		expect(out).not.toContain('<script');
		expect(out.toLowerCase()).not.toContain('__pwned');
	});

	test('strips event-handler attributes', () => {
		const out = html('<img src=x onerror="alert(1)"><div onclick="alert(1)">x</div>');
		expect(out.toLowerCase()).not.toContain('onerror');
		expect(out.toLowerCase()).not.toContain('onclick');
	});

	test('neutralizes javascript: hrefs', () => {
		const out = html('<a href="javascript:alert(1)">x</a>');
		expect(out.toLowerCase()).not.toContain('javascript:alert');
	});

	test('drops layout/position CSS that could overlay or hide the UI', () => {
		const out = html('<span style="position: fixed; top: 0; z-index: 9999; color: red">x</span>');
		expect(out).not.toContain('position');
		expect(out).not.toContain('z-index');
		// the allow-listed color on the same element survives
		expect(out).toContain('color: red');
	});

	test('drops url()/expression() CSS values even on allow-listed properties', () => {
		const out = html(
			'<span style="background-color: url(https://evil.example/x); color: expression(alert(1))">x</span>'
		);
		expect(out.toLowerCase()).not.toContain('url(');
		expect(out.toLowerCase()).not.toContain('expression');
	});

	test('strips iframes', () => {
		const out = html('<iframe src="https://evil.example"></iframe>');
		expect(out.toLowerCase()).not.toContain('<iframe');
	});
});

describe('stripHtml', () => {
	test('flattens a table to its cell text for single-line contexts', () => {
		// Tag removal concatenates adjacent cell text; the details view is where tables
		// render structurally. The list column just needs a compact, safe one-liner.
		expect(stripHtml('<table><tr><td>CPU</td><td>98%</td></tr></table>')).toBe('CPU98%');
	});

	test('leaves plain text untouched', () => {
		expect(stripHtml('just text')).toBe('just text');
	});
});
