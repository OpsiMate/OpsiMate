import { TextWithFlags } from '@/components/shared/TextWithFlags';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
	COLUMN_LABELS,
	GROUP_COUNT_BADGE_CLASSES,
	GROUP_STATUS_BADGE_CLASS,
	GROUP_STATUS_BADGE_VARIANT,
} from '../AlertsTable.constants';
import { FlatGroupItem } from '../AlertsTable.types';

interface GroupHeaderProps {
	item: FlatGroupItem;
	onToggle: (key: string) => void;
	columnLabels?: Record<string, string>;
}

export const GroupHeader = ({ item, onToggle, columnLabels = {} }: GroupHeaderProps) => {
	if (item.type !== 'group') return null;

	const fieldLabel = columnLabels[item.field] || COLUMN_LABELS[item.field] || item.field;

	return (
		<div
			// No backdrop-blur: these copies are pinned while the virtualized rows scroll
			// underneath, and backdrop-filter re-blurs that region every frame (several stack
			// when grouping is nested) — real scroll jank on integrated GPUs. It was also
			// vestigial: the opaque bg-background backing behind these copies is what the
			// filter would sample, so removing it leaves the bg-muted/50 look unchanged.
			className="flex items-center h-8 border-b bg-muted/50 hover:bg-muted/70 px-2 cursor-pointer"
			style={{ paddingLeft: `${item.level * 24 + 8}px` }}
			onClick={() => onToggle(item.key)}
		>
			<Button
				variant="ghost"
				size="icon"
				aria-expanded={item.isExpanded}
				aria-label={`${item.isExpanded ? 'Collapse' : 'Expand'} group ${fieldLabel}: ${item.value}`}
				className="h-6 w-6 p-0 mr-2 text-foreground hover:bg-muted hover:text-foreground"
			>
				{item.isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
			</Button>
			{/* Fixed-width count right after the chevron so the numbers align vertically
			    across groups regardless of how long each group's label is. */}
			<Badge
				variant={GROUP_STATUS_BADGE_VARIANT[item.groupStatus]}
				className={`${GROUP_COUNT_BADGE_CLASSES} mr-2 ${GROUP_STATUS_BADGE_CLASS[item.groupStatus]}`}
			>
				{item.count}
			</Badge>
			<span className="font-semibold text-sm mr-2 text-foreground">{fieldLabel}:</span>
			<span className="text-sm text-foreground/80">
				<TextWithFlags text={item.value} />
			</span>
		</div>
	);
};
