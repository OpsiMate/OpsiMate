import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

export interface ZabbixSetupModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const ZabbixSetupModal = ({ open, onOpenChange }: ZabbixSetupModalProps) => {
	const [copied, setCopied] = useState(false);
	const [copiedPayload, setCopiedPayload] = useState(false);
	const { toast } = useToast();

	const webhookUrl = `${window.location.protocol + '//' + window.location.hostname}:3001/api/v1/alerts/custom/zabbix?api_token={your_api_token}`;

	const webhookPayload = `{
  "event_id": "{EVENT.ID}",
  "event_name": "{EVENT.NAME}",
  "host_name": "{HOST.NAME}",
  "host_ip": "{HOST.IP}",
  "trigger_id": "{TRIGGER.ID}",
  "trigger_name": "{TRIGGER.NAME}",
  "trigger_severity": "{TRIGGER.SEVERITY}",
  "trigger_status": "{TRIGGER.STATUS}",
  "event_date": "{EVENT.DATE}",
  "event_time": "{EVENT.TIME}",
  "event_value": "{EVENT.VALUE}",
  "event_tags": "{EVENT.TAGS}",
  "item_name": "{ITEM.NAME}",
  "item_value": "{ITEM.VALUE}",
  "alert_message": "{ALERT.MESSAGE}",
  "event_recovery_date": "{EVENT.RECOVERY.DATE}",
  "event_recovery_time": "{EVENT.RECOVERY.TIME}"
}`;

	const handleCopyWebhook = async () => {
		try {
			await navigator.clipboard.writeText(webhookUrl);
			setCopied(true);
			toast({
				title: 'Copied!',
				description: 'Webhook URL copied to clipboard',
				duration: 2000,
			});
			setTimeout(() => setCopied(false), 2000);
		} catch (error) {
			toast({
				title: 'Failed to copy',
				description: 'Please copy the URL manually',
				variant: 'destructive',
				duration: 3000,
			});
		}
	};

	const handleCopyPayload = async () => {
		try {
			await navigator.clipboard.writeText(webhookPayload);
			setCopiedPayload(true);
			toast({
				title: 'Copied!',
				description: 'Webhook payload copied to clipboard',
				duration: 2000,
			});
			setTimeout(() => setCopiedPayload(false), 2000);
		} catch (error) {
			toast({
				title: 'Failed to copy',
				description: 'Please copy the payload manually',
				variant: 'destructive',
				duration: 3000,
			});
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="text-2xl">Set Up Zabbix Integration</DialogTitle>
					<DialogDescription>Configure Zabbix to send alerts to OpsiMate via webhook</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Webhook URL Section */}
					<div className="space-y-3">
						<div>
							<h3 className="text-lg font-semibold mb-2">1. Copy Your Webhook URL</h3>
							<p className="text-sm text-muted-foreground mb-3">
								Use this URL when configuring the Zabbix webhook media type
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

					{/* Webhook Payload Section */}
					<div className="space-y-3">
						<div>
							<h3 className="text-lg font-semibold mb-2">2. Webhook Payload Template</h3>
							<p className="text-sm text-muted-foreground mb-3">
								Use this JSON payload template in your Zabbix webhook media type
							</p>
						</div>
						<div className="relative">
							<pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto">
								{webhookPayload}
							</pre>
							<Button
								onClick={handleCopyPayload}
								variant="outline"
								size="sm"
								className="absolute top-2 right-2 gap-2"
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

					{/* Instructions */}
					<div className="space-y-4">
						<div>
							<h3 className="text-lg font-semibold mb-2">3. Configure Zabbix Webhook</h3>
							<ol className="list-decimal list-inside space-y-3 text-sm">
								<li className="space-y-2">
									<span>
										Go to <strong>Administration → Media types</strong> in Zabbix
									</span>
								</li>
								<li className="space-y-2">
									<span>
										Click <strong>Create media type</strong>
									</span>
								</li>
								<li>
									Set <strong>Name</strong> to "OpsiMate"
								</li>
								<li>
									Set <strong>Type</strong> to "Webhook"
								</li>
								<li>
									Add a parameter named <strong>URL</strong> with your webhook URL
								</li>
								<li>
									In the <strong>Script</strong> field, add the JavaScript code to send HTTP POST
									request with the payload
								</li>
								<li>
									Go to <strong>Administration → Users</strong> and add the media type to your
									alert user
								</li>
								<li>
									Create or modify an <strong>Action</strong> under{' '}
									<strong>Configuration → Actions</strong> to send notifications via the OpsiMate
									media type
								</li>
								<li>Test by triggering an alert in Zabbix</li>
							</ol>
						</div>

						<div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
							<h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
								<span className="text-blue-600 dark:text-blue-400">ℹ️</span>
								Important Notes
							</h4>
							<ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
								<li>Your webhook endpoint must be accessible from your Zabbix server</li>
								<li>Alerts will appear in OpsiMate's Alerts page once configured</li>
								<li>
									When a problem is resolved in Zabbix, the corresponding alert will be automatically
									archived in OpsiMate
								</li>
								<li>
									Severity levels and host information are automatically extracted as alert tags
								</li>
							</ul>
						</div>

						<div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
							<h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
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
					</div>

					<div className="pt-4 flex justify-between">
						<Button
							variant="outline"
							onClick={() =>
								window.open(
									'https://www.zabbix.com/documentation/current/en/manual/config/notifications/media/webhook',
									'_blank'
								)
							}
							className="gap-2"
						>
							<span>View Zabbix Webhook Documentation</span>
							<ExternalLink className="h-4 w-4" />
						</Button>
						<Button onClick={() => onOpenChange(false)}>Done</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
