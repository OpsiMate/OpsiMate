import { cn } from '@/lib/utils';

interface ZabbixIconProps {
	className?: string;
}

// Zabbix logo using official colors (red #D40000)
export const ZabbixIcon = ({ className }: ZabbixIconProps) => {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			className={cn('h-full w-full', className)}
		>
			<path
				fill="#D40000"
				d="M4.5 3h15A1.5 1.5 0 0 1 21 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-15A1.5 1.5 0 0 1 4.5 3z"
			/>
			<path
				fill="#FFFFFF"
				d="M7 7h10v2H9.8l7.2 6v2H7v-2h7.2L7 9V7z"
			/>
		</svg>
	);
};
