import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert } from '@OpsiMate/shared';
import { Archive, Check, RotateCcw, Trash2 } from 'lucide-react';

interface AlertActionsSectionProps {
	alert: Alert;
	isActive: boolean;
	onDismiss?: (alertId: string) => void;
	onUndismiss?: (alertId: string) => void;
	onDelete?: (alertId: string) => void;
}

export const AlertActionsSection = ({
	alert,
	isActive,
	onDismiss,
	onUndismiss,
	onDelete,
}: AlertActionsSectionProps) => {
	return (
		<>
			<Separator />
			{isActive ? (
				<div className="space-y-2">
					{alert.isDismissed ? (
						<Button
							variant="outline"
							size="sm"
							className="w-full justify-start gap-2"
							onClick={() => onUndismiss?.(alert.id)}
						>
							<RotateCcw className="h-3 w-3" />
							Undismiss Alert
						</Button>
					) : (
						<Button
							variant="outline"
							size="sm"
							className="w-full justify-start gap-2"
							onClick={() => onDismiss?.(alert.id)}
						>
							<Check className="h-3 w-3" />
							Dismiss Alert
						</Button>
					)}
					<Button
						variant="outline"
						size="sm"
						className="w-full justify-start gap-2"
						onClick={() => onDelete?.(alert.id)}
					>
						<Archive className="h-3 w-3" />
						Archive Alert
					</Button>
				</div>
			) : (
				<div className="space-y-2">
					<Button
						variant="destructive"
						size="sm"
						className="w-full justify-start gap-2"
						onClick={() => onDelete?.(alert.id)}
					>
						<Trash2 className="h-3 w-3" />
						Delete Alert
					</Button>
				</div>
			)}
		</>
	);
};
