import { securityModeOf, withSecurityMode } from '@/components/Settings/LdapSettings/securityMode';
import { describe, expect, test } from 'vitest';

describe('securityModeOf', () => {
	test.each([
		['', false, 'ldaps'],
		['ldaps://ldap.example.com', false, 'ldaps'],
		['LDAPS://ldap.example.com:636', false, 'ldaps'],
		// The flag means nothing on ldaps:// and must not change what is shown.
		['ldaps://ldap.example.com', true, 'ldaps'],
		['ldap://ldap.example.com', true, 'starttls'],
		['ldap://ldap.example.com', false, 'none'],
		['ldap://localhost:10389', false, 'none'],
	] as const)('%s / startTls=%s -> %s', (url, startTls, mode) => {
		expect(securityModeOf({ url, startTls })).toBe(mode);
	});
});

describe('withSecurityMode', () => {
	test('swaps the scheme and the standard port', () => {
		expect(withSecurityMode({ url: 'ldap://h:389', startTls: false }, 'ldaps')).toEqual({
			url: 'ldaps://h:636',
			startTls: false,
		});
		expect(withSecurityMode({ url: 'ldaps://h:636', startTls: false }, 'none')).toEqual({
			url: 'ldap://h:389',
			startTls: false,
		});
		expect(withSecurityMode({ url: 'ldaps://h:636', startTls: false }, 'starttls')).toEqual({
			url: 'ldap://h:389',
			startTls: true,
		});
	});

	test('keeps a custom port, a path, and an IPv6 host', () => {
		expect(withSecurityMode({ url: 'ldap://h:1389', startTls: false }, 'ldaps').url).toBe('ldaps://h:1389');
		expect(withSecurityMode({ url: 'ldap://h:389/dc=example', startTls: false }, 'ldaps').url).toBe(
			'ldaps://h:636/dc=example'
		);
		expect(withSecurityMode({ url: 'ldap://[::1]:389', startTls: false }, 'ldaps').url).toBe('ldaps://[::1]:636');
		expect(withSecurityMode({ url: 'ldap://h', startTls: false }, 'ldaps').url).toBe('ldaps://h');
	});

	test('adds the scheme to a bare host and to an empty URL', () => {
		expect(withSecurityMode({ url: 'ldap.example.com', startTls: false }, 'starttls').url).toBe(
			'ldap://ldap.example.com'
		);
		expect(withSecurityMode({ url: '', startTls: false }, 'none').url).toBe('ldap://');
	});

	test('is case-insensitive about the scheme it replaces', () => {
		expect(withSecurityMode({ url: 'LDAPS://h', startTls: false }, 'none').url).toBe('ldap://h');
	});
});
