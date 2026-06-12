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
import { useCreateEnrichment, useUpdateEnrichment } from '@/hooks/queries/enrichments';
import { EnrichmentPayload } from '@/lib/api';
import { AlertEnrichment } from '@OpsiMate/shared';
import { Plus, Sparkles, Tag, Trash2, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type KeyValue = { key: string; value: string };

interface EnrichmentFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	enrichment?: AlertEnrichment | null;
}

const KeyValueRows = ({
	rows,
	onChange,
	keyPlaceholder,
	valuePlaceholder,
	emptyText,
	addLabel,
}: {
	rows: KeyValue[];
	onChange: (rows: KeyValue[]) => void;
	keyPlaceholder: string;
	valuePlaceholder: string;
	emptyText: string;
	addLabel: string;
}) => (
	<div className="space-y-2">
		<div className="flex items-center justify-between">
			<Label className="text-xs">{addLabel}</Label>
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
			<p className="text-xs text-muted-foreground italic">{emptyText}</p>
		) : (
			<div className="space-y-2">
				{rows.map((row, idx) => (
					<div key={idx} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
						<Input
							placeholder={keyPlaceholder}
							value={row.key}
							onChange={(e) =>
								onChange(rows.map((r, i) => (i === idx ? { ...r, key: e.target.value } : r)))
							}
						/>
						<span className="text-muted-foreground text-sm">=</span>
						<Input
							placeholder={valuePlaceholder}
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
							aria-label="Remove row"
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</div>
				))}
			</div>
		)}
	</div>
);

