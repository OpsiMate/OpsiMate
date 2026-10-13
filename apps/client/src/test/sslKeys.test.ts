import { SecretMetadata, SecretType } from '@OpsiMate/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLogger, getSecrets, createSecret, updateSecret, deleteSecret } = vi.hoisted(() => ({
	mockLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
	getSecrets: vi.fn(),
	createSecret: vi.fn(),
	updateSecret: vi.fn(),
	deleteSecret: vi.fn(),
}));

vi.mock('@OpsiMate/shared', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@OpsiMate/shared')>();
	return {
		...actual,
		Logger: function () {
			return mockLogger;
		},
	};
});

vi.mock('@/lib/api', () => ({
	secretsApi: {
		getSecrets,
		createSecret,
		updateSecret,
		deleteSecret,
	},
}));

import {
	createSecretOnServer,
	deleteSecretOnServer,
	getSecretsFromServer,
	updateSecretOnServer,
} from '@/lib/sslKeys';

const secret = (id: number): SecretMetadata =>
	({ id, name: `s-${id}`, value: `v-${id}` }) as unknown as SecretMetadata;

beforeEach(() => {
	vi.clearAllMocks();
	mockLogger.error.mockReset();
	mockLogger.warn.mockReset();
	mockLogger.info.mockReset();
	mockLogger.debug.mockReset();
});

describe('getSecretsFromServer', () => {
	it('returns data.secrets on success', async () => {
		getSecrets.mockResolvedValue({ success: true, data: { secrets: [secret(1), secret(2)] } });
		const result = await getSecretsFromServer();
		expect(result).toEqual([secret(1), secret(2)]);
	});

	it('returns [] when the call succeeds but reports success: false', async () => {
		getSecrets.mockResolvedValue({ success: false, error: 'not found' });
		expect(await getSecretsFromServer()).toEqual([]);
	});

	it('returns [] when data is absent on a success response', async () => {
		getSecrets.mockResolvedValue({ success: true, data: undefined });
		expect(await getSecretsFromServer()).toEqual([]);
	});

	it('swallows a thrown error, logs it, and returns []', async () => {
		getSecrets.mockRejectedValue(new Error('network down'));
		expect(await getSecretsFromServer()).toEqual([]);
		expect(mockLogger.error).toHaveBeenCalledTimes(1);
		expect(String(mockLogger.error.mock.calls[0][0])).toContain('Error fetching secrets');
	});
});

describe('createSecretOnServer', () => {
	const file = new File([], 'key.pem');

	it('returns { success: true, id } on a successful create', async () => {
		createSecret.mockResolvedValue({ success: true, data: { id: 42 } });
		const result = await createSecretOnServer('my key', file, SecretType.SSH);
		expect(result).toEqual({ success: true, id: 42 });
		// forwards the arguments to the API
		expect(createSecret).toHaveBeenCalledWith('my key', file, SecretType.SSH);
	});

	it('surfaces an API error string when the create reports failure', async () => {
		createSecret.mockResolvedValue({ success: false, error: 'duplicate display name' });
		const result = await createSecretOnServer('my key', file, SecretType.SSH);
		expect(result).toEqual({ success: false, error: 'duplicate display name' });
	});

	it('falls back to the default message when no error string is provided', async () => {
		createSecret.mockResolvedValue({ success: false });
		const result = await createSecretOnServer('my key', file, SecretType.SSH);
		expect(result).toEqual({ success: false, error: 'Failed to create secret' });
	});

	it('returns the thrown Error message', async () => {
		createSecret.mockRejectedValue(new Error('request failed'));
		const result = await createSecretOnServer('my key', file, SecretType.SSH);
		expect(result).toEqual({ success: false, error: 'request failed' });
		expect(mockLogger.error).toHaveBeenCalled();
	});

	it('returns "Unknown error occurred" for a non-Error throw', async () => {
		createSecret.mockRejectedValue('boom');
		const result = await createSecretOnServer('my key', file, SecretType.SSH);
		expect(result).toEqual({ success: false, error: 'Unknown error occurred' });
	});

	it('defaults the secret type to SSH when omitted', async () => {
		createSecret.mockResolvedValue({ success: true, data: { id: 7 } });
		await createSecretOnServer('key', file);
		expect(createSecret).toHaveBeenCalledWith('key', file, SecretType.SSH);
	});
});

describe('updateSecretOnServer', () => {
	const file = new File([], 'key.pem');

	it('returns { success: true } on a successful update', async () => {
		updateSecret.mockResolvedValue({ success: true, data: { message: 'ok' } });
		const result = await updateSecretOnServer(5, 'renamed', file, SecretType.SSH);
		expect(result).toEqual({ success: true });
		expect(updateSecret).toHaveBeenCalledWith(5, 'renamed', file, SecretType.SSH);
	});

	it('surfaces an API error string when the update reports failure', async () => {
		updateSecret.mockResolvedValue({ success: false, error: 'forbidden' });
		const result = await updateSecretOnServer(5, 'renamed');
		expect(result).toEqual({ success: false, error: 'forbidden' });
	});

	it('falls back to the default message when no error string is provided', async () => {
		updateSecret.mockResolvedValue({ success: false });
		const result = await updateSecretOnServer(5, 'renamed');
		expect(result).toEqual({ success: false, error: 'Failed to update secret' });
	});

	it('returns the thrown Error message', async () => {
		updateSecret.mockRejectedValue(new Error('bad request'));
		const result = await updateSecretOnServer(5, 'renamed');
		expect(result).toEqual({ success: false, error: 'bad request' });
	});

	it('returns "Unknown error occurred" for a non-Error throw', async () => {
		updateSecret.mockRejectedValue(42);
		const result = await updateSecretOnServer(5, 'renamed');
		expect(result).toEqual({ success: false, error: 'Unknown error occurred' });
	});
});

describe('deleteSecretOnServer', () => {
	it('returns { success: true } on a successful delete', async () => {
		deleteSecret.mockResolvedValue({ success: true, data: { message: 'deleted' } });
		const result = await deleteSecretOnServer(9);
		expect(result).toEqual({ success: true });
		expect(deleteSecret).toHaveBeenCalledWith(9);
	});

	it('surfaces an API error string when the delete reports failure', async () => {
		deleteSecret.mockResolvedValue({ success: false, error: 'not found' });
		const result = await deleteSecretOnServer(9);
		expect(result).toEqual({ success: false, error: 'not found' });
	});

	it('falls back to the default message when no error string is provided', async () => {
		deleteSecret.mockResolvedValue({ success: false });
		const result = await deleteSecretOnServer(9);
		expect(result).toEqual({ success: false, error: 'Failed to delete secret' });
	});

	it('returns the thrown Error message', async () => {
		deleteSecret.mockRejectedValue(new Error('denied'));
		const result = await deleteSecretOnServer(9);
		expect(result).toEqual({ success: false, error: 'denied' });
	});

	it('returns "Unknown error occurred" for a non-Error throw', async () => {
		deleteSecret.mockRejectedValue(null);
		const result = await deleteSecretOnServer(9);
		expect(result).toEqual({ success: false, error: 'Unknown error occurred' });
	});
});
