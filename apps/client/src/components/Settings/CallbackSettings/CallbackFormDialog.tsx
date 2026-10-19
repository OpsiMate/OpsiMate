import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { TemplateVariablePicker } from '@/components/shared';
import { useToast } from '@/hooks/use-toast';
import { useCreateCallback, useTestCallback, useUpdateCallback } from '@/hooks/queries/callbacks';
import { AlertCallbackInput } from '@/lib/api';
import {
	ALERT_CALLBACK_EVENT_LABELS,
	ALERT_CALLBACK_EVENTS,
	ALERT_CALLBACK_TEMPLATE_VARIABLES,
	ALERT_TEMPLATE_VARIABLES,
	AlertCallback,
	AlertCallbackEvent,
	AlertCallbackMethod,
	AlertCallbackTestResult,
} from '@OpsiMate/shared';
import { CheckCircle2, Copy, KeyRound, Loader2, Plus, RefreshCw, Send, Trash2, XCircle } from 'lucide-react';
import { FormEvent, useId, useRef, useState } from 'react';
import {
	CallbackFormErrors,
	callbackFormErrors,
	HeaderRow,
	headersToRows,
	rowsToHeaders,
} from './CallbackSettings.utils';

export interface CallbackFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	// Editing an existing callback; absent = creating one.
	callback?: AlertCallback | null;
}

interface CallbackFormProps {
	callback?: AlertCallback | null;
	onCancel: () => void;
	// Saved. `secret` is set when this save produced one (create, or a rotation): the one
	// moment it can be copied.
	onSaved: (secret: string | undefined) => void;
}

interface SecretRevealProps {
	secret: string;
	rotated: boolean;
	onDone: () => void;
}

const METHODS: AlertCallbackMethod[] = ['POST', 'PUT'];

const TEMPLATE_VARIABLES = [...ALERT_CALLBACK_TEMPLATE_VARIABLES, ...ALERT_TEMPLATE_VARIABLES];

interface EventsPickerProps {
	selected: AlertCallbackEvent[];
	onChange: (events: AlertCallbackEvent[]) => void;
	error?: string;
}

const EventsPicker = ({ selected, onChange, error }: EventsPickerProps) => {
	const toggle = (event: AlertCallbackEvent, checked: boolean) => {
		onChange(checked ? [...selected, event] : selected.filter((e) => e !== event));
	};
	return (
		<fieldset className="space-y-2">
			<legend className="text-xs font-medium">Send on</legend>
			<div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
				{ALERT_CALLBACK_EVENTS.map((event) => (
					<label key={event} className="flex items-center gap-2 text-sm cursor-pointer">
						<Checkbox
							checked={selected.includes(event)}
							onCheckedChange={(checked) => toggle(event, checked === true)}
							aria-label={ALERT_CALLBACK_EVENT_LABELS[event]}
						/>
						{ALERT_CALLBACK_EVENT_LABELS[event]}
					</label>
				))}
			</div>
			<div className="flex gap-3 text-xs">
				<button
					type="button"
					className="text-muted-foreground underline-offset-2 hover:underline"
					onClick={() => onChange([...ALERT_CALLBACK_EVENTS])}
				>
					All
				</button>
				<button
					type="button"
					className="text-muted-foreground underline-offset-2 hover:underline"
					onClick={() => onChange([])}
				>
					None
				</button>
			</div>
			{error && (
				<p className="text-xs text-destructive" role="alert">
					{error}
				</p>
			)}
		</fieldset>
	);
};

// The secret a save just produced, shown once (rotated: it replaced an earlier one).
interface RevealedSecret {
	secret: string;
	rotated: boolean;
}

interface HeadersEditorProps {
	rows: HeaderRow[];
	onChange: (rows: HeaderRow[]) => void;
}

