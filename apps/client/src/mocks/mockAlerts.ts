import { Alert, AlertType } from '@OpsiMate/shared';

export interface MockAlertsConfig {
	count?: number;
	seed?: number;
	distribution?: {
		alertTypes?: Record<AlertType, number>;
		statuses?: Record<string, number>;
		tags?: Record<string, number>;
		alertNames?: Record<string, number>;
	};
}

const ALERT_TYPES: AlertType[] = ['Grafana', 'GCP', 'Custom'];

const STATUSES = ['firing', 'resolved', 'pending', 'suppressed', 'inhibited'];

const TAGS = [
	'production',
	'staging',
	'development',
	'critical',
	'warning',
	'info',
	'backend',
	'frontend',
	'database',
	'api',
	'microservice',
	'infrastructure',
	'security',
	'performance',
	'monitoring',
	'kubernetes',
	'docker',
	'aws',
	'gcp',
	'azure',
	'cdn',
	'cache',
	'queue',
	'worker',
	'scheduler',
];

const ALERT_NAMES = [
	'High CPU Usage',
	'Memory Leak Detected',
	'Database Connection Pool Exhausted',
	'API Response Time Degraded',
	'Disk Space Running Low',
	'Failed Health Checks',
	'Error Rate Spike',
	'Service Unavailable',
	'Network Latency Increased',
	'Cache Miss Rate High',
	'Queue Depth Exceeded',
	'Authentication Failures',
	'SSL Certificate Expiring',
	'Load Balancer Overloaded',
	'Database Query Timeout',
	'Pod Crash Loop',
	'Container OOM Killed',
	'Replica Count Below Threshold',
	'Deployment Failed',
	'Ingress 5xx Errors',
	'API Gateway Timeout',
	'Message Queue Backlog',
	'Dead Letter Queue Growth',
	'Redis Connection Pool Exhausted',
	'PostgreSQL Slow Queries',
	'MongoDB Replication Lag',
	'Elasticsearch Cluster Health',
	'Kafka Consumer Lag',
	'Prometheus Scrape Failures',
	'Grafana Dashboard Unavailable',
	'CloudWatch Metric Missing',
	'GCP Pub/Sub Subscription Error',
	'Azure Service Bus Dead Letter',
	'CDN Cache Hit Rate Low',
	'SSL Certificate Expiring Soon',
	'DNS Resolution Failures',
	'Firewall Rule Blocking Traffic',
	'VPN Connection Drops',
	'Backup Job Failed',
	'Data Replication Delayed',
	'Storage Quota Exceeded',
	'Network Packet Loss',
	'JVM Heap Memory High',
	'Node.js Event Loop Lag',
	'Python GIL Contention',
	'Go Goroutine Leak',
	'Ruby Memory Fragmentation',
	'PHP FPM Process Pool Exhausted',
	'Java Thread Pool Exhausted',
	'.NET GC Pressure',
];

const DEFAULT_DISTRIBUTION = {
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
	alertNames: {},
};

class SeededRandom {
	private seed: number;

	constructor(seed: number) {
		this.seed = seed;
	}

	next(): number {
		this.seed = (this.seed * 9301 + 49297) % 233280;
		return this.seed / 233280;
	}

	nextInt(max: number): number {
		return Math.floor(this.next() * max);
	}

	choice<T>(array: T[]): T {
		return array[this.nextInt(array.length)];
	}

	weightedChoice<T>(items: T[], weights: number[]): T {
		const totalWeight = weights.reduce((sum, w) => sum + w, 0);
		let random = this.next() * totalWeight;
		for (let i = 0; i < items.length; i++) {
			random -= weights[i];
			if (random <= 0) {
				return items[i];
			}
		}
		return items[items.length - 1];
	}
}

const selectWeighted = <T>(
	rng: SeededRandom,
	items: T[],
	weights: Record<string, number>,
	defaultWeight: number = 1
): T => {
	const itemWeights = items.map((item) => weights[String(item)] ?? defaultWeight);
	return rng.weightedChoice(items, itemWeights);
};

