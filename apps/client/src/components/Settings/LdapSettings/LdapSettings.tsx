import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { LdapRequestError, useLdapSettings, useTestLdapConnection, useUpdateLdapSettings } from '@/hooks/queries/ldap';
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
	enabled: boolean;
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

// Where a server-reported problem is shown: a form field, the password box, the
// group-mapping block as a whole, or (undefined) only in the summary.
type ProblemTarget = keyof LdapForm | 'bindPassword' | 'roleMapping';

interface FieldProps {
	id: string;
	label: string;
	hint?: ReactNode;
	error?: string;
	children: ReactNode;
}

interface LdapSettingsProps {
	// Start expanded (e.g. opened from a #ldap link).
	defaultOpen?: boolean;
}

interface TestResultViewProps {
	result: LdapTestResult;
	// The test ran on unsaved edits rather than on what is stored.
	draft: boolean;
}

// How the connection is protected. Derived from the URL scheme and the StartTLS flag
// rather than stored on its own, so the URL and the choice can never disagree.
type SecurityMode = 'ldaps' | 'starttls' | 'none';

const NO_DEFAULT_ROLE = 'none';

const STEP_LABELS: Record<string, string> = {
	connect: 'Connect',
	service_bind: 'Service account',
	search_base: 'Search base',
	user_lookup: 'User lookup',
};

const isLdaps = (url: string): boolean => /^ldaps:\/\//i.test(url.trim());

// An empty URL counts as LDAPS: the recommended choice, and what picking it would write.
const securityModeOf = (form: LdapForm): SecurityMode =>
	form.url.trim() === '' || isLdaps(form.url) ? 'ldaps' : form.startTls ? 'starttls' : 'none';

