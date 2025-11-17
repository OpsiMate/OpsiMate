import { AddServiceDialog, ServiceConfig } from '@/components/AddServiceDialog';
import { EditProviderDialog } from '@/components/EditProviderDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { canDelete, canManageProviders } from '@/lib/permissions';
import { ProviderType } from '@OpsiMate/shared';
import { Edit, ListPlus, MoreVertical, RefreshCw, Trash } from 'lucide-react';
import { useState } from 'react';
import { DeleteProviderDialog } from '../ProviderDialogs';
import { getProviderIcon, getProviderTypeName } from '../Providers.utils';
import { EmptyServiceState } from './EmptyServiceState';
import { ProviderCardProps } from './ProviderCard.types';
import { ServiceList } from './ServiceList';

export const ProviderCard = ({
	provider,
	isLoading,
	onRefresh,
	onUpdateProvider,
	onDeleteProvider,
	onAddService,
	onServiceAction,
	onDeleteService,
}: ProviderCardProps) => {
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isAddServiceDialogOpen, setIsAddServiceDialogOpen] = useState(false);

	const hasServices = Array.isArray(provider.services) && provider.services.length > 0;
	const servicesToShow = hasServices ? provider.services : [];

	const handleDeleteClick = async () => {
		const success = await onDeleteProvider(provider);
		if (success) {
			setIsDeleteDialogOpen(false);
		}
	};

	return (
		<>
			<Card className="flex flex-col transition-all duration-300 hover:shadow-md">
				<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
					<div className="flex items-start gap-3">
						<div className="bg-primary/10 dark:bg-primary/20 text-primary p-2 rounded-lg flex-shrink-0">
							{getProviderIcon(provider.providerType)}
						</div>
						<div className="flex-1 min-w-0">
							<CardTitle className="text-lg font-semibold leading-snug truncate">
								{provider.name}
							</CardTitle>
							<p className="text-sm text-muted-foreground">
								{getProviderTypeName(provider.providerType)}
							</p>
						</div>
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								onClick={(e) => e.stopPropagation()}
							>
								<MoreVertical className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuPortal>
							<DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
								<DropdownMenuItem onClick={() => onRefresh(String(provider.id))}>
									<RefreshCw className="mr-2 h-4 w-4" />
									Refresh
								</DropdownMenuItem>
								{canManageProviders() && (
									<DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
										<Edit className="mr-2 h-4 w-4" />
										Edit
									</DropdownMenuItem>
								)}
								{canManageProviders() &&
									(provider.providerType === ProviderType.VM ||
										provider.providerType === ProviderType.K8S) && (
										<DropdownMenuItem onClick={() => setIsAddServiceDialogOpen(true)}>
											<ListPlus className="mr-2 h-4 w-4" />
											Add Service
										</DropdownMenuItem>
									)}
								{canDelete() && (
									<DropdownMenuItem
										onClick={() => setIsDeleteDialogOpen(true)}
										className="text-red-500 focus:text-red-500"
									>
										<Trash className="mr-2 h-4 w-4" />
										Delete
									</DropdownMenuItem>
								)}
							</DropdownMenuContent>
						</DropdownMenuPortal>
					</DropdownMenu>
				</CardHeader>

				<CardContent className="flex-grow pt-2 px-6 pb-4 h-full">
					<div className="min-h-[320px] h-full flex flex-col justify-start">
						<div className="relative h-full">
							<div className="overflow-y-scroll pr-2 max-h-[304px] h-full services-scrollbar">
								{hasServices ? (
									<ServiceList
										services={servicesToShow}
										provider={provider}
										onServiceAction={onServiceAction}
										onDeleteService={onDeleteService}
									/>
								) : (
									<EmptyServiceState
										provider={provider}
										onAddService={() => setIsAddServiceDialogOpen(true)}
									/>
								)}
							</div>
						</div>
					</div>
				</CardContent>

				<CardFooter className="flex items-center justify-between text-xs text-muted-foreground"></CardFooter>
			</Card>

			<AddServiceDialog
				serverId={String(provider.id)}
				serverName={provider.name}
				providerType={provider.providerType}
				open={isAddServiceDialogOpen}
				onClose={() => setIsAddServiceDialogOpen(false)}
				onServiceAdded={(service: ServiceConfig) => onAddService(provider.id, service)}
			/>

			<DeleteProviderDialog
				open={isDeleteDialogOpen}
				provider={provider}
				onClose={() => setIsDeleteDialogOpen(false)}
				onConfirm={handleDeleteClick}
			/>

			<EditProviderDialog
				provider={provider}
				open={isEditDialogOpen}
				onClose={() => setIsEditDialogOpen(false)}
				onSave={onUpdateProvider}
			/>
		</>
	);
};
