import { z } from 'zod';

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
	started_at: string | number;
	url?: string;
	summary?: string;
	documentation?: {
		content?: string;
	};
}

const isoDateString = z.string().refine(
	(s) => {
		return !Number.isNaN(Date.parse(s));
	},
	{
		message: 'Invalid date string (expected ISO date/time)',
	}
);

export const HttpAlertWebhookSchema = z.object({
	id: z.string(),
	status: z.string(),
	tag: z.string(),
	startsAt: isoDateString,
	updatedAt: isoDateString,
	alertUrl: z.string().url(),
	alertName: z.string(),
	summary: z.string().optional(),
	runbookUrl: z.string().url().optional(),
	createdAt: isoDateString,
});
