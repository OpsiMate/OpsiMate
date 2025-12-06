import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { getTagKeyColumnId, TagKeyInfo } from '@/types';

export interface ColumnSettingsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	visibleColumns: string[];
	onColumnToggle: (column: string) => void;
	columnLabels: Record<string, string>;
	title?: string;
	description?: string;
	excludeColumns?: string[];
	tagKeys?: TagKeyInfo[];
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
	tagKeys = [],
}: ColumnSettingsModalProps) => {
	const availableColumns = Object.entries(columnLabels).filter(([key]) => !excludeColumns.includes(key));

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="text-foreground">{title}</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<p className="text-sm text-foreground">{description}</p>

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
									className="text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
								>
									{label}
								</label>
							</div>
						))}
					</div>

					{tagKeys.length > 0 && (
						<>
							<Separator />
							<div className="space-y-3">
								<p className="text-sm font-medium text-foreground">Alert Tags</p>
								<p className="text-xs text-muted-foreground">
									Enable tag fields to show them as columns, filters, and grouping options.
								</p>
								{tagKeys.map((tagKey) => {
									const columnId = getTagKeyColumnId(tagKey.key);
									return (
										<div key={columnId} className="flex items-center space-x-2">
											<Checkbox
												id={columnId}
												checked={visibleColumns.includes(columnId)}
												onCheckedChange={() => onColumnToggle(columnId)}
											/>
											<label
												htmlFor={columnId}
												className="text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
											>
												{tagKey.label}
											</label>
										</div>
									);
								})}
							</div>
						</>
					)}

					<div className="flex justify-end gap-2 pt-4">
						<Button onClick={() => onOpenChange(false)}>Close</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
