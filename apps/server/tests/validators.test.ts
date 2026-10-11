import crypto from 'crypto';
import { describe, expect, test } from 'vitest';
import {
	MAX_SSH_KEY_LENGTH,
	MIN_SSH_KEY_LENGTH,
	validateKubeConfig,
	validatePublicSSHKey,
} from '../src/utils/validators/validators';

// Private keys are generated per run so no private key is ever committed.
const rsaPrivateKey = crypto.generateKeyPairSync('rsa', {
	modulusLength: 2048,
	privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
	publicKeyEncoding: { type: 'spki', format: 'pem' },
}).privateKey;

const ed25519PrivateKey = crypto.generateKeyPairSync('ed25519', {
	privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
	publicKeyEncoding: { type: 'spki', format: 'pem' },
}).privateKey;

// OpenSSH public key from `ssh-keygen -t rsa -b 2048`. Public keys are safe to commit.
const opensshRsaPublicKey =
	'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDZ9dxx6atMdwMYtI+whEymfIkI9taplwHK7KUEafZRAS3gxn74/oC+ZQ02QCI4B9gi2R/gXTRchc6U009FqdlyFmFGHTV+3566N+0W+LEXp+tGill+8cDu8N9Rw7P/yhkD5eQY7IvslAqH5Hx91pDOncGDk2pcVtB8z1tWTQbPDtwhEkEKK7lfHck86WGzbYd8k+ZyWRoXZfTaoy+b4t6PXUhampEne2hRn+NifygwCSEWr+ezFjXLnbOVf4mfOaC3OeHIKGSVpdRfcR95mWBTXYkaZXjy1WfTp5QvUlJtbYZtlVuMqX0oyxksGv1LdR3rCNGkML7ruUS5dJGXWjY9 test@opsimate';

describe('validatePublicSSHKey', () => {
	test('returns false for an empty string', () => {
		expect(validatePublicSSHKey('')).toBe(false);
	});

	test('returns false for whitespace-only input', () => {
		expect(validatePublicSSHKey('   \n\t  \n')).toBe(false);
	});

	test('returns false for a string shorter than the minimum length', () => {
		expect(validatePublicSSHKey('a'.repeat(MIN_SSH_KEY_LENGTH - 1))).toBe(false);
	});

	test('returns false for a string longer than the maximum length', () => {
		expect(validatePublicSSHKey('a'.repeat(MAX_SSH_KEY_LENGTH + 1))).toBe(false);
	});

	test('returns false (and does not throw) for 200 characters of junk', () => {
		const junk = 'not-a-key!'.repeat(20);
		expect(() => validatePublicSSHKey(junk)).not.toThrow();
		expect(validatePublicSSHKey(junk)).toBe(false);
	});

	test('returns true for an RSA private key in PEM format', () => {
		expect(rsaPrivateKey).toContain('-----BEGIN RSA PRIVATE KEY-----');
		expect(validatePublicSSHKey(rsaPrivateKey)).toBe(true);
	});

	test('returns true for an ed25519 private key in PKCS#8 PEM format', () => {
		expect(ed25519PrivateKey).toContain('-----BEGIN PRIVATE KEY-----');
		expect(validatePublicSSHKey(ed25519PrivateKey)).toBe(true);
	});

	test('trims leading/trailing whitespace and newlines before validating', () => {
		expect(validatePublicSSHKey(`\n\n   ${rsaPrivateKey}  \n\t\n`)).toBe(true);
	});

	test('returns false for an OpenSSH-format RSA public key', () => {
		expect(opensshRsaPublicKey.length).toBeGreaterThan(MIN_SSH_KEY_LENGTH);
		expect(validatePublicSSHKey(opensshRsaPublicKey)).toBe(false);
	});
});

describe('validateKubeConfig', () => {
	test('returns true for apiVersion v1 with kind Config', () => {
		expect(validateKubeConfig('apiVersion: v1\nkind: Config\n')).toBe(true);
	});

	test('returns false for a Deployment manifest', () => {
		expect(validateKubeConfig('apiVersion: apps/v1\nkind: Deployment\n')).toBe(false);
	});

	test('returns false when apiVersion is missing', () => {
		expect(validateKubeConfig('kind: Config\n')).toBe(false);
	});

	test('returns false (and does not throw) for invalid YAML', () => {
		expect(() => validateKubeConfig('a: [1, 2')).not.toThrow();
		expect(validateKubeConfig('a: [1, 2')).toBe(false);
	});

	test('returns false for an empty string', () => {
		expect(validateKubeConfig('')).toBe(false);
	});

	test('returns false for a YAML list', () => {
		expect(validateKubeConfig('- apiVersion: v1\n- kind: Config\n')).toBe(false);
	});

	test('returns false for a plain scalar', () => {
		expect(validateKubeConfig('just a string')).toBe(false);
	});
});
