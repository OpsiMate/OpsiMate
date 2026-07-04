import { cn } from '@/lib/utils';

interface DatadogIconProps {
	className?: string;
}

// Datadog logo using the official PNG asset, served locally so it also renders in
// air-gapped deployments. We wrap it in a component so sizing is controlled by
// Tailwind classes.
export const DatadogIcon = ({ className }: DatadogIconProps) => {
	return (
		<img src="/images/logos/datadog.png" alt="Datadog" className={cn('h-full w-full object-contain', className)} />
	);
};
