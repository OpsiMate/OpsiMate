import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Server, Cloud, Database, Globe } from 'lucide-react';
import { ProviderSidebar } from '../components/ProviderSidebar';
import { DashboardLayout } from '../components/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { canManageProviders } from '../lib/permissions';

// Provider types
export type ProviderType = 'server' | 'kubernetes' | 'aws-ec2' | 'aws-eks' | 'gcp-compute' | 'azure-vm';

interface Provider {
	id: string;
	type: ProviderType;
	name: string;
	description: string;
	icon: React.ReactNode;
	category: 'server' | 'kubernetes' | 'cloud';
}

const providers: Provider[] = [
	{
		id: 'server',
		type: 'server',
		name: 'Server',
		description: 'Connect to a physical or virtual server via SSH',
		icon: <Server className="h-6 w-6" />,
		category: 'server',
	},
	{
		id: 'kubernetes',
		type: 'kubernetes',
		name: 'Kubernetes Cluster',
		description: 'Connect to a Kubernetes cluster using kubeconfig',
		icon: <Globe className="h-6 w-6" />,
		category: 'kubernetes',
	},
];

export const Providers = () => {
	const { toast } = useToast();
	const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
	const [activeTab, setActiveTab] = useState<string>('all');

	const filteredProviders =
		activeTab === 'all' ? providers : providers.filter((provider) => provider.category === activeTab);

	return (
		<DashboardLayout>
			<div className="container mx-auto p-4 space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold tracking-tight">Providers</h1>
						<p className="text-muted-foreground">
							Connect your infrastructure and services to OpsiMate Dashboard
						</p>
					</div>
				</div>

				<Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
					<TabsList>
						<TabsTrigger value="all">All</TabsTrigger>
						<TabsTrigger value="server">Servers</TabsTrigger>
						<TabsTrigger value="kubernetes">Kubernetes</TabsTrigger>
					</TabsList>
					<TabsContent value={activeTab} className="mt-6">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{filteredProviders.map((provider) => (
								<Card key={provider.id} className="overflow-hidden">
									<CardHeader className="pb-3">
										<div className="flex items-center gap-3">
											<div className="bg-primary/10 p-2 rounded-md">{provider.icon}</div>
											<CardTitle>{provider.name}</CardTitle>
										</div>
									</CardHeader>
									<CardContent>
										<CardDescription>{provider.description}</CardDescription>
									</CardContent>
									<CardFooter className="pt-3">
										{canManageProviders() ? (
											<Button
												variant="default"
												className="w-full"
												onClick={() => setSelectedProvider(provider)}
												aria-label='Configure provider'
											>
												Configure
											</Button>
										) : (
											<Button
												variant="outline"
												className="w-full"
												disabled
												title="You don't have permission to configure providers"
												aria-label='View only'

											>
												View Only
											</Button>
										)}
									</CardFooter>
								</Card>
							))}
						</div>
					</TabsContent>
				</Tabs>

				{selectedProvider && (
					<ProviderSidebar provider={selectedProvider} onClose={() => setSelectedProvider(null)} />
				)}
			</div>
		</DashboardLayout>
	);
};

export default Providers;
