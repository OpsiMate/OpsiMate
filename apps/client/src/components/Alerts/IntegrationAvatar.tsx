import { cn } from '@/lib/utils';
import { AlertIntegrationKind, iconSizeMap, sizeMap } from './IntegrationAvatar.types';
import { integrationDefinitions } from './IntegrationAvatar.utils';

export { getIntegrationLabel, resolveAlertIntegration } from './IntegrationAvatar.utils';

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
