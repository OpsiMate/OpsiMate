import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { API_HOST } from '@/lib/api';
import { Archive, Check, Copy, ExternalLink, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';

export interface CustomAlertsSetupModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const CustomAlertsSetupModal = ({ open, onOpenChange }: CustomAlertsSetupModalProps) => {
	const [copiedUrl, setCopiedUrl] = useState(false);
	const [copiedPayload, setCopiedPayload] = useState(false);
	const [copiedArchive, setCopiedArchive] = useState(false);
	const [copiedDelete, setCopiedDelete] = useState(false);
	const { toast } = useToast();

	const webhookUrl = `${API_HOST}/api/v1/alerts/custom?api_token={your_api_token}`;
	const archiveUrl = `${API_HOST}/api/v1/alerts/{alertId}?api_token={your_api_token}`;
	const deleteUrl = `${API_HOST}/api/v1/alerts/archived/{alertId}?api_token={your_api_token}`;

	const examplePayload = `{
  "id": "unique-alert-id",
  "tags": { "environment": "production", "team": "backend" },
  "alertUrl": "https://link-to-alert-source",
  "alertName": "High CPU Usage Alert",
  "summary": "CPU usage exceeded 90% threshold",
  "startsAt": "2024-01-15T10:30:00Z",
  "runbookUrl": "https://docs.example.com/runbooks/cpu-alert"
}`;

	const handleCopy = async (text: string, type: 'url' | 'payload' | 'archive' | 'delete') => {
		try {
			await navigator.clipboard.writeText(text);
			if (type === 'url') {
				setCopiedUrl(true);
				setTimeout(() => setCopiedUrl(false), 2000);
			} else if (type === 'payload') {
				setCopiedPayload(true);
				setTimeout(() => setCopiedPayload(false), 2000);
			} else if (type === 'archive') {
				setCopiedArchive(true);
				setTimeout(() => setCopiedArchive(false), 2000);
			} else {
				setCopiedDelete(true);
				setTimeout(() => setCopiedDelete(false), 2000);
			}
			toast({
				title: 'Copied!',
				description: type === 'payload' ? 'Example payload copied to clipboard' : 'URL copied to clipboard',
				duration: 2000,
			});
		} catch (error) {
			toast({
				title: 'Failed to copy',
				description: 'Please copy manually',
				variant: 'destructive',
				duration: 3000,
			});
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="text-2xl">Custom Alerts / Webhook Integration</DialogTitle>
					<DialogDescription>
						Send alerts to OpsiMate from any source using HTTP requests
					</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue="create" className="w-full">
					<TabsList className="grid w-full grid-cols-3 mb-4">
						<TabsTrigger value="create" className="flex items-center gap-2">
							<Send className="h-4 w-4" />
							Create
						</TabsTrigger>
						<TabsTrigger value="archive" className="flex items-center gap-2">
							<Archive className="h-4 w-4" />
							Archive
						</TabsTrigger>
						<TabsTrigger value="delete" className="flex items-center gap-2">
							<Trash2 className="h-4 w-4" />
							Delete
						</TabsTrigger>
					</TabsList>

					<TabsContent value="create" className="space-y-6">
						{/* Webhook URL Section */}
						<div className="space-y-3">
							<div>
								<h3 className="text-lg font-semibold mb-2 text-foreground">1. Webhook Endpoint</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Send a POST request to this URL to create custom alerts
								</p>
							</div>
							<div className="flex gap-2">
								<Input value={webhookUrl} readOnly className="font-mono text-sm" />
								<Button onClick={() => handleCopy(webhookUrl, 'url')} variant="outline" className="gap-2">
									{copiedUrl ? (
										<>
											<Check className="h-4 w-4" />
											Copied
										</>
									) : (
										<>
											<Copy className="h-4 w-4" />
											Copy
										</>
									)}
								</Button>
							</div>
							<div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-2">
								<p className="text-sm text-amber-900 dark:text-amber-100">
									<strong>Important:</strong> Replace{' '}
									<code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">
										{'{your_api_token}'}
									</code>{' '}
									with your actual API_TOKEN environment variable value from your OpsiMate server
									configuration.
								</p>
							</div>
						</div>

						{/* Payload Section */}
						<div className="space-y-3">
							<div>
								<h3 className="text-lg font-semibold mb-2 text-foreground">2. Request Payload</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Send a JSON payload with the following structure
								</p>
							</div>
							<div className="relative">
								<pre className="bg-muted p-4 rounded-lg text-sm font-mono overflow-x-auto border">
									{examplePayload}
								</pre>
								<Button
									onClick={() => handleCopy(examplePayload, 'payload')}
									variant="outline"
									size="sm"
									className="absolute top-2 right-2 gap-1"
								>
									{copiedPayload ? (
										<>
											<Check className="h-3 w-3" />
											Copied
										</>
									) : (
										<>
											<Copy className="h-3 w-3" />
											Copy
										</>
									)}
								</Button>
							</div>
						</div>

						{/* Field Descriptions */}
						<div className="space-y-3">
							<h3 className="text-lg font-semibold text-foreground">3. Field Reference</h3>
							<div className="border rounded-lg overflow-hidden">
								<table className="w-full text-sm">
									<thead className="bg-muted">
										<tr>
											<th className="text-left p-3 font-medium">Field</th>
											<th className="text-left p-3 font-medium">Required</th>
											<th className="text-left p-3 font-medium">Description</th>
										</tr>
									</thead>
									<tbody className="divide-y">
										<tr>
											<td className="p-3 font-mono text-xs">id</td>
											<td className="p-3">
												<span className="text-red-600 dark:text-red-400 font-medium">Yes</span>
											</td>
											<td className="p-3 text-muted-foreground">Unique identifier for the alert</td>
										</tr>
										<tr>
											<td className="p-3 font-mono text-xs">alertName</td>
											<td className="p-3">
												<span className="text-red-600 dark:text-red-400 font-medium">Yes</span>
											</td>
											<td className="p-3 text-muted-foreground">Title/name of the alert</td>
										</tr>
										<tr>
											<td className="p-3 font-mono text-xs">tags</td>
											<td className="p-3">
												<span className="text-red-600 dark:text-red-400 font-medium">Yes</span>
											</td>
											<td className="p-3 text-muted-foreground">Key-value pairs for categorization</td>
										</tr>
										<tr>
											<td className="p-3 font-mono text-xs">alertUrl</td>
											<td className="p-3">
												<span className="text-red-600 dark:text-red-400 font-medium">Yes</span>
											</td>
											<td className="p-3 text-muted-foreground">URL to the alert source</td>
										</tr>
										<tr>
											<td className="p-3 font-mono text-xs">summary</td>
											<td className="p-3">
												<span className="text-muted-foreground">No</span>
											</td>
											<td className="p-3 text-muted-foreground">Brief description of the alert</td>
										</tr>
										<tr>
											<td className="p-3 font-mono text-xs">startsAt</td>
											<td className="p-3">
												<span className="text-muted-foreground">No</span>
											</td>
											<td className="p-3 text-muted-foreground">ISO date string (defaults to current time)</td>
										</tr>
										<tr>
											<td className="p-3 font-mono text-xs">updatedAt</td>
											<td className="p-3">
												<span className="text-muted-foreground">No</span>
											</td>
											<td className="p-3 text-muted-foreground">ISO date string for last update</td>
										</tr>
										<tr>
											<td className="p-3 font-mono text-xs">runbookUrl</td>
											<td className="p-3">
												<span className="text-muted-foreground">No</span>
											</td>
											<td className="p-3 text-muted-foreground">URL to runbook documentation</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>

						{/* Example cURL */}
						<div className="space-y-3">
							<h3 className="text-lg font-semibold text-foreground">4. Example cURL Request</h3>
							<pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto border whitespace-pre-wrap">
{`curl -X POST "${API_HOST}/api/v1/alerts/custom?api_token=YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "id": "alert-123",
    "alertName": "High CPU Usage",
    "tags": {"env": "prod"},
    "alertUrl": "https://monitoring.example.com/alert/123"
  }'`}
							</pre>
						</div>
					</TabsContent>

					<TabsContent value="archive" className="space-y-6">
						{/* Archive Alert Endpoint */}
						<div className="space-y-3">
							<div>
								<h3 className="text-lg font-semibold mb-2 text-foreground">1. Archive Endpoint</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Send a DELETE request to archive an active alert. The alert will be moved to the archived alerts table.
								</p>
							</div>
							<div className="flex gap-2">
								<Input value={archiveUrl} readOnly className="font-mono text-sm" />
								<Button onClick={() => handleCopy(archiveUrl, 'archive')} variant="outline" className="gap-2">
									{copiedArchive ? (
										<>
											<Check className="h-4 w-4" />
											Copied
										</>
									) : (
										<>
											<Copy className="h-4 w-4" />
											Copy
										</>
									)}
								</Button>
							</div>
							<div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-2">
								<p className="text-sm text-amber-900 dark:text-amber-100">
									<strong>Important:</strong> Replace{' '}
									<code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">
										{'{alertId}'}
									</code>{' '}
									with the actual alert ID and{' '}
									<code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">
										{'{your_api_token}'}
									</code>{' '}
									with your API token.
								</p>
							</div>
						</div>

						{/* What happens when archived */}
						<div className="space-y-3">
							<h3 className="text-lg font-semibold text-foreground">2. What Happens When Archived</h3>
							<div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
								<ul className="text-sm text-blue-900 dark:text-blue-100 space-y-2 list-disc list-inside">
									<li>Alert is removed from the active alerts list</li>
									<li>Alert is moved to the archived alerts table</li>
									<li>Alert data is preserved and can be viewed in archives</li>
									<li>Archived alerts can be permanently deleted later</li>
								</ul>
							</div>
						</div>

						{/* Example cURL */}
						<div className="space-y-3">
							<h3 className="text-lg font-semibold text-foreground">3. Example cURL Request</h3>
							<pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto border">
{`curl -X DELETE "${API_HOST}/api/v1/alerts/alert-123?api_token=YOUR_TOKEN"`}
							</pre>
						</div>
					</TabsContent>

					<TabsContent value="delete" className="space-y-6">
						{/* Permanent Delete Endpoint */}
						<div className="space-y-3">
							<div>
								<h3 className="text-lg font-semibold mb-2 text-foreground">1. Permanent Delete Endpoint</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Send a DELETE request to permanently remove an archived alert from the system.
								</p>
							</div>
							<div className="flex gap-2">
								<Input value={deleteUrl} readOnly className="font-mono text-sm" />
								<Button onClick={() => handleCopy(deleteUrl, 'delete')} variant="outline" className="gap-2">
									{copiedDelete ? (
										<>
											<Check className="h-4 w-4" />
											Copied
										</>
									) : (
										<>
											<Copy className="h-4 w-4" />
											Copy
										</>
									)}
								</Button>
							</div>
							<div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-2">
								<p className="text-sm text-amber-900 dark:text-amber-100">
									<strong>Important:</strong> Replace{' '}
									<code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">
										{'{alertId}'}
									</code>{' '}
									with the archived alert ID and{' '}
									<code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">
										{'{your_api_token}'}
									</code>{' '}
									with your API token.
								</p>
							</div>
						</div>

						{/* Warning */}
						<div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
							<h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-foreground">
								<span className="text-red-600 dark:text-red-400">⚠️</span>
								Warning: Permanent Action
							</h4>
							<p className="text-sm text-red-900 dark:text-red-100">
								Permanently deleting an archived alert <strong>cannot be undone</strong>. The alert will be completely
								removed from the system with no way to recover it.
							</p>
						</div>

						{/* Prerequisites */}
						<div className="space-y-3">
							<h3 className="text-lg font-semibold text-foreground">2. Prerequisites</h3>
							<div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
								<ul className="text-sm text-blue-900 dark:text-blue-100 space-y-2 list-disc list-inside">
									<li>The alert must first be archived before it can be permanently deleted</li>
									<li>Use the Archive endpoint to move active alerts to the archive first</li>
									<li>Only archived alerts can be permanently deleted</li>
								</ul>
							</div>
						</div>

						{/* Example cURL */}
						<div className="space-y-3">
							<h3 className="text-lg font-semibold text-foreground">3. Example cURL Request</h3>
							<pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto border">
{`curl -X DELETE "${API_HOST}/api/v1/alerts/archived/alert-123?api_token=YOUR_TOKEN"`}
							</pre>
						</div>
					</TabsContent>
				</Tabs>

				<div className="space-y-4 pt-4">
					<div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
						<h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-foreground">
							<span className="text-green-600 dark:text-green-400">💡</span>
							Tip
						</h4>
						<p className="text-sm text-muted-foreground">
							If you installed OpsiMate using the default installation script, the default{' '}
							<code className="bg-green-100 dark:bg-green-900 px-1 py-0.5 rounded">api_token</code> is{' '}
							<strong>opsimate</strong>. You can change this value in your{' '}
							<code className="bg-green-100 dark:bg-green-900 px-1 py-0.5 rounded">
								docker-compose.yml
							</code>{' '}
							file.
						</p>
					</div>

					<div className="flex justify-between">
						<Button
							variant="outline"
							onClick={() =>
								window.open(
									'https://opsimate.vercel.app/docs/integrations/custom-alerts',
									'_blank'
								)
							}
							className="gap-2"
						>
							<span>View Full Documentation</span>
							<ExternalLink className="h-4 w-4" />
						</Button>
						<Button onClick={() => onOpenChange(false)}>Done</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
