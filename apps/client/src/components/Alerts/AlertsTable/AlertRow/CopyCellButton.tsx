import { Check, Copy } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { cn } from '@/lib/utils';

export interface CopyCellButtonProps {
	// The FULL underlying value — not the (possibly truncated/reformatted) display text.
	value: string;
	className?: string;
}

// Hover-revealed copy button for table cells (issue #747). The host cell must carry
// `relative group/cell` for the reveal and positioning to work. Click/mousedown stop
// propagation so copying never opens the details panel or starts a drag selection.
export const CopyCellButton = ({ value, className }: CopyCellButtonProps) => {
	const { copied, copy } = useCopyToClipboard({ resetMs: 1500, restartTimer: true, legacyFallback: true });

	const handleCopy = async (e: React.MouseEvent) => {
		e.stopPropagation();
		await copy(value);
	};

	return (
		<button
			type="button"
			onClick={handleCopy}
			onMouseDown={(e) => e.stopPropagation()}
			aria-label={copied ? 'Copied' : 'Copy value'}
			title={copied ? 'Copied!' : 'Copy value'}
			className={cn(
				'absolute right-0.5 top-1/2 -translate-y-1/2 rounded border bg-background p-0.5 shadow-sm',
				'opacity-0 transition-opacity group-hover/cell:opacity-100 focus-visible:opacity-100',
				'text-muted-foreground hover:bg-muted hover:text-foreground',
				className
			)}
		>
			{copied ? <Check className="h-3 w-3 text-secondary" /> : <Copy className="h-3 w-3" />}
		</button>
	);
};
