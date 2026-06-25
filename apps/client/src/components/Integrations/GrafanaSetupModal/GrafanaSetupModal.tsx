import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { API_BASE_URL } from '@/lib/api';
import { Check, Copy, ExternalLink, Info } from 'lucide-react';
import { useMemo, useState } from 'react';

export interface GrafanaSetupModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const GRAFANA_CONTACT_POINTS_DOCS_URL =
	'https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/';

export const GrafanaSetupModal = ({ open, onOpenChange }: GrafanaSetupModalProps) => {
	const [copiedWebhook, setCopiedWebhook] = useState(false);
	const { toast } = useToast();

	const webhookUrl = useMemo(() => {
		// Prefer the shared API_BASE_URL, which already encodes the correct host + base path.
		const base = typeof window !== 'undefined' ? API_BASE_URL : '';
		const trimmedBase = base.replace(/\/+$/, '');
		return `${trimmedBase || ''}/alerts/custom/grafana?api_token={your_api_token}`;
	}, []);

	const handleCopy = async (value: string) => {
		try {
			await navigator.clipboard.writeText(value);
			setCopiedWebhook(true);
			toast({ title: 'Copied!', description: 'Webhook URL copied to clipboard', duration: 2000 });
			setTimeout(() => setCopiedWebhook(false), 2000);
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
					<DialogTitle className="text-2xl">Set Up Grafana Alert Webhooks</DialogTitle>
					<DialogDescription>
						Configure Grafana to push alerts to OpsiMate via a Webhook contact point — no polling or API key
						required.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Webhook URL Section */}
					<div className="space-y-3">
						<div>
							<h3 className="text-lg font-semibold mb-2 text-foreground">1. Copy your webhook URL</h3>
							<p className="text-sm text-muted-foreground mb-3">
								Use this URL as the endpoint of a Grafana <strong>Webhook</strong> contact point.
							</p>
						</div>
						<div className="flex gap-2">
							<Input value={webhookUrl} readOnly className="font-mono text-sm" />
							<Button onClick={() => handleCopy(webhookUrl)} variant="outline" className="gap-2">
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
								with your actual <code>API_TOKEN</code> value from your OpsiMate server configuration.
							</p>
						</div>
					</div>

					{/* Grafana configuration steps */}
					<div className="space-y-4">
						<div>
							<h3 className="text-lg font-semibold mb-2 text-foreground">
								2. Create a Webhook contact point in Grafana
							</h3>
							<ol className="list-decimal list-inside space-y-3 text-sm text-foreground">
								<li>
									In Grafana, go to <strong>Alerting → Contact points</strong> and click{' '}
									<strong>Add contact point</strong>.
								</li>
								<li>
									Give it a name, for example: <code>opsimate-webhook</code>.
								</li>
								<li>
									Set <strong>Integration</strong> to <strong>Webhook</strong>.
								</li>
								<li>
									Paste the webhook URL above into the <strong>URL</strong> field and keep the HTTP
									method as <code>POST</code>.
								</li>
								<li>
									Click <strong>Save contact point</strong>.
								</li>
							</ol>
						</div>

						<div>
							<h3 className="text-lg font-semibold mb-2 text-foreground">
								3. Route your alerts to the contact point
							</h3>
							<ol className="list-decimal list-inside space-y-3 text-sm text-foreground">
								<li>
									Go to <strong>Alerting → Notification policies</strong>.
								</li>
								<li>
									Set the default policy&apos;s contact point to <code>opsimate-webhook</code> (or add
									a specific routing rule for the alerts you want in OpsiMate).
								</li>
								<li>
									Make sure your alert rules send <strong>resolved</strong> notifications too —
									OpsiMate uses them to automatically archive alerts when they clear.
								</li>
							</ol>
						</div>

						<div className="flex items-start gap-2 text-xs text-muted-foreground">
							<Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
							<p>
								OpsiMate reads each alert&apos;s <code>fingerprint</code> as the identifier,{' '}
								<code>alertname</code> as the name, the <code>summary</code> annotation as the summary,
								and the alert labels as tags. A <code>firing</code> status creates/updates the alert; a{' '}
								<code>resolved</code> status archives it.
							</p>
						</div>

						<div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
							<h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-foreground">
								<span className="text-blue-600 dark:text-blue-400">ℹ️</span>
								Additional resources
							</h4>
							<p className="text-sm text-muted-foreground">
								For more details on configuring Grafana contact points, see the official Grafana
								documentation.
							</p>
							<div className="mt-2">
								<Button
									variant="link"
									className="p-0 h-auto text-blue-600 hover:text-blue-700"
									onClick={() => window.open(GRAFANA_CONTACT_POINTS_DOCS_URL, '_blank')}
								>
									<span>Open Grafana contact points documentation</span>
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
