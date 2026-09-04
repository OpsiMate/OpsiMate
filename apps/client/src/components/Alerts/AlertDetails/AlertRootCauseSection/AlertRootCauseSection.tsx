import { useAlertRootCause, useRateRootCause } from '@/hooks/queries/rootCause';
import { formatRelativeTime } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { RootCauseRating } from '@OpsiMate/shared';
import { SearchCheck, ThumbsDown, ThumbsUp } from 'lucide-react';
import { CollapsibleSection } from '../CollapsibleSection';

interface AlertRootCauseSectionProps {
	alertId: string;
}

interface RatingButtonProps {
	rating: RootCauseRating;
	active: boolean;
	disabled: boolean;
	onRate: (rating: RootCauseRating) => void;
}

const RatingButton = ({ rating, active, disabled, onRate }: RatingButtonProps) => {
	const Icon = rating === 'up' ? ThumbsUp : ThumbsDown;
	return (
		<button
			type="button"
			aria-label={rating === 'up' ? 'Rate root cause helpful' : 'Rate root cause unhelpful'}
			aria-pressed={active}
			disabled={disabled}
			onClick={() => onRate(rating)}
			className={cn(
				'rounded p-1 transition-colors hover:bg-muted disabled:opacity-50',
				active
					? rating === 'up'
						? 'text-emerald-600 dark:text-emerald-400'
						: 'text-red-600 dark:text-red-400'
					: 'text-muted-foreground hover:text-foreground'
			)}
		>
			<Icon className={cn('h-3.5 w-3.5', active && 'fill-current')} />
		</button>
	);
};

// Root-cause analysis for one alert, fetched ON OPEN of the drawer — never through the
// polled list payloads (the analysis can be kilobytes; see the alert_root_causes table
// notes). Shows the pushed analysis with 👍/👎: the verdict is stored server-side (and
// relayed to the sender's feedback callback when one was provided), so the section
// renders who rated and when across sessions.
export const AlertRootCauseSection = ({ alertId }: AlertRootCauseSectionProps) => {
	const { data: rootCause, isLoading } = useAlertRootCause(alertId);
	const rate = useRateRootCause();

	// No section at all while empty: most alerts will never have an analysis, and a
	// permanent "no root cause yet" row would be drawer noise. (Phase 2's AI agent
	// will re-introduce an empty state carrying the Generate button.)
	if (isLoading || !rootCause) return null;

	const onRate = (rating: RootCauseRating) => {
		if (rate.isPending || rootCause.rating === rating) return;
		rate.mutate({ alertId, rating });
	};

	return (
		<CollapsibleSection title="Root cause" icon={<SearchCheck className="h-3.5 w-3.5" />} defaultOpen>
			<div className="rounded-lg border bg-muted/30 p-3 space-y-2">
				<p className="text-sm text-foreground whitespace-pre-wrap wrap-break-word">{rootCause.content}</p>
				<div className="flex items-center justify-between gap-2 border-t pt-2">
					<span className="text-xs text-muted-foreground">
						{rootCause.source === 'ai' ? 'AI analysis' : 'via API'} ·{' '}
						{formatRelativeTime(rootCause.updatedAt)}
					</span>
					<div className="flex items-center gap-1">
						{rootCause.rating && rootCause.ratedBy && (
							<span className="text-xs text-muted-foreground mr-1">
								rated by {rootCause.ratedBy} {formatRelativeTime(rootCause.ratedAt)}
							</span>
						)}
						<RatingButton
							rating="up"
							active={rootCause.rating === 'up'}
							disabled={rate.isPending}
							onRate={onRate}
						/>
						<RatingButton
							rating="down"
							active={rootCause.rating === 'down'}
							disabled={rate.isPending}
							onRate={onRate}
						/>
					</div>
				</div>
			</div>
		</CollapsibleSection>
	);
};
