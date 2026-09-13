import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

export const COPIED_RESET_MS = 2000;

interface CopyOptions {
	successDescription?: string;
	failureDescription?: string;
	// Multi-button dialogs keep their existing per-button or grouped indicators.
	onCopied?: () => void;
	onReset?: () => void;
}

interface ClipboardOptions {
	resetMs?: number;
	// Table feedback restarts; dialogs retain their existing scheduled resets.
	restartTimer?: boolean;
	legacyFallback?: boolean;
}

// The Clipboard API needs a secure context, and self-hosted OpsiMate commonly runs on
// plain http — fall back to the legacy execCommand path there.
const copyText = async (text: string, legacyFallback: boolean): Promise<boolean> => {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			if (!legacyFallback) return false;
		}
	}
	if (!legacyFallback) return false;
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

export const useCopyToClipboard = ({
	resetMs = COPIED_RESET_MS,
	restartTimer = false,
	legacyFallback = false,
}: ClipboardOptions = {}) => {
	const [copied, setCopied] = useState(false);
	const timers = useRef(new Set<number>());
	const mounted = useRef(true);
	const { toast } = useToast();
	useEffect(() => {
		mounted.current = true;
		const pending = timers.current;
		return () => {
			mounted.current = false;
			pending.forEach((timer) => window.clearTimeout(timer));
			pending.clear();
		};
	}, []);
	const copy = async (text: string, options: CopyOptions = {}): Promise<boolean> => {
		const success = await copyText(text, legacyFallback).catch(() => false);
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
		options.onCopied?.();
		if (options.successDescription)
			toast({ title: 'Copied!', description: options.successDescription, duration: COPIED_RESET_MS });
		if (restartTimer) {
			timers.current.forEach((timer) => window.clearTimeout(timer));
			timers.current.clear();
		}
		const timer = window.setTimeout(() => {
			timers.current.delete(timer);
			setCopied(false);
			options.onReset?.();
		}, resetMs);
		timers.current.add(timer);
		return true;
	};
	return { copied, copy };
};
