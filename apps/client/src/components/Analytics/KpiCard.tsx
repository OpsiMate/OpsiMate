import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { ReactNode } from 'react';
import { deltaPercent } from './analytics.utils';

interface KpiCardProps {
	label: string;
	value: string;
	// Raw numbers behind the value, for the vs-previous-period delta chip.
	rawValue?: number | null;
	rawPrevious?: number | null;
	// Whether a RISE in this metric is good news (resolved count) or bad (alert
	// volume, MTTR) — decides the chip's color, not its direction.
	upIsGood?: boolean;
	hint?: string;
	icon?: ReactNode;
}

// One headline number. The delta chip compares against the immediately preceding
// window of the same length and stays absent on All time (no previous period).
export const KpiCard = ({ label, value, rawValue, rawPrevious, upIsGood = false, hint, icon }: KpiCardProps) => {
	const delta =
		rawValue !== undefined && rawValue !== null && rawPrevious !== undefined
			? deltaPercent(rawValue, rawPrevious ?? null)
			: null;
	const up = delta !== null && delta > 0;
	const good = delta !== null && (up ? upIsGood : !upIsGood);

	return (
		<Card>
			<CardContent className="p-4">
				<div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
					{icon}
					{label}
				</div>
				<div className="mt-1 flex items-baseline gap-2">
					<span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
					{delta !== null && Math.abs(delta) >= 0.005 && (
						<span
							className={cn(
								'flex items-center gap-0.5 text-xs font-medium',
								good ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
							)}
						>
							{up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
							{Math.abs(delta * 100).toFixed(0)}%
						</span>
					)}
				</div>
				{hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
			</CardContent>
		</Card>
	);
};
