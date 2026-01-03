import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { playgroundApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Calendar, Github, Info, Send } from 'lucide-react';
import { useState } from 'react';
import {
	BOOK_DEMO_BUTTON_TEXT,
	DEMO_ERROR_MESSAGE,
	DEMO_SUCCESS_MESSAGE,
	GITHUB_BUTTON_TEXT,
	GITHUB_REPO_URL,
	PLAYGROUND_BANNER_TEXT,
} from './PlaygroundBanner.constants';
import { PlaygroundBannerProps } from './PlaygroundBanner.types';

const TRACKING_STORAGE_KEY = 'opsimate-demo-tracking-id';

const createTrackingId = () => {
	if (typeof window === 'undefined') {
		return `demo-${Date.now()}`;
	}
	const existing = localStorage.getItem(TRACKING_STORAGE_KEY);
	if (existing) return existing;

	const id =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
	localStorage.setItem(TRACKING_STORAGE_KEY, id);
	return id;
};

export const PlaygroundBanner = ({ className }: PlaygroundBannerProps) => {
	const [email, setEmail] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const [hasTrackedInterest, setHasTrackedInterest] = useState(false);
	const [trackingId] = useState(createTrackingId);
	const { toast } = useToast();

	const handleBookDemo = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!email) return;

		setIsSubmitting(true);
		try {
			const response = await playgroundApi.bookDemo({ email, trackingId });
			if (response.success) {
				toast({
					title: 'Success!',
					description: DEMO_SUCCESS_MESSAGE,
				});
				setEmail('');
				setIsOpen(false);
			} else {
				throw new Error(response.error);
			}
		} catch (error) {
			toast({
				title: 'Error',
				description: DEMO_ERROR_MESSAGE,
				variant: 'destructive',
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleOpenChange = async (open: boolean) => {
		setIsOpen(open);

		if (open && !hasTrackedInterest) {
			try {
				await playgroundApi.bookDemo({ trackingId });
				setHasTrackedInterest(true);
			} catch {
				// Silent fail; best-effort tracking only
			}
		}
	};

	const handleGithubClick = () => {
		window.open(GITHUB_REPO_URL, '_blank', 'noopener,noreferrer');
	};

	return (
		<div
			className={cn(
				'bg-primary/10 border-b border-primary/20 py-2 px-4 flex flex-col sm:flex-row items-center justify-center gap-3 text-sm transition-all animate-in fade-in slide-in-from-top-4 duration-500',
				className
			)}
		>
			<div className="flex items-center gap-2 text-primary font-medium">
				<Info className="h-4 w-4" />
				<span>{PLAYGROUND_BANNER_TEXT}</span>
			</div>

			<div className="flex items-center gap-2">
				<Popover open={isOpen} onOpenChange={handleOpenChange}>
					<PopoverTrigger asChild>
						<Button variant="outline" size="sm" className="h-8 gap-2 border-primary/30 hover:bg-primary/20">
							<Calendar className="h-3.5 w-3.5" />
							{BOOK_DEMO_BUTTON_TEXT}
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-80 p-4" align="center">
						<form onSubmit={handleBookDemo} className="space-y-3">
							<div className="space-y-1">
								<h4 className="font-medium text-sm leading-none">Book a Demo</h4>
								<p className="text-xs text-muted-foreground">Enter your email and we'll reach out.</p>
							</div>
							<div className="flex gap-2">
								<Input
									type="email"
									placeholder="email@example.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									className="h-8 text-xs"
									required
								/>
								<Button type="submit" size="sm" className="h-8 px-2" disabled={isSubmitting}>
									{isSubmitting ? (
										<div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background border-t-transparent" />
									) : (
										<Send className="h-3.5 w-3.5" />
									)}
								</Button>
							</div>
						</form>
					</PopoverContent>
				</Popover>

				<Button
					variant="outline"
					size="sm"
					onClick={handleGithubClick}
					className="h-8 gap-2 border-primary/30 hover:bg-primary/20"
				>
					<Github className="h-3.5 w-3.5" />
					{GITHUB_BUTTON_TEXT}
				</Button>
			</div>
		</div>
	);
};
