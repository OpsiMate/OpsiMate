import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

export interface ZabbixSetupModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const ZabbixSetupModal = ({ open, onOpenChange }: ZabbixSetupModalProps) => {
	const [copied, setCopied] = useState(false);
	const [copiedScript, setCopiedScript] = useState(false);
	const [copiedCurl, setCopiedCurl] = useState(false);
	const { toast } = useToast();

	const webhookUrl = `${window.location.protocol}//${window.location.hostname}:3001/api/v1/alerts/custom/zabbix?api_token={your_api_token}`;

	const getCurlCommand = (
		zabbixUrl: string,
		opsimateUrl: string,
		mediaName: string,
		username: string,
		password: string
	) => `#!/bin/bash
# Export environment variables for easy configuration
export ZABBIX_URL="${zabbixUrl}"
export OPSIMATE_WEBHOOK_URL="${opsimateUrl}"
export MEDIA_TYPE_NAME="${mediaName}"
export ZABBIX_USER="${username}"
export ZABBIX_PASSWORD="${password}"

# Step 1: Login to Zabbix API and get auth token
AUTH_TOKEN=\$(curl -s -X POST "\$ZABBIX_URL/api_jsonrpc.php" \\
  -H "Content-Type: application/json-rpc" \\
  -d "{\\"jsonrpc\\":\\"2.0\\",\\"method\\":\\"user.login\\",\\"params\\":{\\"username\\":\\"\$ZABBIX_USER\\",\\"password\\":\\"\$ZABBIX_PASSWORD\\"},\\"id\\":1}" \\
  | grep -o '"result":"[^"]*"' | cut -d'"' -f4)

echo "✓ Logged in to Zabbix (Auth token: \$AUTH_TOKEN)"

# Step 2: Create the OpsiMate media type
WEBHOOK_SCRIPT='try { var params = JSON.parse(value); var req = new HttpRequest(); req.addHeader(\\"Content-Type: application/json\\"); var payload = { event_id: params.event_id, event_name: params.event_name, host_name: params.host_name, host_ip: params.host_ip, trigger_id: params.trigger_id, trigger_name: params.trigger_name, trigger_severity: params.trigger_severity, trigger_status: params.trigger_status, event_date: params.event_date, event_time: params.event_time, event_value: params.event_value, event_tags: params.event_tags, item_name: params.item_name, item_value: params.item_value, alert_message: params.alert_message, event_recovery_date: params.event_recovery_date, event_recovery_time: params.event_recovery_time, zabbix_url: params.zabbix_url, trigger_url: params.trigger_url }; var response = req.post(params.URL, JSON.stringify(payload)); if (req.getStatus() != 200) { throw \\"HTTP error: \\" + req.getStatus(); } return \\"OK\\"; } catch (error) { throw \\"OpsiMate webhook error: \\" + error; }'

RESPONSE=\$(curl -s -X POST "\$ZABBIX_URL/api_jsonrpc.php" \\
  -H "Content-Type: application/json-rpc" \\
  -d "{
  \\"jsonrpc\\": \\"2.0\\",
  \\"method\\": \\"mediatype.create\\",
  \\"params\\": {
    \\"name\\": \\"\$MEDIA_TYPE_NAME\\",
    \\"type\\": 4,
    \\"status\\": 0,
    \\"parameters\\": [
      {\\"name\\": \\"URL\\", \\"value\\": \\"\$OPSIMATE_WEBHOOK_URL\\"},
      {\\"name\\": \\"event_id\\", \\"value\\": \\"{EVENT.ID}\\"},
      {\\"name\\": \\"event_name\\", \\"value\\": \\"{EVENT.NAME}\\"},
      {\\"name\\": \\"host_name\\", \\"value\\": \\"{HOST.NAME}\\"},
      {\\"name\\": \\"host_ip\\", \\"value\\": \\"{HOST.IP}\\"},
      {\\"name\\": \\"trigger_id\\", \\"value\\": \\"{TRIGGER.ID}\\"},
      {\\"name\\": \\"trigger_name\\", \\"value\\": \\"{TRIGGER.NAME}\\"},
      {\\"name\\": \\"trigger_severity\\", \\"value\\": \\"{TRIGGER.SEVERITY}\\"},
      {\\"name\\": \\"trigger_status\\", \\"value\\": \\"{TRIGGER.STATUS}\\"},
      {\\"name\\": \\"event_date\\", \\"value\\": \\"{EVENT.DATE}\\"},
      {\\"name\\": \\"event_time\\", \\"value\\": \\"{EVENT.TIME}\\"},
      {\\"name\\": \\"event_value\\", \\"value\\": \\"{EVENT.VALUE}\\"},
      {\\"name\\": \\"event_tags\\", \\"value\\": \\"{EVENT.TAGS}\\"},
      {\\"name\\": \\"item_name\\", \\"value\\": \\"{ITEM.NAME}\\"},
      {\\"name\\": \\"item_value\\", \\"value\\": \\"{ITEM.VALUE}\\"},
      {\\"name\\": \\"alert_message\\", \\"value\\": \\"{ALERT.MESSAGE}\\"},
      {\\"name\\": \\"event_recovery_date\\", \\"value\\": \\"{EVENT.RECOVERY.DATE}\\"},
      {\\"name\\": \\"event_recovery_time\\", \\"value\\": \\"{EVENT.RECOVERY.TIME}\\"},
      {\\"name\\": \\"zabbix_url\\", \\"value\\": \\"\$ZABBIX_URL\\"},
      {\\"name\\": \\"trigger_url\\", \\"value\\": \\"{TRIGGER.URL}\\"}
    ],
    \\"script\\": \\"\$WEBHOOK_SCRIPT\\"
  },
  \\"auth\\": \\"\$AUTH_TOKEN\\",
  \\"id\\": 2
}")

echo "\$RESPONSE"

if echo "\$RESPONSE" | grep -q '"result"'; then
  echo "✓ \$MEDIA_TYPE_NAME media type created successfully!"
  echo ""
  echo "Next steps:"
  echo "1. Go to Users → Users in Zabbix"
  echo "2. Add '\$MEDIA_TYPE_NAME' media to your alert user"
  echo "3. Create an action in Alerts → Actions → Trigger actions"
else
  echo "✗ Failed to create media type. Check the response above."
fi`;

