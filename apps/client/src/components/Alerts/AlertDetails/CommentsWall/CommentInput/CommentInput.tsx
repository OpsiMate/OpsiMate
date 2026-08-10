import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { KeyboardEvent, useEffect, useRef } from 'react';
import { SUBMIT_BUTTON_TEXT, WRITE_COMMENT_PLACEHOLDER } from '../CommentsWall.constants';

interface CommentInputProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	isSubmitting: boolean;
	placeholder?: string;
	// Put the caret in the box as soon as it appears: opening Comments is intent enough to
	// write, so it shouldn't cost a second click into the field.
	autoFocus?: boolean;
}

export const CommentInput = ({
	value,
	onChange,
	onSubmit,
	isSubmitting,
	placeholder = WRITE_COMMENT_PLACEHOLDER,
	autoFocus = false,
}: CommentInputProps) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const refocusFrame = useRef<number | undefined>(undefined);

	// Deferred a frame on purpose: the Comments tab activates on mousedown, so mounting
	// happens BEFORE the browser applies that click's default focus to the tab button —
	// focusing synchronously here would just be overwritten by the trigger.
	// preventScroll: the composer is already pinned in view, and letting the browser
	// scroll to it would jerk the comment list.
	useEffect(() => {
		if (!autoFocus) return;
		const frame = requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }));
		return () => cancelAnimationFrame(frame);
	}, [autoFocus]);

	useEffect(() => () => cancelAnimationFrame(refocusFrame.current ?? 0), []);

	// Sending puts focus on the Send button, which then goes disabled and drops focus to
	// the body — so a second comment would need a fresh click into the box. Hand the caret
	// back instead, unless focus has meanwhile landed somewhere the user chose.
	const submit = () => {
		onSubmit();
		refocusFrame.current = requestAnimationFrame(() => {
			const active = document.activeElement;
			const focusIsLoose = !active || active === document.body;
			if (focusIsLoose || containerRef.current?.contains(active)) {
				textareaRef.current?.focus({ preventScroll: true });
			}
		});
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			if (value.trim()) {
				submit();
			}
		}
	};

	return (
		<div ref={containerRef} className="flex gap-2 p-3 border-t bg-background">
			<Textarea
				ref={textareaRef}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				className="min-h-[40px] max-h-[120px] resize-none text-sm"
				rows={1}
			/>
			<Button
				size="icon"
				onClick={submit}
				disabled={!value.trim() || isSubmitting}
				className="shrink-0 h-10 w-10"
			>
				<Send className="h-4 w-4" />
				<span className="sr-only">{SUBMIT_BUTTON_TEXT}</span>
			</Button>
		</div>
	);
};
