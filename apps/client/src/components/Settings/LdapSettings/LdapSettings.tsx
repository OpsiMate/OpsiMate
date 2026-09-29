import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useLdapSettings, useTestLdapConnection, useUpdateLdapSettings } from '@/hooks/queries/ldap';
import {
	LdapRoleGroups,
	LdapSettings as LdapSettingsData,
	LdapTestResult,
	Role,
	UpdateLdapSettings,
} from '@OpsiMate/shared';
import {
	AlertTriangle,
	Building2,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Info,
	KeyRound,
	Loader2,
	PlugZap,
	XCircle,
} from 'lucide-react';
import { ReactNode, useEffect, useRef, useState } from 'react';

// Everything the form edits, as the inputs hold it (group lists as one-per-line text).
interface LdapForm {
	url: string;
	startTls: boolean;
	bindDn: string;
	searchBase: string;
	searchFilter: string;
	emailAttribute: string;
	nameAttribute: string;
	groupsAttribute: string;
	groupSearchBase: string;
	groupSearchFilter: string;
	adminGroups: string;
	editorGroups: string;
	operationGroups: string;
	viewerGroups: string;
	defaultRole: string;
	timeoutMs: string;
	loginMaxFailures: string;
	tlsRejectUnauthorized: boolean;
	tlsCaCert: string;
}

interface FieldProps {
	id: string;
	label: string;
	hint?: ReactNode;
	children: ReactNode;
}

interface LdapSettingsProps {
	// Start expanded (e.g. opened from a #ldap link).
	defaultOpen?: boolean;
}

interface TestResultViewProps {
	result: LdapTestResult;
}

const NO_DEFAULT_ROLE = 'none';

const STEP_LABELS: Record<string, string> = {
	connect: 'Connect',
	service_bind: 'Service account',
	search_base: 'Search base',
	user_lookup: 'User lookup',
};

const toForm = (data: LdapSettingsData): LdapForm => ({
	url: data.url,
	startTls: data.startTls,
	bindDn: data.bindDn,
	searchBase: data.searchBase,
	searchFilter: data.searchFilter,
	emailAttribute: data.emailAttribute,
	nameAttribute: data.nameAttribute,
	groupsAttribute: data.groupsAttribute,
	groupSearchBase: data.groupSearchBase,
	groupSearchFilter: data.groupSearchFilter,
	adminGroups: data.roleMapping.admin.join('\n'),
	editorGroups: data.roleMapping.editor.join('\n'),
	operationGroups: data.roleMapping.operation.join('\n'),
	viewerGroups: data.roleMapping.viewer.join('\n'),
	defaultRole: data.defaultRole ?? NO_DEFAULT_ROLE,
	timeoutMs: String(data.timeoutMs),
	loginMaxFailures: String(data.loginMaxFailures),
	tlsRejectUnauthorized: data.tlsRejectUnauthorized,
	tlsCaCert: data.tlsCaCert,
});

const lines = (text: string): string[] =>
	text
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);

const toUpdate = (form: LdapForm): UpdateLdapSettings => {
	const roleMapping: LdapRoleGroups = {
		admin: lines(form.adminGroups),
		editor: lines(form.editorGroups),
		operation: lines(form.operationGroups),
		viewer: lines(form.viewerGroups),
	};
	return {
		url: form.url.trim(),
		startTls: form.startTls,
		bindDn: form.bindDn.trim(),
		searchBase: form.searchBase.trim(),
		searchFilter: form.searchFilter.trim(),
		emailAttribute: form.emailAttribute.trim(),
		nameAttribute: form.nameAttribute.trim(),
		groupsAttribute: form.groupsAttribute.trim(),
		groupSearchBase: form.groupSearchBase.trim(),
		groupSearchFilter: form.groupSearchFilter.trim(),
		roleMapping,
		defaultRole: form.defaultRole === NO_DEFAULT_ROLE ? null : (form.defaultRole as Role),
		tlsRejectUnauthorized: form.tlsRejectUnauthorized,
		tlsCaCert: form.tlsCaCert.trim(),
		// A blank number field keeps what's stored: Number('') is 0, which would be refused
		// for the timeout and would silently mean "no limit" for failed logins.
		...(form.timeoutMs.trim() ? { timeoutMs: Number(form.timeoutMs) } : {}),
		...(form.loginMaxFailures.trim() ? { loginMaxFailures: Number(form.loginMaxFailures) } : {}),
	};
};

