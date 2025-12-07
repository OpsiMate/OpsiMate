import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { canManageProviders } from '@/lib/permissions';
import { ClientProviderType } from '@OpsiMate/shared';
import { Database, Globe, Plus, Server } from 'lucide-react';

interface EmptyStateProps {
	searchQuery: string;
	onAddProvider: (type: ClientProviderType) => void;
}

export const EmptyState = ({ searchQuery, onAddProvider }: EmptyStateProps) => {
	return (
		<div className="flex flex-col items-center justify-center h-full p-8 text-center">
			<div className="bg-muted/30 p-4 rounded-full mb-4">
				<Database className="h-10 w-10 text-muted-foreground" />
			</div>
			<h3 className="text-xl font-semibold mb-2">No providers found</h3>
			<p className="text-muted-foreground mb-4">
				{searchQuery ? 'No providers match your search query.' : "You haven't added any providers yet."}
			</p>
			{canManageProviders() && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button>
							<Plus className="mr-2 h-4 w-4" />
							Add Provider
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="center">
						<DropdownMenuItem onClick={() => onAddProvider('server')}>
							<Server className="mr-2 h-4 w-4" />
							VM / Server
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => onAddProvider('kubernetes')}>
							<Globe className="mr-2 h-4 w-4" />
							Kubernetes
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
};
