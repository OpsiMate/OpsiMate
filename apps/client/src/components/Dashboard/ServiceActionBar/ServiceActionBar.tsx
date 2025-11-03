import { ActionButtons } from '@/components/ActionButtons';
import { Service } from '../../ServiceTable';

interface ServiceActionBarProps {
	selectedService: Service | null;
	selectedServices: Service[];
	onStart: () => Promise<void>;
	onStop: () => Promise<void>;
	onRestart: () => Promise<void>;
}

export const ServiceActionBar = ({
	selectedService,
	selectedServices,
	onStart,
	onStop,
	onRestart,
}: ServiceActionBarProps) => {
	return (
		<div className="flex-shrink-0 p-2 border-t border-border">
			<ActionButtons
				selectedService={selectedService}
				selectedServices={selectedServices}
				onStart={onStart}
				onStop={onStop}
				onRestart={onRestart}
			/>
		</div>
	);
};
