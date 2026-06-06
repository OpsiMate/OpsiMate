import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useCreateAction, useTestAction, useUpdateAction } from '@/hooks/queries/actions';
import { ActionPayload } from '@/lib/api';
import {
	Action,
	ActionType,
	HttpActionConfig,
	HttpActionMethod,
	JiraActionConfig,
	SlackActionConfig,
	TeamsActionConfig,
} from '@OpsiMate/shared';
import { Filter, Globe, Loader2, Play, Plus, Send, Trash2, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface ActionFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	action?: Action | null;
}

type HeaderRow = { key: string; value: string };

const HTTP_METHODS: HttpActionMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const TYPE_OPTIONS: { value: ActionType; label: string }[] = [
	{ value: 'slack', label: 'Slack message' },
	{ value: 'teams', label: 'Microsoft Teams message' },
	{ value: 'jira', label: 'Jira ticket' },
	{ value: 'http', label: 'HTTP request' },
];

const LOGO_SRC: Partial<Record<ActionType, string>> = {
	slack: 'images/logos/slack.svg',
	teams: 'images/logos/teams.svg',
	jira: 'images/logos/jira.svg',
};

const TypeLogo = ({ type }: { type: ActionType }) => {
	const src = LOGO_SRC[type];
	if (src) return <img src={src} alt={type} className="h-4 w-4 object-contain flex-shrink-0" />;
	return <Globe className="h-4 w-4 flex-shrink-0 text-muted-foreground" />;
};

const headersToRows = (headers?: Record<string, string> | null): HeaderRow[] =>
	headers ? Object.entries(headers).map(([key, value]) => ({ key, value })) : [];

const rowsToHeaders = (rows: HeaderRow[]): Record<string, string> | null => {
	const cleaned = rows.map((r) => ({ key: r.key.trim(), value: r.value })).filter((r) => r.key);
	if (cleaned.length === 0) return null;
	return cleaned.reduce<Record<string, string>>((acc, r) => {
		acc[r.key] = r.value;
		return acc;
	}, {});
};

