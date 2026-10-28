import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { CommentInput } from '@/components/Alerts/AlertDetails/CommentsWall/CommentInput';
import { CommentItem } from '@/components/Alerts/AlertDetails/CommentsWall/CommentItem';
import { ALERT_COMMENT_MAX_LENGTH, AlertComment } from '@OpsiMate/shared';

// The server rejects comments over ALERT_COMMENT_MAX_LENGTH with a 400 the UI doesn't show,
// so both comment boxes cap input themselves. jsdom doesn't enforce maxLength on
// fireEvent.change, hence the attribute check instead of typing past the limit.

const noop = () => {};

const ownComment: AlertComment = {
	id: 'c1',
	alertId: 'a1',
	userId: '1',
	comment: 'hello',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('comment max length', () => {
	test('the new-comment box is capped at the shared limit', () => {
		render(<CommentInput value="" onChange={noop} onSubmit={noop} isSubmitting={false} />);

		expect(screen.getByRole('textbox')).toHaveAttribute('maxlength', String(ALERT_COMMENT_MAX_LENGTH));
	});

	test('the edit box of your own comment is capped at the shared limit', () => {
		render(
			<CommentItem
				comment={ownComment}
				currentUserId="1"
				userMap={new Map()}
				onEdit={noop}
				onDelete={noop}
				isDeleting={false}
				isUpdating={false}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: 'Edit comment' }));

		expect(screen.getByRole('textbox')).toHaveAttribute('maxlength', String(ALERT_COMMENT_MAX_LENGTH));
	});
});
