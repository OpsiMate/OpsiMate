import { TextWithFlags } from '@/components/shared/TextWithFlags';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert } from '@OpsiMate/shared';
import { Tag } from 'lucide-react';
import { getAlertTagEntries } from '../../utils/alertTags.utils';
import {
	CHIP_CLASS,
	ID_CHIP_KEY,
	ID_CHIP_TITLE,
	LABELS_CHIPS_TEST_ID,
	POPOVER_ARIA_LABEL,
	labelsCountText,
	labelsTriggerAriaLabel,
} from './AlertLabelsPopover.constants';

interface AlertLabelsPopoverProps {
	alert: Alert;
}

// Labels stay out of the way until asked for: a tag icon with the label count sits in the
// owner row's indicator group, and clicking it opens a popover with the alert id and every
// label as chips. Label colors are reserved for the alerts table columns.
export const AlertLabelsPopover = ({ alert }: AlertLabelsPopoverProps) => {
	const entries = getAlertTagEntries(alert);
	const label = labelsCountText(entries.length);

	return (
		<Popover>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<button
							type="button"
							aria-label={labelsTriggerAriaLabel(entries.length)}
							className="inline-flex items-center gap-0.5 shrink-0 rounded text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
						>
							<Tag className="h-3.5 w-3.5" aria-hidden />
							<span className="text-[11px] leading-none tabular-nums">{entries.length}</span>
						</button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent>{label}</TooltipContent>
			</Tooltip>
			{/* Named for screen readers (the trigger's label names the button, not the dialog) and
			    capped to the space Radix reports below/above the trigger so a long label list
			    scrolls inside the popover instead of running off screen. */}
			<PopoverContent
				align="end"
				aria-label={POPOVER_ARIA_LABEL}
				className="w-80 max-w-[90vw] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-3"
			>
				<div className="flex items-center gap-1 flex-wrap" data-testid={LABELS_CHIPS_TEST_ID}>
					{/* The alert id first — what webhook senders key on to re-fire or resolve. Same
					    look as a label, dashed so it doesn't read as a tag the source sent; one
					    click selects the value for copying. */}
					<Badge variant="outline" className={`${CHIP_CLASS} border-dashed`} title={ID_CHIP_TITLE}>
						<span className="break-all">
							<span className="font-medium text-foreground">{ID_CHIP_KEY}</span>:{' '}
							<span className="select-all font-mono">{alert.id}</span>
						</span>
					</Badge>
					{entries.map(({ key, value }) => (
						<Badge key={key} variant="outline" className={CHIP_CLASS}>
							{/* Single text-flow span so long values wrap inside the chip instead of
							    splitting key/colon/value into separate flex items. break-all handles
							    unbroken tokens like URLs and pod names. */}
							<span className="break-all">
								<span className="font-medium text-foreground">{key}</span>:{' '}
								<TextWithFlags text={value} />
							</span>
						</Badge>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
};
