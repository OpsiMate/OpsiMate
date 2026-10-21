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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { usePreviewAction, useRunAction } from '@/hooks/queries/actions';
import { Action, ActionOverrides, ActionPreview, Alert, HttpActionConfig } from '@OpsiMate/shared';
import { Loader2, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ActionTypeIcon } from '@/components/Actions/ActionTypeIcon';
import { SendFieldsForm } from './SendFieldsForm';
import { getAtPath, setAtPath } from '@/lib/jsonFields';

// A chosen field whose variable this alert has no value for ({{label.priority}} with no
// such tag) renders as that placeholder, literally. The sender is about to type it in,
// so it starts empty rather than making them delete the braces first.
const clearUnresolvedFields = (body: string, action: Action): string => {
	const fields = action.type === 'http' ? ((action.config as HttpActionConfig).editableFields ?? []) : [];
	if (fields.length === 0) return body;
	let parsed: unknown;
	try {
		parsed = JSON.parse(body) as unknown;
	} catch {
		return body;
	}
	let changed = false;
	for (const field of fields) {
		const value = getAtPath(parsed, field.path);
		if (typeof value === 'string' && /^\{\{\s*[\w.]+\s*\}\}$/.test(value)) {
			parsed = setAtPath(parsed, field.path, '');
			changed = true;
		}
	}
	return changed ? JSON.stringify(parsed, null, 2) : body;
};

interface ActionSendDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	action: Action | null;
	alert: Alert;
}

const hostOf = (url: string): string => {
	try {
		return new URL(url).host;
	} catch {
		return url;
	}
};

