import { ActionFormDialog } from '@/components/Actions/ActionFormDialog';
import { DashboardLayout } from '@/components/DashboardLayout';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useActions, useDeleteAction, useTestAction } from '@/hooks/queries/actions';
import {
	Action,
	ActionType,
	HttpActionConfig,
	JiraActionConfig,
	SlackActionConfig,
	TeamsActionConfig,
} from '@OpsiMate/shared';
import { Globe, Loader2, MessageSquare, Pencil, Play, Plus, Search, Ticket, Trash2, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';

const TYPE_META: Record<
	ActionType,
	{ label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
	slack: {
		label: 'Slack',
		icon: MessageSquare,
		tone: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30',
	},
	teams: {
		label: 'Teams',
		icon: MessageSquare,
		tone: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
	},
	jira: {
		label: 'Jira',
		icon: Ticket,
		tone: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30',
	},
	http: {
		label: 'HTTP',
		icon: Globe,
		tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
	},
};

const TypeBadge = ({ type }: { type: ActionType }) => {
	const meta = TYPE_META[type];
	const Icon = meta.icon;
	return (
		<Badge variant="outline" className={meta.tone}>
			<Icon className="h-3 w-3 mr-1" /> {meta.label}
		</Badge>
	);
};

const AppliesTo = ({ action }: { action: Action }) => {
	const hasName = !!action.nameContains && action.nameContains.trim().length > 0;
	const matchers = action.labelMatchers ?? [];
	if (!hasName && matchers.length === 0) {
		return (
			<Badge variant="secondary" className="text-xs">
				All alerts
			</Badge>
		);
	}
	return (
		<div className="flex flex-wrap gap-1">
			{hasName && (
				<Badge variant="outline" className="font-mono text-xs">
					name ~ "{action.nameContains}"
				</Badge>
			)}
			{matchers.map((m, idx) => (
				<Badge key={idx} variant="outline" className="font-mono text-xs">
					{m.key}={m.value}
				</Badge>
			))}
		</div>
	);
};

const summarize = (action: Action): string => {
	switch (action.type) {
		case 'slack': {
			const cfg = action.config as SlackActionConfig;
			return cfg.channel ? `→ ${cfg.channel}` : 'Slack webhook';
		}
		case 'teams':
			return (action.config as TeamsActionConfig).webhookUrl ? 'Teams webhook' : '—';
		case 'jira': {
			const cfg = action.config as JiraActionConfig;
			return `${cfg.projectKey} · ${cfg.issueType}`;
		}
		case 'http': {
			const cfg = action.config as HttpActionConfig;
			return `${cfg.method} ${cfg.url}`;
		}
		default:
			return '—';
	}
};

const Actions: React.FC = () => {
	const { data: actions = [], isLoading } = useActions();
	const deleteMutation = useDeleteAction();
	const testMutation = useTestAction();
	const { toast } = useToast();

	const [search, setSearch] = useState('');
	const [editing, setEditing] = useState<Action | null>(null);
	const [creating, setCreating] = useState(false);
	const [deleting, setDeleting] = useState<Action | null>(null);
	const [testingId, setTestingId] = useState<number | null>(null);

	const handleTest = async (a: Action) => {
		setTestingId(a.id);
		try {
			const result = await testMutation.mutateAsync({ name: a.name, type: a.type, config: a.config });
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
		} finally {
			setTestingId(null);
		}
	};

	const filtered = useMemo(() => {
		if (!search.trim()) return actions;
		const q = search.toLowerCase();
		return actions.filter(
			(a) =>
				a.name.toLowerCase().includes(q) ||
				a.type.toLowerCase().includes(q) ||
				summarize(a).toLowerCase().includes(q)
		);
	}, [actions, search]);

	const handleDelete = async () => {
		if (!deleting) return;
		try {
			await deleteMutation.mutateAsync(deleting.id);
			toast({ title: 'Action deleted', description: deleting.name });
			setDeleting(null);
		} catch (err) {
			toast({
				title: 'Failed to delete action',
				description: err instanceof Error ? err.message : 'Unknown error',
				variant: 'destructive',
			});
		}
	};

	return (
		<DashboardLayout>
			<div className="container max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
					<div>
						<div className="flex items-center gap-2">
							<Zap className="h-6 w-6 text-muted-foreground" />
							<h1 className="text-2xl font-semibold tracking-tight">Actions</h1>
						</div>
						<p className="text-sm text-muted-foreground mt-1">
							Configure reusable actions — send a Slack or Teams message, open a Jira ticket, or fire an
							HTTP request. You'll be able to run these against alerts from the alert view.
						</p>
					</div>
					<Button onClick={() => setCreating(true)}>
						<Plus className="h-4 w-4 mr-1" /> New action
					</Button>
				</div>

				<Card>
					<CardContent className="p-0">
						<div className="flex items-center gap-2 p-4 border-b">
							<div className="relative flex-1 max-w-md">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									className="pl-9"
									placeholder="Search by name, type, or target"
									value={search}
									onChange={(e) => setSearch(e.target.value)}
								/>
							</div>
							<div className="ml-auto text-xs text-muted-foreground">
								{filtered.length} of {actions.length}
							</div>
						</div>

						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Target</TableHead>
									<TableHead>Applies to</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
											Loading actions…
										</TableCell>
									</TableRow>
								) : filtered.length === 0 ? (
									<TableRow>
										<TableCell colSpan={5} className="py-12">
											<div className="flex flex-col items-center gap-2 text-center">
												<div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
													<Zap className="h-6 w-6 text-muted-foreground" />
												</div>
												<p className="font-medium">
													{actions.length === 0
														? 'No actions yet'
														: 'No actions match your search'}
												</p>
												<p className="text-sm text-muted-foreground max-w-sm">
													{actions.length === 0
														? 'Create an action to notify a channel, open a ticket, or call an external service when an alert fires.'
														: 'Try a different search term.'}
												</p>
												{actions.length === 0 && (
													<Button
														className="mt-2"
														onClick={() => setCreating(true)}
														size="sm"
													>
														<Plus className="h-4 w-4 mr-1" /> New action
													</Button>
												)}
											</div>
										</TableCell>
									</TableRow>
								) : (
									filtered.map((a) => (
										<TableRow key={a.id} className="align-top">
											<TableCell className="max-w-[260px]">
												<div className="font-medium truncate">{a.name}</div>
											</TableCell>
											<TableCell>
												<TypeBadge type={a.type} />
											</TableCell>
											<TableCell className="max-w-[320px]">
												<span className="text-xs font-mono text-muted-foreground truncate block">
													{summarize(a)}
												</span>
											</TableCell>
											<TableCell className="max-w-[240px]">
												<AppliesTo action={a} />
											</TableCell>
											<TableCell className="text-right">
												<div className="flex items-center justify-end gap-1">
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8"
														onClick={() => handleTest(a)}
														disabled={testingId === a.id}
														aria-label="Test action"
														title="Run a test with sample alert data"
													>
														{testingId === a.id ? (
															<Loader2 className="h-4 w-4 animate-spin" />
														) : (
															<Play className="h-4 w-4" />
														)}
													</Button>
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8"
														onClick={() => setEditing(a)}
														aria-label="Edit action"
													>
														<Pencil className="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8 text-destructive hover:text-destructive"
														onClick={() => setDeleting(a)}
														aria-label="Delete action"
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</div>

			<ActionFormDialog open={creating} onOpenChange={setCreating} />
			<ActionFormDialog
				open={!!editing}
				onOpenChange={(open) => {
					if (!open) setEditing(null);
				}}
				action={editing}
			/>

			<AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete action?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently remove "{deleting?.name}". This cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={(e) => {
								e.preventDefault();
								handleDelete();
							}}
							disabled={deleteMutation.isPending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{deleteMutation.isPending ? 'Deleting…' : 'Delete'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</DashboardLayout>
	);
};

export default Actions;
