import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// The Clipboard API needs a secure context, and self-hosted OpsiMate commonly runs on
// plain http — fall back to the legacy execCommand path there.
const copyText = async (text: string): Promise<boolean> => {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// Permission denied or transient failure — try the fallback below.
		}
	}
	const textarea = document.createElement('textarea');
	textarea.value = text;
	textarea.style.position = 'fixed';
	textarea.style.opacity = '0';
	document.body.appendChild(textarea);
	textarea.select();
	try {
		return document.execCommand('copy');
	} finally {
		textarea.remove();
	}
};

export interface CopyCellButtonProps {
	// The FULL underlying value — not the (possibly truncated/reformatted) display text.
	value: string;
	className?: string;
}

// Hover-revealed copy button for table cells (issue #747). The host cell must carry
// `relative group/cell` for the reveal and positioning to work. Click/mousedown stop
// propagation so copying never opens the details panel or starts a drag selection.
export const CopyCellButton = ({ value, className }: CopyCellButtonProps) => {
	const [copied, setCopied] = useState(false);
	const resetTimer = useRef<number>();
	useEffect(() => () => window.clearTimeout(resetTimer.current), []);

	const handleCopy = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!(await copyText(value))) return;
		setCopied(true);
		window.clearTimeout(resetTimer.current);
		resetTimer.current = window.setTimeout(() => setCopied(false), 1500);
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
