import { SecretMetadata, SecretType } from '@OpsiMate/shared';
import { afterEach, beforeEach, describe, expect, test, vi, type MockInstance } from 'vitest';
import { createSecretOnServer, deleteSecretOnServer, getSecretsFromServer, updateSecretOnServer } from '@/lib/sslKeys';

// The secrets API is mocked at the module boundary: these tests are about the messages
// sslKeys.ts hands back to the UI, not about how the request itself is built.
const { getSecrets, createSecret, updateSecret, deleteSecret } = vi.hoisted(() => ({
	getSecrets: vi.fn(),
	createSecret: vi.fn(),
	updateSecret: vi.fn(),
	deleteSecret: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
	secretsApi: { getSecrets, createSecret, updateSecret, deleteSecret },
}));

type MutationResult = { success: boolean; error?: string };

const secret = (overrides: Partial<SecretMetadata> = {}): SecretMetadata => ({
	id: 1,
	name: 'deploy key',
	fileName: 'id_rsa',
	type: SecretType.SSH,
	...overrides,
});

const keyFile = () => new File(['-----BEGIN PRIVATE KEY-----'], 'id_rsa');

// Every mutation normalises a failure to { success: false, error }, so the failure cases
// assert the whole object through one helper instead of repeating the shape each time.
const expectFailure = async (result: Promise<MutationResult>, error: string) => {
	await expect(result).resolves.toEqual({ success: false, error });
};

// Logger.error writes through console.error and then console.dir for the sanitised error
// argument. Both are silenced so a green run stays readable; console.error is asserted in
// the cases where the issue asks for a failure to be logged.
let consoleError: MockInstance;

