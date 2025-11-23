import { generateMockAlerts, MockAlertsConfig } from './mockAlerts';

export const generateDiverseMockAlerts = (count: number = 5000): ReturnType<typeof generateMockAlerts> => {
	const config: MockAlertsConfig = {
		count,
		seed: 12345,
		distribution: {
			alertTypes: {
				Grafana: 0.5,
				GCP: 0.3,
				Custom: 0.2,
			},
			statuses: {
				firing: 0.6,
				resolved: 0.25,
				pending: 0.1,
				suppressed: 0.04,
				inhibited: 0.01,
			},
			tags: {
				production: 0.35,
				backend: 0.15,
				critical: 0.12,
				api: 0.1,
				staging: 0.08,
				database: 0.06,
				frontend: 0.05,
				infrastructure: 0.04,
				development: 0.03,
				warning: 0.02,
			},
		},
	};

	return generateMockAlerts(config);
};

export const generateProductionHeavyMockAlerts = (count: number = 5000): ReturnType<typeof generateMockAlerts> => {
	const config: MockAlertsConfig = {
		count,
		seed: 54321,
		distribution: {
			alertTypes: {
				Grafana: 0.6,
				GCP: 0.25,
				Custom: 0.15,
			},
			statuses: {
				firing: 0.7,
				resolved: 0.2,
				pending: 0.08,
				suppressed: 0.015,
				inhibited: 0.005,
			},
			tags: {
				production: 0.5,
				critical: 0.2,
				backend: 0.15,
				api: 0.1,
				infrastructure: 0.05,
			},
		},
	};

	return generateMockAlerts(config);
};

export const generateBalancedMockAlerts = (count: number = 5000): ReturnType<typeof generateMockAlerts> => {
	const config: MockAlertsConfig = {
		count,
		seed: 99999,
		distribution: {
			alertTypes: {
				Grafana: 0.33,
				GCP: 0.33,
				Custom: 0.34,
			},
			statuses: {
				firing: 0.4,
				resolved: 0.3,
				pending: 0.15,
				suppressed: 0.1,
				inhibited: 0.05,
			},
			tags: {
				production: 0.2,
				staging: 0.2,
				development: 0.15,
				backend: 0.1,
				frontend: 0.1,
				database: 0.1,
				api: 0.1,
				critical: 0.05,
			},
		},
	};

	return generateMockAlerts(config);
};
