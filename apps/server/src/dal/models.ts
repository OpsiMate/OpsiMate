import { AlertType, IntegrationType, Role } from '@OpsiMate/shared';
import { AuditActionType, AuditResourceType } from '@OpsiMate/shared';

export type IntegrationRow = {
	id: number;
	name: string;
	type: IntegrationType;
	external_url: string;
	credentials: string; // stored as JSON string in DB
	created_at: string; // SQLite returns DATETIME as string
};

export type ProviderRow = {
	id: number;
	name: string; // provider_name in DB
	provider_ip: string;
	username: string;
	private_key_filename: string;
	ssh_port: number;
	created_at: string; // DATETIME
	provider_type: string;
};

export type ServiceRow = {
	id: number;
	provider_id: number;
	service_name: string; // service_name in DB
	service_ip: string;
	service_status: string;
	service_type: string;
	created_at: string; // DATETIME
	container_details: string; // stored as JSON string in DB
};

export type ServiceRowWithProviderRow = {
	service_id: number;
	service_name: string; // service_name in DB
	service_ip: string;
	service_status: string;
	service_type: string;
	service_created_at: string; // DATETIME
	container_details: string; // stored as JSON string in DB
	provider_id: number;
	provider_name: string; // provider_name in DB
	provider_ip: string;
	username: string;
	private_key_filename: string;
	ssh_port: number;
	provider_created_at: string; // DATETIME
	provider_type: string;
};

export interface ViewRow {
	id: string;
	name: string;
	description?: string;
	createdAt: string;
	filters: string;
	visibleColumns: string;
	searchTerm: string;
	isDefault?: number;
}

export type AlertRow = {
	id: string;
	type: AlertType;
	status: string;
	tag: string;
	starts_at: string;
	updated_at: string;
	alert_url: string;
	alert_name: string;
	summary?: string;
	runbook_url?: string;
	created_at: string;
	is_dismissed: boolean;
};

export type UserRow = {
	id: number;
	email: string;
	password_hash: string;
	full_name: string;
	role: Role;
	created_at: string;
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

export type ServiceCustomFieldRow = {
	id: number;
	name: string;
	created_at: string;
};

export type ServiceCustomFieldValueRow = {
	service_id: number;
	custom_field_id: number;
	value: string;
	created_at: string;
	updated_at: string;
};

export type ResetPasswordRow = {
	id: number;
	user_id: number;
	token_hash: string;
	expires_at: string;
	created_at: string;
};

export type CustomActionRow = {
	id: number;
	name: string;
	description: string;
	type: 'bash' | 'http';
	target: 'service' | 'provider' | null;
	script: string | null;
	http_config: string | null;
	created_at: string;
};