const sameForm = (a: LdapForm, b: LdapForm): boolean => JSON.stringify(a) === JSON.stringify(b);

const Field = ({ id, label, hint, children }: FieldProps) => (
	<div className="space-y-1.5">
		<Label htmlFor={id} className="text-xs">
			{label}
		</Label>
		{children}
		{hint && <p className="text-xs text-muted-foreground">{hint}</p>}
	</div>
);

const TestResultView = ({ result }: TestResultViewProps) => (
	<div
		className={`rounded-md border p-3 text-sm space-y-2 ${
			result.ok ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-destructive/40 bg-destructive/10'
		}`}
	>
		<div className="font-medium">
			{result.ok ? `All checks passed (${result.latencyMs}ms)` : 'Connection test failed'}
		</div>
		<ul className="space-y-1">
			{result.steps.map((step) => (
				<li key={step.step} className="flex items-start gap-2">
					{step.ok ? (
						<CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
					) : (
						<XCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
					)}
					<span className="min-w-0 break-words">
						<span className="font-medium">{STEP_LABELS[step.step] ?? step.step}:</span> {step.message}
					</span>
				</li>
			))}
		</ul>
		{result.user && (
			<div className="border-t pt-2 space-y-1 text-xs">
				<div>
					<span className="text-muted-foreground">Name:</span> {result.user.fullName}
				</div>
				<div className="break-all">
					<span className="text-muted-foreground">DN:</span> {result.user.dn}
				</div>
				<div>
					<span className="text-muted-foreground">Role at login:</span>{' '}
					<span className="font-medium">{result.user.role ?? 'refused (no mapped group)'}</span>
				</div>
				<div className="break-all">
					<span className="text-muted-foreground">Groups:</span>{' '}
					{result.user.groups.length > 0 ? result.user.groups.join('; ') : 'none found'}
				</div>
			</div>
		)}
	</div>
);

