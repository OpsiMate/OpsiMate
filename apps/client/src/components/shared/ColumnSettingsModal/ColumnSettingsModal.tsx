import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface ColumnSettingsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	visibleColumns: string[];
	onColumnToggle: (column: string) => void;
	columnLabels: Record<string, string>;
	title?: string;
	description?: string;
	excludeColumns?: string[];
}

export const ColumnSettingsModal = ({
	open,
	onOpenChange,
	visibleColumns,
	onColumnToggle,
	columnLabels,
	title = 'Table Settings',
	description = 'Select which columns to display in the table.',
	excludeColumns = [],
}: ColumnSettingsModalProps) => {
	const availableColumns = Object.entries(columnLabels).filter(([key]) => !excludeColumns.includes(key));

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">{description}</p>

					<div className="space-y-3">
						{availableColumns.map(([key, label]) => (
							<div key={key} className="flex items-center space-x-2">
								<Checkbox
									id={key}
									checked={visibleColumns.includes(key)}
									onCheckedChange={() => onColumnToggle(key)}
								/>
								<label
									htmlFor={key}
									className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
								>
									{label}
								</label>
							</div>
						))}
					</div>

					<div className="flex justify-end gap-2 pt-4">
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Close
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
