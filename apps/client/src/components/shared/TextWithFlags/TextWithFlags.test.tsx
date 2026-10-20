import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { flagEmojiToCode, flagUrlFor, splitFlags, TextWithFlags } from './TextWithFlags';

// Windows renders flag emoji as two boxed letters; this component draws the flag from a
// bundled SVG instead. The contract: text is split correctly, the SVG is the right
// country, and text without flags passes through untouched.
describe('TextWithFlags', () => {
	test('maps a regional-indicator pair to its country code', () => {
		expect(flagEmojiToCode('🇮🇱')).toBe('IL');
		expect(flagEmojiToCode('🇺🇸')).toBe('US');
		expect(flagEmojiToCode('🇩🇪')).toBe('DE');
	});

	test('splits text into runs and flags, in order', () => {
		expect(splitFlags('IL 🇮🇱')).toEqual([
			{ type: 'text', text: 'IL ' },
			{ type: 'flag', emoji: '🇮🇱', code: 'IL' },
		]);
		expect(splitFlags('🇺🇸 then 🇩🇪!')).toEqual([
			{ type: 'flag', emoji: '🇺🇸', code: 'US' },
			{ type: 'text', text: ' then ' },
			{ type: 'flag', emoji: '🇩🇪', code: 'DE' },
			{ type: 'text', text: '!' },
		]);
		expect(splitFlags('no flags here')).toEqual([{ type: 'text', text: 'no flags here' }]);
	});

	test('has an SVG for the bundled countries (case-insensitive), none for an unassigned code', () => {
		// Only that each country resolves to its own asset; the URL's shape is Vite's business.
		expect(flagUrlFor('IL')).toBeTruthy();
		expect(flagUrlFor('us')).toBe(flagUrlFor('US'));
		expect(flagUrlFor('IL')).not.toBe(flagUrlFor('US'));
		expect(flagUrlFor('ZZ')).toBeUndefined();
	});

	test('renders "IL 🇮🇱" as the text plus an inline flag image, keeping the emoji as alt text', () => {
		render(<TextWithFlags text="IL 🇮🇱" />);
		expect(screen.getByText('IL')).toBeInTheDocument();
		const img = screen.getByRole('img', { name: '🇮🇱' });
		expect(img).toHaveAttribute('title', 'IL');
		expect(img.getAttribute('src')).toBe(flagUrlFor('IL'));
	});

	test('text without a flag renders as plain text with no image', () => {
		const { container } = render(<TextWithFlags text="prod" />);
		expect(container.textContent).toBe('prod');
		expect(container.querySelector('img')).toBeNull();
	});

	test('a pair with no flag for it stays as the emoji', () => {
		// 🇽🇽 is not an assigned country.
		const { container } = render(<TextWithFlags text="site 🇽🇽" />);
		expect(container.textContent).toBe('site 🇽🇽');
		expect(container.querySelector('img')).toBeNull();
	});
});
