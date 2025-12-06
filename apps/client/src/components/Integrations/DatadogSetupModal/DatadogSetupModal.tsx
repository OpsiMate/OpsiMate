import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { API_BASE_URL } from '@/lib/api';
import { Check, Copy, ExternalLink, Info } from 'lucide-react';
import { useMemo, useState } from 'react';

export interface DatadogSetupModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const DATADOG_WEBHOOK_DOCS_URL = 'https://docs.datadoghq.com/integrations/webhooks/#usage';

export const DatadogSetupModal = ({ open, onOpenChange }: DatadogSetupModalProps) => {
	const [copiedWebhook, setCopiedWebhook] = useState(false);
	const [copiedPayload, setCopiedPayload] = useState(false);
	const { toast } = useToast();

	const webhookUrl = useMemo(() => {
		// Prefer the shared API_BASE_URL, which already encodes the correct host + base path.
		// In SSR/tests, API_BASE_URL may be an empty string; in that case fall back to a relative path.
		const base = typeof window !== 'undefined' ? API_BASE_URL : '';
		const trimmedBase = base.replace(/\/+$/, '');
		return `${trimmedBase || ''}/alerts/custom/datadog?api_token={your_api_token}`;
	}, []);

	const payloadTemplate = `{
  "alert_id": "$ALERT_ID",
  "id": "$ID",
  "title": "$EVENT_TITLE",
  "message": "$EVENT_MSG",
  "alert_status": "$ALERT_STATUS",
  "alert_transition": "$ALERT_TRANSITION",
  "event_type": "$EVENT_TYPE",
  "link": "$LINK",
  "tags": "$TAGS",
  "alert_scope": "$ALERT_SCOPE",
  "date": "$DATE",
  "last_updated": "$LAST_UPDATED",
  "org": {
    "id": "$ORG_ID",
    "name": "$ORG_NAME"
  }
}`;

	const handleCopy = async (value: string, type: 'webhook' | 'payload') => {
		try {
			await navigator.clipboard.writeText(value);
			if (type === 'webhook') {
				setCopiedWebhook(true);
			} else {
				setCopiedPayload(true);
			}
			toast({
				title: 'Copied!',
				description:
					type === 'webhook' ? 'Webhook URL copied to clipboard' : 'Payload template copied to clipboard',
				duration: 2000,
			});
			setTimeout(() => {
				setCopiedWebhook(false);
				setCopiedPayload(false);
			}, 2000);
		} catch (error) {
			toast({
				title: 'Failed to copy',
				description: 'Please copy the value manually',
				variant: 'destructive',
				duration: 3000,
			});
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="text-2xl">Set Up Datadog Alert Webhooks</DialogTitle>
					<DialogDescription>
						Configure Datadog to send monitor alerts to OpsiMate via webhook
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Webhook URL Section */}
					<div className="space-y-3">
						<div>
							<h3 className="text-lg font-semibold mb-2">1. Copy your webhook URL</h3>
							<p className="text-sm text-muted-foreground mb-3">
								Use this URL as the endpoint in your Datadog Webhook integration.
							</p>
						</div>
						<div className="flex gap-2">
							<Input value={webhookUrl} readOnly className="font-mono text-sm" />
							<Button
								onClick={() => handleCopy(webhookUrl, 'webhook')}
								variant="outline"
								className="gap-2"
							>
								{copiedWebhook ? (
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
								with your actual <code>API_TOKEN</code> environment variable value from your OpsiMate
								server configuration.
							</p>
						</div>
					</div>

					{/* Datadog configuration steps */}
					<div className="space-y-4">
						<div>
							<h3 className="text-lg font-semibold mb-2">2. Configure the Datadog Webhook integration</h3>
							<ol className="list-decimal list-inside space-y-3 text-sm">
								<li className="space-y-2">
									<span>Open Datadog Webhooks integration settings.</span>
									<div className="ml-6">
										<Button
											variant="link"
											className="p-0 h-auto text-blue-600 hover:text-blue-700"
											onClick={() =>
												window.open(
													'https://app.datadoghq.com/account/settings#integrations/webhooks',
													'_blank'
												)
											}
										>
											<span>Open Datadog Webhooks integration</span>
											<ExternalLink className="ml-1 h-3 w-3" />
										</Button>
									</div>
								</li>
								<li>Click &quot;New&quot; to create a new webhook.</li>
								<li>
									Give it a name, for example: <code>opsimate-alerts</code>.
								</li>
								<li>
									Paste the webhook URL above into the <strong>URL</strong> field.
								</li>
								<li>
									(Optional) Add a custom header if you prefer header-based auth instead of query
									param:
									<ul className="list-disc list-inside ml-6 mt-1 space-y-1">
										<li>
											Header name: <code>X-API-Token</code>
										</li>
										<li>
											Header value: your <code>API_TOKEN</code> value
										</li>
									</ul>
								</li>
							</ol>
						</div>

						<div className="space-y-3">
							<h3 className="text-lg font-semibold mb-2">3. Set the payload (body) template</h3>
							<p className="text-sm text-muted-foreground">
								Use the following JSON as the <strong>Custom payload</strong> for your webhook. OpsiMate
								will use this to map Datadog alerts into its internal alert model.
							</p>
							<div className="relative">
								<Textarea
									value={payloadTemplate}
									readOnly
									className="font-mono text-xs min-h-[220px] resize-none"
								/>
								<Button
									size="sm"
									variant="outline"
									className="absolute top-2 right-2 gap-1"
									onClick={() => handleCopy(payloadTemplate, 'payload')}
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
							<div className="flex items-start gap-2 text-xs text-muted-foreground">
								<Info className="h-4 w-4 mt-0.5" />
								<p>
									OpsiMate uses <code>alert_id</code> (or <code>id</code> if not present) as the alert
									identifier, <code>title</code> as the alert name, <code>message</code> as the
									summary, and the first tag from <code>$TAGS</code> / <code>$ALERT_SCOPE</code> as
									the alert tag. It detects recovery based on <code>$ALERT_STATUS</code> /{' '}
									<code>$ALERT_TRANSITION</code>.
								</p>
							</div>
						</div>

						<div>
							<h3 className="text-lg font-semibold mb-2">4. Attach the webhook to your monitors</h3>
							<ol className="list-decimal list-inside space-y-3 text-sm">
								<li>Create or edit a monitor in Datadog (for example, a CPU usage monitor).</li>
								<li>
									In the <strong>Notify</strong> section of the monitor, add your webhook by
									referencing it with <code>@webhook-opsimate-alerts</code> (or the name you chose).
								</li>
								<li>Save the monitor and trigger a test alert to verify it appears in OpsiMate.</li>
							</ol>
						</div>

						<div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
							<h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
								<span className="text-blue-600 dark:text-blue-400">ℹ️</span>
								Additional resources
							</h4>
							<p className="text-sm text-muted-foreground">
								For more details on the variables available in Datadog webhooks, see the official
								Datadog documentation.
							</p>
							<div className="mt-2">
								<Button
									variant="link"
									className="p-0 h-auto text-blue-600 hover:text-blue-700"
									onClick={() => window.open(DATADOG_WEBHOOK_DOCS_URL, '_blank')}
								>
									<span>Open Datadog Webhooks documentation</span>
									<ExternalLink className="ml-1 h-3 w-3" />
								</Button>
							</div>
						</div>
					</div>

					<div className="pt-4 flex justify-end">
						<Button onClick={() => onOpenChange(false)}>Done</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
