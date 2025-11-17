import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface TableSettingsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	visibleColumns: Record<string, boolean>;
	onColumnToggle: (column: string) => void;
	customFields?: Array<{ id: number; name: string }>;
}

const columnLabels = {
	name: 'Service Name',
	serviceIP: 'Service IP',
	serviceStatus: 'Status',
	provider: 'Provider',
	containerDetails: 'Container Details',
	alerts: 'Alerts',
};

export const TableSettingsModal = ({
	open,
	onOpenChange,
	visibleColumns,
	onColumnToggle,
	customFields = [],
}: TableSettingsModalProps) => {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Table Settings</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">
						Select which columns to display in the services table.
					</p>

					<div className="space-y-3">
						{/* Native Columns */}
						{Object.entries(columnLabels).map(([key, label]) => (
							<div key={key} className="flex items-center space-x-2">
								<Checkbox
									id={key}
									checked={visibleColumns[key]}
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

						{/* Custom Fields */}
						{customFields.length > 0 && (
							<>
								<div className="border-t pt-3 mt-3">
									<h4 className="text-sm font-semibold text-muted-foreground mb-2">Custom Fields</h4>
								</div>
								{customFields.map((field) => (
									<div key={`custom-${field.id}`} className="flex items-center space-x-2">
										<Checkbox
											id={`custom-${field.id}`}
											checked={visibleColumns[`custom-${field.id}`] || false}
											onCheckedChange={() => onColumnToggle(`custom-${field.id}`)}
										/>
										<label
											htmlFor={`custom-${field.id}`}
											className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
										>
											{field.name}
										</label>
									</div>
								))}
							</>
						)}
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
