import { describe, expect, test } from 'vitest';
import { passwordResetTemplate, playgroundDemoTemplate, welcomeTemplate } from '../src/utils/mailTemplate';

// The email builders are plain string functions, so these assert on the pieces that
// matter (link, greeting, optional lines, header/footer) rather than full-HTML snapshots,
// which would break on every style tweak.

const year = String(new Date().getFullYear());

describe('passwordResetTemplate', () => {
	test('embeds the reset URL', () => {
		const html = passwordResetTemplate('https://app.example.com/reset?token=abc123');
		expect(html).toContain('href="https://app.example.com/reset?token=abc123"');
	});

	test('greets the user by name when one is given', () => {
		const html = passwordResetTemplate('https://x/reset', 'Ada');
		expect(html).toContain('Hi Ada,');
		expect(html).not.toContain('Hello,');
	});

	test('falls back to a generic greeting without a name', () => {
		const html = passwordResetTemplate('https://x/reset');
		expect(html).toContain('Hello,');
		expect(html).not.toContain('Hi ');
	});
});

describe('welcomeTemplate', () => {
	test.each([
		['an empty string', ''],
		['undefined', undefined],
	])('uses the default body for %s', (_label, body) => {
		const html = welcomeTemplate(body);
		expect(html).toContain('Welcome aboard!');
	});

	test('a custom body replaces the default one', () => {
		const html = welcomeTemplate('<p>Custom onboarding text</p>');
		expect(html).toContain('<p>Custom onboarding text</p>');
		expect(html).not.toContain('Welcome aboard!');
	});

	test('puts the name in the greeting', () => {
		const html = welcomeTemplate(undefined, 'Ada');
		expect(html).toContain('Hey Ada');
	});
});

describe('playgroundDemoTemplate', () => {
	test('omits the contact email and tracking ID lines when they are absent', () => {
		const html = playgroundDemoTemplate();
		expect(html).not.toContain('Contact Email:');
		expect(html).not.toContain('Tracking ID:');
	});

	test('includes the contact email and tracking ID when present', () => {
		const html = playgroundDemoTemplate('lead@example.com', 'trk-42');
		expect(html).toContain('<strong>Contact Email:</strong> lead@example.com');
		expect(html).toContain('<strong>Tracking ID:</strong> trk-42');
	});
});

describe('shared skeleton', () => {
	test.each([
		['passwordResetTemplate', () => passwordResetTemplate('https://x/reset')],
		['welcomeTemplate', () => welcomeTemplate()],
		['playgroundDemoTemplate', () => playgroundDemoTemplate()],
	])('%s has the OpsiMate header and the current year in the footer', (_name, build) => {
		const html = build();
		expect(html).toContain('>OpsiMate</h1>');
		expect(html).toContain(`Copyright &copy; ${year} OpsiMate`);
	});
});
