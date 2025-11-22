import { Button } from '@/components/ui/button';
import { Play, RotateCcw, Square } from 'lucide-react';

interface ServiceActionButtonsProps {
	isDisabled: boolean;
	onStart: () => void;
	onStop: () => void;
	onRestart: () => void;
}

export const ServiceActionButtons = ({ isDisabled, onStart, onStop, onRestart }: ServiceActionButtonsProps) => {
	return (
		<div className="flex flex-wrap gap-2">
			<Button variant="outline" size="sm" disabled={isDisabled} onClick={onStart} className="gap-2 h-9">
				<Play className="h-4 w-4" />
				Start
			</Button>

			<Button variant="outline" size="sm" disabled={isDisabled} onClick={onStop} className="gap-2 h-9">
				<Square className="h-4 w-4" />
				Stop
			</Button>

			<Button variant="outline" size="sm" disabled={isDisabled} onClick={onRestart} className="gap-2 h-9">
				<RotateCcw className="h-4 w-4" />
				Restart
			</Button>
		</div>
	);
};
