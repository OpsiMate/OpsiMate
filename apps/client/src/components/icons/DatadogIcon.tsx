import { cn } from '@/lib/utils';

interface DatadogIconProps {
	className?: string;
}

// Datadog logo using the official PNG asset.
// We wrap it in a component so sizing is controlled by Tailwind classes.
export const DatadogIcon = ({ className }: DatadogIconProps) => {
	return (
		<img
			src="https://imgix.datadoghq.com/img/dd_logo_n_70x75.png"
			alt="Datadog"
			className={cn('h-full w-full object-contain', className)}
		/>
	);
};