export const ActionFormDialog = ({ open, onOpenChange, action }: ActionFormDialogProps) => {
	const isEdit = !!action;
	const { toast } = useToast();
	const createMutation = useCreateAction();
	const updateMutation = useUpdateAction();
	const testMutation = useTestAction();

	const [name, setName] = useState('');
	const [type, setType] = useState<ActionType>('slack');

	// Alert filter (empty = applies to all alerts)
	const [nameContains, setNameContains] = useState('');
	const [matchers, setMatchers] = useState<HeaderRow[]>([]);

	// Slack
	const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
	const [slackChannel, setSlackChannel] = useState('');
	const [slackMessage, setSlackMessage] = useState('');

	// Teams
	const [teamsWebhookUrl, setTeamsWebhookUrl] = useState('');
	const [teamsTitle, setTeamsTitle] = useState('');
	const [teamsMessage, setTeamsMessage] = useState('');

	// Jira
	const [jiraBaseUrl, setJiraBaseUrl] = useState('');
	const [jiraEmail, setJiraEmail] = useState('');
	const [jiraApiToken, setJiraApiToken] = useState('');
	const [jiraProjectKey, setJiraProjectKey] = useState('');
	const [jiraIssueType, setJiraIssueType] = useState('Task');
	const [jiraSummary, setJiraSummary] = useState('');
	const [jiraDescription, setJiraDescription] = useState('');

	// HTTP
	const [httpUrl, setHttpUrl] = useState('');
	const [httpMethod, setHttpMethod] = useState<HttpActionMethod>('POST');
	const [httpHeaders, setHttpHeaders] = useState<HeaderRow[]>([]);
	const [httpBody, setHttpBody] = useState('');

	const resetTypeFields = () => {
		setSlackWebhookUrl('');
		setSlackChannel('');
		setSlackMessage('');
		setTeamsWebhookUrl('');
		setTeamsTitle('');
		setTeamsMessage('');
		setJiraBaseUrl('');
		setJiraEmail('');
		setJiraApiToken('');
		setJiraProjectKey('');
		setJiraIssueType('Task');
		setJiraSummary('');
		setJiraDescription('');
		setHttpUrl('');
		setHttpMethod('POST');
		setHttpHeaders([]);
		setHttpBody('');
	};

	useEffect(() => {
		if (!open) return;
		resetTypeFields();
		if (action) {
			setName(action.name);
			setType(action.type);
			setNameContains(action.nameContains ?? '');
			setMatchers((action.labelMatchers ?? []).map((m) => ({ ...m })));
			if (action.type === 'slack') {
				const cfg = action.config as SlackActionConfig;
				setSlackWebhookUrl(cfg.webhookUrl ?? '');
				setSlackChannel(cfg.channel ?? '');
				setSlackMessage(cfg.messageTemplate ?? '');
			} else if (action.type === 'teams') {
				const cfg = action.config as TeamsActionConfig;
				setTeamsWebhookUrl(cfg.webhookUrl ?? '');
				setTeamsTitle(cfg.titleTemplate ?? '');
				setTeamsMessage(cfg.messageTemplate ?? '');
			} else if (action.type === 'jira') {
				const cfg = action.config as JiraActionConfig;
				setJiraBaseUrl(cfg.baseUrl ?? '');
				setJiraEmail(cfg.email ?? '');
				setJiraApiToken(cfg.apiToken ?? '');
				setJiraProjectKey(cfg.projectKey ?? '');
				setJiraIssueType(cfg.issueType ?? 'Task');
				setJiraSummary(cfg.summaryTemplate ?? '');
				setJiraDescription(cfg.descriptionTemplate ?? '');
			} else if (action.type === 'http') {
				const cfg = action.config as HttpActionConfig;
				setHttpUrl(cfg.url ?? '');
				setHttpMethod(cfg.method ?? 'POST');
				setHttpHeaders(headersToRows(cfg.headers));
				setHttpBody(cfg.bodyTemplate ?? '');
			}
		} else {
			setName('');
			setType('slack');
			setNameContains('');
			setMatchers([]);
		}
	}, [open, action]);

	const isValid = useMemo(() => {
		if (!name.trim()) return false;
		switch (type) {
			case 'slack':
				return slackWebhookUrl.trim().length > 0;
			case 'teams':
				return teamsWebhookUrl.trim().length > 0;
			case 'jira':
				return (
					jiraBaseUrl.trim().length > 0 &&
					jiraEmail.trim().length > 0 &&
					jiraApiToken.trim().length > 0 &&
					jiraProjectKey.trim().length > 0 &&
					jiraIssueType.trim().length > 0
				);
			case 'http':
				return httpUrl.trim().length > 0;
			default:
				return false;
		}
	}, [
		name,
		type,
		slackWebhookUrl,
		teamsWebhookUrl,
		jiraBaseUrl,
		jiraEmail,
		jiraApiToken,
		jiraProjectKey,
		jiraIssueType,
		httpUrl,
	]);

	const buildPayload = (): ActionPayload => {
		const trimmedName = name.trim();
		const match = {
			nameContains: nameContains.trim() || null,
			labelMatchers: matchers
				.map((m) => ({ key: m.key.trim(), value: m.value.trim() }))
				.filter((m) => m.key && m.value),
		};
		switch (type) {
			case 'slack':
				return {
					...match,
					name: trimmedName,
					type: 'slack',
					config: {
						webhookUrl: slackWebhookUrl.trim(),
						channel: slackChannel.trim() || null,
						messageTemplate: slackMessage.trim() || null,
					},
				};
			case 'teams':
				return {
					...match,
					name: trimmedName,
					type: 'teams',
					config: {
						webhookUrl: teamsWebhookUrl.trim(),
						titleTemplate: teamsTitle.trim() || null,
						messageTemplate: teamsMessage.trim() || null,
					},
				};
			case 'jira':
				return {
					...match,
					name: trimmedName,
					type: 'jira',
					config: {
						baseUrl: jiraBaseUrl.trim(),
						email: jiraEmail.trim(),
						apiToken: jiraApiToken.trim(),
						projectKey: jiraProjectKey.trim(),
						issueType: jiraIssueType.trim(),
						summaryTemplate: jiraSummary.trim() || null,
						descriptionTemplate: jiraDescription.trim() || null,
					},
				};
			case 'http':
			default:
				return {
					...match,
					name: trimmedName,
					type: 'http',
					config: {
						url: httpUrl.trim(),
						method: httpMethod,
						headers: rowsToHeaders(httpHeaders),
						bodyTemplate: httpBody.trim() || null,
					},
				};
		}
	};

	const handleTest = async () => {
		const payload = buildPayload();
		try {
			const result = await testMutation.mutateAsync(payload);
			toast({
				title: result.ok ? 'Test succeeded' : 'Test failed',
				description: result.message,
				variant: result.ok ? undefined : 'destructive',
			});
		} catch (err) {
			toast({
				title: 'Test failed',
				description: err instanceof Error ? err.message : 'Unknown error',
				variant: 'destructive',
			});
		}
	};

	const submit = async () => {
		const payload = buildPayload();
		try {
			if (isEdit && action) {
				await updateMutation.mutateAsync({ id: action.id, payload });
				toast({ title: 'Action updated', description: payload.name });
			} else {
				await createMutation.mutateAsync(payload);
				toast({ title: 'Action created', description: payload.name });
			}
			onOpenChange(false);
		} catch (err) {
			toast({
				title: isEdit ? 'Failed to update action' : 'Failed to create action',
				description: err instanceof Error ? err.message : 'Unknown error',
				variant: 'destructive',
			});
		}
	};

	const isPending = createMutation.isPending || updateMutation.isPending;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Zap className="h-5 w-5 text-muted-foreground" />
						{isEdit ? 'Edit action' : 'New action'}
					</DialogTitle>
					<DialogDescription>
						Configure a reusable action. You'll be able to run it against alerts from the alert view.
						Templates may reference alert fields like {'{{alert.name}}'} once wired to an alert.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-5 py-2">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="action-name">Name</Label>
							<Input
								id="action-name"
								placeholder="e.g. Notify #oncall"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label>Type</Label>
							<Select value={type} onValueChange={(v) => setType(v as ActionType)}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{TYPE_OPTIONS.map((opt) => (
										<SelectItem key={opt.value} value={opt.value}>
											<span className="flex items-center gap-2">
												<TypeLogo type={opt.value} />
												{opt.label}
											</span>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="rounded-lg border bg-muted/30 p-4 space-y-4">
						<div className="flex items-center gap-2">
							<Send className="h-4 w-4 text-muted-foreground" />
							<h4 className="text-sm font-semibold">Configuration</h4>
						</div>

						{type === 'slack' && (
							<>
								<div className="space-y-2">
									<Label htmlFor="slack-webhook" className="text-xs">
										Incoming webhook URL
									</Label>
									<Input
										id="slack-webhook"
										placeholder="https://hooks.slack.com/services/…"
										value={slackWebhookUrl}
										onChange={(e) => setSlackWebhookUrl(e.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="slack-channel" className="text-xs">
										Channel override (optional)
									</Label>
									<Input
										id="slack-channel"
										placeholder="#oncall"
										value={slackChannel}
										onChange={(e) => setSlackChannel(e.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="slack-message" className="text-xs">
										Message template (optional)
									</Label>
									<Textarea
										id="slack-message"
										placeholder="🔔 {{alert.name}} fired on {{alert.service}}"
										value={slackMessage}
										onChange={(e) => setSlackMessage(e.target.value)}
										rows={3}
									/>
								</div>
							</>
						)}

						{type === 'teams' && (
							<>
								<div className="space-y-2">
									<Label htmlFor="teams-webhook" className="text-xs">
										Incoming webhook URL
									</Label>
									<Input
										id="teams-webhook"
										placeholder="https://outlook.office.com/webhook/…"
										value={teamsWebhookUrl}
										onChange={(e) => setTeamsWebhookUrl(e.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="teams-title" className="text-xs">
										Card title (optional)
									</Label>
									<Input
										id="teams-title"
										placeholder="Alert: {{alert.name}}"
										value={teamsTitle}
										onChange={(e) => setTeamsTitle(e.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="teams-message" className="text-xs">
										Message template (optional)
									</Label>
									<Textarea
										id="teams-message"
										placeholder="{{alert.name}} fired on {{alert.service}}"
										value={teamsMessage}
										onChange={(e) => setTeamsMessage(e.target.value)}
										rows={3}
									/>
								</div>
							</>
						)}

						{type === 'jira' && (
							<>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="jira-baseurl" className="text-xs">
											Jira base URL
										</Label>
										<Input
											id="jira-baseurl"
											placeholder="https://your-org.atlassian.net"
											value={jiraBaseUrl}
											onChange={(e) => setJiraBaseUrl(e.target.value)}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="jira-email" className="text-xs">
											Account email
										</Label>
										<Input
											id="jira-email"
											type="email"
											placeholder="you@company.com"
											value={jiraEmail}
											onChange={(e) => setJiraEmail(e.target.value)}
										/>
									</div>
								</div>
								<div className="space-y-2">
									<Label htmlFor="jira-token" className="text-xs">
										API token
									</Label>
									<Input
										id="jira-token"
										type="password"
										placeholder="Atlassian API token"
										value={jiraApiToken}
										onChange={(e) => setJiraApiToken(e.target.value)}
									/>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="jira-project" className="text-xs">
											Project key
										</Label>
										<Input
											id="jira-project"
											placeholder="OPS"
											value={jiraProjectKey}
											onChange={(e) => setJiraProjectKey(e.target.value)}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="jira-issuetype" className="text-xs">
											Issue type
										</Label>
										<Input
											id="jira-issuetype"
											placeholder="Task, Bug, Incident…"
											value={jiraIssueType}
											onChange={(e) => setJiraIssueType(e.target.value)}
										/>
									</div>
								</div>
								<div className="space-y-2">
									<Label htmlFor="jira-summary" className="text-xs">
										Summary template (optional)
									</Label>
									<Input
										id="jira-summary"
										placeholder="{{alert.name}} on {{alert.service}}"
										value={jiraSummary}
										onChange={(e) => setJiraSummary(e.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="jira-description" className="text-xs">
										Description template (optional)
									</Label>
									<Textarea
										id="jira-description"
										placeholder="Triggered at {{alert.startsAt}}. Details: {{alert.summary}}"
										value={jiraDescription}
										onChange={(e) => setJiraDescription(e.target.value)}
										rows={3}
									/>
								</div>
							</>
						)}

						{type === 'http' && (
							<>
								<div className="grid grid-cols-[120px_1fr] gap-3">
									<div className="space-y-2">
										<Label className="text-xs">Method</Label>
										<Select
											value={httpMethod}
											onValueChange={(v) => setHttpMethod(v as HttpActionMethod)}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{HTTP_METHODS.map((m) => (
													<SelectItem key={m} value={m}>
														{m}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label htmlFor="http-url" className="text-xs">
											URL
										</Label>
										<Input
											id="http-url"
											placeholder="https://api.example.com/webhook"
											value={httpUrl}
											onChange={(e) => setHttpUrl(e.target.value)}
										/>
									</div>
								</div>
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<Label className="text-xs">Headers</Label>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => setHttpHeaders((h) => [...h, { key: '', value: '' }])}
										>
											<Plus className="h-3.5 w-3.5 mr-1" /> Add
										</Button>
									</div>
									{httpHeaders.length === 0 ? (
										<p className="text-xs text-muted-foreground italic">
											No headers. Add e.g. Authorization or Content-Type.
										</p>
									) : (
										<div className="space-y-2">
											{httpHeaders.map((header, idx) => (
												<div
													key={idx}
													className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2"
												>
													<Input
														placeholder="Header (e.g. Content-Type)"
														value={header.key}
														onChange={(e) =>
															setHttpHeaders((h) =>
																h.map((row, i) =>
																	i === idx ? { ...row, key: e.target.value } : row
																)
															)
														}
													/>
													<span className="text-muted-foreground text-sm">:</span>
													<Input
														placeholder="Value (e.g. application/json)"
														value={header.value}
														onChange={(e) =>
															setHttpHeaders((h) =>
																h.map((row, i) =>
																	i === idx ? { ...row, value: e.target.value } : row
																)
															)
														}
													/>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="h-9 w-9"
														onClick={() =>
															setHttpHeaders((h) => h.filter((_, i) => i !== idx))
														}
														aria-label="Remove header"
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
											))}
										</div>
									)}
								</div>
								<div className="space-y-2">
									<Label htmlFor="http-body" className="text-xs">
										Request body template (optional)
									</Label>
									<Textarea
										id="http-body"
										placeholder={'{\n  "text": "{{alert.name}} fired"\n}'}
										value={httpBody}
										onChange={(e) => setHttpBody(e.target.value)}
										rows={4}
										className="font-mono text-xs"
									/>
								</div>
							</>
						)}

						<Badge variant="outline" className="text-xs">
							Secrets are stored as configured.
						</Badge>
					</div>

					<div className="rounded-lg border bg-muted/30 p-4 space-y-4">
						<div className="flex items-center gap-2">
							<Filter className="h-4 w-4 text-muted-foreground" />
							<h4 className="text-sm font-semibold">Show on alerts</h4>
						</div>
						<p className="text-xs text-muted-foreground -mt-2">
							Leave empty to show this action on every alert. Add criteria to show it only on matching
							alerts (name contains AND all labels match).
						</p>

						<div className="space-y-2">
							<Label htmlFor="action-nameContains" className="text-xs">
								Alert name contains
							</Label>
							<Input
								id="action-nameContains"
								placeholder="e.g. HighCPU, prod-db, latency"
								value={nameContains}
								onChange={(e) => setNameContains(e.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label className="text-xs">Label matchers (key = value)</Label>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setMatchers((m) => [...m, { key: '', value: '' }])}
								>
									<Plus className="h-3.5 w-3.5 mr-1" /> Add
								</Button>
							</div>
							{matchers.length === 0 ? (
								<p className="text-xs text-muted-foreground italic">
									No label matchers. Scope by environment, service, severity, etc.
								</p>
							) : (
								<div className="space-y-2">
									{matchers.map((matcher, idx) => (
										<div
											key={idx}
											className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2"
										>
											<Input
												placeholder="key (e.g. severity)"
												value={matcher.key}
												onChange={(e) =>
													setMatchers((m) =>
														m.map((row, i) =>
															i === idx ? { ...row, key: e.target.value } : row
														)
													)
												}
											/>
											<span className="text-muted-foreground text-sm">=</span>
											<Input
												placeholder="value (e.g. critical)"
												value={matcher.value}
												onChange={(e) =>
													setMatchers((m) =>
														m.map((row, i) =>
															i === idx ? { ...row, value: e.target.value } : row
														)
													)
												}
											/>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="h-9 w-9"
												onClick={() => setMatchers((m) => m.filter((_, i) => i !== idx))}
												aria-label="Remove matcher"
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				</div>

				<DialogFooter className="sm:justify-between">
					<Button
						variant="secondary"
						onClick={handleTest}
						disabled={!isValid || isPending || testMutation.isPending}
						title="Send a test with sample alert data"
					>
						{testMutation.isPending ? (
							<Loader2 className="h-4 w-4 mr-1 animate-spin" />
						) : (
							<Play className="h-4 w-4 mr-1" />
						)}
						Send test
					</Button>
					<div className="flex gap-2">
						<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
							Cancel
						</Button>
						<Button onClick={submit} disabled={!isValid || isPending}>
							{isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create action'}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