// Directory (LDAP) login: users sign in with their directory email and password; their
// OpsiMate account is created at first login and its role follows their groups. Save,
// then Test: the test and the Enable switch use the SAVED settings. When the server's
// config.yml / LDAP_* env configures LDAP, those win and this section is read-only.
// Lives in Settings -> Users, collapsed to a one-line status until opened.
export const LdapSettings = ({ defaultOpen = false }: LdapSettingsProps) => {
	const { data, isLoading, error } = useLdapSettings();
	const updateMutation = useUpdateLdapSettings();
	const testMutation = useTestLdapConnection();
	const { toast } = useToast();

	const [form, setForm] = useState<LdapForm | null>(null);
	const [bindPassword, setBindPassword] = useState('');
	const [testEmail, setTestEmail] = useState('');
	const [testResult, setTestResult] = useState<LdapTestResult | null>(null);
	const [open, setOpen] = useState(defaultOpen);

	// Refresh from the server without clobbering unsaved edits (see AiSettings).
	const lastSynced = useRef<LdapForm | null>(null);
	useEffect(() => {
		if (!data) return;
		const fresh = toForm(data);
		setForm((current) =>
			current === null || lastSynced.current === null || sameForm(current, lastSynced.current) ? fresh : current
		);
		lastSynced.current = fresh;
	}, [data]);

	if (isLoading || (data && !form)) {
		return (
			<div className="flex items-center gap-2 text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" /> Loading LDAP settings…
			</div>
		);
	}

	if (error || !data || !form) {
		return (
			<div className="text-sm text-muted-foreground">
				Failed to load LDAP settings{error ? ` — ${(error as Error).message}` : ''}. Admin access is required
				for this section.
			</div>
		);
	}

	const readOnly = data.source === 'config';
	// While a save or a test is in flight the form is frozen: a save would otherwise
	// overwrite edits typed meanwhile, and a test started before a save would report on
	// settings that are no longer the saved ones.
	const busy = updateMutation.isPending || testMutation.isPending;
	const locked = readOnly || busy;
	const dirty = !sameForm(form, toForm(data)) || bindPassword.length > 0;
	// Switched on, but the server can't use it (e.g. the saved password no longer decrypts).
	const notActive = data.enabled && data.problems.length > 0;
	// The server refuses to keep the stored password when where/how it is sent changes
	// (see LdapSettingsBL): ask for it up front instead of failing on Save.
	const needsPassword =
		!readOnly &&
		data.hasBindPassword &&
		bindPassword.length === 0 &&
		(form.url.trim().toLowerCase() !== data.url.toLowerCase() ||
			form.bindDn.trim().toLowerCase() !== data.bindDn.toLowerCase() ||
			form.startTls !== data.startTls ||
			form.tlsRejectUnauthorized !== data.tlsRejectUnauthorized ||
			form.tlsCaCert.trim() !== data.tlsCaCert);
	const set = <K extends keyof LdapForm>(key: K, value: LdapForm[K]) => setForm({ ...form, [key]: value });
	const text = (key: keyof LdapForm) => ({
		id: `ldap-${key}`,
		value: form[key] as string,
		disabled: locked,
		onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
			set(key, e.target.value as LdapForm[typeof key]),
	});

	const save = async () => {
		try {
			const saved = await updateMutation.mutateAsync({
				...toUpdate(form),
				// Empty field = keep the stored password; only a typed value replaces it.
				...(bindPassword.length > 0 ? { bindPassword } : {}),
			});
			// Show what was stored: the server trims values (a pasted PEM's trailing
			// newline, blank group lines), and the form must not stay "unsaved" over that.
			const stored = toForm(saved);
			lastSynced.current = stored;
			setForm(stored);
			setBindPassword('');
			setTestResult(null);
			toast({ title: 'LDAP settings saved' });
		} catch (e) {
			toast({ title: 'Failed to save', description: (e as Error).message, variant: 'destructive' });
		}
	};

	const removePassword = async () => {
		try {
			await updateMutation.mutateAsync({ bindPassword: null, enabled: false });
			setBindPassword('');
			toast({ title: 'Password removed', description: 'LDAP login is off until a new one is saved.' });
		} catch (e) {
			toast({
				title: 'Failed to remove the password',
				description: (e as Error).message,
				variant: 'destructive',
			});
		}
	};

	const setEnabled = (enabled: boolean) =>
		updateMutation.mutate(
			{ enabled },
			{
				onSuccess: () => toast({ title: enabled ? 'LDAP login enabled' : 'LDAP login disabled' }),
				onError: (e) =>
					toast({
						title: enabled ? 'Cannot enable LDAP login yet' : 'Failed to update',
						description: (e as Error).message,
						variant: 'destructive',
					}),
			}
		);

	const runTest = async () => {
		setTestResult(null);
		try {
			setTestResult(await testMutation.mutateAsync(testEmail.trim() ? { email: testEmail.trim() } : {}));
		} catch (e) {
			toast({ title: 'Test failed to run', description: (e as Error).message, variant: 'destructive' });
		}
	};

	return (
		<div className="space-y-4">
			<Card className="p-4">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="space-y-1 min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<Building2 className="h-5 w-5 text-muted-foreground" />
							<h2 className="text-lg font-semibold text-foreground">Directory login (LDAP)</h2>
							<Badge
								variant="outline"
								className={
									notActive
										? 'border-amber-500/50 text-amber-700 dark:text-amber-300'
										: data.enabled
											? 'border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
											: ''
								}
							>
								{notActive ? 'Not active' : data.enabled ? 'Enabled' : 'Off'}
							</Badge>
							{readOnly && <Badge variant="outline">Server config</Badge>}
						</div>
						<p className="text-sm text-muted-foreground">
							Let people sign in with their company directory account (Active Directory, OpenLDAP,
							FreeIPA…). Their account is created the first time they sign in, and their role follows
							their directory groups at every login. Local accounts, like yours, keep signing in locally —
							even if the directory is down.
						</p>
						{notActive && (
							<p className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
								<AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
								<span>
									Switched on but not in effect — directory users can&apos;t sign in until this is
									fixed: {data.problems.join(', ')}.
								</span>
							</p>
						)}
					</div>
					<Button variant="outline" onClick={() => setOpen(!open)} className="gap-1.5 shrink-0">
						{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
						{open ? 'Hide' : 'Configure'}
					</Button>
				</div>
			</Card>

			{open && (
				<>
					{readOnly && (
						<div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm flex items-start gap-2">
							<Info className="h-4 w-4 mt-0.5 shrink-0" />
							<span>
								LDAP is configured on the server (<code>config.yml</code> or <code>LDAP_*</code>{' '}
								environment variables), which takes priority over this page. The settings are shown
								read-only; you can still test them.
							</span>
						</div>
					)}

					<Card className="p-4 space-y-4">
						<h3 className="text-sm font-semibold">Connection</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<Field
								id="ldap-url"
								label="Server URL"
								hint="ldaps://host:636, or ldap://host:389 with StartTLS"
							>
								<Input placeholder="ldaps://ldap.example.com:636" {...text('url')} />
							</Field>
							<Field id="ldap-timeoutMs" label="Timeout (ms)">
								<Input type="number" min={500} max={60000} {...text('timeoutMs')} />
							</Field>
						</div>
						<div className="flex items-center gap-2">
							<Switch
								id="ldap-startTls"
								checked={form.startTls}
								disabled={locked}
								onCheckedChange={(v) => set('startTls', v)}
							/>
							<Label htmlFor="ldap-startTls" className="text-sm">
								Use StartTLS (for ldap:// URLs)
							</Label>
						</div>
						{/^ldap:\/\//i.test(form.url) && !form.startTls && (
							<p className="text-xs text-amber-600 flex items-center gap-1">
								<AlertTriangle className="h-3 w-3" /> Without ldaps:// or StartTLS, passwords cross the
								network unencrypted.
							</p>
						)}
						<div className="flex items-center gap-2">
							<Switch
								id="ldap-tlsRejectUnauthorized"
								checked={form.tlsRejectUnauthorized}
								disabled={locked}
								onCheckedChange={(v) => set('tlsRejectUnauthorized', v)}
							/>
							<Label htmlFor="ldap-tlsRejectUnauthorized" className="text-sm">
								Verify the server certificate
							</Label>
						</div>
						{!form.tlsRejectUnauthorized && (
							<p className="text-xs text-amber-600 flex items-center gap-1">
								<AlertTriangle className="h-3 w-3" /> Only for testing: anyone on the network path could
								read passwords.
							</p>
						)}
						<Field
							id="ldap-tlsCaCert"
							label="CA certificate (optional)"
							hint="PEM of the CA that signed the directory's certificate, if it isn't publicly trusted."
						>
							<Textarea
								rows={3}
								className="font-mono text-xs"
								placeholder="-----BEGIN CERTIFICATE-----"
								{...text('tlsCaCert')}
							/>
						</Field>
					</Card>

					<Card className="p-4 space-y-4">
						<h3 className="text-sm font-semibold">Service account</h3>
						<p className="text-xs text-muted-foreground">
							A read-only directory account OpsiMate uses to find users and their groups.
						</p>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<Field id="ldap-bindDn" label="Bind DN">
								<Input placeholder="cn=opsimate,ou=service,dc=example,dc=com" {...text('bindDn')} />
							</Field>
							<Field
								id="ldap-bindPassword"
								label="Password"
								hint={
									needsPassword ? (
										<span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
											<AlertTriangle className="h-3 w-3" /> Re-enter the password: you changed the
											server, bind DN or TLS settings it is sent with.
										</span>
									) : (
										<span className="flex items-center gap-1">
											<KeyRound className="h-3 w-3" /> Stored encrypted; never shown again after
											saving.
										</span>
									)
								}
							>
								<div className="flex items-center gap-2">
									<Input
										id="ldap-bindPassword"
										type="password"
										autoComplete="new-password"
										disabled={locked}
										placeholder={
											data.hasBindPassword
												? '•••••••• (saved — type to replace it)'
												: 'Service account password'
										}
										value={bindPassword}
										onChange={(e) => setBindPassword(e.target.value)}
									/>
									{data.hasBindPassword && !readOnly && (
										<Button
											variant="outline"
											size="sm"
											className="shrink-0"
											onClick={() => void removePassword()}
											disabled={busy}
										>
											Remove
										</Button>
									)}
								</div>
							</Field>
						</div>
					</Card>

					<Card className="p-4 space-y-4">
						<h3 className="text-sm font-semibold">Users</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<Field id="ldap-searchBase" label="Search base">
								<Input placeholder="ou=people,dc=example,dc=com" {...text('searchBase')} />
							</Field>
							<Field
								id="ldap-searchFilter"
								label="Search filter"
								hint="{{email}} is replaced by the address typed at login. AD: (&(objectClass=user)(mail={{email}}))"
							>
								<Input {...text('searchFilter')} />
							</Field>
							<Field id="ldap-emailAttribute" label="Email attribute">
								<Input {...text('emailAttribute')} />
							</Field>
							<Field id="ldap-nameAttribute" label="Name attribute">
								<Input {...text('nameAttribute')} />
							</Field>
						</div>
					</Card>

					<Card className="p-4 space-y-4">
						<h3 className="text-sm font-semibold">Groups and roles</h3>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<Field
								id="ldap-groupsAttribute"
								label="Groups attribute"
								hint="On the user entry (AD: memberOf)"
							>
								<Input {...text('groupsAttribute')} />
							</Field>
							<Field
								id="ldap-groupSearchBase"
								label="Group search base (optional)"
								hint="For directories without memberOf"
							>
								<Input placeholder="ou=groups,dc=example,dc=com" {...text('groupSearchBase')} />
							</Field>
							<Field
								id="ldap-groupSearchFilter"
								label="Group search filter"
								hint="{{dn}} = the user's DN"
							>
								<Input {...text('groupSearchFilter')} />
							</Field>
						</div>
						<p className="text-xs text-muted-foreground">
							One group per line: a full DN (safest) or a bare group name. The highest matching role wins.
							A bare name matches any group with that name, so prefer full DNs for Admin.
						</p>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<Field id="ldap-adminGroups" label="Admin groups">
								<Textarea rows={2} className="font-mono text-xs" {...text('adminGroups')} />
							</Field>
							<Field id="ldap-editorGroups" label="Editor groups">
								<Textarea rows={2} className="font-mono text-xs" {...text('editorGroups')} />
							</Field>
							<Field id="ldap-operationGroups" label="Operation groups">
								<Textarea rows={2} className="font-mono text-xs" {...text('operationGroups')} />
							</Field>
							<Field id="ldap-viewerGroups" label="Viewer groups">
								<Textarea rows={2} className="font-mono text-xs" {...text('viewerGroups')} />
							</Field>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<Field id="ldap-defaultRole" label="Everyone else">
								<Select
									value={form.defaultRole}
									disabled={locked}
									onValueChange={(v) => set('defaultRole', v)}
								>
									<SelectTrigger id="ldap-defaultRole">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={NO_DEFAULT_ROLE}>Refuse sign-in</SelectItem>
										<SelectItem value={Role.Viewer}>Viewer</SelectItem>
										<SelectItem value={Role.Operation}>Operation</SelectItem>
										<SelectItem value={Role.Editor}>Editor</SelectItem>
										<SelectItem value={Role.Admin}>Admin</SelectItem>
									</SelectContent>
								</Select>
							</Field>
							<Field
								id="ldap-loginMaxFailures"
								label="Failed logins before a 15-minute block"
								hint="Per email; keep it below your directory's lockout threshold. 0 = no limit."
							>
								<Input type="number" min={0} max={1000} {...text('loginMaxFailures')} />
							</Field>
						</div>
					</Card>

					<Card className="p-4 space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-4">
							<div className="flex items-center gap-2">
								<Switch
									checked={data.enabled}
									disabled={readOnly || busy || dirty}
									onCheckedChange={setEnabled}
									aria-label="Enable LDAP login"
								/>
								<span className="text-sm text-foreground">
									{data.enabled ? 'LDAP login enabled' : 'LDAP login disabled'}
								</span>
							</div>
							{!readOnly && (
								<Button
									onClick={() => void save()}
									disabled={busy || !dirty || needsPassword}
									title={needsPassword ? 'Re-enter the service-account password first' : undefined}
								>
									{updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
								</Button>
							)}
						</div>
						<div className="flex flex-wrap items-end gap-2">
							<div className="flex-1 min-w-[14rem]">
								<Field id="ldap-testEmail" label="Test with a user (optional)">
									<Input
										id="ldap-testEmail"
										type="email"
										placeholder="someone@example.com — shows the role they would get"
										value={testEmail}
										onChange={(e) => setTestEmail(e.target.value)}
									/>
								</Field>
							</div>
							<Button
								variant="outline"
								onClick={() => void runTest()}
								disabled={busy || dirty}
								title={
									dirty
										? 'Save your changes first — the test runs with the saved settings'
										: undefined
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
						</div>
						{dirty && (
							<p className="text-xs text-muted-foreground">
								Unsaved changes — save first: Test connection and the Enable switch use the saved
								settings.
							</p>
						)}
						{testResult && <TestResultView result={testResult} />}
					</Card>
				</>
			)}
		</div>
	);
};
