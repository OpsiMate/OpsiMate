import { AlertType, DashboardType, IntegrationType, Role, Tag } from '@OpsiMate/shared';
import { AuditActionType, AuditResourceType } from '@OpsiMate/shared';

export interface InsertResult {
	lastID: number;
}

export type IntegrationRow = {
	id: number;
	name: string;
	type: IntegrationType;
	external_url: string;
	credentials: string; // stored as JSON string in DB
	created_at: string; // SQLite returns DATETIME as string
};

export interface DashboardRow {
	id: string;
	type: DashboardType;
	name: string;
	description?: string;
	created_at: string;
	filters: string; // Record<string, string>
	visible_columns: string; // string[]
	column_order?: string | null; // string[]
	column_widths?: string | null; // Record<string, number>, px per column id
	// SQLite has no boolean type: these are 0/1, or NULL on rows saved before the toggles
	// existed. Typed as number so the 0/1-to-boolean conversion can't be forgotten.
	split_by_assignment?: number | null;
	severity_colors?: number | null;
	query: string;
	group_by: string; // string[]
	time_range?: string | null; // DashboardTimeRange
}

export interface DashboardTagsEntry {
	dashboardId: number;
	tags: Tag[];
}

export interface DashboardTagRow {
	dashboard_id: number;
	id: number;
	name: string;
	color: string;
	createdAt: string;
}

export type AlertRow = {
	id: string;
	type: AlertType;
	status: string;
	severity?: string | null;
	team?: string | null;
	tags: string;
	starts_at: string;
	updated_at: string;
	alert_url: string;
	alert_name: string;
	summary?: string;
	runbook_url?: string;
	links?: string | null;
	created_at: string;
	is_dismissed: boolean;
	silenced_until?: string | null;
	silenced_at?: string | null;
	is_read?: boolean | number | null;
	owner_id?: number | null;
};

export type ResolvedAlertRow = {
	id: string;
	type: AlertType;
	status: string;
	severity?: string | null;
	team?: string | null;
	tags: string;
	starts_at: string;
	updated_at: string;
	alert_url: string;
	alert_name: string;
	summary?: string;
	runbook_url?: string;
	links?: string | null;
	created_at: string;
	is_dismissed: boolean;
	archived_at: string;
	owner_id?: number | null;
};

export type UserRow = {
	id: number;
	email: string;
	password_hash: string;
	full_name: string;
	role: Role;
	created_at: string;
	phone_number: string | null;
	// Absent on rows read before the column existed; treated as 'local'.
	auth_source?: string | null;
	ldap_dn?: string | null;
};

export type OncallTeamRow = {
	id: number;
	name: string;
	rotation_interval_days: number | null;
	rotation_anchor: string;
	created_at: string;
};

export type OncallTeamMemberRow = {
	id: number;
	team_id: number;
	user_id: number;
	position: number;
	full_name: string;
	email: string;
	phone_number: string | null;
};

export type AuditLogRow = {
	id: number;
	action_type: AuditActionType;
	resource_type: AuditResourceType;
	resource_id: string;
	user_id: number;
	user_name: string;
	resource_name: string;
	timestamp: string;
	details?: string;
};

export type ResetPasswordRow = {
	id: number;
	user_id: number;
	token_hash: string;
	expires_at: string;
	created_at: string;
};

export type TableInfoRow = {
	cid: number;
	name: string;
	type: string;
	notnull: number;
	dflt_value: unknown;
	pk: number;
};

// Row shape of PRAGMA foreign_key_list(<table>).
export type ForeignKeyInfoRow = {
	id: number;
	seq: number;
	table: string;
	from: string;
	to: string;
	on_update: string;
	on_delete: string;
	match: string;
};

export type AlertCommentRow = {
	id: string;
	alert_id: string;
	user_id: string;
	comment: string;
	created_at: string;
	updated_at: string;
};
