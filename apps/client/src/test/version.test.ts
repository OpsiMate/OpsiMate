import { describe, expect, test } from 'vitest';
import { compareVersions, formatVersion, isReleaseVersion, releaseNotesUrl } from '@/lib/version';

// The version badge's pure helpers. The invariant that matters: a non-release build
// is displayed as what it is ("dev"), never dressed up as a release number, and is
// never reported as "behind" the latest release.

describe('isReleaseVersion', () => {
	test('accepts strict a.b.c only', () => {
		expect(isReleaseVersion('0.0.110')).toBe(true);
		expect(isReleaseVersion('1.2.3')).toBe(true);
		for (const bad of ['dev', 'v0.0.110', '0.0', '0.0.110-rc1', '', 'latest']) {
			expect(isReleaseVersion(bad), bad).toBe(false);
		}
	});
});

describe('formatVersion', () => {
	test('releases get a v prefix; the commit is not appended', () => {
		expect(formatVersion('0.0.110', 'abcdef1234')).toBe('v0.0.110');
	});
	test('dev builds show the short commit when known', () => {
		expect(formatVersion('dev', 'abcdef1234')).toBe('dev · abcdef1');
		expect(formatVersion('dev', null)).toBe('dev');
	});
});

describe('releaseNotesUrl', () => {
	test('a release links to its own tag; anything else to the releases list', () => {
		expect(releaseNotesUrl('0.0.110')).toBe('https://github.com/OpsiMate/OpsiMate/releases/tag/v0.0.110');
		expect(releaseNotesUrl('dev')).toBe('https://github.com/OpsiMate/OpsiMate/releases');
	});
});

describe('compareVersions', () => {
	test('numeric, not lexical: 0.0.9 < 0.0.10 < 0.1.0', () => {
		expect(compareVersions('0.0.9', '0.0.10')).toBe(-1);
		expect(compareVersions('0.0.10', '0.1.0')).toBe(-1);
		expect(compareVersions('0.1.0', '0.0.999')).toBe(1);
		expect(compareVersions('0.0.110', '0.0.110')).toBe(0);
	});
	test('a dev build is never behind — comparison is unknown, not -1', () => {
		expect(compareVersions('dev', '0.0.110')).toBeNull();
		expect(compareVersions('0.0.110', 'dev')).toBeNull();
	});
});
