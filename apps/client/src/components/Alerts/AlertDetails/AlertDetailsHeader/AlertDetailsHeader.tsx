import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface AlertDetailsHeaderProps {
	onClose: () => void;
}

export const AlertDetailsHeader = ({ onClose }: AlertDetailsHeaderProps) => {
	return (
		<div className="flex items-center justify-between p-4 border-b">
			<h2 className="text-lg font-semibold text-foreground">Alert Details</h2>
			<Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-foreground">
				<X className="h-4 w-4" />
			</Button>
		</div>
	);
};
