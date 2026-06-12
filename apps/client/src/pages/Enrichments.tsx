import { DashboardLayout } from '@/components/DashboardLayout';
import { EnrichmentFormDialog } from '@/components/Enrichments/EnrichmentFormDialog';
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
import { useDeleteEnrichment, useEnrichments } from '@/hooks/queries/enrichments';
import { AlertEnrichment } from '@OpsiMate/shared';
import { FileText, Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

const MatchBadges = ({ enrichment }: { enrichment: AlertEnrichment }) => (
	<div className="flex flex-wrap gap-1.5">
		{enrichment.nameContains && (
			<Badge variant="secondary" className="font-mono text-xs">
				name ~ "{enrichment.nameContains}"
			</Badge>
		)}
		{(enrichment.labelMatchers ?? []).map((m, idx) => (
			<Badge key={idx} variant="outline" className="font-mono text-xs">
				{m.key}={m.value}
			</Badge>
		))}
		{!enrichment.nameContains && (enrichment.labelMatchers ?? []).length === 0 && (
			<span className="text-xs text-muted-foreground italic">no matchers</span>
		)}
	</div>
);

const EffectBadges = ({ enrichment }: { enrichment: AlertEnrichment }) => (
	<div className="flex flex-wrap gap-1.5">
		{(enrichment.addFields ?? []).map((f, idx) => (
			<Badge
				key={idx}
				variant="outline"
				className="font-mono text-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
			>
				+{f.key}={f.value}
			</Badge>
		))}
		{enrichment.summaryTemplate && (
			<Badge
				variant="outline"
				className="text-xs bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 max-w-[260px]"
			>
				<FileText className="h-3 w-3 mr-1 flex-shrink-0" />
				<span className="truncate">summary: {enrichment.summaryTemplate}</span>
			</Badge>
		)}
	</div>
);

const Enrichments: React.FC = () => {
	const { data: enrichments = [], isLoading } = useEnrichments();
	const deleteMutation = useDeleteEnrichment();
	const { toast } = useToast();

	const [search, setSearch] = useState('');
	const [editing, setEditing] = useState<AlertEnrichment | null>(null);
	const [creating, setCreating] = useState(false);
	const [deleting, setDeleting] = useState<AlertEnrichment | null>(null);

	const filtered = useMemo(() => {
		// Display in execution order: highest priority first, ties by creation order.
		const ranked = [...enrichments].sort((a, b) => b.priority - a.priority || a.id - b.id);
		if (!search.trim()) return ranked;
		const q = search.toLowerCase();
		return ranked.filter((e) => {
			if (e.name.toLowerCase().includes(q)) return true;
			if (e.nameContains?.toLowerCase().includes(q)) return true;
			if (e.summaryTemplate?.toLowerCase().includes(q)) return true;
			if (e.labelMatchers?.some((m) => m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q)))
				return true;
			return e.addFields?.some((f) => f.key.toLowerCase().includes(q) || f.value.toLowerCase().includes(q));
		});
	}, [enrichments, search]);

	const handleDelete = async () => {
		if (!deleting) return;
		try {
			await deleteMutation.mutateAsync(deleting.id);
			toast({ title: 'Enrichment deleted', description: deleting.name });
			setDeleting(null);
		} catch (err) {
			toast({
				title: 'Failed to delete enrichment',
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
							<Sparkles className="h-6 w-6 text-muted-foreground" />
							<h1 className="text-2xl font-semibold tracking-tight">Enrichment</h1>
						</div>
						<p className="text-sm text-muted-foreground mt-1">
							Automatically add fields or rewrite the summary of matching alerts — e.g. tag every "Disk"
							alert with disk_alert=true and append help-desk instructions to its summary. Rules run in
							priority order (highest first); on conflicts the higher-priority rule wins.
						</p>
					</div>
					<Button onClick={() => setCreating(true)}>
						<Plus className="h-4 w-4 mr-1" /> New enrichment
					</Button>
				</div>

				<Card>
					<CardContent className="p-0">
						<div className="flex items-center gap-2 p-4 border-b">
							<div className="relative flex-1 max-w-md">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									className="pl-9"
									placeholder="Search by name, match, or field"
									value={search}
									onChange={(e) => setSearch(e.target.value)}
								/>
							</div>
							<div className="ml-auto text-xs text-muted-foreground">
								{filtered.length} of {enrichments.length}
							</div>
						</div>

						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead className="w-[90px]">Priority</TableHead>
									<TableHead>Match</TableHead>
									<TableHead>Enrichment</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
											Loading enrichments…
										</TableCell>
									</TableRow>
								) : filtered.length === 0 ? (
									<TableRow>
										<TableCell colSpan={5} className="py-12">
											<div className="flex flex-col items-center gap-2 text-center">
												<div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
													<Sparkles className="h-6 w-6 text-muted-foreground" />
												</div>
												<p className="font-medium">
													{enrichments.length === 0
														? 'No enrichments yet'
														: 'No enrichments match your search'}
												</p>
												<p className="text-sm text-muted-foreground max-w-sm">
													{enrichments.length === 0
														? 'Create a rule to automatically add fields or rewrite summaries on matching alerts.'
														: 'Try a different search term.'}
												</p>
												{enrichments.length === 0 && (
													<Button
														className="mt-2"
														onClick={() => setCreating(true)}
														size="sm"
													>
														<Plus className="h-4 w-4 mr-1" /> New enrichment
													</Button>
												)}
											</div>
										</TableCell>
									</TableRow>
								) : (
									filtered.map((e) => (
										<TableRow key={e.id} className="align-top">
											<TableCell className="max-w-[220px]">
												<div className="font-medium truncate">{e.name}</div>
											</TableCell>
											<TableCell>
												<Badge variant="secondary" className="font-mono text-xs">
													{e.priority}
												</Badge>
											</TableCell>
											<TableCell className="max-w-[260px]">
												<MatchBadges enrichment={e} />
											</TableCell>
											<TableCell className="max-w-[340px]">
												<EffectBadges enrichment={e} />
											</TableCell>
											<TableCell className="text-right">
												<div className="flex items-center justify-end gap-1">
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8"
														onClick={() => setEditing(e)}
														aria-label="Edit enrichment"
													>
														<Pencil className="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8 text-destructive hover:text-destructive"
														onClick={() => setDeleting(e)}
														aria-label="Delete enrichment"
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

			<EnrichmentFormDialog open={creating} onOpenChange={setCreating} />
			<EnrichmentFormDialog
				open={!!editing}
				onOpenChange={(open) => {
					if (!open) setEditing(null);
				}}
				enrichment={editing}
			/>

			<AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete enrichment?</AlertDialogTitle>
						<AlertDialogDescription>
							This will remove "{deleting?.name}". Matching alerts will immediately stop being enriched.
							This cannot be undone.
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

export default Enrichments;
