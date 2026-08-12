import { GCPIcon } from '@/components/icons/GCPIcon';
import { GrafanaIcon } from '@/components/icons/GrafanaIcon';
import { UptimeKumaIcon } from '@/components/icons/UptimeKumaIcon';
import { DatadogIcon } from '@/components/icons/DatadogIcon';
import { ZabbixIcon } from '@/components/icons/ZabbixIcon';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { Bell } from 'lucide-react';
import { AlertIntegrationKind, IntegrationDefinition } from './IntegrationAvatar.types';

// Resolution and labels live in @OpsiMate/shared so server-side search matches the
// integration column exactly; this file layers the icons and styling on top.
export { normalizeIntegration, resolveAlertIntegration, getIntegrationLabel } from '@OpsiMate/shared';

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
	zabbix: {
		label: 'Zabbix',
		bgClass: 'bg-white',
		borderClass: 'border-red-200',
		textClass: 'text-red-600',
		render: (iconSizeClass) => <ZabbixIcon className={cn(iconSizeClass)} />,
	},
	custom: {
		label: 'Custom',
		bgClass: 'bg-slate-50 dark:bg-slate-800',
		borderClass: 'border-slate-200 dark:border-slate-700',
		textClass: 'text-slate-700 dark:text-foreground',
		render: (iconSizeClass) => <Bell className={cn(iconSizeClass)} />,
	},
};
