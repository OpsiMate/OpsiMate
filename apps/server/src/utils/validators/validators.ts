import { Logger } from '@OpsiMate/shared';
// Namespace import, not default: js-yaml 5 dropped the ESM default export. A default
// import still typechecks here (allowSyntheticDefaultImports) but fails to link at
// runtime, which would take the server down at boot rather than in a test.
import * as yaml from 'js-yaml';
import { parseKey, Key } from 'sshpk';
const logger: Logger = new Logger('utils/validators');

export const MIN_SSH_KEY_LENGTH = 100;
export const MAX_SSH_KEY_LENGTH = 100000;

export function validatePublicSSHKey(content: string): boolean {
	try {
		const trimmed = content.trim();
		if (!trimmed || trimmed.length < MIN_SSH_KEY_LENGTH || trimmed.length > MAX_SSH_KEY_LENGTH) {
			return false;
		}
		// Despite the function name, the uploaded file is the PRIVATE key OpsiMate uses to
		// SSH into hosts (e.g. PEM "-----BEGIN RSA PRIVATE KEY-----" / PKCS#8). OpenSSH
		// public keys ("ssh-rsa AAAA…", "ssh-ed25519 AAAA…") are rejected.
		const key: Key = parseKey(trimmed, 'auto');
		if (!key || !key.source) {
			return false;
		}
		return true;
	} catch {
		return false;
	}
}

export function validateKubeConfig(content: string): boolean {
	try {
		const data = yaml.load(content);
		if (data && typeof data === 'object' && 'apiVersion' in data && 'kind' in data && data.kind === 'Config') {
			return true;
		}
		return false;
	} catch (error: unknown) {
		logger.error('kubernetes config validation error:', error);
		return false;
	}
}
