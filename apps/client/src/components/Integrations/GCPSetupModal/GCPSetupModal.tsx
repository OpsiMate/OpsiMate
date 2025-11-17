import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

export interface GCPSetupModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const GCPSetupModal = ({ open, onOpenChange }: GCPSetupModalProps) => {
	const [copied, setCopied] = useState(false);

	// This should come from your backend configuration
	const webhookUrl = `${window.location.origin}/api/webhooks/gcp`;

	const handleCopyWebhook = async () => {
		await navigator.clipboard.writeText(webhookUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="text-2xl">Set Up Google Cloud Platform Integration</DialogTitle>
					<DialogDescription>
						Configure GCP to send monitoring alerts to OpsiMate via webhook
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Webhook URL Section */}
					<div className="space-y-3">
						<div>
							<h3 className="text-lg font-semibold mb-2">1. Copy Your Webhook URL</h3>
							<p className="text-sm text-muted-foreground mb-3">
								Use this URL in GCP to send alerts to OpsiMate
							</p>
						</div>
						<div className="flex gap-2">
							<Input value={webhookUrl} readOnly className="font-mono text-sm" />
							<Button onClick={handleCopyWebhook} variant="outline" className="gap-2">
								{copied ? (
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
					</div>

					{/* Instructions */}
					<div className="space-y-4">
						<div>
							<h3 className="text-lg font-semibold mb-2">
								2. Create Webhook Notification Channel in GCP
							</h3>
							<ol className="list-decimal list-inside space-y-3 text-sm">
								<li className="space-y-2">
									<span>Navigate to the Google Cloud Console</span>
									<div className="ml-6">
										<Button
											variant="link"
											className="p-0 h-auto text-blue-600 hover:text-blue-700"
											onClick={() => window.open('https://console.cloud.google.com/', '_blank')}
										>
											<span>Open Google Cloud Console</span>
											<ExternalLink className="ml-1 h-3 w-3" />
										</Button>
									</div>
								</li>
								<li className="space-y-2">
									<span>Go to Monitoring → Alerting → Edit Notification Channels</span>
									<div className="ml-6">
										<Button
											variant="link"
											className="p-0 h-auto text-blue-600 hover:text-blue-700"
											onClick={() =>
												window.open(
													'https://console.cloud.google.com/monitoring/alerting/notifications',
													'_blank'
												)
											}
										>
											<span>Go to Notification Channels</span>
											<ExternalLink className="ml-1 h-3 w-3" />
										</Button>
									</div>
								</li>
								<li>In the Webhooks section, click "Add New"</li>
								<li>Provide a display name (e.g., "OpsiMate Webhook")</li>
								<li>Paste your webhook URL in the "Endpoint URL" field</li>
								<li>
									(Optional) If authentication is required, enable "Use HTTP Basic Auth" and provide
									credentials
								</li>
								<li>Click "Test Connection" to verify the webhook is reachable</li>
								<li>Once the test is successful, click "Save"</li>
							</ol>
						</div>

						<div>
							<h3 className="text-lg font-semibold mb-2">3. Configure Alert Policies</h3>
							<ol className="list-decimal list-inside space-y-3 text-sm">
								<li>
									Navigate to Monitoring → Alerting in the Google Cloud Console
									<div className="ml-6 mt-2">
										<Button
											variant="link"
											className="p-0 h-auto text-blue-600 hover:text-blue-700"
											onClick={() =>
												window.open(
													'https://console.cloud.google.com/monitoring/alerting/policies',
													'_blank'
												)
											}
										>
											<span>Go to Alert Policies</span>
											<ExternalLink className="ml-1 h-3 w-3" />
										</Button>
									</div>
								</li>
								<li>Click "Create Policy" to set up a new alerting policy</li>
								<li>Define the conditions that will trigger the alert</li>
								<li>
									In the "Notifications" section, select the OpsiMate webhook notification channel you
									created
								</li>
								<li>Provide a descriptive name for the alerting policy and save it</li>
							</ol>
						</div>

						<div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
							<h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
								<span className="text-blue-600 dark:text-blue-400">ℹ️</span>
								Important Notes
							</h4>
							<ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
								<li>Your webhook endpoint must be publicly accessible</li>
								<li>GCP expects a 200 HTTP status response within 5 seconds</li>
								<li>Alerts will appear in OpsiMate's Alerts page once configured</li>
								<li>
									You can test the webhook by triggering a test alert in GCP or using the "Test
									Connection" button
								</li>
							</ul>
						</div>
					</div>

					<div className="pt-4 flex justify-between">
						<Button
							variant="outline"
							onClick={() =>
								window.open(
									'https://cloud.google.com/monitoring/support/notification-options',
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
