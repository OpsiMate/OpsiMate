import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import { LayoutDashboard, Star } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { COLUMN_WIDTHS } from '../Dashboards.constants';
import { DashboardsTableProps, DashboardWithFavorite } from '../Dashboards.types';
import { DashboardRow } from '../DashboardRow';

export const DashboardsTable = ({
	dashboards,
	isLoading,
	onDashboardClick,
	onDeleteDashboard,
	onToggleFavorite,
}: DashboardsTableProps) => {
	const parentRef = useRef<HTMLDivElement>(null);

	const { favorites, others } = useMemo(() => {
		const favs: DashboardWithFavorite[] = [];
		const rest: DashboardWithFavorite[] = [];
		dashboards.forEach((d) => {
			if (d.isFavorite) {
				favs.push(d);
			} else {
				rest.push(d);
			}
		});
		return { favorites: favs, others: rest };
	}, [dashboards]);

	const hasFavorites = favorites.length > 0;

	const flatItems = useMemo(() => {
		const items: Array<{ type: 'header' | 'dashboard'; dashboard?: DashboardWithFavorite; label?: string }> = [];

		if (hasFavorites) {
			items.push({ type: 'header', label: 'Favorites' });
			favorites.forEach((d) => items.push({ type: 'dashboard', dashboard: d }));
			items.push({ type: 'header', label: 'All Dashboards' });
		}

		others.forEach((d) => items.push({ type: 'dashboard', dashboard: d }));

		return items;
	}, [favorites, others, hasFavorites]);

	const virtualizer = useVirtualizer({
		count: flatItems.length,
		getScrollElement: () => parentRef.current,
		estimateSize: (index) => (flatItems[index].type === 'header' ? 40 : 52),
		overscan: 10,
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-16 text-muted-foreground">
				<div className="flex items-center gap-2">
					<div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
					Loading dashboards...
				</div>
			</div>
		);
	}

	if (dashboards.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<LayoutDashboard className="h-12 w-12 text-muted-foreground/50 mb-4" />
				<h3 className="text-lg font-medium text-foreground mb-2">No dashboards found</h3>
				<p className="text-muted-foreground text-sm max-w-md">
					Create a new dashboard to save your custom filter configurations for quick access.
				</p>
			</div>
		);
	}

	return (
		<div className="border rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
			<div className="border-b flex-shrink-0">
				<Table className="table-fixed w-full">
					<TableHeader>
						<TableRow className="h-10">
							<TableHead className={cn('py-2 px-3', COLUMN_WIDTHS.favorite)}>
								<Star className="h-4 w-4 text-muted-foreground" />
							</TableHead>
							<TableHead className={cn('py-2 px-3 font-medium', COLUMN_WIDTHS.name)}>Name</TableHead>
							<TableHead className={cn('py-2 px-3 font-medium', COLUMN_WIDTHS.description)}>
								Description
							</TableHead>
							<TableHead className={cn('py-2 px-3 font-medium', COLUMN_WIDTHS.filters)}>Filters</TableHead>
							<TableHead className={cn('py-2 px-3 font-medium', COLUMN_WIDTHS.createdAt)}>
								Created
							</TableHead>
							<TableHead className={cn('py-2 px-3 font-medium', COLUMN_WIDTHS.actions)}>Actions</TableHead>
						</TableRow>
					</TableHeader>
				</Table>
			</div>

			<div ref={parentRef} className="flex-1 min-h-0 overflow-auto">
				<div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
					{virtualizer.getVirtualItems().map((virtualRow) => {
						const item = flatItems[virtualRow.index];

						if (item.type === 'header') {
							return (
								<div
									key={virtualRow.key}
									data-index={virtualRow.index}
									ref={virtualizer.measureElement}
									style={{
										position: 'absolute',
										top: 0,
										left: 0,
										width: '100%',
										transform: `translateY(${virtualRow.start}px)`,
									}}
								>
									<div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b">
										{item.label === 'Favorites' && (
											<Star className="h-4 w-4 fill-amber-400 text-amber-400" />
										)}
										<span className="text-sm font-medium text-foreground">{item.label}</span>
									</div>
								</div>
							);
						}

						const dashboard = item.dashboard!;
						return (
							<div
								key={virtualRow.key}
								data-index={virtualRow.index}
								ref={virtualizer.measureElement}
								style={{
									position: 'absolute',
									top: 0,
									left: 0,
									width: '100%',
									transform: `translateY(${virtualRow.start}px)`,
								}}
							>
								<Table className="table-fixed w-full">
									<TableBody>
										<DashboardRow
											dashboard={dashboard}
											onClick={() => onDashboardClick(dashboard)}
											onDelete={() => onDeleteDashboard(dashboard.id)}
											onToggleFavorite={() => onToggleFavorite(dashboard.id)}
										/>
									</TableBody>
								</Table>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
};
