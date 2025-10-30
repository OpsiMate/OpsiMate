import { useState, useMemo, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { KibanaIcon } from './icons/KibanaIcon';
import { GrafanaIcon } from './icons/GrafanaIcon';
import { DatadogIcon } from './icons/DatadogIcon';
import { ChevronDown, ExternalLink, Loader2 } from 'lucide-react';
import { Tag } from '@OpsiMate/shared';
import { useToast } from '@/hooks/use-toast';
import { useIntegrations, useIntegrationUrls } from '@/hooks/queries';

interface Dashboard {
	name: string;
	url: string;
}

interface IntegrationDashboardDropdownProps {
	tags: Tag[];
	integrationType: 'Kibana' | 'Grafana' | 'Datadog';
	className?: string;
}

export const IntegrationDashboardDropdown = memo(function IntegrationDashboardDropdown({
	tags,
	integrationType,
	className,
}: IntegrationDashboardDropdownProps) {
	const { toast } = useToast();

	// Use React Query to fetch integrations
	const { data: integrations = [], error: integrationsError } = useIntegrations();

	// Memoize display properties to prevent unnecessary re-renders
	const displayName = useMemo(() => `${integrationType} Dashboards`, [integrationType]);

	const getIconComponent = useCallback(() => {
		switch (integrationType) {
			case 'Kibana':
				return KibanaIcon;
			case 'Datadog':
				return DatadogIcon;
			case 'Grafana':
			default:
				return GrafanaIcon;
		}
	}, [integrationType]);

	const IconComponent = getIconComponent();

	// Find the specific integration from cached data
	const integration = useMemo(() => {
		return integrations.find(
			(integration: { type: string; id: string; externalUrl?: string }) => integration.type === integrationType
		);
	}, [integrations, integrationType]);

	const integrationId = integration?.id;
	const integrationUrl = integration?.externalUrl || '';

	// Use React Query to fetch dashboards
	const tagNames = useMemo(() => tags.map((tag) => tag.name), [tags]);
	const { data: dashboards = [], isLoading: loading, error } = useIntegrationUrls(integrationId, tagNames);

	const handleDashboardClick = useCallback(
		(url: string, name: string) => {
			window.open(url, '_blank', 'noopener,noreferrer');
			toast({
				title: 'Opening Dashboard',
				description: `Opening "${name}" in ${integrationType}`,
			});
		},
		[toast, integrationType]
	);

	// Don't render anything if there are no tags or no integration
	if (tags.length === 0 || !integrationId) {
		return null;
	}

	// Show error if integrations failed to load
	if (integrationsError) {
		return (
			<Button
				variant="outline"
				size="sm"
				className={`justify-between gap-2 h-7 text-xs px-2 ${className}`}
				disabled
			>
				<div className="flex items-center gap-2">
					<IconComponent className="h-3 w-3" />
					<span>{displayName}</span>
				</div>
				<span className="text-red-500">Error</span>
			</Button>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className={`justify-between gap-2 h-7 text-xs px-2 ${className}`}
					disabled={loading}
				>
					<div className="flex items-center gap-2">
						<IconComponent className="h-3 w-3" />
						<span>{displayName}</span>
					</div>
					{loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-64">
				<DropdownMenuLabel className="text-xs">
					Dashboards for tags: {tags.map((tag) => tag.name).join(', ')}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />

				{loading && (
					<DropdownMenuItem disabled className="text-xs">
						<Loader2 className="h-3 w-3 mr-2 animate-spin" />
						Loading dashboards...
					</DropdownMenuItem>
				)}

				{error && (
					<DropdownMenuItem disabled className="text-xs text-red-500">
						<span>Error: {error.message}</span>
					</DropdownMenuItem>
				)}

				{!loading && !error && dashboards.length === 0 && (
					<DropdownMenuItem disabled className="text-xs text-muted-foreground">
						No dashboards found for these tags
					</DropdownMenuItem>
				)}

				{!loading && !error && dashboards.length > 0 && (
					<>
						{dashboards.map((dashboard, index) => (
							<DropdownMenuItem
								key={index}
								className="text-xs cursor-pointer"
								onClick={() => handleDashboardClick(dashboard.url, dashboard.name)}
							>
								<div className="flex items-center justify-between w-full">
									<span className="truncate">{dashboard.name}</span>
									<ExternalLink className="h-3 w-3 ml-2 flex-shrink-0" />
								</div>
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-xs text-muted-foreground"
							onClick={() => window.open(integrationUrl, '_blank')}
						>
							<IconComponent className="h-3 w-3 mr-2" />
							Open {integrationType}
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
});
