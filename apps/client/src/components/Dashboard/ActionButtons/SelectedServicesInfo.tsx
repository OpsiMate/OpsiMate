import { Service } from '@/components/ServiceTable';

interface SelectedServicesInfoProps {
	selectedServices: Service[];
}

export const SelectedServicesInfo = ({ selectedServices }: SelectedServicesInfoProps) => {
	return (
		<div className="text-sm font-medium px-1">
			{selectedServices.length > 0 ? (
				<span>
					Selected:{' '}
					<span className="text-primary">
						{selectedServices.length} service{selectedServices.length !== 1 ? 's' : ''}
					</span>
					{selectedServices.length === 1 && (
						<span className="text-muted-foreground">({selectedServices[0].name})</span>
					)}
				</span>
			) : (
				<span className="text-muted-foreground">No services selected</span>
			)}
		</div>
	);
};
