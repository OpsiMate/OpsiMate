import { Button } from '@/components/ui/button';
import { canManageProviders } from '@/lib/permissions';
import { ProviderType } from '@OpsiMate/shared';
import { ListPlus, Server } from 'lucide-react';
import { Provider } from '../Providers.types';

interface EmptyServiceStateProps {
	provider: Provider;
	onAddService: () => void;
}

export const EmptyServiceState = ({ provider, onAddService }: EmptyServiceStateProps) => {
	return (
		<div className="flex-1 h-full flex flex-col justify-center">
			<div
				className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center bg-gray-50 dark:bg-gray-800/50 flex flex-col items-center justify-center h-full"
				style={{
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<Server className="h-8 w-8 text-muted-foreground mb-2" />
				<h4 className="font-semibold text-sm text-foreground">No Services Configured</h4>
				<p className="text-xs text-muted-foreground mt-1 mb-4">
					Get started by adding a new service to this provider.
				</p>
				{canManageProviders() &&
					(provider.providerType === ProviderType.VM || provider.providerType === ProviderType.K8S) && (
						<Button
							variant="outline"
							size="sm"
							onClick={(e) => {
								e.stopPropagation();
								onAddService();
							}}
						>
							<ListPlus className="mr-2 h-4 w-4" />
							Add New Service
						</Button>
					)}
			</div>
		</div>
	);
};
