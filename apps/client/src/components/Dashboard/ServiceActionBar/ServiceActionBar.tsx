import { CustomAction } from '@OpsiMate/custom-actions';
import { Service } from '../../ServiceTable';
import { ActionButtons } from '../ActionButtons';

interface ServiceActionBarProps {
	selectedService: Service | null;
	selectedServices: Service[];
	onStart: () => Promise<void>;
	onStop: () => Promise<void>;
	onRestart: () => Promise<void>;
	onRunAction?: (action: CustomAction) => Promise<void>;
	isRunningAction?: boolean;
}

export const ServiceActionBar = ({
	selectedService,
	selectedServices,
	onStart,
	onStop,
	onRestart,
	onRunAction,
	isRunningAction = false,
}: ServiceActionBarProps) => {
	return (
		<div className="flex-shrink-0 p-2 border-t border-border">
			<ActionButtons
				selectedService={selectedService}
				selectedServices={selectedServices}
				onStart={onStart}
				onStop={onStop}
				onRestart={onRestart}
				onRunAction={onRunAction}
				isRunningAction={isRunningAction}
			/>
		</div>
	);
};
