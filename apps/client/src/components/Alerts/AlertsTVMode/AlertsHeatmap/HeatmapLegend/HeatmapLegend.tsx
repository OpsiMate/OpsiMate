import { StatusChip } from './StatusChip';

export const HeatmapLegend = () => {
	return (
		<div className="w-full bg-card border-t py-3 px-4">
			<div className="flex items-center justify-between gap-8 max-w-full">
				<div className="flex items-center gap-2">
					<span className="text-sm font-bold mr-2">Status:</span>
					<StatusChip color="hsl(0, 85%, 60%)" label="Firing" />
					<StatusChip color="hsl(45, 90%, 60%)" label="Pending/Ack" />
					<StatusChip color="hsl(120, 60%, 60%)" label="Dismissed" />
					<StatusChip color="hsl(0, 0%, 60%)" label="Unknown" />
				</div>

				<div className="flex items-center gap-3 border-l border-border pl-6">
					<span className="text-sm font-bold">Recency:</span>
					<div className="flex items-center gap-2">
						<span className="text-xs text-muted-foreground font-medium">New</span>
						<div className="flex h-5 w-32 rounded overflow-hidden border border-border shadow-sm">
							<div className="flex-1" style={{ backgroundColor: 'hsl(0, 85%, 60%)' }} />
							<div className="flex-1" style={{ backgroundColor: 'hsl(0, 85%, 52%)' }} />
							<div className="flex-1" style={{ backgroundColor: 'hsl(0, 85%, 45%)' }} />
							<div className="flex-1" style={{ backgroundColor: 'hsl(0, 85%, 38%)' }} />
							<div className="flex-1" style={{ backgroundColor: 'hsl(0, 85%, 33%)' }} />
						</div>
						<span className="text-xs text-muted-foreground font-medium">Old</span>
					</div>
					<span className="text-xs text-muted-foreground">
						(15m → 1h → 6h → 24h+)
					</span>
				</div>
			</div>
		</div>
	);
};
