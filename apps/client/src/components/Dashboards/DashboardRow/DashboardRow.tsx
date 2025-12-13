import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Filter, Star, Trash2 } from 'lucide-react';
import { COLUMN_WIDTHS } from '../Dashboards.constants';
import { DashboardRowProps } from '../Dashboards.types';
import { formatDate, getActiveFiltersCount } from '../Dashboards.utils';

export const DashboardRow = ({ dashboard, onClick, onDelete, onToggleFavorite }: DashboardRowProps) => {
	const filterCount = getActiveFiltersCount(dashboard.filters);

	return (
		<TableRow className="cursor-pointer hover:bg-muted/50 transition-colors group" onClick={onClick}>
			<TableCell className={cn('py-2 px-3', COLUMN_WIDTHS.favorite)}>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8"
					onClick={(e) => {
						e.stopPropagation();
						onToggleFavorite();
					}}
				>
					<Star
						className={cn(
							'h-4 w-4 transition-colors',
							dashboard.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'
						)}
					/>
				</Button>
			</TableCell>
			<TableCell className={cn('py-2 px-3 font-medium', COLUMN_WIDTHS.name)}>{dashboard.name}</TableCell>
			<TableCell className={cn('py-2 px-3 text-muted-foreground truncate', COLUMN_WIDTHS.description)}>
				{dashboard.description || '-'}
			</TableCell>
			<TableCell className={cn('py-2 px-3', COLUMN_WIDTHS.filters)}>
				{filterCount > 0 ? (
					<span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
						<Filter className="h-3 w-3" />
						{filterCount}
					</span>
				) : (
					<span className="text-muted-foreground text-sm">-</span>
				)}
			</TableCell>
			<TableCell className={cn('py-2 px-3 text-muted-foreground text-sm', COLUMN_WIDTHS.createdAt)}>
				{formatDate(dashboard.createdAt)}
			</TableCell>
			<TableCell className={cn('py-2 px-3', COLUMN_WIDTHS.actions)}>
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
							onClick={(e) => e.stopPropagation()}
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent onClick={(e) => e.stopPropagation()}>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete Dashboard</AlertDialogTitle>
							<AlertDialogDescription>
								Are you sure you want to delete "{dashboard.name}"? This action cannot be undone.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
								onClick={(e) => {
									e.stopPropagation();
									onDelete();
								}}
							>
								Delete
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</TableCell>
		</TableRow>
	);
};
