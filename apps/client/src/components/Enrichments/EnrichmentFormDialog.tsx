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
import { useAlerts } from '@/hooks/queries/alerts';
import { useCreateEnrichment, useUpdateEnrichment } from '@/hooks/queries/enrichments';
import { EnrichmentPayload } from '@/lib/api';
import { AlertEnrichment } from '@OpsiMate/shared';
import { Plus, Sparkles, Tag, Trash2, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type KeyValue = { key: string; value: string };

const DEFAULT_SUMMARY_TEMPLATE = '{{summary}}';

interface EnrichmentFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	enrichment?: AlertEnrichment | null;
	// When set (and not editing), opens a new rule pre-filled from this one ("copy from existing").
	duplicateFrom?: AlertEnrichment | null;
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

export const EnrichmentFormDialog = ({ open, onOpenChange, enrichment, duplicateFrom }: EnrichmentFormDialogProps) => {
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

	// Label keys present on current alerts, offered as insertable placeholders.
	const { data: alerts = [] } = useAlerts();
	const labelKeys = useMemo(() => {
		const keys = new Set<string>();
		alerts.forEach((a) => Object.keys(a.tags ?? {}).forEach((k) => keys.add(k)));
		return Array.from(keys).sort();
	}, [alerts]);

	const summaryRef = useRef<HTMLTextAreaElement>(null);

	// Insert a placeholder into the summary template at the cursor (replacing any selection),
	// then restore focus with the caret placed after the inserted text.
	const insertIntoSummary = (placeholder: string) => {
		const el = summaryRef.current;
		const start = el?.selectionStart ?? summaryTemplate.length;
		const end = el?.selectionEnd ?? summaryTemplate.length;
		const next = summaryTemplate.slice(0, start) + placeholder + summaryTemplate.slice(end);
		setSummaryTemplate(next);
		requestAnimationFrame(() => {
			if (!el) return;
			el.focus();
			const caret = start + placeholder.length;
			el.setSelectionRange(caret, caret);
		});
	};

	useEffect(() => {
		if (!open) return;
		// Editing loads the rule; "copy from existing" loads a source rule into a new draft.
		const source = enrichment ?? duplicateFrom;
		if (source) {
			setName(enrichment ? source.name : `${source.name} (copy)`);
			setNameContains(source.nameContains ?? '');
			setMatchers((source.labelMatchers ?? []).map((m) => ({ ...m })));
			setAddFields((source.addFields ?? []).map((f) => ({ ...f })));
			setSummaryTemplate(source.summaryTemplate ?? '');
			setPriority(String(source.priority ?? 0));
		} else {
			setName('');
			setNameContains('');
			setMatchers([]);
			setAddFields([]);
			// Pre-fill with {{summary}} so the user keeps the existing summary and appends to it.
			setSummaryTemplate(DEFAULT_SUMMARY_TEMPLATE);
			setPriority('0');
		}
	}, [open, enrichment, duplicateFrom]);

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
							valuePlaceholder="value (e.g. true or {{label.host}})"
							emptyText="No fields. Added as tags on the alert; existing keys are overridden."
							addLabel="Fields to add / override"
						/>
						<p className="text-xs text-muted-foreground -mt-2">
							A value can copy a label, e.g. <code className="text-[11px]">owner={'{{label.team}}'}</code>
							.
						</p>

						<div className="space-y-2">
							<Label htmlFor="enrichment-summary" className="text-xs">
								Summary template (optional)
							</Label>
							<Textarea
								ref={summaryRef}
								id="enrichment-summary"
								placeholder="e.g. {{summary}} — contact the help desk, the disk is full"
								value={summaryTemplate}
								onChange={(e) => setSummaryTemplate(e.target.value)}
								rows={3}
							/>
							<p className="text-xs text-muted-foreground">
								Replaces the alert summary. Use {'{{summary}}'} for the current summary, plus{' '}
								{'{{name}}'}, {'{{status}}'}, and any label as {'{{label.<key>}}'}. New lines and basic
								HTML ({'<b>'}, {'<a>'}, lists) are rendered in the alert details.
							</p>
						</div>

						{labelKeys.length > 0 && (
							<div className="space-y-1.5">
								<p className="text-xs text-muted-foreground">
									Available labels (click to insert a placeholder):
								</p>
								<div className="flex flex-wrap gap-1.5">
									{labelKeys.map((key) => {
										const placeholder = `{{label.${key}}}`;
										return (
											<button
												key={key}
												type="button"
												onClick={() => insertIntoSummary(placeholder)}
												className="px-2 py-0.5 rounded-full border bg-background hover:bg-muted text-[11px] font-mono"
												title={`Insert ${placeholder}`}
											>
												{placeholder}
											</button>
										);
									})}
								</div>
							</div>
						)}
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
