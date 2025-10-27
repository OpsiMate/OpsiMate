import React, { useState } from 'react';
import { useApiKeys } from '../hooks/queries/apiKeys/useApiKeys';
import { CreateApiKeyModal } from '../components/CreateApiKeyModal';
import { ApiKeyCard } from '../components/ApiKeyCard';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { ErrorAlert } from '../components/ErrorAlert';
import { Plus, Key, AlertCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

export function ApiKeysPage() {
	const [showCreateModal, setShowCreateModal] = useState(false);
	const { data: apiKeys, isLoading, error, refetch } = useApiKeys();

	const handleApiKeyCreated = () => {
		refetch();
	};

	if (isLoading) {
		return (
			<DashboardLayout>
				<div className="container mx-auto p-6">
					<div className="flex items-center justify-between mb-6">
						<div>
							<h1 className="text-3xl font-bold">API Keys</h1>
							<p className="text-muted-foreground">Manage your API keys for programmatic access</p>
						</div>
						<Button disabled>
							<Plus className="h-4 w-4 mr-2" />
							Create API Key
						</Button>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{[...Array(6)].map((_, i) => (
							<Card key={i} className="animate-pulse">
								<CardHeader>
									<div className="h-5 bg-muted rounded w-2/3 mb-2"></div>
									<div className="h-4 bg-muted rounded w-1/2"></div>
								</CardHeader>
								<CardContent>
									<div className="h-4 bg-muted rounded w-full mb-2"></div>
									<div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
									<div className="flex gap-2">
										<div className="h-9 bg-muted rounded flex-1"></div>
										<div className="h-9 bg-muted rounded w-9"></div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</DashboardLayout>
		);
	}

	if (error) {
		return (
			<DashboardLayout>
				<div className="container mx-auto p-6">
					<div className="flex items-center justify-between mb-6">
						<div>
							<h1 className="text-3xl font-bold">API Keys</h1>
							<p className="text-muted-foreground">Manage your API keys for programmatic access</p>
						</div>
					</div>
					<ErrorAlert message={error.message || 'Failed to load API keys'} className="mb-4" />
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout>
			<div className="container mx-auto p-6">
				<div className="flex items-center justify-between mb-6">
					<div>
						<h1 className="text-3xl font-bold">API Keys</h1>
						<p className="text-muted-foreground">Manage your API keys for programmatic access</p>
					</div>
					<Button onClick={() => setShowCreateModal(true)}>
						<Plus className="h-4 w-4 mr-2" />
						Create API Key
					</Button>
				</div>

				{apiKeys && apiKeys.length === 0 ? (
					<Card>
						<CardHeader className="text-center">
							<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
								<Key className="h-6 w-6" />
							</div>
							<CardTitle>No API Keys</CardTitle>
							<CardDescription>
								You haven't created any API keys yet. Create your first API key to get started with
								programmatic access.
							</CardDescription>
						</CardHeader>
						<CardContent className="text-center">
							<Button onClick={() => setShowCreateModal(true)}>
								<Plus className="h-4 w-4 mr-2" />
								Create Your First API Key
							</Button>
						</CardContent>
					</Card>
				) : (
					<div className="space-y-4">
						<Alert>
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								API keys provide programmatic access to OpsiMate. Keep them secure and never share them
								publicly. You can use them in the Authorization header:{' '}
								<code className="bg-muted px-1 rounded">Bearer YOUR_API_KEY</code>
							</AlertDescription>
						</Alert>

						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{apiKeys?.map((apiKey) => (
								<ApiKeyCard key={apiKey.id} apiKey={apiKey} />
							))}
						</div>
					</div>
				)}

				<CreateApiKeyModal
					open={showCreateModal}
					onOpenChange={setShowCreateModal}
					onApiKeyCreated={handleApiKeyCreated}
				/>
			</div>
		</DashboardLayout>
	);
}

export default ApiKeysPage;
