import { getProviderTypeName, getStatusBadgeColor } from '@/components/Providers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { providerApi } from '@/lib/api';
import { Provider as SharedProvider } from '@OpsiMate/shared';
import { ExternalLink, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ServiceConfig } from './AddServiceDialog';
import { ServicesList } from './ServicesList';

interface ProviderWithStatus extends SharedProvider {
	status?: 'online' | 'offline' | 'warning' | 'unknown';
	type?: string;
	details?: Record<string, unknown>;
	services?: ServiceConfig[];
}

interface ServiceDetailsSheetProps {
	provider: ProviderWithStatus | null;
	onClose: () => void;
	onDeleteService?: (serviceId: string) => void;
	onStatusChange?: (serviceId: string, newStatus: 'running' | 'stopped' | 'error') => void;
}

const DetailRow = ({ label, value }: { label: string; value: string }) => (
	<>
		<div className="text-muted-foreground">{label}</div>
		<div className="text-foreground font-medium">{value}</div>
	</>
);

export const ServiceDetailsSheetWithLogs = ({
	provider,
	onClose,
	onDeleteService,
	onStatusChange,
}: ServiceDetailsSheetProps) => {
	const { toast } = useToast();
	const [selectedServiceForLogs, setSelectedServiceForLogs] = useState<ServiceConfig | null>(null);
	const [logs, setLogs] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchLogs = useCallback(
		async (serviceId: string) => {
			setLoading(true);
			setError(null);
			try {
				const response = await providerApi.getServiceLogs(parseInt(serviceId));

				if (response.success && response.data) {
					setLogs(response.data);
				} else {
					setError(response.error || 'Failed to fetch logs');
					toast({
						title: 'Error fetching logs',
						description: response.error || 'Failed to fetch logs',
						variant: 'destructive',
					});
				}
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
				setError(errorMessage);
				toast({
					title: 'Error fetching logs',
					description: errorMessage,
					variant: 'destructive',
				});
			} finally {
				setLoading(false);
			}
		},
		[toast]
	);

	useEffect(() => {
		if (selectedServiceForLogs) {
			fetchLogs(selectedServiceForLogs.id);
		}
	}, [selectedServiceForLogs, fetchLogs]);

	if (!provider) return null;

	return (
		<Sheet open={true} onOpenChange={onClose}>
			<SheetContent className="w-full sm:max-w-md overflow-y-auto">
				<SheetHeader>
					<SheetTitle className="text-xl font-bold">Provider Details</SheetTitle>
				</SheetHeader>
				<Separator className="my-4" />
				<div className="space-y-6 py-2">
					<div>
						<h3 className="text-lg font-semibold">{provider.name}</h3>
						<p className="text-sm text-muted-foreground">{getProviderTypeName(provider.type)}</p>
						<Badge className={`mt-1 capitalize ${getStatusBadgeColor(provider.status ?? 'unknown')}`}>
							{provider.status}
						</Badge>
					</div>

					<div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-2">
						{Object.entries(provider.details).map(([key, value]) => (
							<DetailRow
								key={key}
								label={`${key.charAt(0).toUpperCase() + key.slice(1)}:`}
								value={String(value)}
							/>
						))}
					</div>

					{provider.services && provider.services.length > 0 && (
						<div>
							<h4 className="font-semibold text-lg mb-2">Services</h4>
							<ServicesList
								services={provider.services}
								onServiceClick={(service) => {
									// When a service is clicked, select it for logs display
									setSelectedServiceForLogs(service);
								}}
								onStatusChange={(serviceId, newStatus) => {
									if (onStatusChange && provider.id) {
										onStatusChange(serviceId, newStatus);
									}
								}}
								onDeleteService={onDeleteService}
							/>
						</div>
					)}

					{selectedServiceForLogs && (
						<div className="mt-4">
							<div className="flex items-center justify-between mb-2">
								<h4 className="font-semibold text-md">Service Logs: {selectedServiceForLogs.name}</h4>
								<div className="flex gap-2">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => fetchLogs(selectedServiceForLogs.id)}
										disabled={loading}
										className="h-8 w-8 p-0"
									>
										<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setSelectedServiceForLogs(null)}
										className="h-8 w-8 p-0"
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
							</div>

							{loading ? (
								<div className="flex justify-center py-4">
									<div className="animate-pulse text-muted-foreground">Loading logs...</div>
								</div>
							) : error ? (
								<div className="text-red-500 py-2">{error}</div>
							) : logs.length === 0 ? (
								<div className="text-muted-foreground py-2">No logs available</div>
							) : (
								<div className="bg-muted rounded-md p-2 overflow-auto max-h-[300px]">
									<pre className="text-xs font-mono whitespace-pre-wrap">{logs.join('\n')}</pre>
								</div>
							)}
						</div>
					)}

					<div>
						<h4 className="font-semibold text-lg mb-2">External Links</h4>
						<div className="space-y-2">
							<Button variant="outline" className="w-full justify-start" asChild>
								<a href="#" target="_blank" rel="noopener noreferrer">
									<ExternalLink className="mr-2 h-4 w-4" />
									View Metrics
								</a>
							</Button>
						</div>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
};
