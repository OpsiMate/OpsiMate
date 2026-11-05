import { generateMockAlerts, MockAlertsConfig } from './mockAlerts';

export const generateDiverseMockAlerts = (count: number = 5000): ReturnType<typeof generateMockAlerts> => {
	const config: MockAlertsConfig = {
		count,
		seed: 12345,
		distribution: {
			alertTypes: {
				Grafana: 0.4,
				GCP: 0.25,
				UptimeKuma: 0.2,
				Custom: 0.15,
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
