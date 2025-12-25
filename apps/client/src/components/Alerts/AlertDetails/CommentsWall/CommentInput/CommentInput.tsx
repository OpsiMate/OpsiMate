import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { KeyboardEvent } from 'react';
import { SUBMIT_BUTTON_TEXT, WRITE_COMMENT_PLACEHOLDER } from '../CommentsWall.constants';

interface CommentInputProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	isSubmitting: boolean;
	placeholder?: string;
}

export const CommentInput = ({
	value,
	onChange,
	onSubmit,
	isSubmitting,
	placeholder = WRITE_COMMENT_PLACEHOLDER,
}: CommentInputProps) => {
	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			if (value.trim()) {
				onSubmit();
			}
		}
	};

	return (
		<div className="flex gap-2 p-3 border-t bg-background">
			<Textarea
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				className="min-h-[40px] max-h-[120px] resize-none text-sm"
				rows={1}
			/>
			<Button
				size="icon"
				onClick={onSubmit}
				disabled={!value.trim() || isSubmitting}
				className="flex-shrink-0 h-10 w-10"
			>
				<Send className="h-4 w-4" />
				<span className="sr-only">{SUBMIT_BUTTON_TEXT}</span>
			</Button>
		</div>
	);
};
