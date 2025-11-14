// In grafana-client.ts
export interface GrafanaDashboardSummary {
	title: string;
	url: string;
}

type GrafanaAlert = {
	annotations: Record<string, string>;
	endsAt: string;
	fingerprint: string;
	receivers: { name: string }[];
	startsAt: string;
	status: {
		inhibitedBy: string[];
		silencedBy: string[];
		state: 'active' | 'suppressed' | 'unprocessed';
	};
	updatedAt: string;
	generatorURL: string;
	labels: Record<string, string>;
};

export class GrafanaClient {
	constructor(
		private url: string,
		private apiKey: string
	) {}

	async searchByTags(tags: string[]): Promise<GrafanaDashboardSummary[]> {
		const query = new URLSearchParams();
		query.append('type', 'dash-db');
		tags.forEach((tag) => query.append('tag', tag));

		const res = await fetch(`${this.url}/api/search?${query.toString()}`, {
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json',
			},
		});

		if (!res.ok) {
			throw new Error(`Grafana API error: ${res.status}`);
		}

		return (await res.json()) as GrafanaDashboardSummary[];
	}

	async getAlerts(): Promise<GrafanaAlert[]> {
		const res = await fetch(`${this.url}/api/alertmanager/grafana/api/v2/alerts`, {
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
			},
		});

		if (!res.ok) {
			throw new Error(`Grafana API error: ${res.status}`);
		}

		return (await res.json()) as GrafanaAlert[];
	}
}
