import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { getLabelMatcherGroups, MatcherCriteria } from '@OpsiMate/shared';
import { Fragment } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export type MatcherRow = { key: string; value: string };

interface MatcherGroupsEditorProps {
	// OR groups of AND matchers: the entity matches when ANY group fully matches.
	groups: MatcherRow[][];
	onChange: (groups: MatcherRow[][]) => void;
	keyPlaceholder?: string;
	valuePlaceholder?: string;
	emptyText?: string;
	disabled?: boolean;
}

// Grouped label-matcher editor shared by mute policies, enrichments, and actions.
// Within a box every row must match (AND); boxes are alternatives (OR). Removing a
// group's last row removes the group.
export const MatcherGroupsEditor = ({
	groups,
	onChange,
	keyPlaceholder = 'key (e.g. env)',
	valuePlaceholder = 'value (e.g. prod)',
	emptyText = 'No label matchers. Use these to scope by environment, service, severity, etc.',
	disabled = false,
}: MatcherGroupsEditorProps) => {
	const updateRow = (groupIdx: number, rowIdx: number, patch: Partial<MatcherRow>) =>
		onChange(
			groups.map((group, gi) =>
				gi === groupIdx ? group.map((row, ri) => (ri === rowIdx ? { ...row, ...patch } : row)) : group
			)
		);

	const removeRow = (groupIdx: number, rowIdx: number) =>
		onChange(
			groups
				.map((group, gi) => (gi === groupIdx ? group.filter((_, ri) => ri !== rowIdx) : group))
				.filter((group) => group.length > 0)
		);

	const addRow = (groupIdx: number) =>
		onChange(groups.map((group, gi) => (gi === groupIdx ? [...group, { key: '', value: '' }] : group)));

	return (
		<div className={cn('space-y-2', disabled && 'opacity-50 pointer-events-none')}>
			<div className="flex items-center justify-between">
				<Label className="text-xs">Label matchers (key = value)</Label>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() =>
						groups.length === 0 ? onChange([[{ key: '', value: '' }]]) : addRow(groups.length - 1)
					}
				>
					<Plus className="h-3.5 w-3.5 mr-1" /> Add
				</Button>
			</div>
			{groups.length === 0 ? (
				<p className="text-xs text-muted-foreground italic">{emptyText}</p>
			) : (
				<div className="space-y-2">
					{groups.map((group, groupIdx) => (
						<div key={groupIdx}>
							{groupIdx > 0 && (
								<div className="flex items-center gap-2 py-1" aria-hidden>
									<div className="h-px flex-1 bg-border" />
									<span className="text-[10px] font-semibold text-muted-foreground tracking-wide">
										OR
									</span>
									<div className="h-px flex-1 bg-border" />
								</div>
							)}
							<div className="rounded-md border bg-background/50 p-2 space-y-2">
								{group.map((row, rowIdx) => (
									<div key={rowIdx} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
										<Input
											placeholder={keyPlaceholder}
											value={row.key}
											onChange={(e) => updateRow(groupIdx, rowIdx, { key: e.target.value })}
										/>
										<span className="text-muted-foreground text-sm">=</span>
										<Input
											placeholder={valuePlaceholder}
											value={row.value}
											onChange={(e) => updateRow(groupIdx, rowIdx, { value: e.target.value })}
										/>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="h-9 w-9"
											onClick={() => removeRow(groupIdx, rowIdx)}
											aria-label="Remove matcher"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								))}
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-7 text-xs text-muted-foreground"
									onClick={() => addRow(groupIdx)}
								>
									<Plus className="h-3 w-3 mr-1" /> AND matcher
								</Button>
							</div>
						</div>
					))}
				</div>
			)}
			{groups.length > 0 && (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="w-full text-xs"
					onClick={() => onChange([...groups, [{ key: '', value: '' }]])}
				>
					<Plus className="h-3.5 w-3.5 mr-1" /> OR group
				</Button>
			)}
			{groups.length > 1 && (
				<p className="text-xs text-muted-foreground">
					Matches when ANY group matches; within a group every matcher must match.
				</p>
			)}
		</div>
	);
};

// Cleans editor state for submission: trims, drops incomplete rows and empty groups.
export const cleanMatcherGroups = (groups: MatcherRow[][]): MatcherRow[][] =>
	groups
		.map((group) =>
			group.map((m) => ({ key: m.key.trim(), value: m.value.trim() })).filter((m) => m.key && m.value)
		)
		.filter((group) => group.length > 0);

// List-page badges for an entity's matcher groups: k=v badges per group, an OR chip
// between groups. Callers render their own name-contains / match-all / empty badges.
export const MatcherGroupBadges = ({ criteria }: { criteria: MatcherCriteria }) => {
	const groups = getLabelMatcherGroups(criteria);
	return (
		<>
			{groups.map((group, groupIdx) => (
				<Fragment key={groupIdx}>
					{groupIdx > 0 && (
						<span className="text-[10px] font-semibold text-muted-foreground self-center">OR</span>
					)}
					{group.map((m, idx) => (
						<Badge
							key={`${groupIdx}-${idx}`}
							variant="outline"
							className="font-mono text-xs max-w-full whitespace-normal break-all rounded-md"
						>
							{m.key}={m.value}
						</Badge>
					))}
				</Fragment>
			))}
		</>
	);
};

// True when the entity has any complete matcher (used by the pages' empty-state checks).
export const hasMatcherCriteria = (criteria: MatcherCriteria): boolean => getLabelMatcherGroups(criteria).length > 0;
