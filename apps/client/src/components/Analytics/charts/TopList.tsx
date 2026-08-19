import { NamedCount } from '@OpsiMate/shared';
import { ChartCard } from './chartTheme';

// Ranked list with proportional bars — reads faster than a rotated bar chart for
// name-length labels, and needs no chart plumbing.
export const TopList = ({ title, hint, items }: { title: string; hint?: string; items: NamedCount[] }) => {
	const max = Math.max(...items.map((i) => i.count), 1);
	return (
		<ChartCard title={title} hint={hint}>
			{items.length === 0 ? (
				<p className="py-6 text-center text-sm text-muted-foreground">Nothing in this window</p>
			) : (
				<div className="space-y-1.5">
					{items.map((item) => (
						<div key={item.name} className="relative flex items-center gap-2 rounded-md px-2 py-1">
							<div
								className="absolute inset-y-0 left-0 rounded-md bg-primary/10"
								style={{ width: `${(item.count / max) * 100}%` }}
							/>
							<span className="relative z-10 flex-1 truncate text-xs text-foreground" title={item.name}>
								{item.name}
							</span>
							<span className="relative z-10 text-xs font-semibold tabular-nums text-foreground">
								{item.count}
							</span>
						</div>
					))}
				</div>
			)}
		</ChartCard>
	);
};