	const [zabbixUrlInput, setZabbixUrlInput] = useState('http://your-zabbix-server:8080');
	const [opsimateUrlInput, setOpsimateUrlInput] = useState(
		`${window.location.protocol}//${window.location.hostname}:3001/api/v1/alerts/custom/zabbix?api_token=opsimate`
	);
	const [mediaTypeName, setMediaTypeName] = useState('OpsiMate');
	const [zabbixUsername, setZabbixUsername] = useState('Admin');
	const [zabbixPassword, setZabbixPassword] = useState('zabbix');

	const webhookScript = `try {
    var params = JSON.parse(value);
    var req = new HttpRequest();
    req.addHeader('Content-Type: application/json');
    
    var payload = {
        event_id: params.event_id,
        event_name: params.event_name,
        host_name: params.host_name,
        host_ip: params.host_ip,
        trigger_id: params.trigger_id,
        trigger_name: params.trigger_name,
        trigger_severity: params.trigger_severity,
        trigger_status: params.trigger_status,
        event_date: params.event_date,
        event_time: params.event_time,
        event_value: params.event_value,
        event_tags: params.event_tags,
        item_name: params.item_name,
        item_value: params.item_value,
        alert_message: params.alert_message,
        event_recovery_date: params.event_recovery_date,
        event_recovery_time: params.event_recovery_time,
        zabbix_url: params.zabbix_url,
        trigger_url: params.trigger_url
    };
    
    var response = req.post(params.URL, JSON.stringify(payload));
    
    if (req.getStatus() != 200) {
        throw 'HTTP error: ' + req.getStatus();
    }
    
    return 'OK';
} catch (error) {
    throw 'OpsiMate webhook error: ' + error;
}`;

