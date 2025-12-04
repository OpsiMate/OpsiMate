import { RECENCY_GRADIENT_STEPS, STATUS_LEGEND_COLORS } from '../AlertsHeatmap.constants';
import { StatusChip } from './StatusChip';

export const HeatmapLegend = () => {
	return (
		<div className="w-full bg-card border-t py-3 px-4">
			<div className="flex items-center justify-between gap-8 max-w-full">
				<div className="flex items-center gap-2">
					<span className="text-sm font-bold mr-2 text-foreground">Status:</span>
					<StatusChip color={STATUS_LEGEND_COLORS.FIRING} label="Firing" />
					<StatusChip color={STATUS_LEGEND_COLORS.PENDING_ACK} label="Pending/Ack" />
					<StatusChip color={STATUS_LEGEND_COLORS.DISMISSED} label="Dismissed" />
					<StatusChip color={STATUS_LEGEND_COLORS.UNKNOWN} label="Unknown" />
				</div>

				<div className="flex items-center gap-3 border-l border-border pl-6">
					<span className="text-sm font-bold text-foreground">Recency:</span>
					<div className="flex items-center gap-2">
						<span className="text-xs text-foreground font-medium">New</span>
						<div className="flex h-5 w-32 rounded overflow-hidden border border-border shadow-sm">
							{RECENCY_GRADIENT_STEPS.map((color, i) => (
								<div key={i} className="flex-1" style={{ backgroundColor: color }} />
							))}
						</div>
						<span className="text-xs text-foreground font-medium">Old</span>
					</div>
					<span className="text-xs text-foreground">(15m → 1h → 6h → 24h+)</span>
				</div>
			</div>
		</div>
	);
};
