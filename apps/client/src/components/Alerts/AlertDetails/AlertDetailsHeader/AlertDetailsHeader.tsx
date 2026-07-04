import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { ReactNode } from 'react';

interface AlertDetailsHeaderProps {
	onClose: () => void;
	className?: string;
	// Extra header controls rendered just before the close button.
	actions?: ReactNode;
}

export const AlertDetailsHeader = ({ onClose, className, actions }: AlertDetailsHeaderProps) => {
	return (
		<div className={cn('flex items-center justify-between p-4 border-b', className)}>
			<h2 className="text-lg font-semibold text-foreground">Alert Details</h2>
			<div className="flex items-center gap-0.5">
				{actions}
				<Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-foreground">
					<X className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
};
