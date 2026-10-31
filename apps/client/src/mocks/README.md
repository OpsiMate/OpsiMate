# Mock Alerts Generator

A configurable mock alerts generator for testing and development, designed to create realistic, diverse alert data for visualizing heatmaps and other alert displays.

## Features

- **Configurable**: Control count, seed, and distribution of alert types, statuses, tags, and names
- **Natural Diversity**: Uses weighted distributions to create realistic data patterns
- **5K+ Alerts**: Optimized to generate large datasets efficiently
- **Seeded Random**: Reproducible results with seed-based generation

## Basic Usage

```typescript
import { generateMockAlerts } from '@/mocks/mockAlerts';

// Generate 5000 alerts with default distribution
const alerts = generateMockAlerts(5000);

// Or use configuration object
const alerts = generateMockAlerts({
	count: 5000,
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
	},
});
```

## Pre-configured Presets

```typescript
import { generateDiverseMockAlerts } from '@/mocks/mockAlerts.utils';

// Diverse distribution (default)
const diverseAlerts = generateDiverseMockAlerts(5000);
```

## Available Alert Types

- `Grafana`
- `GCP`
- `Custom`
- `UptimeKuma`

## Available Statuses

- `firing` (most common)
- `resolved`
- `pending`
- `suppressed`
- `inhibited`

## Available Alert Names

50+ realistic alert names including:

- High CPU Usage
- Memory Leak Detected
- Database Connection Pool Exhausted
- API Response Time Degraded
- Pod Crash Loop
- Container OOM Killed
- And many more...

## Custom Distribution Example

```typescript
const customAlerts = generateMockAlerts({
	count: 10000,
	seed: 99999,
	distribution: {
		alertTypes: {
			Grafana: 0.7,
			GCP: 0.2,
			Custom: 0.1,
		},
		statuses: {
			firing: 0.8,
			resolved: 0.15,
			pending: 0.05,
		},
	},
});
```

## Caching

The generator caches results based on configuration: calling it again with
the same configuration object shape returns the cached alerts instead of
regenerating them. The cache lives for the session; there is no manual
clearing API.

## Integration Example

To use in your development environment, you can modify the alerts hook:

```typescript
// In useAlerts.ts or similar
import { generateDiverseMockAlerts } from '@/mocks/mockAlerts.utils';

const USE_MOCK_DATA = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_ALERTS === 'true';

export const useAlerts = () => {
	return useQuery({
		queryKey: queryKeys.alerts,
		queryFn: async () => {
			if (USE_MOCK_DATA) {
				return generateDiverseMockAlerts(5000);
			}
			const response = await alertsApi.getAllAlerts();
			// ... rest of implementation
		},
	});
};
```
