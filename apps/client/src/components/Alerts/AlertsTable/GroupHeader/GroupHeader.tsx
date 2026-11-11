import { TextWithFlags } from '@/components/shared/TextWithFlags';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
	COLUMN_LABELS,
	GROUP_COUNT_BADGE_CLASSES,
	GROUP_STATUS_BADGE_CLASS,
	GROUP_STATUS_BADGE_VARIANT,
	MemberSelectionState,
} from '../AlertsTable.constants';
import { MemberCheckbox } from '../MemberCheckbox';
import { FlatGroupItem } from '../AlertsTable.types';
import { INDENT_PER_LEVEL_PX } from './GroupHeader.constants';
import { groupCheckboxText, groupCountLabel, groupLabels } from './GroupHeader.utils';

interface GroupHeaderProps {
	item: FlatGroupItem;
	onToggle: (key: string) => void;
	columnLabels?: Record<string, string>;
	// How many of the group's alerts are selected; undefined hides the checkbox (no selection on this table).
	selectionState?: MemberSelectionState;
	// The group checkbox: select every alert in the group, or unselect them all.
	onToggleSelection?: () => void;
}

// Layout: without a checkbox cell the chevron takes the select column's padding; with
// one, nesting indents the content after the cell, never the cell itself. The count
// badge has a fixed width so the numbers align down the table whatever the labels'
// lengths. The header bar has no backdrop-blur: its sticky copies are pinned while the virtualized
// rows scroll underneath, and backdrop-filter re-blurs that region every frame (several
// stack when grouping is nested) — real scroll jank on integrated GPUs. It was also
// vestigial: the opaque bg-background backing behind those copies is what the filter
// would sample, so without it the bg-muted/50 look is unchanged.

export const GroupHeader = ({
	item,
	onToggle,
	columnLabels = {},
	selectionState,
	onToggleSelection,
}: GroupHeaderProps) => {
	if (item.type !== 'group') return null;

	const { fieldLabel, groupLabel } = groupLabels(item, columnLabels, COLUMN_LABELS);
	const checkbox = groupCheckboxText(item, groupLabel);

	return (
		<div
			className={cn(
				'flex items-center h-8 border-b bg-muted/50 hover:bg-muted/70 pr-2 cursor-pointer',
				selectionState === undefined && 'pl-2'
			)}
			onClick={() => onToggle(item.key)}
			data-selection-scope
		>
			{selectionState !== undefined && (
				<MemberCheckbox
					state={selectionState}
					labels={checkbox.labels}
					title={checkbox.title}
					onToggle={onToggleSelection}
				/>
			)}
			<div className="flex min-w-0 items-center" style={{ paddingLeft: `${item.level * INDENT_PER_LEVEL_PX}px` }}>
				<Button
					variant="ghost"
					size="icon"
					aria-expanded={item.isExpanded}
					aria-label={`${item.isExpanded ? 'Collapse' : 'Expand'} group ${groupLabel}`}
					className="h-6 w-6 p-0 mr-2 text-foreground hover:bg-muted hover:text-foreground"
				>
					{item.isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
				</Button>
				<Badge
					variant={GROUP_STATUS_BADGE_VARIANT[item.groupStatus]}
					className={`${GROUP_COUNT_BADGE_CLASSES} mr-2 ${GROUP_STATUS_BADGE_CLASS[item.groupStatus]}`}
				>
					{groupCountLabel(item)}
				</Badge>
				<span className="font-semibold text-sm mr-2 text-foreground">{fieldLabel}:</span>
				<span className="text-sm text-foreground/80">
					<TextWithFlags text={item.value} />
				</span>
			</div>
		</div>
	);
};
