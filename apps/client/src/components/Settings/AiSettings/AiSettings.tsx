import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useAiConfig, useTestAiConnection, useUpdateAiConfig } from '@/hooks/queries/ai';
import { AiTestResult } from '@OpsiMate/shared';
import { CheckCircle2, KeyRound, Loader2, PlugZap, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// Common Bedrock model ids offered as suggestions; the field stays free text because
// AWS ships new models (and cross-region inference profiles) faster than any list.
const MODEL_SUGGESTIONS = [
	'anthropic.claude-sonnet-4-5-20250929-v1:0',
	'anthropic.claude-3-5-sonnet-20240620-v1:0',
	'anthropic.claude-3-5-haiku-20241022-v1:0',
	'amazon.nova-pro-v1:0',
	'amazon.nova-lite-v1:0',
	'meta.llama3-3-70b-instruct-v1:0',
];

const REGION_SUGGESTIONS = ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1', 'ap-northeast-1'];

// AI (beta): bring-your-own-key Bedrock configuration. The key is write-only — once
// saved, the server only ever reports that one exists. Test Connection runs one real,
// tiny Converse call with the SAVED settings, so what was verified is what is stored.
// The server values the form last mirrored — a field still equal to these is untouched
// and safe to refresh; anything else is an unsaved edit.
interface SyncedFormValues {
	region: string;
	modelId: string;
	baseUrl: string;
}

export const AiSettings = () => {
	const { data, isLoading, error } = useAiConfig();
	const updateMutation = useUpdateAiConfig();
	const testMutation = useTestAiConnection();
	const { toast } = useToast();

	const [region, setRegion] = useState('');
	const [modelId, setModelId] = useState('');
	const [baseUrl, setBaseUrl] = useState('');
	const [apiKey, setApiKey] = useState('');
	const [testResult, setTestResult] = useState<AiTestResult | null>(null);

	// Sync fields from the server WITHOUT clobbering unsaved edits: the query refreshes
	// after every mutation (e.g. the enable toggle), and a field the user has diverged
	// from the last-synced value must keep their text.
	const lastSynced = useRef<SyncedFormValues | null>(null);
	useEffect(() => {
		if (!data) return;
		const prev = lastSynced.current;
		setRegion((current) => (prev === null || current === prev.region ? data.region : current));
		setModelId((current) => (prev === null || current === prev.modelId ? data.modelId : current));
		setBaseUrl((current) => (prev === null || current === prev.baseUrl ? data.baseUrl : current));
		lastSynced.current = { region: data.region, modelId: data.modelId, baseUrl: data.baseUrl };
	}, [data]);

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" /> Loading AI settings…
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className="text-sm text-muted-foreground">
				Failed to load AI settings{error ? ` — ${(error as Error).message}` : ''}. Admin access is required for
				this section.
			</div>
		);
	}

	const dirty = region !== data.region || modelId !== data.modelId || baseUrl !== data.baseUrl || apiKey.length > 0;

	const save = async () => {
		try {
			await updateMutation.mutateAsync({
				region: region.trim(),
				modelId: modelId.trim(),
				baseUrl: baseUrl.trim(),
				// Empty field = keep the stored key; only a typed value replaces it.
				...(apiKey.length > 0 ? { apiKey } : {}),
			});
			setApiKey('');
			setTestResult(null);
			toast({ title: 'AI settings saved' });
		} catch (e) {
			toast({ title: 'Failed to save', description: (e as Error).message, variant: 'destructive' });
		}
	};

	const removeKey = async () => {
		try {
			await updateMutation.mutateAsync({ apiKey: null, enabled: false });
			setApiKey('');
			setTestResult(null);
			toast({ title: 'API key removed', description: 'AI features are disabled until a new key is saved.' });
		} catch (e) {
			toast({ title: 'Failed to remove key', description: (e as Error).message, variant: 'destructive' });
		}
	};

	const runTest = async () => {
		setTestResult(null);
		try {
			setTestResult(await testMutation.mutateAsync());
		} catch (e) {
			toast({ title: 'Test failed to run', description: (e as Error).message, variant: 'destructive' });
		}
	};

	return (
		<div className="space-y-4">
			<div>
				<h2 className="text-lg font-semibold text-foreground">AI (beta)</h2>
				<p className="text-sm text-muted-foreground">
					Bring your own Amazon Bedrock API key to power upcoming AI features. The key is stored encrypted on
					your OpsiMate server, never reaches the browser, and is sent only to the endpoint configured here
					(Amazon Bedrock unless you set a custom one). It can be removed at any time, and no alert data
					leaves your server until an AI feature is explicitly used.
				</p>
			</div>

			<Card className="p-4 space-y-4">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="ai-region" className="text-xs">
							AWS region
						</Label>
						<Input
							id="ai-region"
							list="ai-region-suggestions"
							placeholder="us-east-1"
							value={region}
							onChange={(e) => setRegion(e.target.value)}
						/>
						<datalist id="ai-region-suggestions">
							{REGION_SUGGESTIONS.map((r) => (
								<option key={r} value={r} />
							))}
						</datalist>
					</div>
					<div className="space-y-2">
						<Label htmlFor="ai-model" className="text-xs">
							Model id
						</Label>
						<Input
							id="ai-model"
							list="ai-model-suggestions"
							placeholder="anthropic.claude-sonnet-4-5-20250929-v1:0"
							value={modelId}
							onChange={(e) => setModelId(e.target.value)}
						/>
						<datalist id="ai-model-suggestions">
							{MODEL_SUGGESTIONS.map((m) => (
								<option key={m} value={m} />
							))}
						</datalist>
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="ai-base-url" className="text-xs">
						Endpoint URL (optional)
					</Label>
					<Input
						id="ai-base-url"
						placeholder="https://bedrock-runtime.us-east-1.amazonaws.com"
						value={baseUrl}
						onChange={(e) => setBaseUrl(e.target.value)}
					/>
					<p className="text-xs text-muted-foreground">
						Custom endpoint for proxied setups (e.g. LiteLLM). Leave empty to use the default Bedrock
						endpoint for the selected region.
					</p>
				</div>

				<div className="space-y-2">
					<Label htmlFor="ai-key" className="text-xs">
						Bedrock API key
					</Label>
					<div className="flex items-center gap-2">
						<Input
							id="ai-key"
							type="password"
							autoComplete="off"
							placeholder={
								data.hasApiKey
									? '•••••••• (a key is saved — type to replace it)'
									: 'Paste your Bedrock API key'
							}
							value={apiKey}
							onChange={(e) => setApiKey(e.target.value)}
						/>
						{data.hasApiKey && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => void removeKey()}
								disabled={updateMutation.isPending}
								className="shrink-0"
							>
								Remove key
							</Button>
						)}
					</div>
					<p className="text-xs text-muted-foreground flex items-center gap-1">
						<KeyRound className="h-3 w-3" />
						Generate one in the AWS console under Bedrock → API keys. It is never shown again after saving.
					</p>
				</div>

				<div className="flex items-center justify-between gap-4 border-t pt-4">
					<div className="flex items-center gap-2">
						<Switch
							checked={data.enabled}
							disabled={updateMutation.isPending || !data.hasApiKey}
							onCheckedChange={(enabled) =>
								updateMutation.mutate(
									{ enabled },
									{
										onError: (e) =>
											toast({
												title: 'Failed to update',
												description: (e as Error).message,
												variant: 'destructive',
											}),
									}
								)
							}
							aria-label="Enable AI features"
						/>
						<span className="text-sm text-foreground">
							{data.enabled ? 'AI features enabled' : 'AI features disabled'}
						</span>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							onClick={() => void runTest()}
							disabled={testMutation.isPending || !data.hasApiKey || dirty}
							title={
								dirty ? 'Save your changes first — the test runs with the saved settings' : undefined
							}
							className="gap-1.5"
						>
							{testMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<PlugZap className="h-4 w-4" />
							)}
							Test connection
						</Button>
						<Button onClick={() => void save()} disabled={updateMutation.isPending || !dirty}>
							{updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
						</Button>
					</div>
				</div>

				{dirty && data.hasApiKey && (
					<p className="text-xs text-muted-foreground">
						Unsaved changes — Test connection uses the saved settings.
					</p>
				)}

				{testResult && (
					<div
						className={`rounded-md border p-3 text-sm flex items-start gap-2 ${
							testResult.ok
								? 'border-emerald-500/40 bg-emerald-500/10'
								: 'border-destructive/40 bg-destructive/10'
						}`}
					>
						{testResult.ok ? (
							<CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
						) : (
							<XCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
						)}
						<div className="min-w-0">
							<div className="font-medium">
								{testResult.ok
									? `Connected — ${testResult.modelId} answered in ${testResult.latencyMs}ms`
									: 'Connection failed'}
							</div>
							<div className="text-muted-foreground break-words">{testResult.message}</div>
						</div>
					</div>
				)}
			</Card>
		</div>
	);
};
