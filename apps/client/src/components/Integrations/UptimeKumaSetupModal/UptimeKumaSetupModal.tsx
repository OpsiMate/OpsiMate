import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

export interface UptimeKumaSetupModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const UptimeKumaSetupModal = ({ open, onOpenChange }: UptimeKumaSetupModalProps) => {
	const [copied, setCopied] = useState(false);

	const webhookUrl = `${window.location.protocol + '//' + window.location.hostname}:3001/api/v1/alerts/custom/UptimeKuma?api_token={your_api_token}`;

	const handleCopyWebhook = async () => {
		await navigator.clipboard.writeText(webhookUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="text-2xl">Set Up Uptime Kuma Integration</DialogTitle>
					<DialogDescription>Configure Uptime Kuma to send alerts to OpsiMate via webhook</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Webhook URL Section */}
					<div className="space-y-3">
						<div>
							<h3 className="text-lg font-semibold mb-2">1. Copy Your Webhook URL</h3>
							<p className="text-sm text-muted-foreground mb-3">
								Use this URL in Uptime Kuma to send alerts to OpsiMate
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
							<h3 className="text-lg font-semibold mb-2">2. Configure Notification in Uptime Kuma</h3>
							<ol className="list-decimal list-inside space-y-3 text-sm">
								<li className="space-y-2">
									<span>Open your Uptime Kuma dashboard</span>
								</li>
								<li className="space-y-2">
									<span>Go to Settings → Notifications</span>
								</li>
								<li>Click "Setup Notification"</li>
								<li>
									Set <strong>Notification Type</strong> to "Webhook"
								</li>
								<li>
									Set <strong>Friendly Name</strong> to "OpsiMate"
								</li>
								<li>
									Paste your webhook URL into the <strong>Post URL</strong> field
								</li>
								<li>
									Ensure <strong>Content Type</strong> is set to "JSON" (default)
								</li>
								<li>Click "Test" to verify the connection</li>
								<li>Check that the test succeeds and shows a success message, open OpsiMate to confirm the alert appears</li>
								<li>Optionally, configure "Default enabled" to true for this notification and configure "Apply to all existing monitors"</li>
								<li>Click "Save" to finish setup</li>
							</ol>
						</div>

						<div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
							<h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
								<span className="text-blue-600 dark:text-blue-400">ℹ️</span>
								Important Notes
							</h4>
							<ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
								<li>Your webhook endpoint must be accessible from your Uptime Kuma instance</li>
								<li>Alerts will appear in OpsiMate's Alerts page once configured</li>
								<li>
									The "Test" button in Uptime Kuma will send a test alert that should appear in
									OpsiMate
								</li>
							</ul>
						</div>
					</div>

					<div className="pt-4 flex justify-between">
						<Button
							variant="outline"
							onClick={() =>
								window.open('https://github.com/louislam/uptime-kuma/wiki/Notifications', '_blank')
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
