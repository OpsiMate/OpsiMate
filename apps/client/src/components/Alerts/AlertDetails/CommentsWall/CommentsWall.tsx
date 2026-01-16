import { ScrollArea } from '@/components/ui/scroll-area';
import {
	useAlertComments,
	useCreateAlertComment,
	useDeleteAlertComment,
	useUpdateAlertComment,
} from '@/hooks/queries/alertComments';
import { useUsers } from '@/hooks/queries/users/useUsers';
import { getCurrentUser } from '@/lib/auth';
import { MessageSquare } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CommentInput } from './CommentInput';
import { CommentItem } from './CommentItem';
import { COMMENTS_HEADER, NO_COMMENTS_MESSAGE } from './CommentsWall.constants';

interface CommentsWallProps {
	alertId: string;
}

export const CommentsWall = ({ alertId }: CommentsWallProps) => {
	const [newComment, setNewComment] = useState('');
	const currentUser = getCurrentUser();
	const { data: comments = [], isLoading } = useAlertComments(alertId);
	const { data: users = [] } = useUsers();
	const createMutation = useCreateAlertComment();
	const updateMutation = useUpdateAlertComment();
	const deleteMutation = useDeleteAlertComment();

	const userMap = useMemo(() => {
		const map = new Map<string, { fullName: string; email: string }>();
		users.forEach((user) => {
			map.set(String(user.id), { fullName: user.fullName, email: user.email });
		});
		return map;
	}, [users]);

	const handleSubmit = () => {
		if (!newComment.trim() || !currentUser) return;

		createMutation.mutate(
			{
				alertId,
				userId: String(currentUser.id),
				comment: newComment.trim(),
			},
			{
				onSuccess: () => setNewComment(''),
			}
		);
	};

	const handleEdit = (commentId: string, newText: string) => {
		updateMutation.mutate({ commentId, comment: newText, alertId });
	};

	const handleDelete = (commentId: string) => {
		deleteMutation.mutate({ commentId, alertId });
	};

	return (
		<div className="flex flex-col h-full border-l bg-background">
			<div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0">
				<MessageSquare className="h-4 w-4 text-muted-foreground" />
				<h3 className="font-semibold text-sm text-foreground">{COMMENTS_HEADER}</h3>
				{comments.length > 0 && (
					<span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
						{comments.length}
					</span>
				)}
			</div>

			<ScrollArea className="flex-1">
				<div className="p-3 space-y-3">
					{isLoading ? (
						<div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
							Loading comments...
						</div>
					) : comments.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-8 text-center">
							<MessageSquare className="h-8 w-8 text-muted-foreground/50 mb-2" />
							<p className="text-sm text-muted-foreground">{NO_COMMENTS_MESSAGE}</p>
						</div>
					) : (
						comments.map((comment) => (
							<CommentItem
								key={comment.id}
								comment={comment}
								currentUserId={currentUser?.id || ''}
								userMap={userMap}
								onEdit={handleEdit}
								onDelete={handleDelete}
								isDeleting={deleteMutation.isPending}
								isUpdating={updateMutation.isPending}
							/>
						))
					)}
				</div>
			</ScrollArea>

			<CommentInput
				value={newComment}
				onChange={setNewComment}
				onSubmit={handleSubmit}
				isSubmitting={createMutation.isPending}
			/>
		</div>
	);
};
