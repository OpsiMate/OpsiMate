import { Alert, AlertType } from '@OpsiMate/shared';

const ALERT_TYPES: AlertType[] = ['Grafana', 'GCP', 'Custom'];
const STATUSES = ['firing', 'resolved', 'pending'];
const TAGS = ['production', 'staging', 'development', 'critical', 'warning', 'info'];
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
];

const generateMockAlert = (index: number): Alert => {
	const type = ALERT_TYPES[index % ALERT_TYPES.length];
	const status = STATUSES[index % STATUSES.length];
	const tag = TAGS[index % TAGS.length];
	const alertName = `${ALERT_NAMES[index % ALERT_NAMES.length]} #${index + 1}`;
	const baseDate = new Date('2024-01-01T00:00:00Z');
	const hoursAgo = index % 168;
	const startsAt = new Date(baseDate.getTime() - hoursAgo * 60 * 60 * 1000);

	return {
		id: `mock-alert-${index}`,
		type,
		status,
		tag,
		startsAt: startsAt.toISOString(),
		updatedAt: startsAt.toISOString(),
		alertUrl: `https://grafana.example.com/alert/${index}`,
		alertName,
		summary:
			index % 3 === 0
				? `This is a summary for alert ${index + 1}. It contains some details about what went wrong.`
				: undefined,
		runbookUrl: index % 5 === 0 ? `https://runbook.example.com/alert-${index}` : undefined,
		createdAt: startsAt.toISOString(),
		isDismissed: index % 10 === 0,
	};
};

let cachedMockAlerts: Alert[] | null = null;
let refreshCount = 0;

export const generateMockAlerts = (count: number = 5000): Alert[] => {
	refreshCount++;

	if (cachedMockAlerts && cachedMockAlerts.length === count) {
		return cachedMockAlerts;
	}

	cachedMockAlerts = Array.from({ length: count }, (_, index) => generateMockAlert(index));
	return cachedMockAlerts;
};
