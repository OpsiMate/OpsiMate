export enum ProviderType {
	VM = 'VM',
	K8S = 'K8S',
}

// Client-side provider types for UI configuration
export type ClientProviderType =
	| 'server'
	| 'kubernetes'
	| 'aws-ec2'
	| 'aws-eks'
	| 'gcp-compute'
	| 'gcp-gke'
	| 'azure-vm'
	| 'azure-aks';

export enum IntegrationType {
	Grafana = 'Grafana',
	Kibana = 'Kibana',
	Datadog = 'Datadog',
}

export enum ServiceType {
	DOCKER = 'DOCKER',
	SYSTEMD = 'SYSTEMD',
	MANUAL = 'MANUAL',
}

export enum Role {
	Admin = 'admin',
	Editor = 'editor',
	Viewer = 'viewer',
	Operation = 'operation',
}

export enum SecretType {
	SSH = 'ssh',
	KUBECONFIG = 'kubeconfig',
}

export interface User {
	id: number;
	email: string;
	fullName: string;
	role: Role;
	createdAt: string;
}

export interface IntegrationUrls {
	name: string;
	url: string;
}

export interface Provider {
	id: number;
	name: string;
	providerIP?: string;
	username?: string;
	secretId?: number;
	privateKeyFilename?: string; // Deprecated: use secretId instead
	password?: string;
	SSHPort?: number;
	createdAt: string;
	providerType: ProviderType;
}

export interface ContainerDetails {
	id?: string;
	image?: string;
	created?: string;
	namespace?: string;
}

export interface Tag {
	id: number;
	name: string;
	color: string;
	createdAt: string;
}

export interface ServiceTag {
	id: number;
	serviceId: number;
	tagId: number;
	createdAt: string;
}

export interface Service {
	id: number;
	providerId: number;
	name: string;
	serviceIP?: string;
	serviceStatus: string;
	createdAt: string;
	serviceType: ServiceType;
	// todo - this be in different interface
	containerDetails?: ContainerDetails;
	tags?: Tag[];
	customFields?: Record<number, string>; // customFieldId -> value
}

export interface ServiceWithProvider extends Service {
	provider: Provider;
}

export interface DiscoveredService {
	name: string;
	serviceStatus: string;
	serviceIP: string;
	namespace?: string;
}

export interface DiscoveredPod {
	name: string;
}

export type AlertType = 'Grafana' | 'GCP' | 'Custom';

export interface Alert {
	id: string;
	type: AlertType;
	status: string;
	tag: string;
	startsAt: string;
	updatedAt: string;
	alertUrl: string;
	alertName: string;
	summary?: string;
	runbookUrl?: string;
	createdAt: string;
	isDismissed: boolean;
}

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
}

export enum AuditActionType {
	CREATE = 'CREATE',
	UPDATE = 'UPDATE',
	DELETE = 'DELETE',
}

export enum AuditResourceType {
	PROVIDER = 'PROVIDER',
	SERVICE = 'SERVICE',
	USER = 'USER',
	VIEW = 'VIEW',
	SECRET = 'SECRET',
	// Add more as needed
}

export interface AuditLog {
	id: number;
	actionType: AuditActionType;
	resourceType: AuditResourceType;
	resourceId: string;
	userId: number;
	timestamp: string;
	resourceName: string;
	userName: string;
	details?: string;
}

export type SecretMetadata = {
	id: number;
	name: string;
	fileName: string;
	type: SecretType;
};

export interface ServiceCustomField {
	id: number;
	name: string;
	createdAt: string;
}

export interface ServiceCustomFieldValue {
	serviceId: number;
	customFieldId: number;
	value: string;
	createdAt: string;
	updatedAt: string;
}

export interface ResetPassword {
	id: number;
	userId: number;
	tokenHash: string;
	expiresAt: string;
	createdAt: string;
}

export interface ResetPasswordType {
	userId: number;
	tokenHash: string;
	expiresAt: Date;
}
