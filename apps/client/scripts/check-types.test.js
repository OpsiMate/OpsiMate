import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	execSync: vi.fn(),
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
}));

vi.mock('node:child_process', () => ({
	default: { execSync: mocks.execSync },
	execSync: mocks.execSync,
}));
vi.mock('node:fs', () => ({
	default: mocks,
	existsSync: mocks.existsSync,
	readFileSync: mocks.readFileSync,
	writeFileSync: mocks.writeFileSync,
}));

const baseline = 'src/example.ts: error TS2322: Type mismatch.\n';
const diagnostic = 'src/example.ts(12,3): error TS2322: Type mismatch.\n';
const originalArgv = process.argv;
const exit = new Error('process exited');

const runGate = async (update = false) => {
	process.argv = update ? [...originalArgv, '--update'] : originalArgv;
	try {
		await import('./check-types.mjs');
	} catch (error) {
		if (error !== exit) throw error;
	}
};

const failCommand = (status, output) => {
	mocks.execSync.mockImplementation(() => {
		throw Object.assign(new Error('Command failed'), { status, stdout: '', stderr: output });
	});
};

beforeEach(() => {
	vi.resetModules();
	vi.resetAllMocks();
	mocks.existsSync.mockReturnValue(true);
	mocks.readFileSync.mockReturnValue(baseline);
	vi.spyOn(process, 'exit').mockImplementation(() => {
		throw exit;
	});
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	process.argv = originalArgv;
	vi.restoreAllMocks();
});

describe('client typecheck command failures', () => {
	it.each([1, 2])('rejects exit %s without TypeScript diagnostics', async (status) => {
		failCommand(status, 'ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "tsc" not found\n');
		await runGate();
		expect(process.exit).toHaveBeenCalledWith(2);
		expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Could not run tsc'));
		expect(mocks.writeFileSync).not.toHaveBeenCalled();
	});

	it('rejects a silent nonzero exit', async () => {
		failCommand(1, '');
		await runGate();
		expect(process.exit).toHaveBeenCalledWith(2);
	});

	it('does not erase the baseline when --update cannot run tsc', async () => {
		failCommand(1, 'Package manager failed before launching tsc\n');
		await runGate(true);
		expect(process.exit).toHaveBeenCalledWith(2);
		expect(mocks.writeFileSync).not.toHaveBeenCalled();
	});

	it.each([1, 2])('accepts baselined diagnostics with exit %s', async (status) => {
		failCommand(status, diagnostic);
		await runGate();
		expect(process.exit).not.toHaveBeenCalled();
		expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No new client type errors'));
	});

	it('rejects new global TypeScript diagnostics', async () => {
		failCommand(1, "error TS5058: The specified path does not exist: 'tsconfig.app.json'.\n");
		await runGate();
		expect(process.exit).toHaveBeenCalledWith(1);
	});

	it('accepts a successful compiler run without diagnostics', async () => {
		mocks.execSync.mockReturnValue('');
		await runGate();
		expect(process.exit).not.toHaveBeenCalled();
	});

	it('allows --update to clear a baseline after a successful compiler run', async () => {
		mocks.execSync.mockReturnValue('');
		await runGate(true);
		expect(mocks.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('type-errors-baseline.txt'), '');
		expect(process.exit).toHaveBeenCalledWith(0);
	});
});
