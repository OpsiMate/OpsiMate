import { GrafanaIcon } from '@/components/icons/GrafanaIcon';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { Bell } from 'lucide-react';
import { ReactNode } from 'react';

type AlertIntegrationKind = 'grafana' | 'gcp' | 'custom';

interface IntegrationDefinition {
	label: string;
	bgClass: string;
	borderClass: string;
	textClass: string;
	render: (iconSizeClass: string) => ReactNode;
}

const sizeMap = {
	sm: 'h-6 w-6',
	md: 'h-7 w-7',
	lg: 'h-10 w-10',
} as const;

const iconSizeMap = {
	sm: 'h-3.5 w-3.5',
	md: 'h-4 w-4',
	lg: 'h-6 w-6',
} as const;

const integrationDefinitions: Record<AlertIntegrationKind, IntegrationDefinition> = {
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

interface IntegrationAvatarProps {
	integration: AlertIntegrationKind;
	size?: keyof typeof sizeMap;
	className?: string;
}

export const IntegrationAvatar = ({ integration, size = 'md', className }: IntegrationAvatarProps) => {
	const definition = integrationDefinitions[integration] ?? integrationDefinitions.custom;
	return (
		<div
			className={cn(
				'rounded-full border flex items-center justify-center font-semibold uppercase tracking-tight shadow-sm ring-1 ring-background',
				sizeMap[size],
				definition.bgClass,
				definition.borderClass,
				definition.textClass,
				className
			)}
			title={`${definition.label} integration`}
		>
			{definition.render(iconSizeMap[size])}
		</div>
	);
};

const GcpIcon = ({ className }: { className?: string }) => (
	<svg viewBox="0 0 48 48" className={className} aria-hidden="true">
		<path
			fill="#4285F4"
			d="M37.6 20.6a12.9 12.9 0 0 0-11.6-7H24l-2.6 4.4l2.6 4.3h2a6.3 6.3 0 0 1 5.7 3.8c.8 2 .5 4.2-.7 6"
		/>
		<path
			fill="#34A853"
			d="M31 32l3.1 5.3l5.1-2.9A13 13 0 0 0 42 24a12.8 12.8 0 0 0-.4-3.5l-7.4.1a6.2 6.2 0 0 1-3.4 11.4Z"
		/>
		<path
			fill="#FBBC05"
			d="m17 36.8l6.4 11L29.7 43h.1l-3.1-5.3a6.3 6.3 0 0 1-6.6-10.7l-3.1-5.3l-5.2 2.9A13 13 0 0 0 17 36.8Z"
		/>
		<path
			fill="#EA4335"
			d="m11.7 18l3 5.3l5.2-2.9l2.4-4.2l.1-.1l2.6-4.3L22.4 6A13 13 0 0 0 6 24.1c0 3 1 6 2.7 8.4l5.1-2.9a6.3 6.3 0 0 1-2-11.5Z"
		/>
	</svg>
);
