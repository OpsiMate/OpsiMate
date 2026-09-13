import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

export const COPIED_RESET_MS = 2000;

interface CopyOptions {
	successDescription?: string;
	failureDescription?: string;
}

interface ClipboardOptions {
	resetMs?: number;
}

// The Clipboard API needs a secure context, and self-hosted OpsiMate commonly runs on
// plain http — fall back to the legacy execCommand path there.
const copyText = async (text: string): Promise<boolean> => {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// Try the fallback if the secure-context API rejects the write.
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

export const useCopyToClipboard = ({ resetMs = COPIED_RESET_MS }: ClipboardOptions = {}) => {
	const [copied, setCopied] = useState(false);
	const timer = useRef<number | undefined>(undefined);
	const mounted = useRef(true);
	const { toast } = useToast();
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			window.clearTimeout(timer.current);
		};
	}, []);
	const copy = async (text: string, options: CopyOptions = {}): Promise<boolean> => {
		const success = await copyText(text).catch(() => false);
		if (!mounted.current) return false;
		if (!success) {
			if (options.failureDescription)
				toast({
					title: 'Failed to copy',
					description: options.failureDescription,
					variant: 'destructive',
					duration: 3000,
				});
			return false;
		}
		setCopied(true);
		if (options.successDescription)
			toast({ title: 'Copied!', description: options.successDescription, duration: COPIED_RESET_MS });
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => setCopied(false), resetMs);
		return true;
	};
	return { copied, copy };
};
