// Example TypeScript types for GCP Monitoring webhook payload

export interface GcpAlertWebhook {
    version?: string | number;
    incident: GcpIncident;
    // plus optionally other root‐level fields, e.g. `policy_scope`, `labels`, etc.
    [key: string]: any;
}

export interface GcpIncident {
    incident_id: string;
    resource_id?: string;
    resource_name?: string;
    policy_name?: string;
    condition_name?: string;
    state: 'open' | 'acknowledged' | 'closed' | string;
    started_at: string;
    url?: string;
    summary?: string;
    documentation?: {
        content?: string;
        // maybe other fields
        [key: string]: any;
    };
    // optional other fields from payload
    [key: string]: any;
}