	const handleCopy = async (text: string, setCopiedState: (v: boolean) => void, description: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedState(true);
			toast({
				title: 'Copied!',
				description,
				duration: 2000,
			});
			setTimeout(() => setCopiedState(false), 2000);
		} catch {
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
			<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="text-2xl flex items-center gap-3">
						<div className="h-8 w-8 rounded bg-red-600 flex items-center justify-center">
							<span className="text-white font-bold text-sm">Z</span>
						</div>
						Set Up Zabbix Integration
					</DialogTitle>
					<DialogDescription>
						Configure Zabbix to send alerts to OpsiMate via webhook. Follow the steps below to set up the
						integration.
					</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue="api" className="mt-4">
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="api">API Setup (Recommended)</TabsTrigger>
						<TabsTrigger value="quick">Manual Setup</TabsTrigger>
						<TabsTrigger value="detailed">Detailed Guide</TabsTrigger>
					</TabsList>

					<TabsContent value="api" className="space-y-6 mt-4">
						<div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
							<h4 className="font-semibold text-sm mb-2">🚀 Fastest Way to Set Up</h4>
							<p className="text-sm text-muted-foreground">
								Just update the URLs below and copy-paste the script. The script uses environment
								variables for easy configuration!
							</p>
						</div>

						{/* URL Inputs */}
						<div className="space-y-4">
							<div className="space-y-2">
								<label className="text-sm font-medium">Media Type Name</label>
								<Input
									value={mediaTypeName}
									onChange={(e) => setMediaTypeName(e.target.value)}
									placeholder="OpsiMate"
									className="font-mono text-sm"
								/>
								<p className="text-xs text-muted-foreground">
									Name for the media type in Zabbix (change if "OpsiMate" already exists)
								</p>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<label className="text-sm font-medium">Zabbix Server URL</label>
									<Input
										value={zabbixUrlInput}
										onChange={(e) => setZabbixUrlInput(e.target.value)}
										placeholder="http://your-zabbix-server:8080"
										className="font-mono text-sm"
									/>
									<p className="text-xs text-muted-foreground">Your Zabbix web interface URL</p>
								</div>
								<div className="space-y-2">
									<label className="text-sm font-medium">OpsiMate Webhook URL</label>
									<Input
										value={opsimateUrlInput}
										onChange={(e) => setOpsimateUrlInput(e.target.value)}
										placeholder="http://opsimate:3001/api/v1/alerts/custom/zabbix?api_token=opsimate"
										className="font-mono text-sm"
									/>
									<p className="text-xs text-muted-foreground">
										Webhook endpoint (accessible from Zabbix)
									</p>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<label className="text-sm font-medium">Zabbix Username</label>
									<Input
										value={zabbixUsername}
										onChange={(e) => setZabbixUsername(e.target.value)}
										placeholder="Admin"
										className="font-mono text-sm"
									/>
									<p className="text-xs text-muted-foreground">Zabbix admin username</p>
								</div>
								<div className="space-y-2">
									<label className="text-sm font-medium">Zabbix Password</label>
									<Input
										type="password"
										value={zabbixPassword}
										onChange={(e) => setZabbixPassword(e.target.value)}
										placeholder="zabbix"
										className="font-mono text-sm"
									/>
									<p className="text-xs text-muted-foreground">Zabbix admin password</p>
								</div>
							</div>
						</div>

						{/* Curl Command */}
						<div className="space-y-3">
							<h3 className="text-lg font-semibold">Run This Script</h3>
							<div className="relative">
								<pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-64 whitespace-pre-wrap">
									{getCurlCommand(zabbixUrlInput, opsimateUrlInput, mediaTypeName, zabbixUsername, zabbixPassword)}
								</pre>
								<Button
									onClick={() =>
										handleCopy(
											getCurlCommand(zabbixUrlInput, opsimateUrlInput, mediaTypeName, zabbixUsername, zabbixPassword),
											setCopiedCurl,
											'Script copied'
										)
									}
									variant="outline"
									size="sm"
									className="absolute top-2 right-2 gap-1"
								>
									{copiedCurl ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
									{copiedCurl ? 'Copied' : 'Copy'}
								</Button>
							</div>
						</div>

						<div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
							<h4 className="font-semibold text-sm mb-2">⚠️ After Running the Script</h4>
							<ol className="text-sm text-muted-foreground space-y-1 list-decimal ml-4">
								<li>
									Go to <strong>Users → Users</strong> in Zabbix and add the "OpsiMate" media to your
									alert user
								</li>
								<li>
									Go to <strong>Alerts → Actions → Trigger actions</strong> and create an action to
									send alerts via OpsiMate
								</li>
								<li>Test by triggering an alert in Zabbix</li>
							</ol>
						</div>
					</TabsContent>

					<TabsContent value="quick" className="space-y-6 mt-4">
						{/* Step 1: Webhook URL */}
						<div className="space-y-3">
							<h3 className="text-lg font-semibold flex items-center gap-2">
								<span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">
									1
								</span>
								Webhook URL
							</h3>
							<div className="flex gap-2">
								<Input value={webhookUrl} readOnly className="font-mono text-sm" />
								<Button
									onClick={() => handleCopy(webhookUrl, setCopied, 'Webhook URL copied')}
									variant="outline"
									className="gap-2 shrink-0"
								>
									{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
									{copied ? 'Copied' : 'Copy'}
								</Button>
							</div>
							<p className="text-xs text-muted-foreground">
								Replace <code className="bg-muted px-1 rounded">{'{your_api_token}'}</code> with your
								OpsiMate API token (default: <code className="bg-muted px-1 rounded">opsimate</code>)
							</p>
						</div>

						{/* Step 2: Webhook Script */}
						<div className="space-y-3">
							<h3 className="text-lg font-semibold flex items-center gap-2">
								<span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">
									2
								</span>
								Webhook Script
							</h3>
							<p className="text-sm text-muted-foreground">
								Copy this JavaScript code into the Zabbix media type script field:
							</p>
							<div className="relative">
								<pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-48">
									{webhookScript}
								</pre>
								<Button
									onClick={() => handleCopy(webhookScript, setCopiedScript, 'Script copied')}
									variant="outline"
									size="sm"
									className="absolute top-2 right-2 gap-1"
								>
									{copiedScript ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
									{copiedScript ? 'Copied' : 'Copy'}
								</Button>
							</div>
						</div>

						{/* Step 3: Parameters */}
						<div className="space-y-3">
							<h3 className="text-lg font-semibold flex items-center gap-2">
								<span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">
									3
								</span>
								Add These Parameters in Zabbix
							</h3>
							<div className="bg-muted rounded-lg p-4 text-xs font-mono space-y-1 max-h-48 overflow-y-auto">
								<div className="grid grid-cols-2 gap-2 text-muted-foreground">
									<span className="font-semibold text-foreground">Parameter Name</span>
									<span className="font-semibold text-foreground">Value (Zabbix Macro)</span>
								</div>
								<div className="border-t border-border my-2" />
								{[
									['URL', webhookUrl],
									['event_id', '{EVENT.ID}'],
									['event_name', '{EVENT.NAME}'],
									['host_name', '{HOST.NAME}'],
									['host_ip', '{HOST.IP}'],
									['trigger_id', '{TRIGGER.ID}'],
									['trigger_name', '{TRIGGER.NAME}'],
									['trigger_severity', '{TRIGGER.SEVERITY}'],
									['trigger_status', '{TRIGGER.STATUS}'],
									['event_date', '{EVENT.DATE}'],
									['event_time', '{EVENT.TIME}'],
									['event_value', '{EVENT.VALUE}'],
									['event_tags', '{EVENT.TAGS}'],
									['item_name', '{ITEM.NAME}'],
									['item_value', '{ITEM.VALUE}'],
									['alert_message', '{ALERT.MESSAGE}'],
									['event_recovery_date', '{EVENT.RECOVERY.DATE}'],
									['event_recovery_time', '{EVENT.RECOVERY.TIME}'],
									['zabbix_url', 'https://your-zabbix-server.com'],
									['trigger_url', '{TRIGGER.URL}'],
								].map(([name, value]) => (
									<div key={name} className="grid grid-cols-2 gap-2">
										<span>{name}</span>
										<span className="text-muted-foreground truncate">{value}</span>
									</div>
								))}
							</div>
							<p className="text-xs text-muted-foreground">
								<strong>Important:</strong> Set <code className="bg-muted px-1 rounded">zabbix_url</code>{' '}
								to your Zabbix server URL so alerts link back to Zabbix.
							</p>
						</div>

						<div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
							<h4 className="font-semibold text-sm mb-2">✨ Features</h4>
							<ul className="text-sm text-muted-foreground space-y-1 list-disc ml-4">
								<li>
									<strong>Auto-resolve:</strong> Alerts are automatically archived when resolved in
									Zabbix
								</li>
								<li>
									<strong>Deep links:</strong> Click alerts in OpsiMate to jump directly to Zabbix
								</li>
								<li>
									<strong>Rich tags:</strong> Host, severity, and custom tags are preserved
								</li>
							</ul>
						</div>
					</TabsContent>

					<TabsContent value="detailed" className="space-y-4 mt-4">
						<div className="space-y-4">
							<h3 className="text-lg font-semibold">Step-by-Step Configuration</h3>

							<div className="space-y-4 text-sm">
								<div className="border rounded-lg p-4">
									<h4 className="font-semibold mb-2">1. Create Media Type</h4>
									<ol className="list-decimal list-inside space-y-2 text-muted-foreground">
										<li>
											Go to <strong>Alerts → Media types</strong> in Zabbix
										</li>
										<li>
											Click <strong>Create media type</strong>
										</li>
										<li>
											Set <strong>Name</strong> to "OpsiMate"
										</li>
										<li>
											Set <strong>Type</strong> to "Webhook"
										</li>
										<li>Add all parameters from the Quick Setup tab</li>
										<li>Paste the webhook script into the Script field</li>
										<li>Click Add</li>
									</ol>
								</div>

								<div className="border rounded-lg p-4">
									<h4 className="font-semibold mb-2">2. Assign Media to User</h4>
									<ol className="list-decimal list-inside space-y-2 text-muted-foreground">
										<li>
											Go to <strong>Users → Users</strong>
										</li>
										<li>Edit your alert user (e.g., Admin)</li>
										<li>
											Go to <strong>Media</strong> tab
										</li>
										<li>Click Add and select "OpsiMate" media type</li>
										<li>Set "Send to" to any value (e.g., "opsimate")</li>
										<li>Click Add, then Update</li>
									</ol>
								</div>

								<div className="border rounded-lg p-4">
									<h4 className="font-semibold mb-2">3. Create Action</h4>
									<ol className="list-decimal list-inside space-y-2 text-muted-foreground">
										<li>
											Go to <strong>Alerts → Actions → Trigger actions</strong>
										</li>
										<li>Click Create action</li>
										<li>Set Name to "Send to OpsiMate"</li>
										<li>In Operations tab, add an operation:</li>
										<li className="ml-4">
											• Send to user groups or users with "OpsiMate" media
										</li>
										<li>In Recovery operations, add same operation for resolved alerts</li>
										<li>Click Add</li>
									</ol>
								</div>

								<div className="border rounded-lg p-4">
									<h4 className="font-semibold mb-2">4. Test the Integration</h4>
									<ol className="list-decimal list-inside space-y-2 text-muted-foreground">
										<li>Trigger a test problem in Zabbix</li>
										<li>Check OpsiMate Alerts page for the new alert</li>
										<li>Resolve the problem in Zabbix</li>
										<li>Verify the alert is archived in OpsiMate</li>
									</ol>
								</div>
							</div>
						</div>
					</TabsContent>
				</Tabs>

				<div className="pt-4 flex justify-between border-t mt-4">
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
						<ExternalLink className="h-4 w-4" />
						Zabbix Docs
					</Button>
					<Button onClick={() => onOpenChange(false)}>Done</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
};