const generateAlertName = (rng: SeededRandom, index: number): string => {
	const baseName = rng.choice(ALERT_NAMES);
	const variations = [
		baseName,
		`${baseName} - ${rng.choice(['Primary', 'Secondary', 'Replica', 'Shard'])}`,
		`${baseName} - ${rng.choice(['US-East', 'US-West', 'EU-Central', 'AP-South'])}`,
		`${baseName} - ${rng.choice(['Service-A', 'Service-B', 'Service-C'])}`,
		`${baseName} (${rng.nextInt(1000) + 1})`,
	];
	return rng.choice(variations);
};

const generateMockAlert = (index: number, rng: SeededRandom, config: MockAlertsConfig): Alert => {
	const distribution = config.distribution ?? DEFAULT_DISTRIBUTION;

	const type = selectWeighted(rng, ALERT_TYPES, distribution.alertTypes ?? DEFAULT_DISTRIBUTION.alertTypes);
	const status = selectWeighted(rng, STATUSES, distribution.statuses ?? DEFAULT_DISTRIBUTION.statuses);
	const tag = selectWeighted(rng, TAGS, distribution.tags ?? DEFAULT_DISTRIBUTION.tags);
	const alertName = generateAlertName(rng, index);

	const now = new Date();
	const daysAgo = rng.nextInt(30);
	const hoursAgo = rng.nextInt(24);
	const minutesAgo = rng.nextInt(60);
	const startsAt = new Date(
		now.getTime() - (daysAgo * 24 * 60 * 60 * 1000 + hoursAgo * 60 * 60 * 1000 + minutesAgo * 60 * 1000)
	);

	const updatedAt =
		status === 'firing'
			? new Date(startsAt.getTime() + rng.nextInt(60) * 60 * 1000)
			: new Date(startsAt.getTime() + rng.nextInt(24) * 60 * 60 * 1000);

	const hasSummary = rng.next() < 0.4;
	const hasRunbook = rng.next() < 0.2;
	const isDismissed = rng.next() < 0.15;

	const baseUrl =
		type === 'Grafana'
			? 'https://grafana.example.com'
			: type === 'GCP'
				? 'https://console.cloud.google.com'
				: 'https://opsimate.example.com';

	return {
		id: `mock-alert-${index}-${rng.nextInt(10000)}`,
		type,
		status,
		tag,
		startsAt: startsAt.toISOString(),
		updatedAt: updatedAt.toISOString(),
		alertUrl: `${baseUrl}/alert/${index}`,
		alertName,
		summary: hasSummary
			? `Alert detected at ${startsAt.toLocaleString()}. ${rng.choice([
					'This requires immediate attention.',
					'Investigation in progress.',
					'Root cause analysis needed.',
					'Automated remediation attempted.',
					'Manual intervention required.',
				])}`
			: undefined,
		runbookUrl: hasRunbook ? `https://runbook.example.com/alert-${index}` : undefined,
		createdAt: startsAt.toISOString(),
		isDismissed,
	};
};

let cachedMockAlerts: Alert[] | null = null;
let cachedConfig: MockAlertsConfig | null = null;

export const generateMockAlerts = (config: MockAlertsConfig | number = {}): Alert[] => {
	const normalizedConfig: MockAlertsConfig = typeof config === 'number' ? { count: config } : config;

	const finalConfig: MockAlertsConfig = {
		count: 5000,
		seed: Date.now(),
		distribution: DEFAULT_DISTRIBUTION,
		...normalizedConfig,
	};

	const configKey = JSON.stringify(finalConfig);
	if (cachedMockAlerts && cachedConfig && JSON.stringify(cachedConfig) === configKey) {
		return cachedMockAlerts;
	}

	const rng = new SeededRandom(finalConfig.seed ?? Date.now());
	const count = finalConfig.count ?? 5000;

	cachedMockAlerts = Array.from({ length: count }, (_, index) => generateMockAlert(index, rng, finalConfig));
	cachedConfig = finalConfig;

	return cachedMockAlerts;
};

export const clearMockAlertsCache = (): void => {
	cachedMockAlerts = null;
	cachedConfig = null;
};
