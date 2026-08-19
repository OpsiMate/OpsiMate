import { Dashboard } from '@/hooks/queries/dashboards/dashboards.types';
import { useGetDashboards } from '@/hooks/queries/dashboards/useGetDashboards';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { extractTagKeyFromColumnId, isTagKeyColumn } from '@/types';
import { LayoutDashboard, Search } from 'lucide-react';
import { useMemo } from 'react';

interface DashboardScopePickerProps {
	selectedId: string | null;
	onSelect: (dashboard: Dashboard | null) => void;
}

const ALL_ALERTS_VALUE = '__all__';

// Human name for a filter key: negations ("!severity") read as "not severity", tag
// columns unwrap to their tag key, everything else capitalizes.
const filterKeyLabel = (key: string): string => {
	const negated = key.startsWith('!');
	const bare = negated ? key.slice(1) : key;
	const label = isTagKeyColumn(bare)
		? (extractTagKeyFromColumnId(bare) ?? bare)
		: bare.charAt(0).toUpperCase() + bare.slice(1);
	return negated ? `not ${label}` : label;
};

// Scopes the Insights page to a saved dashboard's filters. The chips spell out exactly
// what the chosen dashboard filters on — a scope you can't SEE is a scope you'll
// misread numbers through.
export const DashboardScopePicker = ({ selectedId, onSelect }: DashboardScopePickerProps) => {
	const { data: dashboards = [] } = useGetDashboards();
	const alertDashboards = useMemo(
		() => dashboards.filter((dashboard: Dashboard) => dashboard.type === 'alerts'),
		[dashboards]
	);
	const selected = alertDashboards.find((dashboard: Dashboard) => dashboard.id === selectedId) ?? null;

	// Saved dashboards keep keys for cleared filters with empty arrays; those filter
	// nothing (the match engine skips them) and must not render as blank chips.
	const filterEntries = selected
		? Object.entries(selected.filters ?? {}).filter(([, values]) => values.length > 0)
		: [];
	const hasScope = !!selected && (filterEntries.length > 0 || !!selected.query?.trim());

	return (
		<div className="flex flex-col gap-1.5">
			<Select
				value={selectedId ?? ALL_ALERTS_VALUE}
				onValueChange={(value) =>
					onSelect(value === ALL_ALERTS_VALUE ? null : (alertDashboards.find((d) => d.id === value) ?? null))
				}
			>
				<SelectTrigger className="h-8 w-[210px] text-xs" aria-label="Scope by dashboard">
					<LayoutDashboard className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
					<SelectValue placeholder="All alerts" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={ALL_ALERTS_VALUE}>All alerts</SelectItem>
					{alertDashboards.map((dashboard) => (
						<SelectItem key={dashboard.id} value={dashboard.id}>
							{dashboard.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{selected &&
				(hasScope ? (
					<div className="flex max-w-md flex-wrap gap-1">
						{selected.query?.trim() && (
							<Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] font-normal">
								<Search className="h-2.5 w-2.5" />"{selected.query.trim()}"
							</Badge>
						)}
						{filterEntries.map(([key, values]) => (
							<Badge key={key} variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
								<span className="font-medium">{filterKeyLabel(key)}:</span>&nbsp;
								{values.join(', ')}
							</Badge>
						))}
					</div>
				) : (
					// An unfiltered dashboard scopes nothing; say so instead of showing
					// numbers identical to "All alerts" with no explanation.
					<span className="text-[10px] text-muted-foreground">
						This dashboard has no filters — showing all alerts
					</span>
				))}
		</div>
	);
};
