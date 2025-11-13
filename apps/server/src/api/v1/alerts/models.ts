// Example TypeScript types for GCP Monitoring webhook payload

export interface GcpAlertWebhook {
	version?: string | number;
	incident: GcpIncident;
}

export interface GcpIncident {
	incident_id: string;
	resource_id?: string;
	resource_name?: string;
	policy_name?: string;
	condition_name?: string;
	state: 'open' | 'acknowledged' | 'closed';
	started_at: string;
	url?: string;
	summary?: string;
	documentation?: {
		content?: string;
	};
}
