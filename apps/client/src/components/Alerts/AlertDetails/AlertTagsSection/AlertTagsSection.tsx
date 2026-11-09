import { TextWithFlags } from '@/components/shared/TextWithFlags';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@OpsiMate/shared';
import { useContext, useEffect, useRef, useState } from 'react';
import { getAlertTagEntries } from '../../utils/alertTags.utils';
import { SectionsExpandContext } from '../CollapsibleSection';

interface AlertTagsSectionProps {
	alert: Alert;
}

// How many label chips show before the rest fold behind a "+N" chip. Six fits two short
// rows in the default panel width, enough to read an alert's shape at a glance.
const MAX_VISIBLE_TAGS = 6;

const chipClass = 'max-w-full rounded-md px-1.5 py-0 text-[11px] leading-5 font-normal text-muted-foreground';

// The alert's id and labels (tags) as a compact, always-visible strip of small chips right
// under the identity block. Label colors are reserved for the alerts table columns. Beyond
// MAX_VISIBLE_TAGS the rest fold behind a "+N" chip that expands in place, so a heavily
// labelled alert never pushes the sections below it off screen.
export const AlertTagsSection = ({ alert }: AlertTagsSectionProps) => {
	const [showAll, setShowAll] = useState(false);

	// A new alert starts folded, like the panel starts on Details: the previous alert's
	// "show all" is not a preference, it was about that alert's labels.
	useEffect(() => {
		setShowAll(false);
	}, [alert.id]);

	// "Expand all" / "Collapse all" in the panel header unfold or fold the strip too, so
	// the controls still reach every label. Only broadcasts fired after mount count.
	const signal = useContext(SectionsExpandContext);
	const lastToken = useRef(signal?.token);
	useEffect(() => {
		if (signal && signal.token !== lastToken.current) {
			lastToken.current = signal.token;
			setShowAll(signal.open);
		}
	}, [signal]);

	const entries = getAlertTagEntries(alert);
	const hidden = Math.max(0, entries.length - MAX_VISIBLE_TAGS);
	const visible = showAll ? entries : entries.slice(0, MAX_VISIBLE_TAGS);

	return (
		<div className="flex items-center gap-1 flex-wrap">
			{/* The alert id first — what webhook senders key on to re-fire or resolve. Same
			    look as a label, dashed so it doesn't read as a tag the source sent; one
			    click selects the (full, untruncated) value for copying. */}
			<Badge
				variant="outline"
				className={`${chipClass} border-dashed max-w-[14rem]`}
				title={`Alert ID: ${alert.id} — click the value to select it`}
			>
				<span className="truncate">
					<span className="font-medium text-foreground">id</span>:{' '}
					<span className="select-all font-mono">{alert.id}</span>
				</span>
			</Badge>
			{visible.map(({ key, value }) => (
				<Badge key={key} variant="outline" className={chipClass}>
					{/* Single text-flow span so long values wrap inside the chip instead of
					    splitting key/colon/value into separate flex items. break-all handles
					    unbroken tokens like URLs and pod names. */}
					<span className="break-all">
						<span className="font-medium text-foreground">{key}</span>: <TextWithFlags text={value} />
					</span>
				</Badge>
			))}
			{hidden > 0 && (
				<button
					type="button"
					onClick={() => setShowAll((v) => !v)}
					aria-expanded={showAll}
					className="rounded-md border border-border px-1.5 text-[11px] leading-5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
				>
					{showAll ? 'Show less' : `+${hidden} more`}
				</button>
			)}
		</div>
	);
};
