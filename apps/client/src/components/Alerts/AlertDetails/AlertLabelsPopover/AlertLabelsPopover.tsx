import { TextWithFlags } from '@/components/shared/TextWithFlags';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert } from '@OpsiMate/shared';
import { Tag } from 'lucide-react';
import { getAlertTagEntries } from '../../utils/alertTags.utils';

interface AlertLabelsPopoverProps {
	alert: Alert;
}

const chipClass = 'max-w-full rounded-md px-1.5 py-0 text-[11px] leading-5 font-normal text-muted-foreground';

// Labels stay out of the way until asked for: a tag icon with the label count sits in the
// owner row's indicator group, and clicking it opens a popover with the alert id and every
// label as chips. Label colors are reserved for the alerts table columns.
export const AlertLabelsPopover = ({ alert }: AlertLabelsPopoverProps) => {
	const entries = getAlertTagEntries(alert);
	const label = entries.length === 1 ? '1 label' : `${entries.length} labels`;

	return (
		<Popover>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<button
							type="button"
							aria-label={`Labels: ${label}. Opens the alert id and labels`}
							className="inline-flex items-center gap-0.5 shrink-0 rounded text-muted-foreground hover:text-foreground transition-colors"
						>
							<Tag className="h-3.5 w-3.5" aria-hidden />
							<span className="text-[11px] leading-none tabular-nums">{entries.length}</span>
						</button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent>{label}</TooltipContent>
			</Tooltip>
			<PopoverContent align="end" className="w-80 max-w-[90vw] p-3">
				<div className="flex items-center gap-1 flex-wrap">
					{/* The alert id first — what webhook senders key on to re-fire or resolve. Same
					    look as a label, dashed so it doesn't read as a tag the source sent; one
					    click selects the value for copying. */}
					<Badge
						variant="outline"
						className={`${chipClass} border-dashed`}
						title="Alert ID — click the value to select it"
					>
						<span className="break-all">
							<span className="font-medium text-foreground">id</span>:{' '}
							<span className="select-all font-mono">{alert.id}</span>
						</span>
					</Badge>
					{entries.map(({ key, value }) => (
						<Badge key={key} variant="outline" className={chipClass}>
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