beforeEach(() => {
	vi.clearAllMocks();
	consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.spyOn(console, 'dir').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('getSecretsFromServer', () => {
	test('returns the secrets the server sent', async () => {
		const secrets = [secret(), secret({ id: 2, name: 'kube config', type: SecretType.KUBECONFIG })];
		getSecrets.mockResolvedValue({ success: true, data: { secrets } });

		await expect(getSecretsFromServer()).resolves.toEqual(secrets);
		expect(getSecrets).toHaveBeenCalledTimes(1);
	});

	test('an unsuccessful response is an empty list, not an error', async () => {
		getSecrets.mockResolvedValue({ success: false, error: 'Not allowed' });

		await expect(getSecretsFromServer()).resolves.toEqual([]);
		expect(consoleError).not.toHaveBeenCalled();
	});

	test('a response that succeeded without data is an empty list', async () => {
		getSecrets.mockResolvedValue({ success: true });

		await expect(getSecretsFromServer()).resolves.toEqual([]);
	});

	test('a thrown request is an empty list and is logged', async () => {
		getSecrets.mockRejectedValue(new Error('network down'));

		await expect(getSecretsFromServer()).resolves.toEqual([]);
		expect(consoleError).toHaveBeenCalled();
	});
});

describe('createSecretOnServer', () => {
	test('returns the id of the secret the server created', async () => {
		createSecret.mockResolvedValue({ success: true, data: { id: 42 } });
		const file = keyFile();

		await expect(createSecretOnServer('deploy key', file)).resolves.toEqual({ success: true, id: 42 });
		expect(createSecret).toHaveBeenCalledWith('deploy key', file, SecretType.SSH);
	});

	test('sends the type it was given instead of the SSH default', async () => {
		createSecret.mockResolvedValue({ success: true, data: { id: 7 } });
		const file = keyFile();

		await createSecretOnServer('kube config', file, SecretType.KUBECONFIG);

		expect(createSecret).toHaveBeenCalledWith('kube config', file, SecretType.KUBECONFIG);
	});

	test('surfaces the message the API returned', async () => {
		createSecret.mockResolvedValue({ success: false, error: 'File type not allowed' });

		await expectFailure(createSecretOnServer('deploy key', keyFile()), 'File type not allowed');
	});

	test('falls back to "Failed to create secret" when the API gives no message', async () => {
		createSecret.mockResolvedValue({ success: false });

		await expectFailure(createSecretOnServer('deploy key', keyFile()), 'Failed to create secret');
	});

	test('a success without a body still falls back to the default message', async () => {
		createSecret.mockResolvedValue({ success: true });

		await expectFailure(createSecretOnServer('deploy key', keyFile()), 'Failed to create secret');
	});

	test('a thrown error becomes its message, and is logged', async () => {
		createSecret.mockRejectedValue(new Error('Payload too large'));

		await expectFailure(createSecretOnServer('deploy key', keyFile()), 'Payload too large');
		expect(consoleError).toHaveBeenCalled();
	});

	test('a throw that is not an Error becomes "Unknown error occurred"', async () => {
		createSecret.mockRejectedValue('boom');

		await expectFailure(createSecretOnServer('deploy key', keyFile()), 'Unknown error occurred');
		expect(consoleError).toHaveBeenCalled();
	});
});

describe('updateSecretOnServer', () => {
	test('reports success when the API accepted the update', async () => {
		updateSecret.mockResolvedValue({ success: true, data: { message: 'updated' } });

		await expect(updateSecretOnServer(7, 'renamed')).resolves.toEqual({ success: true });
		expect(updateSecret).toHaveBeenCalledWith(7, 'renamed', undefined, undefined);
	});

	test('passes every optional argument through in order', async () => {
		updateSecret.mockResolvedValue({ success: true });
		const file = keyFile();

		await updateSecretOnServer(9, 'kube config', file, SecretType.KUBECONFIG);

		expect(updateSecret).toHaveBeenCalledWith(9, 'kube config', file, SecretType.KUBECONFIG);
	});

	test('reports success even when the API sends no body back', async () => {
		updateSecret.mockResolvedValue({ success: true });

		await expect(updateSecretOnServer(7)).resolves.toEqual({ success: true });
	});

	test('surfaces the message the API returned', async () => {
		updateSecret.mockResolvedValue({ success: false, error: 'Secret not found' });

		await expectFailure(updateSecretOnServer(7, 'renamed'), 'Secret not found');
	});

	test('falls back to "Failed to update secret" when the API gives no message', async () => {
		updateSecret.mockResolvedValue({ success: false });

		await expectFailure(updateSecretOnServer(7), 'Failed to update secret');
	});

	test('a thrown error becomes its message, and is logged', async () => {
		updateSecret.mockRejectedValue(new Error('Request timed out'));

		await expectFailure(updateSecretOnServer(7), 'Request timed out');
		expect(consoleError).toHaveBeenCalled();
	});

	test('a throw that is not an Error becomes "Unknown error occurred"', async () => {
		updateSecret.mockRejectedValue({ code: 500 });

		await expectFailure(updateSecretOnServer(7), 'Unknown error occurred');
		expect(consoleError).toHaveBeenCalled();
	});
});

describe('deleteSecretOnServer', () => {
	test('reports success and deletes the secret it was given', async () => {
		deleteSecret.mockResolvedValue({ success: true, data: { message: 'deleted' } });

		await expect(deleteSecretOnServer(3)).resolves.toEqual({ success: true });
		expect(deleteSecret).toHaveBeenCalledWith(3);
	});

	test('reports success even when the API sends no body back', async () => {
		deleteSecret.mockResolvedValue({ success: true });

		await expect(deleteSecretOnServer(3)).resolves.toEqual({ success: true });
	});

	test('surfaces the message the API returned', async () => {
		deleteSecret.mockResolvedValue({ success: false, error: 'Secret is in use' });

		await expectFailure(deleteSecretOnServer(3), 'Secret is in use');
	});

	test('falls back to "Failed to delete secret" when the API gives no message', async () => {
		deleteSecret.mockResolvedValue({ success: false });

		await expectFailure(deleteSecretOnServer(3), 'Failed to delete secret');
	});

	test('a thrown error becomes its message, and is logged', async () => {
		deleteSecret.mockRejectedValue(new Error('Forbidden'));

		await expectFailure(deleteSecretOnServer(3), 'Forbidden');
		expect(consoleError).toHaveBeenCalled();
	});

	test('a throw that is not an Error becomes "Unknown error occurred"', async () => {
		deleteSecret.mockRejectedValue(undefined);

		await expectFailure(deleteSecretOnServer(3), 'Unknown error occurred');
		expect(consoleError).toHaveBeenCalled();
	});
});