const HeadersEditor = ({ rows, onChange }: HeadersEditorProps) => (
	<div className="space-y-2">
		<div className="flex items-center justify-between">
			<Label className="text-xs">Headers</Label>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={() => onChange([...rows, { key: '', value: '' }])}
			>
				<Plus className="h-3.5 w-3.5 mr-1" /> Add
			</Button>
		</div>
		{rows.length === 0 ? (
			<p className="text-xs text-muted-foreground italic">
				No headers. Add one for the receiver&apos;s auth token, e.g. Authorization.
			</p>
		) : (
			<div className="space-y-2">
				{rows.map((row, idx) => (
					<div key={idx} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
						<Input
							placeholder="Header (e.g. Authorization)"
							aria-label={`Header ${idx + 1} name`}
							value={row.key}
							onChange={(e) =>
								onChange(rows.map((r, i) => (i === idx ? { ...r, key: e.target.value } : r)))
							}
						/>
						<span className="text-muted-foreground text-sm">:</span>
						<Input
							placeholder="Value"
							aria-label={`Header ${idx + 1} value`}
							value={row.value}
							onChange={(e) =>
								onChange(rows.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)))
							}
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-9 w-9"
							onClick={() => onChange(rows.filter((_, i) => i !== idx))}
							aria-label="Remove header"
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</div>
				))}
			</div>
		)}
	</div>
);

interface TestResultLineProps {
	result: AlertCallbackTestResult;
}

