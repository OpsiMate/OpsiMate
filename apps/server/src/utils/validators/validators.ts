import { Logger } from '@OpsiMate/shared';
// Namespace import, not default: js-yaml 5 dropped the ESM default export. A default
// import still typechecks here (allowSyntheticDefaultImports) but fails to link at
// runtime, which would take the server down at boot rather than in a test.
import * as yaml from 'js-yaml';
import { parseKey, Key } from 'sshpk';
const logger: Logger = new Logger('server');
export function validatePublicSSHKey(content: string): boolean {
	try {
		const trimmed = content.trim();
		if (!trimmed || trimmed.length < 100 || trimmed.length > 100000) {
			return false;
		}
		const key: Key = parseKey(trimmed, 'auto'); //validate private Key
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
