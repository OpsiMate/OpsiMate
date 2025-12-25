import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { AlertComment } from '@OpsiMate/shared';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { useState } from 'react';

interface CommentItemProps {
	comment: AlertComment;
	currentUserId: string | number;
	userMap: Map<string, { fullName: string; email: string }>;
	onEdit: (commentId: string, newText: string) => void;
	onDelete: (commentId: string) => void;
	isDeleting: boolean;
	isUpdating: boolean;
}

export const CommentItem = ({
	comment,
	currentUserId,
	userMap,
	onEdit,
	onDelete,
	isDeleting,
	isUpdating,
}: CommentItemProps) => {
	const [isEditing, setIsEditing] = useState(false);
	const [editText, setEditText] = useState(comment.comment);

	const isOwnComment = String(currentUserId) === String(comment.userId);
	const user = userMap.get(comment.userId);
	const displayName = user?.fullName || user?.email || 'Unknown User';
	const initials = displayName
		.split(' ')
		.map((n) => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		return date.toLocaleDateString();
	};

	const handleSave = () => {
		if (editText.trim() && editText !== comment.comment) {
			onEdit(comment.id, editText.trim());
		}
		setIsEditing(false);
	};

	const handleCancel = () => {
		setEditText(comment.comment);
		setIsEditing(false);
	};

	return (
		<div className={cn('flex gap-3 p-3 rounded-lg', isOwnComment ? 'bg-primary/5' : 'bg-muted/30')}>
			<div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
				{initials}
			</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center justify-between gap-2 mb-1">
					<div className="flex items-center gap-2 min-w-0">
						<span className="font-medium text-sm text-foreground truncate">{displayName}</span>
						<span className="text-xs text-muted-foreground flex-shrink-0">
							{formatDate(comment.createdAt)}
						</span>
						{comment.updatedAt !== comment.createdAt && (
							<span className="text-xs text-muted-foreground italic flex-shrink-0">(edited)</span>
						)}
					</div>
					{isOwnComment && !isEditing && (
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 text-muted-foreground hover:text-foreground"
								onClick={() => setIsEditing(true)}
								disabled={isUpdating}
							>
								<Pencil className="h-3 w-3" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 text-muted-foreground hover:text-destructive"
								onClick={() => onDelete(comment.id)}
								disabled={isDeleting}
							>
								<Trash2 className="h-3 w-3" />
							</Button>
						</div>
					)}
				</div>

				{isEditing ? (
					<div className="space-y-2">
						<Textarea
							value={editText}
							onChange={(e) => setEditText(e.target.value)}
							className="min-h-[60px] resize-none text-sm"
							autoFocus
						/>
						<div className="flex justify-end gap-1">
							<Button variant="ghost" size="sm" onClick={handleCancel} className="h-7 px-2">
								<X className="h-3 w-3 mr-1" />
								Cancel
							</Button>
							<Button
								size="sm"
								onClick={handleSave}
								disabled={!editText.trim() || isUpdating}
								className="h-7 px-2"
							>
								<Check className="h-3 w-3 mr-1" />
								Save
							</Button>
						</div>
					</div>
				) : (
					<p className="text-sm text-foreground whitespace-pre-wrap break-words">{comment.comment}</p>
				)}
			</div>
		</div>
	);
};
