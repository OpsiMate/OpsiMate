import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cleanMatcherGroups, MatcherGroupsEditor } from '@/components/shared/MatcherGroupsEditor';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAlerts } from '@/hooks/queries/alerts';
import { useCreateEnrichment, useUpdateEnrichment } from '@/hooks/queries/enrichments';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EnrichmentPayload } from '@/lib/api';
import { AlertEnrichment, AlertLink } from '@OpsiMate/shared';
import { Plus, Sparkles, Tag, Trash2, Wand2 } from 'lucide-react';
import { AlertLinkIcon } from '@/components/Alerts/AlertLinkIcon';
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

// Icon slugs offered for enrichment links — the integration icon set plus "no icon".
const LINK_ICON_OPTIONS: { value: string; label: string }[] = [
	{ value: '', label: 'No icon' },
	{ value: 'grafana', label: 'Grafana' },
	{ value: 'uptimekuma', label: 'Uptime Kuma' },
	{ value: 'gcp', label: 'Google Cloud' },
	{ value: 'datadog', label: 'Datadog' },
	{ value: 'zabbix', label: 'Zabbix' },
	{ value: 'custom', label: 'Bell' },
];

// Radix Select can't carry an empty-string item value; stand in for "no icon".
const NO_ICON = '__none__';

const LinkRows = ({ rows, onChange }: { rows: AlertLink[]; onChange: (rows: AlertLink[]) => void }) => (
	<div className="space-y-2">
		<div className="flex items-center justify-between">
			<Label className="text-xs">Links to add</Label>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={() => onChange([...rows, { label: '', icon: '', url: '' }])}
			>
				<Plus className="h-3.5 w-3.5 mr-1" /> Add
			</Button>
		</div>
		{rows.length === 0 ? (
			<p className="text-xs text-muted-foreground italic">
				No links. Added as buttons in the alert&apos;s Links section, next to its existing links.
			</p>
		) : (
			<div className="space-y-2">
				{rows.map((row, idx) => (
					<div key={idx} className="grid grid-cols-[1fr_130px_1.5fr_auto] items-center gap-2">
						<Input
							placeholder="label (e.g. Dashboard)"
							value={row.label}
							onChange={(e) =>
								onChange(rows.map((r, i) => (i === idx ? { ...r, label: e.target.value } : r)))
							}
						/>
						<Select
							value={row.icon || NO_ICON}
							onValueChange={(value) =>
								onChange(
									rows.map((r, i) => (i === idx ? { ...r, icon: value === NO_ICON ? '' : value } : r))
								)
							}
						>
							<SelectTrigger className="h-9">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{LINK_ICON_OPTIONS.map((opt) => (
									<SelectItem key={opt.value || NO_ICON} value={opt.value || NO_ICON}>
										<span className="flex items-center gap-2">
											<AlertLinkIcon icon={opt.value} className="h-3.5 w-3.5" />
											{opt.label}
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Input
							placeholder="url (e.g. https://grafana/d/{{label.host}})"
							value={row.url}
							onChange={(e) =>
								onChange(rows.map((r, i) => (i === idx ? { ...r, url: e.target.value } : r)))
							}
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-9 w-9"
							onClick={() => onChange(rows.filter((_, i) => i !== idx))}
							aria-label="Remove link"
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
	const [matcherGroups, setMatcherGroups] = useState<KeyValue[][]>([]);
	const [matchAll, setMatchAll] = useState(false);
	const [addFields, setAddFields] = useState<KeyValue[]>([]);
	const [addLinks, setAddLinks] = useState<AlertLink[]>([]);
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
	// then restore focus with the caret placed after the inserted text. When the textarea
	// isn't focused its selection is 0, so append at the end instead of the start.
	const insertIntoSummary = (placeholder: string) => {
		const el = summaryRef.current;
		const isFocused = el != null && document.activeElement === el;
		const start = isFocused ? el.selectionStart : summaryTemplate.length;
		const end = isFocused ? el.selectionEnd : summaryTemplate.length;
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
			setMatcherGroups(
				source.labelMatcherGroups?.length
					? source.labelMatcherGroups.map((g) => g.map((m) => ({ ...m })))
					: (source.labelMatchers ?? []).length
						? [(source.labelMatchers ?? []).map((m) => ({ ...m }))]
						: []
			);
			setMatchAll(!!source.matchAll);
			setAddFields((source.addFields ?? []).map((f) => ({ ...f })));
			setAddLinks((source.addLinks ?? []).map((l) => ({ ...l })));
			setSummaryTemplate(source.summaryTemplate ?? '');
			setPriority(String(source.priority ?? 0));
		} else {
			setName('');
			setNameContains('');
			setMatcherGroups([]);
			setMatchAll(false);
			setAddFields([]);
			setAddLinks([]);
			// Pre-fill with {{summary}} so the user keeps the existing summary and appends to it.
			setSummaryTemplate(DEFAULT_SUMMARY_TEMPLATE);
			setPriority('0');
		}
	}, [open, enrichment, duplicateFrom]);

	const isValid = useMemo(() => {
		if (!name.trim()) return false;
		const hasNameMatcher = nameContains.trim().length > 0;
		const hasLabelMatchers = matcherGroups.some((g) => g.some((m) => m.key.trim() && m.value.trim()));
		if (!matchAll && !hasNameMatcher && !hasLabelMatchers) return false;
		const hasFields = addFields.some((f) => f.key.trim() && f.value.trim());
		const hasLinks = addLinks.some((l) => l.label.trim() && l.url.trim());
		const hasSummary = summaryTemplate.trim().length > 0;
		return hasFields || hasLinks || hasSummary;
	}, [name, nameContains, matcherGroups, matchAll, addFields, addLinks, summaryTemplate]);

	const submit = async () => {
		const clean = (rows: KeyValue[]) =>
			rows.map((r) => ({ key: r.key.trim(), value: r.value.trim() })).filter((r) => r.key && r.value);

		const cleanedGroups = matchAll ? [] : cleanMatcherGroups(matcherGroups);
		const payload: EnrichmentPayload = {
			name: name.trim(),
			nameContains: matchAll ? null : nameContains.trim() || null,
			labelMatchers: cleanedGroups[0] ?? [],
			labelMatcherGroups: cleanedGroups,
			matchAll,
			addFields: clean(addFields),
			addLinks: addLinks
				.map((l) => ({ label: l.label.trim(), icon: (l.icon ?? '').trim(), url: l.url.trim() }))
				.filter((l) => l.label && l.url),
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
						Automatically add fields, links, or rewrite the summary of alerts that match the criteria below.
						Applied live whenever alerts are fetched.
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
							An alert is enriched when its name matches and any matcher group matches. At least one
							criterion (or match-all) is required.
						</p>

						<label className="flex items-center gap-2 cursor-pointer">
							<Checkbox checked={matchAll} onCheckedChange={(v) => setMatchAll(v === true)} />
							<span className="text-xs font-medium">
								Apply to all alerts (ignore name and label criteria)
							</span>
						</label>

						<div className={matchAll ? 'space-y-2 opacity-50 pointer-events-none' : 'space-y-2'}>
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

						<MatcherGroupsEditor
							groups={matcherGroups}
							onChange={setMatcherGroups}
							keyPlaceholder="key (e.g. severity)"
							valuePlaceholder="value (e.g. critical)"
							disabled={matchAll}
						/>
					</div>

					<div className="rounded-lg border bg-muted/30 p-4 space-y-4">
						<div className="flex items-center gap-2">
							<Wand2 className="h-4 w-4 text-muted-foreground" />
							<h4 className="text-sm font-semibold">Enrichment</h4>
						</div>
						<p className="text-xs text-muted-foreground -mt-2">
							What to change on matching alerts. At least one field, link, or summary template is
							required.
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

						<LinkRows rows={addLinks} onChange={setAddLinks} />
						<p className="text-xs text-muted-foreground -mt-2">
							Label and URL accept the same placeholders, e.g.{' '}
							<code className="text-[11px]">https://grafana.example.com/d/{'{{label.host}}'}</code>.
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
												// Keep focus in the textarea so the caret position is preserved
												// and the placeholder inserts where the user was typing.
												onMouseDown={(e) => e.preventDefault()}
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
