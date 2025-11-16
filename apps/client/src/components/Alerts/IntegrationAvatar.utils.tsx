import { GCPIcon } from '@/components/icons/GCPIcon';
import { GrafanaIcon } from '@/components/icons/GrafanaIcon';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { Bell } from 'lucide-react';
import { AlertIntegrationKind, IntegrationDefinition } from './IntegrationAvatar.types';

export const integrationDefinitions: Record<AlertIntegrationKind, IntegrationDefinition> = {
	grafana: {
		label: 'Grafana',
		bgClass: 'bg-white',
		borderClass: 'border-orange-200',
		textClass: 'text-orange-600',
		render: (iconSizeClass) => <GrafanaIcon className={cn(iconSizeClass)} />,
	},
	gcp: {
		label: 'Google Cloud',
		bgClass: 'bg-white',
		borderClass: 'border-sky-200',
		textClass: 'text-sky-600',
		render: (iconSizeClass) => <GCPIcon className={cn(iconSizeClass)} />,
	},
	custom: {
		label: 'Custom',
		bgClass: 'bg-slate-50',
		borderClass: 'border-slate-200',
		textClass: 'text-slate-700',
		render: (iconSizeClass) => <Bell className={cn(iconSizeClass)} />,
	},
};

const normalizeIntegration = (value?: string | null): AlertIntegrationKind | undefined => {
	if (!value) return undefined;
	const normalized = value.toLowerCase();
	if (normalized.includes('grafana')) return 'grafana';
	if (normalized.includes('gcp') || normalized.includes('google')) return 'gcp';
	if (normalized.includes('custom')) return 'custom';
	return undefined;
};

export const resolveAlertIntegration = (alert: Alert): AlertIntegrationKind => {
	return (
		normalizeIntegration(alert.type) ||
		normalizeIntegration(alert.tag) ||
		normalizeIntegration(alert.id) ||
		normalizeIntegration(alert.summary) ||
		'custom'
	);
};

export const getIntegrationLabel = (integration: AlertIntegrationKind) => integrationDefinitions[integration].label;