const TestResultLine = ({ result }: TestResultLineProps) => (
	<p
		className={`flex items-center gap-1.5 text-xs ${result.ok ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}
		role="status"
	>
		{result.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
		{result.message}
	</p>
);

const copyToClipboard = async (value: string, toast: ReturnType<typeof useToast>['toast']) => {
	try {
		await navigator.clipboard.writeText(value);
		toast({ title: 'Secret copied' });
	} catch {
		toast({
			title: 'Could not copy',
			description: 'Select the secret and copy it by hand.',
			variant: 'destructive',
		});
	}
};

// Shown once, right after a create or a rotation: the server never returns the secret
// again (list and get leave it out), so this is where it gets copied to the receiver.
const SecretReveal = ({ secret, rotated, onDone }: SecretRevealProps) => {
	const { toast } = useToast();
	const secretId = useId();
	return (
		<div className="space-y-5">
			<DialogHeader>
				<DialogTitle>Copy your signing secret</DialogTitle>
				<DialogDescription>
					{rotated
						? 'The secret was rotated. Requests are signed with the new one from now on, so update the receiver.'
						: 'The callback is saved.'}{' '}
					This is the only time the secret is shown — it is not stored anywhere you can read it back.
				</DialogDescription>
			</DialogHeader>
			<div className="space-y-2">
				<Label htmlFor={secretId} className="text-xs">
					Signing secret
				</Label>
				<div className="flex items-center gap-2">
					<Input id={secretId} value={secret} readOnly className="font-mono text-xs" />
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => void copyToClipboard(secret, toast)}
						aria-label="Copy secret"
					>
						<Copy className="h-3.5 w-3.5 mr-1" /> Copy
					</Button>
				</div>
				<p className="text-xs text-muted-foreground">
					The receiver checks X-OpsiMate-Signature = sha256=HMAC-SHA256(&quot;timestamp.body&quot;, secret).
					Lost it? Edit the callback and rotate.
				</p>
			</div>
			<DialogFooter>
				<Button type="button" onClick={onDone}>
					Done
				</Button>
			</DialogFooter>
		</div>
	);
};

// Lives inside DialogContent, which Radix unmounts on close, so every opening starts
// from the callback it was given (or blank).
const CallbackForm = ({ callback, onCancel, onSaved }: CallbackFormProps) => {
	const { toast } = useToast();
	const createMutation = useCreateCallback();
	const updateMutation = useUpdateCallback();
	const testMutation = useTestCallback();

	const [name, setName] = useState(callback?.name ?? '');
	const [url, setUrl] = useState(callback?.url ?? '');
	const [method, setMethod] = useState<AlertCallbackMethod>(callback?.method ?? 'POST');
	const [headerRows, setHeaderRows] = useState<HeaderRow[]>(headersToRows(callback?.headers));
	const [bodyTemplate, setBodyTemplate] = useState(callback?.bodyTemplate ?? '');
	const [events, setEvents] = useState<AlertCallbackEvent[]>(callback?.events ?? []);
	// Off by default: a callback sends nothing until an admin turns it on.
	const [enabled, setEnabled] = useState(callback?.enabled ?? false);
	// Only a typed secret is sent; otherwise the server keeps (or generates) one.
	const [secret, setSecret] = useState('');
	const [rotating, setRotating] = useState(false);
	const [errors, setErrors] = useState<CallbackFormErrors>({});
	const [testResult, setTestResult] = useState<AlertCallbackTestResult | null>(null);

	const nameId = useId();
	const urlId = useId();
	const methodId = useId();
	const bodyId = useId();
	const secretId = useId();
	const enabledId = useId();
	const bodyRef = useRef<HTMLTextAreaElement>(null);
	const urlRef = useRef<HTMLInputElement>(null);

	const isEditing = !!callback;
	const saving = createMutation.isPending || updateMutation.isPending;

	const buildPayload = (): AlertCallbackInput => ({
		name: name.trim(),
		url: url.trim(),
		method,
		headers: rowsToHeaders(headerRows),
		bodyTemplate: bodyTemplate.trim() ? bodyTemplate : null,
		events,
		enabled,
		...(secret.trim() ? { secret: secret.trim() } : {}),
	});

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		const nextErrors = callbackFormErrors({ name, url, events, headerRows, secret });
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) return;
		try {
			if (callback) {
				// The secret comes back only when this edit rotated it.
				const updated = await updateMutation.mutateAsync({ id: callback.id, payload: buildPayload() });
				toast({ title: 'Callback updated' });
				onSaved(updated.secret);
			} else {
				const created = await createMutation.mutateAsync(buildPayload());
				toast({
					title: 'Callback created',
					description: enabled ? 'It is on and will send from now.' : 'It is off until you turn it on.',
				});
				onSaved(created.secret);
			}
		} catch (error) {
			toast({
				title: isEditing ? 'Could not update callback' : 'Could not create callback',
				description: error instanceof Error ? error.message : undefined,
				variant: 'destructive',
			});
		}
	};

	const handleTest = async () => {
		const nextErrors = callbackFormErrors({
			name: name || 'test',
			url,
			events: events.length ? events : ['silenced'],
			headerRows,
			secret,
		});
		const { url: urlError, headers: headersError, secret: secretError } = nextErrors;
		setErrors((current) => ({ ...current, url: urlError, headers: headersError, secret: secretError }));
		if (urlError || headersError || secretError) return;
		setTestResult(null);
		try {
			const result = await testMutation.mutateAsync({
				url: url.trim(),
				method,
				headers: rowsToHeaders(headerRows),
				bodyTemplate: bodyTemplate.trim() ? bodyTemplate : null,
				// A typed secret signs the test; otherwise the server signs with the saved one
				// (the page cannot: it never sees it after creation).
				secret: secret.trim() || undefined,
				...(callback && !secret.trim() ? { callbackId: callback.id } : {}),
			});
			setTestResult(result);
		} catch (error) {
			setTestResult({ ok: false, message: error instanceof Error ? error.message : 'Test failed' });
		}
	};

	return (
		<form onSubmit={handleSubmit} noValidate className="space-y-5">
			<DialogHeader>
				<DialogTitle>{isEditing ? 'Edit callback' : 'New callback'}</DialogTitle>
				<DialogDescription>
					OpsiMate sends a request to this URL after someone changes an alert. The change is saved first; a
					slow or failing receiver never delays it.
				</DialogDescription>
			</DialogHeader>

			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor={nameId} className="text-xs">
						Name
					</Label>
					<Input
						id={nameId}
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g. Ticketing sync"
						aria-invalid={!!errors.name}
					/>
					{errors.name && (
						<p className="text-xs text-destructive" role="alert">
							{errors.name}
						</p>
					)}
				</div>

				<div className="grid grid-cols-[120px_1fr] gap-3">
					<div className="space-y-2">
						<Label htmlFor={methodId} className="text-xs">
							Method
						</Label>
						<Select value={method} onValueChange={(v) => setMethod(v as AlertCallbackMethod)}>
							<SelectTrigger id={methodId}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{METHODS.map((m) => (
									<SelectItem key={m} value={m}>
										{m}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor={urlId} className="text-xs">
							URL
						</Label>
						<Input
							id={urlId}
							ref={urlRef}
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							placeholder="https://example.com/opsimate/callback"
							aria-invalid={!!errors.url}
						/>
						{errors.url && (
							<p className="text-xs text-destructive" role="alert">
								{errors.url}
							</p>
						)}
					</div>
				</div>

				<EventsPicker selected={events} onChange={setEvents} error={errors.events} />

				<div className="space-y-1">
					<HeadersEditor rows={headerRows} onChange={setHeaderRows} />
					{errors.headers && (
						<p className="text-xs text-destructive" role="alert">
							{errors.headers}
						</p>
					)}
				</div>

				<div className="space-y-2">
					<Label htmlFor={bodyId} className="text-xs">
						Body template (optional)
					</Label>
					<Textarea
						id={bodyId}
						ref={bodyRef}
						value={bodyTemplate}
						onChange={(e) => setBodyTemplate(e.target.value)}
						placeholder={
							'Leave empty to send the JSON payload, or shape your own:\n{ "text": "{{event}}: {{name}} by {{actor.name}}" }'
						}
						rows={4}
						className="font-mono text-xs"
					/>
					<TemplateVariablePicker
						variables={TEMPLATE_VARIABLES}
						targets={[{ ref: bodyRef, value: bodyTemplate, onChange: setBodyTemplate }]}
						caption="Click to insert. {{payload}} is the whole JSON document; a bulk change lists every alert in it, the alert variables come from the first one."
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor={secretId} className="text-xs">
						Signing secret
					</Label>
					{isEditing && !rotating ? (
						<div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
							<p id={secretId} className="flex items-center gap-1.5 text-xs text-muted-foreground">
								<KeyRound className="h-3.5 w-3.5 shrink-0" /> A secret is set. It was shown once, when
								the callback was created or last rotated.
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="shrink-0"
								onClick={() => setRotating(true)}
							>
								<RefreshCw className="h-3.5 w-3.5 mr-1" /> Rotate
							</Button>
						</div>
					) : (
						<Input
							id={secretId}
							value={secret}
							onChange={(e) => setSecret(e.target.value)}
							placeholder={
								isEditing ? 'New secret (at least 8 characters)' : 'Leave empty to generate one'
							}
							className="font-mono text-xs"
							aria-invalid={!!errors.secret}
						/>
					)}
					{errors.secret && (
						<p className="text-xs text-destructive" role="alert">
							{errors.secret}
						</p>
					)}
					<p className="text-xs text-muted-foreground">
						Every request carries X-OpsiMate-Timestamp and X-OpsiMate-Signature:
						sha256=HMAC-SHA256(&quot;timestamp.body&quot;, secret), so the receiver can check it came from
						OpsiMate and is not a replay.
					</p>
				</div>

				<div className="flex items-center justify-between rounded-lg border p-3">
					<div>
						<Label htmlFor={enabledId} className="text-sm">
							Enabled
						</Label>
						<p className="text-xs text-muted-foreground">
							Off by default. Nothing is sent until this is on.
						</p>
					</div>
					<Switch id={enabledId} checked={enabled} onCheckedChange={setEnabled} />
				</div>

				{testResult && <TestResultLine result={testResult} />}
			</div>

			<DialogFooter className="gap-2 sm:justify-between">
				<Button
					type="button"
					variant="outline"
					onClick={handleTest}
					disabled={testMutation.isPending || saving}
				>
					{testMutation.isPending ? (
						<Loader2 className="h-4 w-4 mr-2 animate-spin" />
					) : (
						<Send className="h-4 w-4 mr-2" />
					)}
					Send test
				</Button>
				<div className="flex gap-2">
					<Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
						Cancel
					</Button>
					<Button type="submit" disabled={saving}>
						{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
						{isEditing ? 'Save' : 'Create'}
					</Button>
				</div>
			</DialogFooter>
		</form>
	);
};

export const CallbackFormDialog = ({ open, onOpenChange, callback }: CallbackFormDialogProps) => {
	// A save that produced a secret keeps the dialog open on the reveal step.
	const [revealed, setRevealed] = useState<RevealedSecret | null>(null);
	const close = () => {
		setRevealed(null);
		onOpenChange(false);
	};
	return (
		<Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				{revealed ? (
					<SecretReveal secret={revealed.secret} rotated={revealed.rotated} onDone={close} />
				) : (
					<CallbackForm
						callback={callback}
						onCancel={close}
						onSaved={(secret) => {
							if (secret) setRevealed({ secret, rotated: !!callback });
							else close();
						}}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
};
