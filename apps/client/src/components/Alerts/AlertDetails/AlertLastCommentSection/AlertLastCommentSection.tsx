import { useAlertComments } from '@/hooks/queries/alertComments';
import { useUsers } from '@/hooks/queries/users';
import { MessageSquare } from 'lucide-react';
import { useMemo } from 'react';
import { CollapsibleSection } from '../CollapsibleSection';

interface AlertLastCommentSectionProps {
	alertId: string;
	// Switches the panel to the Comments tab; omitted in container variants without tabs.
	onViewAll?: () => void;
}

const relativeTime = (iso: string): string => {
	const diff = Date.now() - new Date(iso).getTime();
	const m = Math.floor(diff / 60000);
	if (m < 1) return 'just now';
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.floor(h / 24);
	if (d < 7) return `${d}d ago`;
	return new Date(iso).toLocaleDateString();
};

const initials = (name: string): string =>
	name
		.split(' ')
		.map((p) => p[0])
		.filter(Boolean)
		.slice(0, 2)
		.join('')
		.toUpperCase() || '?';

// Shows the most recent comment as a preview in the Details tab, with a count and a link to
// the full Comments tab.
export const AlertLastCommentSection = ({ alertId, onViewAll }: AlertLastCommentSectionProps) => {
	const { data: comments = [] } = useAlertComments(alertId);
	const { data: users = [] } = useUsers();

	const latest = useMemo(() => {
		if (comments.length === 0) return null;
		return [...comments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
	}, [comments]);

	const authorName = useMemo(() => {
		if (!latest) return '';
		return users.find((u) => String(u.id) === String(latest.userId))?.fullName || `User ${latest.userId}`;
	}, [latest, users]);

	const viewAll = onViewAll && (
		<button
			type="button"
			onClick={onViewAll}
			className="text-xs text-muted-foreground hover:text-foreground hover:underline"
		>
			View all
		</button>
	);

	return (
		<CollapsibleSection
			title="Latest comment"
			icon={<MessageSquare className="h-3.5 w-3.5" />}
			badge={comments.length || undefined}
			headerRight={viewAll}
			defaultOpen={false}
		>
			{latest ? (
				<div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
					<div className="flex items-center gap-2">
						<span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-medium flex items-center justify-center flex-shrink-0">
							{initials(authorName)}
						</span>
						<span className="text-xs font-medium truncate">{authorName}</span>
						<span className="text-xs text-muted-foreground flex-shrink-0">
							{relativeTime(latest.createdAt)}
						</span>
					</div>
					<p className="text-sm text-foreground whitespace-pre-wrap break-words line-clamp-4">
						{latest.comment}
					</p>
				</div>
			) : (
				<p className="text-xs text-muted-foreground">
					No comments yet.{' '}
					{onViewAll && (
						<button type="button" onClick={onViewAll} className="underline hover:text-foreground">
							Add one
						</button>
					)}
				</p>
			)}
		</CollapsibleSection>
	);
};
