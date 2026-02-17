import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { GrafanaClient } from '../src/dal/external-client/grafana-client';

/**
 * This test demonstrates the use of STUBS
 * Stub = A test double that returns pre-configured responses without verification
 */
describe('GrafanaClient with STUBS', () => {
	let grafanaClient: GrafanaClient;
	const originalFetch = global.fetch;

	beforeEach(() => {
		grafanaClient = new GrafanaClient('https://grafana.example.com', 'test-api-key');
	});

	afterEach(() => {
		// Restore original fetch
		global.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	test('should search dashboards by tags using stubbed fetch', async () => {
		// Create a stub that returns a pre-configured response
		const stubbedDashboards = [
			{ title: 'Dashboard 1', url: '/d/abc123' },
			{ title: 'Dashboard 2', url: '/d/def456' },
		];

		// Stub fetch to return our pre-configured data
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => stubbedDashboards,
		} as Response);

		const result = await grafanaClient.searchByTags(['production', 'api']);

		expect(result).toEqual(stubbedDashboards);
		expect(result.length).toBe(2);
		expect(result[0].title).toBe('Dashboard 1');
	});

	test('should filter alerts by tags using stubbed fetch', async () => {
		// Stub with pre-configured alerts data
		const stubbedAlerts = [
			{
				labels: { tag: 'production', service: 'api' },
				status: { state: 'active' as const, inhibitedBy: [], silencedBy: [] },
				annotations: { summary: 'High CPU usage' },
				fingerprint: 'abc123',
				receivers: [{ name: 'default' }],
				startsAt: '2025-10-19T10:00:00Z',
				endsAt: '2025-10-19T11:00:00Z',
				updatedAt: '2025-10-19T10:30:00Z',
				generatorURL: 'https://grafana.example.com',
			},
			{
				labels: { tag: 'staging', service: 'db' },
				status: { state: 'active' as const, inhibitedBy: [], silencedBy: [] },
				annotations: { summary: 'Database slow' },
				fingerprint: 'def456',
				receivers: [{ name: 'default' }],
				startsAt: '2025-10-19T10:00:00Z',
				endsAt: '2025-10-19T11:00:00Z',
				updatedAt: '2025-10-19T10:30:00Z',
				generatorURL: 'https://grafana.example.com',
			},
		];

		// Stub fetch
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => stubbedAlerts,
		} as Response);

		const result = await grafanaClient.getAlerts(['production']);

		// Should only return alerts with 'production' tag
		expect(result.length).toBe(1);
		expect(result[0].labels.tag).toBe('production');
	});

	test('should throw error when API returns error using stubbed fetch', async () => {
		// Stub fetch to return error response
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 401,
		} as Response);

		await expect(grafanaClient.searchByTags(['production'])).rejects.toThrow('Grafana API error: 401');
	});

	test('should include correct authorization header', async () => {
		const fetchStub = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => [],
		} as Response);

		global.fetch = fetchStub;

		await grafanaClient.searchByTags(['production']);

		// Verify the stub was called with correct headers
		expect(fetchStub).toHaveBeenCalledWith(
			expect.stringContaining('https://grafana.example.com'),
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: 'Bearer test-api-key',
				}),
			})
		);
	});
});