export const EnrichmentFormDialog = ({ open, onOpenChange, enrichment }: EnrichmentFormDialogProps) => {
	const isEdit = !!enrichment;
	const { toast } = useToast();
	const createMutation = useCreateEnrichment();
	const updateMutation = useUpdateEnrichment();

	const [name, setName] = useState('');
	const [nameContains, setNameContains] = useState('');
	const [matchers, setMatchers] = useState<KeyValue[]>([]);
	const [addFields, setAddFields] = useState<KeyValue[]>([]);
	const [summaryTemplate, setSummaryTemplate] = useState('');
	const [priority, setPriority] = useState('0');

	useEffect(() => {
		if (!open) return;
		if (enrichment) {
			setName(enrichment.name);
			setNameContains(enrichment.nameContains ?? '');
			setMatchers((enrichment.labelMatchers ?? []).map((m) => ({ ...m })));
			setAddFields((enrichment.addFields ?? []).map((f) => ({ ...f })));
			setSummaryTemplate(enrichment.summaryTemplate ?? '');
			setPriority(String(enrichment.priority ?? 0));
		} else {
			setName('');
			setNameContains('');
			setMatchers([]);
			setAddFields([]);
			setSummaryTemplate('');
			setPriority('0');
		}
	}, [open, enrichment]);

	const isValid = useMemo(() => {
		if (!name.trim()) return false;
		const hasNameMatcher = nameContains.trim().length > 0;
		const hasLabelMatchers = matchers.some((m) => m.key.trim() && m.value.trim());
		if (!hasNameMatcher && !hasLabelMatchers) return false;
		const hasFields = addFields.some((f) => f.key.trim() && f.value.trim());
		const hasSummary = summaryTemplate.trim().length > 0;
		return hasFields || hasSummary;
	}, [name, nameContains, matchers, addFields, summaryTemplate]);

	const submit = async () => {
		const clean = (rows: KeyValue[]) =>
			rows.map((r) => ({ key: r.key.trim(), value: r.value.trim() })).filter((r) => r.key && r.value);

		const payload: EnrichmentPayload = {
			name: name.trim(),
			nameContains: nameContains.trim() || null,
			labelMatchers: clean(matchers),
			addFields: clean(addFields),
			summaryTemplate: summaryTemplate.trim() || null,
			priority: Math.max(0, Math.min(1000, parseInt(priority, 10) || 0)),
		};

		try {
			if (isEdit && enrichment) {
				await updateMutation.mutateAsync({ id: enrichment.id, payload });
				toast({ title: 'Enrichment updated', description: payload.name });
			} else {
				await createMutation.mutateAsync(payload);
				toast({ title: 'Enrichment created', description: payload.name });
			}
			onOpenChange(false);
		} catch (err) {
			toast({
				title: isEdit ? 'Failed to update enrichment' : 'Failed to create enrichment',
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
						<Sparkles className="h-5 w-5 text-muted-foreground" />
						{isEdit ? 'Edit enrichment' : 'New enrichment'}
					</DialogTitle>
					<DialogDescription>
						Automatically add fields or rewrite the summary of alerts that match the criteria below. Applied
						live whenever alerts are fetched.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-5 py-2">
					<div className="grid grid-cols-[1fr_140px] gap-4">
						<div className="space-y-2">
							<Label htmlFor="enrichment-name">Name</Label>
							<Input
								id="enrichment-name"
								placeholder="e.g. Tag disk alerts"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="enrichment-priority">Priority</Label>
							<Input
								id="enrichment-priority"
								type="number"
								min={0}
								max={1000}
								value={priority}
								onChange={(e) => setPriority(e.target.value)}
							/>
						</div>
					</div>
					<p className="text-xs text-muted-foreground -mt-3">
						When an alert matches several rules, they run from the highest priority to the lowest (e.g.
						priority 10 runs before 7). If two rules set the same field, the higher-priority rule wins;
						summary templates chain in that order, each seeing the previous result.
					</p>

					<div className="rounded-lg border bg-muted/30 p-4 space-y-4">
						<div className="flex items-center gap-2">
							<Tag className="h-4 w-4 text-muted-foreground" />
							<h4 className="text-sm font-semibold">Match criteria</h4>
						</div>
						<p className="text-xs text-muted-foreground -mt-2">
							An alert is enriched when its name matches and ALL labels match. At least one criterion is
							required.
						</p>

						<div className="space-y-2">
							<Label htmlFor="enrichment-nameContains" className="text-xs">
								Alert name contains
							</Label>
							<Input
								id="enrichment-nameContains"
								placeholder="e.g. Disk, HighCPU, prod-db"
								value={nameContains}
								onChange={(e) => setNameContains(e.target.value)}
							/>
						</div>

						<KeyValueRows
							rows={matchers}
							onChange={setMatchers}
							keyPlaceholder="key (e.g. severity)"
							valuePlaceholder="value (e.g. critical)"
							emptyText="No label matchers. Use these to scope by environment, service, severity, etc."
							addLabel="Label matchers (key = value)"
						/>
					</div>

					<div className="rounded-lg border bg-muted/30 p-4 space-y-4">
						<div className="flex items-center gap-2">
							<Wand2 className="h-4 w-4 text-muted-foreground" />
							<h4 className="text-sm font-semibold">Enrichment</h4>
						</div>
						<p className="text-xs text-muted-foreground -mt-2">
							What to change on matching alerts. At least one field or a summary template is required.
						</p>

						<KeyValueRows
							rows={addFields}
							onChange={setAddFields}
							keyPlaceholder="field (e.g. disk_alert)"
							valuePlaceholder="value (e.g. true)"
							emptyText="No fields. Added as tags on the alert; existing keys are overridden."
							addLabel="Fields to add / override"
						/>

						<div className="space-y-2">
							<Label htmlFor="enrichment-summary" className="text-xs">
								Summary template (optional)
							</Label>
							<Textarea
								id="enrichment-summary"
								placeholder="e.g. {{summary}} — contact the help desk, the disk is full"
								value={summaryTemplate}
								onChange={(e) => setSummaryTemplate(e.target.value)}
								rows={3}
							/>
							<p className="text-xs text-muted-foreground">
								Replaces the alert summary. Use {'{{summary}}'} for the current summary, plus{' '}
								{'{{name}}'} and {'{{status}}'}. New lines and basic HTML ({'<b>'}, {'<a>'}, lists) are
								rendered in the alert details.
							</p>
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
						Cancel
					</Button>
					<Button onClick={submit} disabled={!isValid || isPending}>
						{isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create enrichment'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