// Rewrite the URL for the chosen mode: the scheme always, the port only when it is the
// standard one for the scheme being left (a custom port is kept as typed).
const withSecurityMode = (form: LdapForm, mode: SecurityMode): LdapForm => {
	const ldaps = mode === 'ldaps';
	let url = form.url.trim();
	url = /^ldaps?:\/\//i.test(url)
		? url.replace(/^ldaps?:\/\//i, ldaps ? 'ldaps://' : 'ldap://')
		: `${ldaps ? 'ldaps' : 'ldap'}://${url}`;
	url = url.replace(ldaps ? /:389$/ : /:636$/, ldaps ? ':636' : ':389');
	return { ...form, url, startTls: mode === 'starttls' };
};

const toForm = (data: LdapSettingsData): LdapForm => ({
	enabled: data.enabled,
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
		enabled: form.enabled,
		url: form.url.trim(),
		// StartTLS only means something on ldap://; never send it with ldaps://.
		startTls: form.startTls && !isLdaps(form.url),
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

// Server problems name a setting either as the config key ("search_base", "tls.ca_file")
// or as the API field ("searchBase", "roleMapping.admin.0"). Both are matched here with
// case and underscores ignored.
const PROBLEM_TARGETS: Record<string, ProblemTarget> = {
	enabled: 'enabled',
	url: 'url',
	starttls: 'url',
	binddn: 'bindDn',
	bindpassword: 'bindPassword',
	searchbase: 'searchBase',
	searchfilter: 'searchFilter',
	emailattribute: 'emailAttribute',
	nameattribute: 'nameAttribute',
	groupsattribute: 'groupsAttribute',
	groupsearchbase: 'groupSearchBase',
	groupsearchfilter: 'groupSearchFilter',
	rolemapping: 'roleMapping',
	defaultrole: 'defaultRole',
	timeoutms: 'timeoutMs',
	loginmaxfailures: 'loginMaxFailures',
	tls: 'tlsCaCert',
	tlscacert: 'tlsCaCert',
	tlsrejectunauthorized: 'tlsCaCert',
};
const ROLE_GROUP_FIELDS: Record<string, keyof LdapForm> = {
	admin: 'adminGroups',
	editor: 'editorGroups',
	operation: 'operationGroups',
	viewer: 'viewerGroups',
};

const problemTarget = (problem: string): ProblemTarget | undefined => {
	const [head = '', sub = ''] = (problem.match(/^[A-Za-z0-9_.]+/)?.[0] ?? '').split('.');
	const key = head.toLowerCase().replace(/_/g, '');
	if (key === 'rolemapping' && sub.toLowerCase() in ROLE_GROUP_FIELDS) return ROLE_GROUP_FIELDS[sub.toLowerCase()];
	return PROBLEM_TARGETS[key];
};

// The part of a problem after the field name, for showing under that field.
const problemText = (problem: string): string => problem.replace(/^[A-Za-z0-9_.]+:?\s*/, '').trim() || problem;

const Field = ({ id, label, hint, error, children }: FieldProps) => (
	<div className="space-y-1.5">
		<Label htmlFor={id} className="text-xs">
			{label}
		</Label>
		{children}
		{error ? (
			<p className="text-xs text-destructive flex items-start gap-1" role="alert">
				<XCircle className="h-3 w-3 mt-0.5 shrink-0" /> {error}
			</p>
		) : (
			hint && <p className="text-xs text-muted-foreground">{hint}</p>
		)}
	</div>
);

const TestResultView = ({ result, draft }: TestResultViewProps) => (
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
		{draft && (
			<p className="text-xs text-muted-foreground">
				Tested with your unsaved changes — nothing was stored. Save to keep them.
			</p>
		)}
	</div>
);

// Directory (LDAP) login: users sign in with their directory email and password; their
// OpsiMate account is created at first login and its role follows their groups. Test
// runs on whatever is in the form (saved or not); Save stores it, including the on/off
// switch. When the server's config.yml / LDAP_* env configures LDAP, those win and this
// section is read-only. Lives in Settings -> Users, collapsed to a one-line status
// until opened.
export const LdapSettings = ({ defaultOpen = false }: LdapSettingsProps) => {
	const { data, isLoading, error } = useLdapSettings();
	const updateMutation = useUpdateLdapSettings();
	const testMutation = useTestLdapConnection();
	const { toast } = useToast();

	const [form, setForm] = useState<LdapForm | null>(null);
	const [bindPassword, setBindPassword] = useState('');
	const [testEmail, setTestEmail] = useState('');
	const [testResult, setTestResult] = useState<{ result: LdapTestResult; draft: boolean } | null>(null);
	// What the server refused in the last save or test, shown under the fields it names.
	const [problems, setProblems] = useState<string[]>([]);
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
	// overwrite edits typed meanwhile, and a test would report on settings that are no
	// longer the ones in the form.
	const busy = updateMutation.isPending || testMutation.isPending;
	const locked = readOnly || busy;
	const dirty = !sameForm(form, toForm(data)) || bindPassword.length > 0;
	const mode = securityModeOf(form);
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
			(form.startTls && !isLdaps(form.url)) !== data.startTls ||
			form.tlsRejectUnauthorized !== data.tlsRejectUnauthorized ||
			form.tlsCaCert.trim() !== data.tlsCaCert);
	const fieldError = (target: ProblemTarget): string | undefined => {
		const hits = problems.filter((p) => problemTarget(p) === target);
		return hits.length > 0 ? hits.map(problemText).join('; ') : undefined;
	};
	// Editing a field retires the complaint about it; the next Save or Test re-checks.
	const clearProblemsFor = (target: ProblemTarget) =>
		setProblems((current) => current.filter((p) => problemTarget(p) !== target));
	const set = <K extends keyof LdapForm>(key: K, value: LdapForm[K]) => {
		setForm({ ...form, [key]: value });
		clearProblemsFor(key);
	};
	const text = (key: keyof LdapForm) => ({
		id: `ldap-${key}`,
		value: form[key] as string,
		disabled: locked,
		'aria-invalid': fieldError(key) ? true : undefined,
		onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
			set(key, e.target.value as LdapForm[typeof key]),
	});

	const draftUpdate = (): UpdateLdapSettings => ({
		...toUpdate(form),
		// Empty field = keep the stored password; only a typed value replaces it.
		...(bindPassword.length > 0 ? { bindPassword } : {}),
	});

	const reportFailure = (title: string, e: unknown) => {
		const named = e instanceof LdapRequestError ? e.problems : [];
		setProblems(named);
		toast({
			title,
			description:
				named.length > 0 ? `Check the highlighted field${named.length > 1 ? 's' : ''}.` : (e as Error).message,
			variant: 'destructive',
		});
	};

	const save = async () => {
		const enabling = form.enabled && !data.enabled;
		try {
			const saved = await updateMutation.mutateAsync(draftUpdate());
			// Show what was stored: the server trims values (a pasted PEM's trailing
			// newline, blank group lines), and the form must not stay "unsaved" over that.
			const stored = toForm(saved);
			lastSynced.current = stored;
			setForm(stored);
			setBindPassword('');
			setTestResult(null);
			setProblems([]);
			toast({
				title: enabling
					? 'LDAP login enabled'
					: saved.enabled !== data.enabled
						? 'LDAP login disabled'
						: 'LDAP settings saved',
			});
		} catch (e) {
			reportFailure(enabling ? 'Cannot enable LDAP login yet' : 'Failed to save', e);
		}
	};

	const removePassword = async () => {
		try {
			await updateMutation.mutateAsync({ bindPassword: null, enabled: false });
			setBindPassword('');
			toast({ title: 'Password removed', description: 'LDAP login is off until a new one is saved.' });
		} catch (e) {
			reportFailure('Failed to remove the password', e);
		}
	};

	const runTest = async () => {
		setTestResult(null);
		const email = testEmail.trim();
		// Unsaved edits go along for the test only; the saved settings are tested otherwise.
		const draft = !readOnly && dirty;
		try {
			const result = await testMutation.mutateAsync({
				...(email ? { email } : {}),
				...(draft ? { settings: draftUpdate() } : {}),
			});
			setTestResult({ result, draft });
			setProblems([]);
		} catch (e) {
			reportFailure('Test could not run', e);
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

					{problems.length > 0 && (
						<div
							className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm space-y-1"
							role="alert"
						>
							<div className="font-medium flex items-center gap-1.5">
								<XCircle className="h-4 w-4 text-destructive shrink-0" /> The server refused these
								settings:
							</div>
							<ul className="list-disc pl-6 space-y-0.5 break-words">
								{problems.map((problem) => (
									<li key={problem}>{problem}</li>
								))}
							</ul>
						</div>
					)}

					<Card className="p-4 space-y-4">
						<h3 className="text-sm font-semibold">Connection</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<Field
								id="ldap-url"
								label="Server URL"
								hint="Host and port, e.g. ldaps://ldap.example.com:636. The scheme follows the security setting."
								error={fieldError('url')}
							>
								<Input placeholder="ldaps://ldap.example.com:636" {...text('url')} />
							</Field>
							<Field id="ldap-timeoutMs" label="Timeout (ms)" error={fieldError('timeoutMs')}>
								<Input type="number" min={500} max={60000} {...text('timeoutMs')} />
							</Field>
							<Field
								id="ldap-security"
								label="Connection security"
								hint={
									mode === 'ldaps'
										? 'TLS from the first byte, usually on port 636.'
										: mode === 'starttls'
											? 'Starts in clear on port 389, then upgrades to TLS before anything is sent.'
											: 'No encryption at all. Fine for a local test directory or an isolated network.'
								}
							>
								<Select
									value={mode}
									disabled={locked}
									onValueChange={(v) => {
										setForm(withSecurityMode(form, v as SecurityMode));
										clearProblemsFor('url');
									}}
								>
									<SelectTrigger id="ldap-security">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="ldaps">LDAPS (recommended)</SelectItem>
										<SelectItem value="starttls">StartTLS</SelectItem>
										<SelectItem value="none">None — unencrypted</SelectItem>
									</SelectContent>
								</Select>
							</Field>
						</div>
						{mode === 'none' && (
							<p className="text-xs text-amber-600 flex items-center gap-1">
								<AlertTriangle className="h-3 w-3" /> Passwords cross the network unencrypted. Use LDAPS
								or StartTLS for anything beyond a test setup.
							</p>
						)}
						{mode !== 'none' && (
							<>
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
										<AlertTriangle className="h-3 w-3" /> Only for testing: anyone on the network
										path could read passwords.
									</p>
								)}
								<Field
									id="ldap-tlsCaCert"
									label="CA certificate (optional)"
									hint="PEM of the CA that signed the directory's certificate, if it isn't publicly trusted."
									error={fieldError('tlsCaCert')}
								>
									<Textarea
										rows={3}
										className="font-mono text-xs"
										placeholder="-----BEGIN CERTIFICATE-----"
										{...text('tlsCaCert')}
									/>
								</Field>
							</>
						)}
					</Card>

					<Card className="p-4 space-y-4">
						<h3 className="text-sm font-semibold">Service account</h3>
						<p className="text-xs text-muted-foreground">
							A read-only directory account OpsiMate uses to find users and their groups. Leave both empty
							for an anonymous search.
						</p>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<Field id="ldap-bindDn" label="Bind DN" error={fieldError('bindDn')}>
								<Input placeholder="cn=opsimate,ou=service,dc=example,dc=com" {...text('bindDn')} />
							</Field>
							<Field
								id="ldap-bindPassword"
								label="Password"
								error={fieldError('bindPassword')}
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
										aria-invalid={fieldError('bindPassword') ? true : undefined}
										placeholder={
											data.hasBindPassword
												? '•••••••• (saved — type to replace it)'
												: 'Service account password'
										}
										value={bindPassword}
										onChange={(e) => {
											setBindPassword(e.target.value);
											clearProblemsFor('bindPassword');
										}}
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
							<Field id="ldap-searchBase" label="Search base" error={fieldError('searchBase')}>
								<Input placeholder="ou=people,dc=example,dc=com" {...text('searchBase')} />
							</Field>
							<Field
								id="ldap-searchFilter"
								label="Search filter"
								hint="{{email}} is replaced by the address typed at login. AD: (&(objectClass=user)(mail={{email}}))"
								error={fieldError('searchFilter')}
							>
								<Input {...text('searchFilter')} />
							</Field>
							<Field
								id="ldap-emailAttribute"
								label="Email attribute"
								error={fieldError('emailAttribute')}
							>
								<Input {...text('emailAttribute')} />
							</Field>
							<Field id="ldap-nameAttribute" label="Name attribute" error={fieldError('nameAttribute')}>
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
								error={fieldError('groupsAttribute')}
							>
								<Input {...text('groupsAttribute')} />
							</Field>
							<Field
								id="ldap-groupSearchBase"
								label="Group search base (optional)"
								hint="For directories without memberOf"
								error={fieldError('groupSearchBase')}
							>
								<Input placeholder="ou=groups,dc=example,dc=com" {...text('groupSearchBase')} />
							</Field>
							<Field
								id="ldap-groupSearchFilter"
								label="Group search filter"
								hint="{{dn}} = the user's DN"
								error={fieldError('groupSearchFilter')}
							>
								<Input {...text('groupSearchFilter')} />
							</Field>
						</div>
						<p className="text-xs text-muted-foreground">
							One group per line: a full DN (safest) or a bare group name. The highest matching role wins.
							A bare name matches any group with that name, so prefer full DNs for Admin.
						</p>
						{fieldError('roleMapping') && (
							<p className="text-xs text-destructive flex items-start gap-1" role="alert">
								<XCircle className="h-3 w-3 mt-0.5 shrink-0" /> {fieldError('roleMapping')}
							</p>
						)}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<Field id="ldap-adminGroups" label="Admin groups" error={fieldError('adminGroups')}>
								<Textarea rows={2} className="font-mono text-xs" {...text('adminGroups')} />
							</Field>
							<Field id="ldap-editorGroups" label="Editor groups" error={fieldError('editorGroups')}>
								<Textarea rows={2} className="font-mono text-xs" {...text('editorGroups')} />
							</Field>
							<Field
								id="ldap-operationGroups"
								label="Operation groups"
								error={fieldError('operationGroups')}
							>
								<Textarea rows={2} className="font-mono text-xs" {...text('operationGroups')} />
							</Field>
							<Field id="ldap-viewerGroups" label="Viewer groups" error={fieldError('viewerGroups')}>
								<Textarea rows={2} className="font-mono text-xs" {...text('viewerGroups')} />
							</Field>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<Field id="ldap-defaultRole" label="Everyone else" error={fieldError('defaultRole')}>
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
								error={fieldError('loginMaxFailures')}
							>
								<Input type="number" min={0} max={1000} {...text('loginMaxFailures')} />
							</Field>
						</div>
					</Card>

					<Card className="p-4 space-y-4">
						<h3 className="text-sm font-semibold">Test</h3>
						<p className="text-xs text-muted-foreground">
							Runs the same steps as a login against what is in the form right now — saved or not. With an
							email, it also shows the role that person would get.
						</p>
						<div className="flex flex-wrap items-end gap-2">
							<div className="flex-1 min-w-[14rem]">
								<Field id="ldap-testEmail" label="Test with a user (optional)">
									<Input
										id="ldap-testEmail"
										type="email"
										disabled={busy}
										placeholder="someone@example.com"
										value={testEmail}
										onChange={(e) => setTestEmail(e.target.value)}
									/>
								</Field>
							</div>
							<Button
								variant="outline"
								onClick={() => void runTest()}
								disabled={busy}
								className="gap-1.5"
							>
								{testMutation.isPending ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" /> Testing…
									</>
								) : (
									<>
										<PlugZap className="h-4 w-4" /> Test connection
									</>
								)}
							</Button>
						</div>
						{testMutation.isPending && (
							<p className="text-xs text-muted-foreground">
								Connecting to {form.url.trim() || 'the directory'}… this takes up to{' '}
								{Math.ceil((Number(form.timeoutMs) || 5000) / 1000)}s if the server does not answer.
							</p>
						)}
						{testResult && <TestResultView result={testResult.result} draft={testResult.draft} />}
					</Card>

					<Card className="p-4 space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-4">
							<div className="flex items-center gap-2">
								<Switch
									id="ldap-enabled"
									checked={form.enabled}
									disabled={locked}
									onCheckedChange={(v) => set('enabled', v)}
									aria-invalid={fieldError('enabled') ? true : undefined}
								/>
								<Label htmlFor="ldap-enabled" className="text-sm font-normal">
									{form.enabled ? 'LDAP login on' : 'LDAP login off'}
									{form.enabled !== data.enabled && (
										<span className="text-muted-foreground"> — takes effect on Save</span>
									)}
								</Label>
							</div>
							{!readOnly && (
								<Button
									onClick={() => void save()}
									disabled={busy || !dirty || needsPassword}
									title={needsPassword ? 'Re-enter the service-account password first' : undefined}
								>
									{updateMutation.isPending ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : form.enabled && !data.enabled ? (
										'Save & enable'
									) : (
										'Save'
									)}
								</Button>
							)}
						</div>
						{dirty && !readOnly && (
							<p className="text-xs text-muted-foreground">
								Unsaved changes. Saving applies them immediately — no restart needed.
							</p>
						)}
					</Card>
				</>
			)}
		</div>
	);
};
