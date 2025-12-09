import { GCPIcon } from '@/components/icons/GCPIcon';
import { GrafanaIcon } from '@/components/icons/GrafanaIcon';
import { UptimeKumaIcon } from '@/components/icons/UptimeKumaIcon';
import { DatadogIcon } from '@/components/icons/DatadogIcon';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { Bell } from 'lucide-react';
import { AlertIntegrationKind, IntegrationDefinition } from './IntegrationAvatar.types';
import { getAlertPrimaryTag } from './utils/alertTags.utils';

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
	uptimekuma: {
		label: 'Uptime Kuma',
		bgClass: 'bg-white',
		borderClass: 'border-green-200',
		textClass: 'text-green-600',
		render: (iconSizeClass) => <UptimeKumaIcon className={cn(iconSizeClass)} />,
	},
	datadog: {
		label: 'Datadog',
		bgClass: 'bg-white',
		borderClass: 'border-purple-200',
		textClass: 'text-purple-600',
		render: (iconSizeClass) => <DatadogIcon className={cn(iconSizeClass)} />,
	},
	custom: {
		label: 'Custom',
		bgClass: 'bg-slate-50 dark:bg-slate-800',
		borderClass: 'border-slate-200 dark:border-slate-700',
		textClass: 'text-slate-700 dark:text-foreground',
		render: (iconSizeClass) => <Bell className={cn(iconSizeClass)} />,
	},
};

const normalizeIntegration = (value?: string | null): AlertIntegrationKind | undefined => {
	if (!value) return undefined;
	const normalized = value.toLowerCase();
	if (normalized.includes('grafana')) return 'grafana';
	if (normalized.includes('gcp') || normalized.includes('google')) return 'gcp';
	if (normalized.includes('uptimekuma') || normalized.includes('uptime-kuma')) return 'uptimekuma';
	if (normalized.includes('datadog')) return 'datadog';
	if (normalized.includes('custom')) return 'custom';
	return undefined;
};

export const resolveAlertIntegration = (alert: Alert): AlertIntegrationKind => {
	return (
		normalizeIntegration(alert.type) ||
		normalizeIntegration(getAlertPrimaryTag(alert)) ||
		normalizeIntegration(alert.id) ||
		normalizeIntegration(alert.summary) ||
		'custom'
	);
};

export const getIntegrationLabel = (integration: AlertIntegrationKind) => integrationDefinitions[integration].label;