export const ActionSendDialog = ({ open, onOpenChange, action, alert }: ActionSendDialogProps) => {
	const { toast } = useToast();
	const previewMutation = usePreviewAction();
	const runMutation = useRunAction();

	const [preview, setPreview] = useState<ActionPreview | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Editable fields (only the relevant ones are used per action type)
	const [message, setMessage] = useState('');
	const [title, setTitle] = useState('');
	const [summary, setSummary] = useState('');
	const [description, setDescription] = useState('');
	const [body, setBody] = useState('');

	useEffect(() => {
		if (!open || !action) return;
		setPreview(null);
		setError(null);
		previewMutation
			.mutateAsync({ id: action.id, alert })
			.then((p) => {
				setPreview(p);
				if (p.type === 'slack') {
					setMessage(p.message);
				} else if (p.type === 'teams') {
					setTitle(p.title);
					setMessage(p.message);
				} else if (p.type === 'jira') {
					setSummary(p.summary);
					setDescription(p.description);
				} else if (p.type === 'http') {
					setBody(clearUnresolvedFields(p.body, action));
				}
			})
			.catch((err) => setError(err instanceof Error ? err.message : 'Failed to build preview'));
		// previewMutation is stable; re-run when the dialog opens or the target action/alert changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, action?.id, alert?.id]);

	const buildOverrides = (): ActionOverrides => {
		if (!preview) return {};
		switch (preview.type) {
			case 'slack':
				return { message };
			case 'teams':
				return { title, message };
			case 'jira':
				return { summary, description };
			case 'http':
				return { body };
			default:
				return {};
		}
	};

	const handleSend = async () => {
		if (!action) return;
		try {
			const result = await runMutation.mutateAsync({ id: action.id, alert, overrides: buildOverrides() });
			toast({
				title: result.ok ? `${action.name} sent` : `${action.name} failed`,
				description: result.message,
				variant: result.ok ? undefined : 'destructive',
			});
			if (result.ok) onOpenChange(false);
		} catch (err) {
			toast({
				title: `${action.name} failed`,
				description: err instanceof Error ? err.message : 'Unknown error',
				variant: 'destructive',
			});
		}
	};

	const isLoading = previewMutation.isPending && !preview;
	const sendsWithoutWaiting = action?.type === 'http' && !!(action.config as HttpActionConfig).fireAndForget;
	// The author marked fields the sender may change: show just those, prefilled from the
	// rendered JSON, and send the body with the edits written in. Falls back to the raw body
	// when the rendered request is not JSON after all.
	const editableFields = action?.type === 'http' ? ((action.config as HttpActionConfig).editableFields ?? []) : [];
	const parseBody = (text: string): unknown => {
		try {
			return JSON.parse(text) as unknown;
		} catch {
			return undefined;
		}
	};
	const parsedBody = useMemo(
		(): unknown => (editableFields.length === 0 ? undefined : parseBody(body)),
		[body, editableFields.length]
	);
	const renderedBody = useMemo(
		(): unknown => (preview?.type === 'http' && editableFields.length > 0 ? parseBody(preview.body) : undefined),
		[preview, editableFields.length]
	);
	const fieldsForm = parsedBody !== undefined && parsedBody !== null && typeof parsedBody === 'object';

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{action && <ActionTypeIcon type={action.type} className="h-5 w-5" />}
						{action?.name ?? 'Run action'}
					</DialogTitle>
					<DialogDescription>Review and edit the message below before sending.</DialogDescription>
				</DialogHeader>

				{isLoading ? (
					<div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
						<Loader2 className="h-4 w-4 animate-spin" /> Building preview…
					</div>
				) : error ? (
					<div className="py-6 text-sm text-destructive">{error}</div>
				) : preview ? (
					<div className="space-y-4 py-1">
						{preview.type === 'slack' && (
							<>
								<DestinationRow label="Destination">
									Slack{preview.channel ? ` · ${preview.channel}` : ''} ({hostOf(preview.webhookUrl)})
								</DestinationRow>
								<div className="space-y-2">
									<Label htmlFor="send-message">Message</Label>
									<Textarea
										id="send-message"
										value={message}
										onChange={(e) => setMessage(e.target.value)}
										rows={6}
									/>
								</div>
							</>
						)}

						{preview.type === 'teams' && (
							<>
								<DestinationRow label="Destination">
									Microsoft Teams ({hostOf(preview.webhookUrl)})
								</DestinationRow>
								<div className="space-y-2">
									<Label htmlFor="send-title">Title</Label>
									<Input id="send-title" value={title} onChange={(e) => setTitle(e.target.value)} />
								</div>
								<div className="space-y-2">
									<Label htmlFor="send-message">Message</Label>
									<Textarea
										id="send-message"
										value={message}
										onChange={(e) => setMessage(e.target.value)}
										rows={6}
									/>
								</div>
							</>
						)}

						{preview.type === 'jira' && (
							<>
								<DestinationRow label="Project">
									{preview.projectKey} · {preview.issueType} ({hostOf(preview.baseUrl)})
								</DestinationRow>
								<div className="space-y-2">
									<Label htmlFor="send-summary">Summary</Label>
									<Input
										id="send-summary"
										value={summary}
										onChange={(e) => setSummary(e.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="send-description">Description</Label>
									<Textarea
										id="send-description"
										value={description}
										onChange={(e) => setDescription(e.target.value)}
										rows={6}
										placeholder="Optional description"
									/>
								</div>
							</>
						)}

						{preview.type === 'http' && (
							<>
								<DestinationRow label="Request">
									<span className="font-mono text-xs">
										{preview.method} {preview.url}
									</span>
								</DestinationRow>
								{sendsWithoutWaiting && (
									<p className="text-xs text-muted-foreground">
										This action doesn't wait for a response: Send reports success once the request
										is out, whatever the receiver answers later.
									</p>
								)}
								{fieldsForm ? (
									<SendFieldsForm
										body={parsedBody}
										original={renderedBody}
										fields={editableFields}
										onChange={(next) => setBody(JSON.stringify(next, null, 2))}
									/>
								) : (
									<div className="space-y-2">
										<Label htmlFor="send-body">Request body</Label>
										<Textarea
											id="send-body"
											value={body}
											onChange={(e) => setBody(e.target.value)}
											rows={8}
											className="font-mono text-xs"
										/>
									</div>
								)}
							</>
						)}
					</div>
				) : null}

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={runMutation.isPending}>
						Cancel
					</Button>
					<Button onClick={handleSend} disabled={isLoading || !!error || !preview || runMutation.isPending}>
						{runMutation.isPending ? (
							<Loader2 className="h-4 w-4 mr-1 animate-spin" />
						) : (
							<Send className="h-4 w-4 mr-1" />
						)}
						Send
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

const DestinationRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
	<div className="flex items-start gap-2 text-sm">
		<span className="text-muted-foreground min-w-[80px]">{label}</span>
		<span className="text-foreground break-all">{children}</span>
	</div>
);
