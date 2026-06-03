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
import { Action, ActionOverrides, ActionPreview, ActionType, Alert } from '@OpsiMate/shared';
import { Globe, Loader2, Send } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ActionSendDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	action: Action | null;
	alert: Alert;
}

const LOGO_SRC: Partial<Record<ActionType, string>> = {
	slack: 'images/logos/slack.svg',
	teams: 'images/logos/teams.svg',
	jira: 'images/logos/jira.svg',
};

const TypeLogo = ({ type, className }: { type: ActionType; className?: string }) => {
	const src = LOGO_SRC[type];
	if (src) return <img src={src} alt={type} className={className ?? 'h-5 w-5 object-contain'} />;
	return <Globe className={className ?? 'h-5 w-5 text-muted-foreground'} />;
};

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
					setBody(p.body);
				}
			})
			.catch((err) => setError(err instanceof Error ? err.message : 'Failed to build preview'));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, action?.id]);

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

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{action && <TypeLogo type={action.type} />}
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
