import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { CommentInput } from '@/components/Alerts/AlertDetails/CommentsWall/CommentInput';

// Opening the Comments tab should be enough to start typing: the composer takes focus on
// mount instead of making the user click into it first. The focus is deferred a frame (the
// tab trigger's own click focus would otherwise win), hence the waitFor.

const noop = () => {};

describe('CommentInput focus', () => {
	test('takes focus on mount when autoFocus is set', async () => {
		render(<CommentInput value="" onChange={noop} onSubmit={noop} isSubmitting={false} autoFocus />);

		await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus());
	});

	test('leaves focus alone without autoFocus', async () => {
		render(<CommentInput value="" onChange={noop} onSubmit={noop} isSubmitting={false} />);

		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(screen.getByRole('textbox')).not.toHaveFocus();
	});

	// Sending disables the Send button, which drops focus to the body — without the handback
	// a second comment would need a fresh click into the box.
	test('hands focus back to the box after sending', async () => {
		render(<CommentInput value="hi" onChange={noop} onSubmit={noop} isSubmitting={false} autoFocus />);

		const sendButton = screen.getByRole('button');
		sendButton.focus();
		fireEvent.click(sendButton);

		await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus());
	});

	test('does not steal focus back when the user moved on after sending', async () => {
		render(
			<>
				<input aria-label="elsewhere" />
				<CommentInput value="hi" onChange={noop} onSubmit={noop} isSubmitting={false} />
			</>
		);

		fireEvent.click(screen.getByRole('button'));
		const elsewhere = screen.getByLabelText('elsewhere');
		elsewhere.focus();

		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(elsewhere).toHaveFocus();
	});

	test('Enter submits, Shift+Enter does not', () => {
		const onSubmit = vi.fn();
		render(<CommentInput value="hi" onChange={noop} onSubmit={onSubmit} isSubmitting={false} autoFocus />);

		const box = screen.getByRole('textbox');
		fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
		expect(onSubmit).not.toHaveBeenCalled();

		fireEvent.keyDown(box, { key: 'Enter' });
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});
});
