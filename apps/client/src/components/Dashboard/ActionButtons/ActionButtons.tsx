import { canOperate } from '@/lib/permissions.ts';
import { CustomAction } from '@OpsiMate/custom-actions';
import { Service } from '@/components/ServiceTable';
import { CustomActionSelector } from '../CustomActionSelector';
import { SelectedServicesInfo } from './SelectedServicesInfo';
import { ServiceActionButtons } from './ServiceActionButtons';

interface ActionButtonsProps {
	selectedService: Service | null;
	selectedServices: Service[];
	onStart: () => void;
	onStop: () => void;
	onRestart: () => void;
	onRunAction?: (action: CustomAction) => void;
	isRunningAction?: boolean;
}

export const ActionButtons = ({
	selectedServices,
	onStart,
	onStop,
	onRestart,
	onRunAction,
	isRunningAction = false,
}: ActionButtonsProps) => {
	const isDisabled = selectedServices.length === 0;
	if (!canOperate()) return null;

	return (
		<div className="bg-card border-t border-border p-3 shadow-sm">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
				<SelectedServicesInfo selectedServices={selectedServices} />

				<div className="flex flex-wrap gap-2">
					<ServiceActionButtons
						isDisabled={isDisabled}
						onStart={onStart}
						onStop={onStop}
						onRestart={onRestart}
					/>

					{onRunAction && selectedServices.length === 1 && (
						<CustomActionSelector
							onSelectAction={onRunAction}
							disabled={isDisabled}
							isRunning={isRunningAction}
						/>
					)}
				</div>
			</div>
		</div>
	);
};
