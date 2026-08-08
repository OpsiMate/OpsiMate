import type { ProviderBL } from '../src/bl/providers/provider.bl';
import { RefreshJob } from '../src/jobs/refresh-job';

describe('RefreshJob', () => {
	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	test('schedules provider refresh every 5 seconds', () => {
		vi.useFakeTimers();
		const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
		const providerBL = {
			getAllProviders: vi.fn().mockResolvedValue([]),
			refreshProviderServices: vi.fn(),
		} as unknown as ProviderBL;

		new RefreshJob(providerBL).startRefreshJob();

		expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5 * 1000);
	});
});
