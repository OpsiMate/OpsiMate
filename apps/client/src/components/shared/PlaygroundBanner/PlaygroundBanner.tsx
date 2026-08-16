import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Calendar, Info } from 'lucide-react';
import {
	BOOK_DEMO_BUTTON_TEXT,
	BOOK_DEMO_URL,
	GITHUB_BUTTON_TEXT,
	GITHUB_REPO_URL,
	PLAYGROUND_BANNER_TEXT,
} from './PlaygroundBanner.constants';

interface PlaygroundBannerProps {
	className?: string;
}

export const PlaygroundBanner = ({ className }: PlaygroundBannerProps) => {
	const handleBookDemoClick = () => {
		window.open(BOOK_DEMO_URL, '_blank', 'noopener,noreferrer');
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
				<Button
					variant="outline"
					size="sm"
					onClick={handleBookDemoClick}
					className="h-8 gap-2 border-primary/30 hover:bg-primary/20"
				>
					<Calendar className="h-3.5 w-3.5" />
					{BOOK_DEMO_BUTTON_TEXT}
				</Button>

				<Button
					variant="outline"
					size="sm"
					onClick={handleGithubClick}
					className="h-8 gap-2 border-primary/30 hover:bg-primary/20"
				>
					{/* The bundled mark, not a lucide icon: lucide v1 removed every brand
					    icon for trademark reasons. This is the same asset the left
					    sidebar's GitHub link already uses. */}
					<img
						src="/images/git.png"
						alt=""
						aria-hidden
						className="h-3.5 w-3.5 object-contain invert dark:invert-0"
					/>
					{GITHUB_BUTTON_TEXT}
				</Button>
			</div>
		</div>
	);
};
