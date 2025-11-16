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
		render: (iconSizeClass) => <GcpIcon className={cn(iconSizeClass)} />,
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

const GcpIcon = ({ className }: { className?: string }) => (
	<svg viewBox="0 0 24 24" className={className} aria-hidden="true">
		<path
			fill="#EA4335"
			d="M7.5 10.5h-.6l-1-1.7V8l2.8-2.8c2.4-2.3 6.3-2.3 8.6 0l-1.7 1.7c-1.5-1.4-3.8-1.4-5.3 0l-2.8 2.8v.8z"
		/>
		<path fill="#4285F4" d="m19.3 9.7-1.7 1.7V12l-.6.6-1.7-1.7.6-.6h.7l2.7-2.7c.1.3.1.6.1.9-.1.9-.1 1.9-.1 2.9z" />
		<path fill="#34A853" d="M15 12.7v3.4c-1.4 1.4-3.8 1.4-5.2 0l-1.7 1.7c2.3 2.3 6.2 2.3 8.6 0l1.7-1.7-1.7-1.7-1.7 1.7v-3.4z" />
		<path
			fill="#FBBC05"
			d="M7.2 13.3v.5c0 1 .4 1.9 1.1 2.6l-1.7 1.7c-1.1-1.1-1.7-2.6-1.7-4.2V12l1.7 1.7c.1-.1.3-.3.6-.4z"
		/>
	</svg>
);
