import { Button } from '@/components/ui/button';
import { Alert } from '@OpsiMate/shared';

export interface AlertsSelectionBarProps {
	selectedAlerts: Alert[];
	onClearSelection: () => void;
	onDismissAll: () => void;
}

export const AlertsSelectionBar = ({ selectedAlerts, onClearSelection, onDismissAll }: AlertsSelectionBarProps) => {
	if (selectedAlerts.length === 0) {
		return null;
	}

	const allNotDismissed = selectedAlerts.every((alert) => !alert.isDismissed);

	return (
		<div className="mt-4 p-3 bg-muted rounded-lg flex items-center justify-between">
			<span className="text-sm font-medium">
				{selectedAlerts.length} alert{selectedAlerts.length !== 1 ? 's' : ''} selected
			</span>
			<div className="flex items-center gap-2">
				<Button variant="outline" size="sm" onClick={onClearSelection}>
					Clear selection
				</Button>
				{allNotDismissed && (
					<Button variant="outline" size="sm" onClick={onDismissAll}>
						Dismiss all
					</Button>
				)}
			</div>
		</div>
	);
};
