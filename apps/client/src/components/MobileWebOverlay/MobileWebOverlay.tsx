import { useIsMobile } from '@/hooks/use-mobile';
import { Monitor } from 'lucide-react';

export const MobileWebOverlay = () => {
	const isMobile = useIsMobile();

	if (!isMobile) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 text-center">
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />

			<div className="relative z-10 flex max-w-sm flex-col items-center gap-8">
				<div className="relative">
					<div className="absolute -inset-4 rounded-full bg-blue-500/20 blur-xl" />
					<img
						src="/images/logo.png"
						alt="OpsiMate"
						className="relative h-20 w-20 drop-shadow-2xl"
					/>
				</div>

				<div className="space-y-4">
					<h1 className="text-2xl font-bold tracking-tight text-white">
						Desktop Experience Required
					</h1>

					<p className="text-base leading-relaxed text-slate-300">
						OpsiMate is optimized for larger screens to provide the best experience with
						dashboards and data tables.
					</p>
				</div>

				<div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 px-5 py-4 backdrop-blur-sm">
					<Monitor className="h-6 w-6 text-blue-400" />
					<span className="text-sm font-medium text-slate-200">
						Please open on a desktop or tablet
					</span>
				</div>

				<p className="text-xs text-slate-500">
					Minimum recommended width: 768px
				</p>
			</div>

			<div className="absolute bottom-8 text-xs text-slate-600">
				© {new Date().getFullYear()} OpsiMate
			</div>
		</div>
	);
};
