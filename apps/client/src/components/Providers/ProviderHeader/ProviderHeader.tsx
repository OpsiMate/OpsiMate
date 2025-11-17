import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { canManageProviders } from '@/lib/permissions';
import { ClientProviderType } from '@OpsiMate/shared';
import { Globe, Plus, Search, Server } from 'lucide-react';
import { useState } from 'react';
import { ProviderSidebar } from '../../ProviderSidebar';

interface ProviderHeaderProps {
	searchQuery: string;
	onSearchChange: (value: string) => void;
	onProviderAdded: () => void;
}

export const ProviderHeader = ({ searchQuery, onSearchChange, onProviderAdded }: ProviderHeaderProps) => {
	const [isAddProviderOpen, setIsAddProviderOpen] = useState(false);
	const [selectedProviderType, setSelectedProviderType] = useState<ClientProviderType | null>(null);

	const handleAddProvider = (type: ClientProviderType) => {
		setSelectedProviderType(type);
		setIsAddProviderOpen(true);
	};

	return (
		<>
			<header className="bg-background border-b border-border p-4">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold">Providers</h1>
					{canManageProviders() && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button>
									<Plus className="mr-2 h-4 w-4" />
									Add Provider
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => handleAddProvider('server')}>
									<Server className="mr-2 h-4 w-4" />
									VM / Server
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => handleAddProvider('kubernetes')}>
									<Globe className="mr-2 h-4 w-4" />
									Kubernetes
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>
				<div className="mt-4">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
						<Input
							placeholder="Search providers..."
							className="pl-10"
							value={searchQuery}
							onChange={(e) => onSearchChange(e.target.value)}
						/>
					</div>
				</div>
			</header>

			{isAddProviderOpen && selectedProviderType && (
				<ProviderSidebar
					provider={{
						id: selectedProviderType,
						type: selectedProviderType,
						name: selectedProviderType === 'server' ? 'VM / Server' : 'Kubernetes',
						description:
							selectedProviderType === 'server'
								? 'Connect to a virtual machine or physical server'
								: 'Connect to a Kubernetes cluster',
						icon:
							selectedProviderType === 'server' ? (
								<Server className="h-5 w-5" />
							) : (
								<Globe className="h-5 w-5" />
							),
					}}
					onClose={() => {
						setIsAddProviderOpen(false);
						setSelectedProviderType(null);
						onProviderAdded();
					}}
				/>
			)}
		</>
	);
};
